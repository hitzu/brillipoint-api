import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

/**
 * Public occupancy entry for `GET /bookings/calendar` (endpoint #8 in
 * `odd/tasks/booking-agenda.md`, used by the public expo page). This is a
 * DELIBERATELY narrow type, not `ScheduleAgendaEntryDto` with fields
 * stripped at runtime: it structurally cannot carry `id`, `contractId`,
 * `sku`, `clientName`, `title`, `venueName`, `purpose`, `status`, `type`,
 * `eventDate`, `serviceStartsAt` or `serviceEndsAt`, so a future field added
 * to the staff agenda entry cannot leak here by accident.
 */
export class BookingCalendarEntryDto {
  @ApiProperty({ description: "This day's clipped slice of the interval" })
  segmentStartsAt!: Date;

  @ApiProperty({ description: "This day's clipped slice of the interval" })
  segmentEndsAt!: Date;

  @ApiProperty({ description: 'Uncut interval start, identical on every segment' })
  startsAt!: Date;

  @ApiProperty({ description: 'Uncut interval end, identical on every segment' })
  endsAt!: Date;

  @ApiProperty()
  continuesFromPreviousDay!: boolean;

  @ApiProperty()
  continuesNextDay!: boolean;
}

export class BookingCalendarDayDto {
  @ApiProperty({ description: 'Calendar day in YYYY-MM-DD format' })
  date!: string;

  @ApiProperty({ type: BookingCalendarEntryDto, isArray: true })
  @Type(() => BookingCalendarEntryDto)
  entries!: BookingCalendarEntryDto[];
}

export class BookingCalendarResponseDto {
  @ApiProperty({
    type: BookingCalendarDayDto,
    isArray: true,
    description:
      'Every civil day of the queried month, including days with no entries.',
  })
  @Type(() => BookingCalendarDayDto)
  days!: BookingCalendarDayDto[];
}
