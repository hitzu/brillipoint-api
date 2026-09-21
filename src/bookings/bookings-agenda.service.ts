import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import {
  BookingCalendarDayDto,
  BookingCalendarEntryDto,
  BookingCalendarResponseDto,
} from './dto/booking-calendar.dto';
import {
  ScheduleAgendaDayDto,
  ScheduleAgendaEntryDto,
  ScheduleAgendaResponseDto,
} from './dto/schedule-agenda.dto';
import { ScheduleAgendaQueryDto } from './dto/schedule-agenda-query.dto';
import { Booking } from './entities/booking.entity';
import { BOOKING_STATUS } from './constants/booking_status.enum';
import {
  DaySegment,
  localDateOf,
  localMidnightOfDate,
  splitIntoDaySegments,
} from './schedule/day-segments';

const DAY_IN_MS = 24 * 60 * 60 * 1000;

/** Maximum number of inclusive calendar days the agenda serves in one query. */
export const MAX_AGENDA_SPAN_IN_DAYS = 366;

/** Bounds of a "sane" 4-digit year for `GET /bookings/calendar` (endpoint #8). */
const MIN_SANE_YEAR = 1900;
const MAX_SANE_YEAR = 2200;

type ValidatedRange = {
  /** First queried day (inclusive). */
  from: string;
  /** First day AFTER the queried range (exclusive upper bound). */
  toExclusive: string;
  /** Number of inclusive days in [from, to]. */
  dayCount: number;
};

/**
 * Read side of the staff agenda (`GET /bookings/agenda`, endpoint #1 in
 * `odd/tasks/booking-agenda.md`). Kept out of `BookingsService`: this is a
 * read/projection concern over the bookings table, distinct from the
 * write-side use cases (`create`, `reschedule`) that service owns.
 *
 * There are no holds or blocks in this slice, so every booking already
 * carries an exact `serviceStartsAt`/`serviceEndsAt` and can be queried by
 * plain interval overlap.
 */
@Injectable()
export class BookingsAgendaService {
  constructor(
    @InjectRepository(Booking)
    private readonly bookingsRepository: Repository<Booking>,
  ) {}

  async getAgenda(
    query: ScheduleAgendaQueryDto,
  ): Promise<ScheduleAgendaResponseDto> {
    const range = this.validateRange(query);
    return this.buildAgenda(range);
  }

  /**
   * Public occupancy calendar for a whole civil month (`GET
   * /bookings/calendar`, endpoint #8 in `odd/tasks/booking-agenda.md`).
   * Reuses the same day-splitting and overlap query as the staff agenda
   * (`buildAgenda`) over the month's first-to-last civil day, then projects
   * each entry down to timing/occupancy only — no id, contract, client,
   * title, venue, purpose, status, type or event date.
   */
  async getCalendarByMonth(
    year: number,
    month: number,
  ): Promise<BookingCalendarResponseDto> {
    const range = this.validateMonth(year, month);
    const agenda = await this.buildAgenda(range);
    return this.toPublicResponse(agenda);
  }

  private async buildAgenda(
    range: ValidatedRange,
  ): Promise<ScheduleAgendaResponseDto> {
    const { from, toExclusive, dayCount } = range;
    const windowStart = localMidnightOfDate(from);
    const windowEnd = localMidnightOfDate(toExclusive);

    // Overlap, not eventDate: a booking that started the day before `from`
    // but is still running when the window opens must still be served.
    const bookings = await this.bookingsRepository
      .createQueryBuilder('booking')
      .leftJoinAndSelect('booking.contract', 'contract')
      .where('booking.status = :status', { status: BOOKING_STATUS.CONFIRMED })
      .andWhere('booking.service_starts_at < :windowEnd', {
        windowEnd: new Date(windowEnd),
      })
      .andWhere('booking.service_ends_at > :windowStart', {
        windowStart: new Date(windowStart),
      })
      .getMany();

    const entriesByDate = new Map<string, ScheduleAgendaEntryDto[]>();
    for (const booking of bookings) {
      const segments = splitIntoDaySegments(
        booking.serviceStartsAt,
        booking.serviceEndsAt,
      );
      for (const segment of segments) {
        if (segment.date < from || segment.date >= toExclusive) continue;
        const entries = entriesByDate.get(segment.date) ?? [];
        entries.push(this.toEntry(booking, segment));
        entriesByDate.set(segment.date, entries);
      }
    }

    const days: ScheduleAgendaDayDto[] = [];
    for (let offset = 0; offset < dayCount; offset += 1) {
      const date = localDateOf(windowStart + offset * DAY_IN_MS);
      const entries = (entriesByDate.get(date) ?? []).sort(
        (left, right) =>
          left.segmentStartsAt.getTime() - right.segmentStartsAt.getTime(),
      );
      days.push({ date, entries });
    }

    return { days };
  }

