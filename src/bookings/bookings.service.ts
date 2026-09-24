import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { plainToInstance } from 'class-transformer';
import { isURL } from 'class-validator';
import { LessThan, MoreThan, Repository } from 'typeorm';

import { EXCEPTION_RESPONSE } from '../config/errors/exception-response.config';
import { Contract } from '../contracts/entities/contract.entity';
import { BookingDetailDto } from './dto/booking-detail.dto';
import { CreateBookingDto } from './dto/create-booking.dto';
import { RescheduleBookingDto } from './dto/reschedule-booking.dto';
import { Booking } from './entities/booking.entity';
import { BOOKING_PURPOSE } from './constants/booking_purpose.enum';
import { BOOKING_STATUS } from './constants/booking_status.enum';

/** Postgres unique-violation error code. */
const POSTGRES_UNIQUE_VIOLATION = '23505';

@Injectable()
export class BookingsService {
  private readonly _logger = new Logger(BookingsService.name);

  constructor(
    @InjectRepository(Booking)
    private bookingsRepository: Repository<Booking>,
    @InjectRepository(Contract)
    private contractsRepository: Repository<Contract>,
  ) {}

  async create(dto: CreateBookingDto): Promise<BookingDetailDto> {
    this.assertExactSchedule(dto.scheduleType);
    this.assertServiceRange(dto.serviceStartsAt, dto.serviceEndsAt);
    this.assertMapsUrl(dto.mapsUrl);

    const contract = await this.resolveContract(dto.contractId);

    await this.assertNoOverlap(dto.serviceStartsAt, dto.serviceEndsAt);
    await this.assertNoDuplicateEventBooking(
      dto.purpose ?? null,
      dto.contractId ?? null,
    );

    try {
      const bookingToSave = this.bookingsRepository.create({
        status: BOOKING_STATUS.CONFIRMED,
        purpose: dto.purpose ?? null,
        eventDate: dto.eventDate,
        serviceStartsAt: dto.serviceStartsAt,
        serviceEndsAt: dto.serviceEndsAt,
        title: dto.title ?? null,
        venueName: dto.venueName ?? null,
        mapsUrl: dto.mapsUrl ?? null,
        contractId: dto.contractId ?? null,
      });
      const saved = await this.bookingsRepository.save(bookingToSave);
      saved.contract = contract;
      return this.toDetail(saved);
    } catch (error) {
      if (this.isDuplicateEventBookingViolation(error)) {
        throw new ConflictException(
          EXCEPTION_RESPONSE.BOOKING_CONTRACT_ALREADY_HAS_EVENT,
        );
      }
      this._logger.error(error, 'Error creating booking');
      throw error;
    }
  }

  /** A booking with no `contractId` has no contract to validate. */
  private async resolveContract(
    contractId?: number,
  ): Promise<Contract | null> {
    if (contractId == null) {
      return null;
    }

    const contract = await this.contractsRepository.findOneBy({
      id: contractId,
    });

    if (!contract) {
      throw new NotFoundException(EXCEPTION_RESPONSE.CONTRACT_NOT_FOUND);
    }

    return contract;
  }

  async findDetailById(id: number): Promise<BookingDetailDto> {
    const booking = await this.bookingsRepository.findOne({
      where: { id },
      relations: ['contract'],
    });

    if (!booking) {
      throw new NotFoundException(EXCEPTION_RESPONSE.BOOKING_NOT_FOUND);
    }

    return this.toDetail(booking);
  }

  /**
   * Replaces a booking's schedule and metadata; `status` and `contractId`
   * are never touched, so a contract-linked booking keeps its contract.
   * Optional fields (`title`, `purpose`, `venueName`, `mapsUrl`)
   * omitted from the payload CLEAR the stored value (set to `null`) rather
   * than leaving it untouched: the frontend always sends the full payload
   * (see `odd/tasks/booking-agenda.md`), so "missing" unambiguously means
   * "cleared", matching how `create` already treats these fields.
   */
  async reschedule(
    id: number,
    dto: RescheduleBookingDto,
  ): Promise<BookingDetailDto> {
    this.assertExactSchedule(dto.scheduleType);
    this.assertServiceRange(dto.serviceStartsAt, dto.serviceEndsAt);
    this.assertMapsUrl(dto.mapsUrl);

    const booking = await this.bookingsRepository.findOne({
      where: { id },
      relations: ['contract'],
    });

    if (!booking) {
      throw new NotFoundException(EXCEPTION_RESPONSE.BOOKING_NOT_FOUND);
    }

    await this.assertNoDuplicateEventBooking(
      dto.purpose ?? null,
      booking.contractId,
      booking.id,
    );

    try {
      booking.eventDate = dto.eventDate;
      booking.serviceStartsAt = dto.serviceStartsAt;
      booking.serviceEndsAt = dto.serviceEndsAt;
      booking.title = dto.title ?? null;
      booking.purpose = dto.purpose ?? null;
      booking.venueName = dto.venueName ?? null;
      booking.mapsUrl = dto.mapsUrl ?? null;

      const saved = await this.bookingsRepository.save(booking);
      return this.toDetail(saved);
    } catch (error) {
      if (this.isDuplicateEventBookingViolation(error)) {
        throw new ConflictException(
          EXCEPTION_RESPONSE.BOOKING_CONTRACT_ALREADY_HAS_EVENT,
        );
      }
      this._logger.error(error, 'Error rescheduling booking');
      throw error;
    }
  }

