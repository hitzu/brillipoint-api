import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { plainToInstance } from 'class-transformer';
import { isURL } from 'class-validator';
import { Repository } from 'typeorm';

import { EXCEPTION_RESPONSE } from '../config/errors/exception-response.config';
import { Contract } from '../contracts/entities/contract.entity';
import { BookingDetailDto } from './dto/booking-detail.dto';
import { CreateBookingDto } from './dto/create-booking.dto';
import { RescheduleBookingDto } from './dto/reschedule-booking.dto';
import { Booking } from './entities/booking.entity';
import { BOOKING_STATUS } from './constants/booking_status.enum';

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

  private assertMapsUrl(mapsUrl?: string | null): void {
    if (
      mapsUrl != null &&
      !isURL(mapsUrl, { protocols: ['http', 'https'], require_protocol: true })
    ) {
      throw new BadRequestException('mapsUrl must be a valid http/https URL');
    }
  }
}