  private toEntry(booking: Booking, segment: DaySegment): ScheduleAgendaEntryDto {
    const contract = booking.contract ?? null;
    return {
      id: booking.id,
      date: segment.date,
      status: booking.status,
      purpose: booking.purpose,
      startsAt: segment.startsAt,
      endsAt: segment.endsAt,
      serviceStartsAt: booking.serviceStartsAt,
      serviceEndsAt: booking.serviceEndsAt,
      eventDate: booking.eventDate,
      segmentStartsAt: segment.segmentStartsAt,
      segmentEndsAt: segment.segmentEndsAt,
      continuesFromPreviousDay: segment.continuesFromPreviousDay,
      continuesNextDay: segment.continuesNextDay,
      contractId: booking.contractId,
      sku: contract?.sku ?? null,
      title: booking.title,
      clientName: contract?.clientName ?? null,
      venueName: booking.venueName,
    };
  }

  private validateRange(query: ScheduleAgendaQueryDto): ValidatedRange {
    const from = this.assertCalendarDate(query?.from, 'from');
    const to = this.assertCalendarDate(query?.to, 'to');
    const dayCount =
      (localMidnightOfDate(to) - localMidnightOfDate(from)) / DAY_IN_MS + 1;
    if (dayCount <= 0) {
      throw new BadRequestException('from must not be after to');
    }
    if (dayCount > MAX_AGENDA_SPAN_IN_DAYS) {
      throw new BadRequestException(
        `Agenda range cannot exceed ${MAX_AGENDA_SPAN_IN_DAYS} days`,
      );
    }
    return { from, toExclusive: this.shiftDate(to, 1), dayCount };
  }

  private assertCalendarDate(value: string, field: string): string {
    const invalid = new BadRequestException(
      `${field} must be a valid calendar date in YYYY-MM-DD format`,
    );
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      throw invalid;
    }
    const midnight = localMidnightOfDate(value);
    // Rejects a well shaped date that no calendar holds, such as
    // 2026-02-30, which Postgres would refuse anyway.
    if (Number.isNaN(midnight) || localDateOf(midnight) !== value) {
      throw invalid;
    }
    return value;
  }

  private shiftDate(date: string, days: number): string {
    return localDateOf(localMidnightOfDate(date) + days * DAY_IN_MS);
  }

  private validateMonth(year: number, month: number): ValidatedRange {
    if (!Number.isInteger(year) || year < MIN_SANE_YEAR || year > MAX_SANE_YEAR) {
      throw new BadRequestException(
        `year must be a 4-digit year between ${MIN_SANE_YEAR} and ${MAX_SANE_YEAR}`,
      );
    }
    if (!Number.isInteger(month) || month < 1 || month > 12) {
      throw new BadRequestException('month must be an integer between 1 and 12');
    }
    const from = `${year}-${pad2(month)}-01`;
    const dayCount = daysInMonth(year, month);
    const to = `${year}-${pad2(month)}-${pad2(dayCount)}`;
    return { from, toExclusive: this.shiftDate(to, 1), dayCount };
  }

  /**
   * Projects the staff agenda response down to timing/occupancy only. Built
   * as an explicit object literal (not `ScheduleAgendaEntryDto` with fields
   * omitted) so the private fields cannot leak here even if the staff
   * agenda entry grows new ones.
   */
  private toPublicResponse(
    agenda: ScheduleAgendaResponseDto,
  ): BookingCalendarResponseDto {
    const days: BookingCalendarDayDto[] = agenda.days.map((day) => ({
      date: day.date,
      entries: day.entries.map((entry) => this.toPublicEntry(entry)),
    }));
    return { days };
  }

  private toPublicEntry(entry: ScheduleAgendaEntryDto): BookingCalendarEntryDto {
    return {
      segmentStartsAt: entry.segmentStartsAt,
      segmentEndsAt: entry.segmentEndsAt,
      startsAt: entry.startsAt,
      endsAt: entry.endsAt,
      continuesFromPreviousDay: entry.continuesFromPreviousDay,
      continuesNextDay: entry.continuesNextDay,
    };
  }
}

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

/** Number of civil days in a given 1-based month, via UTC calendar math. */
function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}