  private toDetail(booking: Booking): BookingDetailDto {
    return plainToInstance(BookingDetailDto, booking, {
      excludeExtraneousValues: true,
    });
  }

  private assertExactSchedule(scheduleType: string): void {
    if (scheduleType !== 'exact') {
      throw new BadRequestException('scheduleType must be "exact"');
    }
  }

  private assertServiceRange(serviceStartsAt: Date, serviceEndsAt: Date): void {
    if (serviceEndsAt.getTime() <= serviceStartsAt.getTime()) {
      throw new BadRequestException(
        'serviceEndsAt must be after serviceStartsAt',
      );
    }
  }

  /**
   * Rejects a new range that overlaps any existing booking, using the
   * half-open comparison `newStart < existingEnd && existingStart < newEnd`:
   * a booking ending exactly when another starts is not a conflict. Overlap
   * is checked globally, regardless of `purpose` or `venueName`, because the
   * resource being scheduled is the two operators, not a venue.
   *
   * Only `create` calls this. `reschedule` deliberately keeps allowing
   * overlap: a morning event routinely redefines its end so the afternoon
   * team can arrive early, and services habitually arrive at the tail of the
   * previous booking.
   */
  private async assertNoOverlap(
    serviceStartsAt: Date,
    serviceEndsAt: Date,
  ): Promise<void> {
    const conflicts = await this.bookingsRepository.find({
      where: {
        serviceStartsAt: LessThan(serviceEndsAt),
        serviceEndsAt: MoreThan(serviceStartsAt),
      },
      order: { serviceStartsAt: 'ASC' },
    });

    if (conflicts.length > 0) {
      throw new ConflictException({
        ...EXCEPTION_RESPONSE.BOOKING_OVERLAP,
        conflicts: conflicts.map((conflict) => ({
          id: conflict.id,
          title: conflict.title,
          serviceStartsAt: conflict.serviceStartsAt,
          serviceEndsAt: conflict.serviceEndsAt,
        })),
      });
    }
  }

  /**
   * At most one EVENT booking per contract (`UQ_bookings_contract_event`,
   * see `odd/tasks/event-fields-deprecation.md`). A booking with no contract
   * is unrestricted. On `reschedule`, `excludeBookingId` lets the EVENT
   * booking being updated keep its own purpose.
   */
  private async assertNoDuplicateEventBooking(
    purpose: BOOKING_PURPOSE | null,
    contractId: number | null,
    excludeBookingId?: number,
  ): Promise<void> {
    if (purpose !== BOOKING_PURPOSE.EVENT || contractId == null) {
      return;
    }

    const existing = await this.bookingsRepository.findOne({
      where: { contractId, purpose: BOOKING_PURPOSE.EVENT },
    });

    if (existing && existing.id !== excludeBookingId) {
      throw new ConflictException(
        EXCEPTION_RESPONSE.BOOKING_CONTRACT_ALREADY_HAS_EVENT,
      );
    }
  }

  /**
   * Translates a race on `UQ_bookings_contract_event` (two concurrent
   * requests both passing the pre-save check) into the same 409 the
   * pre-save check throws, instead of leaking a raw Postgres error.
   */
  private isDuplicateEventBookingViolation(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      (error as { code?: string }).code === POSTGRES_UNIQUE_VIOLATION &&
      (error as { constraint?: string }).constraint ===
        'UQ_bookings_contract_event'
    );
  }

  private assertMapsUrl(mapsUrl?: string | null): void {
    if (
      mapsUrl != null &&
      !isURL(mapsUrl, { protocols: ['http', 'https'], require_protocol: true })
    ) {
      throw new BadRequestException('mapsUrl must be a valid http/https URL');
    }
  }
}
