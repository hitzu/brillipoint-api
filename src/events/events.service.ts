import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { plainToInstance } from 'class-transformer';
import { PinoLogger } from 'nestjs-pino';
import { randomUUID } from 'node:crypto';
import { In, QueryFailedError, Repository } from 'typeorm';
import { EXCEPTION_RESPONSE } from '../config/errors/exception-response.config';
import { isUniqueViolation } from '../config/errors/exceptions-handler';
import { Booking } from '../bookings/entities/booking.entity';
import { BOOKING_PURPOSE } from '../bookings/constants/booking_purpose.enum';
import { CreateEventDto } from './dto/create-event.dto';
import { EventResponseDto } from './dto/event-response.dto';
import { EventV2ResponseDto } from './dto/v2/event-v2-response.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { Event } from './entities/event.entity';

const PUBLIC_EVENT_FINISHED_AFTER_DAYS = 30;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

@Injectable()
export class EventsService {
  constructor(
    @InjectRepository(Event)
    private readonly eventRepository: Repository<Event>,
    @InjectRepository(Booking)
    private readonly bookingRepository: Repository<Booking>,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(EventsService.name);
  }

  async create(dto: CreateEventDto): Promise<EventResponseDto> {
    if (
      dto.serviceStartsAt != null &&
      dto.serviceEndsAt != null &&
      dto.serviceEndsAt.getTime() <= dto.serviceStartsAt.getTime()
    ) {
      throw new BadRequestException(
        'serviceEndsAt must be after serviceStartsAt',
      );
    }

    const existing = await this.eventRepository.findOne({
      where: { key: dto.key },
    });
    if (existing) {
      throw new ConflictException(EXCEPTION_RESPONSE.EVENT_KEY_ALREADY_EXISTS);
    }
    const existingForContract = await this.eventRepository.findOne({
      where: { contractId: dto.contractId },
    });
    if (existingForContract) {
      throw new ConflictException(
        EXCEPTION_RESPONSE.EVENT_CONTRACT_ALREADY_HAS_EVENT,
      );
    }
    const token = randomUUID();
    const entity = this.eventRepository.create({
      contractId: dto.contractId,
      key: dto.key,
      token,
      eventTypeId: dto.eventTypeId ?? null,
      serviceTypeId: dto.serviceTypeId ?? null,
      honoreesNames: dto.honoreesNames ?? null,
      albumPhrase: dto.albumPhrase ?? null,
      venueName: dto.venueName ?? null,
      serviceLocationUrl: dto.serviceLocationUrl ?? null,
      serviceStartsAt: dto.serviceStartsAt ?? null,
      serviceEndsAt: dto.serviceEndsAt ?? null,
      delegateName: dto.delegateName ?? null,
      eventThemeId: dto.eventThemeId ?? null,
      printTemplate: dto.printTemplate ?? 'polaroid_2',
      printTemplates: dto.printTemplates ?? null,
    });
    let saved: Event;
    try {
      saved = await this.eventRepository.save(entity);
    } catch (error) {
      this.logger.error(error, 'Error creating event');
      if (
        isUniqueViolation(error) &&
        error instanceof QueryFailedError &&
        String(error.driverError?.detail ?? '').includes('(contract_id)')
      ) {
        throw new ConflictException(
          EXCEPTION_RESPONSE.EVENT_CONTRACT_ALREADY_HAS_EVENT,
        );
      }
      throw error;
    }
    return plainToInstance(EventResponseDto, saved, {
      excludeExtraneousValues: true,
    });
  }

  async getByToken(token: string): Promise<EventResponseDto> {
    const event = await this.eventRepository.findOne({ where: { token }, relations: { eventTheme: true } });
    if (!event) {
      throw new NotFoundException(EXCEPTION_RESPONSE.EVENT_NOT_FOUND);
    }
    return plainToInstance(EventResponseDto, event, {
      excludeExtraneousValues: true,
    });
  }

  async getById(id: number): Promise<EventResponseDto> {
    const event = await this.eventRepository.findOne({
      where: { id },
      relations: { eventTheme: true },
    });
    if (!event) {
      throw new NotFoundException(EXCEPTION_RESPONSE.EVENT_NOT_FOUND);
    }
    return plainToInstance(EventResponseDto, event, {
      excludeExtraneousValues: true,
    });
  }

  async getByKey(key: string): Promise<EventResponseDto> {
    const event = await this.eventRepository.findOne({ where: { key }, relations: { eventTheme: true, serviceType: true } });
    if (!event) {
      throw new NotFoundException(EXCEPTION_RESPONSE.EVENT_NOT_FOUND);
    }

    console.log('eventeeeeee', event)
    return plainToInstance(EventResponseDto, event, {
      excludeExtraneousValues: true,
    });
  }

  async list(): Promise<EventResponseDto[]> {
    const events = await this.eventRepository.find({
      order: { createdAt: 'DESC' },
    });
    return events.map((event) =>
      plainToInstance(EventResponseDto, event, {
        excludeExtraneousValues: true,
      }),
    );
  }

  async update(id: number, dto: UpdateEventDto): Promise<EventResponseDto> {
    const event = await this.eventRepository.findOne({ where: { id } });
    if (!event) {
      throw new NotFoundException(EXCEPTION_RESPONSE.EVENT_NOT_FOUND);
    }
    const serviceStartsAt = dto.serviceStartsAt ?? event.serviceStartsAt;
    const serviceEndsAt = dto.serviceEndsAt ?? event.serviceEndsAt;
    if (
      serviceStartsAt != null &&
      serviceEndsAt != null &&
      serviceEndsAt.getTime() <= serviceStartsAt.getTime()
    ) {
      throw new BadRequestException(
        'serviceEndsAt must be after serviceStartsAt',
      );
    }
    Object.assign(event, dto);
    const saved = await this.eventRepository.save(event);
    return plainToInstance(EventResponseDto, saved, {
      excludeExtraneousValues: true,
    });
  }

  async findOneByToken(token: string): Promise<Event> {
    const event = await this.eventRepository.findOne({ where: { token } });
    if (!event) {
      throw new NotFoundException(EXCEPTION_RESPONSE.EVENT_NOT_FOUND);
    }
    return event;
  }

  async findActive(): Promise<Event | null> {
    const now = new Date();
    const cutoff = new Date(now.getTime() - 5 * 60 * 60 * 1000);
    return this.eventRepository
      .createQueryBuilder('event')
      .where('event.serviceStartsAt <= :now', { now })
      .andWhere('event.serviceEndsAt >= :cutoff', { cutoff })
      .getOne();
  }

  /**
   * `finished` when the contract has no EVENT booking, or when the
   * booking's `serviceStartsAt` is more than 30 days in the past;
   * `active` otherwise. See "Phase 1b" in
   * `odd/tasks/event-fields-deprecation.md`: the booking is the only
   * source of schedule/status — there is no event-field fallback.
   */
  getPublicEventStatus(
    booking: { serviceStartsAt: Date } | null,
    now: Date = new Date(),
  ): 'finished' | 'active' {
    if (booking == null) {
      return 'finished';
    }

    const finishedAt = new Date(
      booking.serviceStartsAt.getTime() + PUBLIC_EVENT_FINISHED_AFTER_DAYS * MS_PER_DAY,
    );

    return now.getTime() > finishedAt.getTime() ? 'finished' : 'active';
  }

  /** Single (non-soft-deleted) EVENT booking for a contract, or null. */
  async findEventBooking(contractId: number): Promise<Booking | null> {
    return this.bookingRepository.findOne({
      where: { contractId, purpose: BOOKING_PURPOSE.EVENT },
    });
  }

  // ─── v2 read model ─────────────────────────────────────────────────────
  // Schedule/venue/mapsUrl come only from the contract's EVENT booking; an
  // event with no EVENT booking has null schedule/location and is always
  // `finished`. See `odd/tasks/event-fields-deprecation.md`, "Phase 1b".

  async getByTokenV2(token: string): Promise<EventV2ResponseDto> {
    const event = await this.eventRepository.findOne({
      where: { token },
      relations: { eventTheme: true },
    });
    if (!event) {
      throw new NotFoundException(EXCEPTION_RESPONSE.EVENT_NOT_FOUND);
    }
    const booking = await this.findEventBooking(event.contractId);
    return this.toEventV2ResponseDto(event, booking);
  }

  async getByIdV2(id: number): Promise<EventV2ResponseDto> {
    const event = await this.eventRepository.findOne({
      where: { id },
      relations: { eventTheme: true },
    });
    if (!event) {
      throw new NotFoundException(EXCEPTION_RESPONSE.EVENT_NOT_FOUND);
    }
    const booking = await this.findEventBooking(event.contractId);
    return this.toEventV2ResponseDto(event, booking);
  }

  async getByKeyV2(key: string): Promise<EventV2ResponseDto> {
    const event = await this.eventRepository.findOne({
      where: { key },
      relations: { eventTheme: true },
    });
    if (!event) {
      throw new NotFoundException(EXCEPTION_RESPONSE.EVENT_NOT_FOUND);
    }
    const booking = await this.findEventBooking(event.contractId);
    return this.toEventV2ResponseDto(event, booking);
  }

  async listV2(): Promise<EventV2ResponseDto[]> {
    const events = await this.eventRepository.find({
      order: { createdAt: 'DESC' },
      relations: { eventTheme: true },
    });
    const bookingsByContractId = await this.findEventBookingsForContracts(
      events.map((event) => event.contractId),
    );
    return events.map((event) =>
      this.toEventV2ResponseDto(event, bookingsByContractId.get(event.contractId) ?? null),
    );
  }

  /** Batched lookup to avoid N+1 when resolving a list of events. */
  private async findEventBookingsForContracts(
    contractIds: number[],
  ): Promise<Map<number, Booking>> {
    const uniqueContractIds = [...new Set(contractIds)];
    if (uniqueContractIds.length === 0) {
      return new Map();
    }
    const bookings = await this.bookingRepository.find({
      where: { contractId: In(uniqueContractIds), purpose: BOOKING_PURPOSE.EVENT },
    });
    return new Map(bookings.map((booking) => [booking.contractId as number, booking]));
  }

  private toEventV2ResponseDto(
    event: Event,
    booking: Booking | null,
  ): EventV2ResponseDto {
    return plainToInstance(
      EventV2ResponseDto,
      {
        ...event,
        serviceStartsAt: booking?.serviceStartsAt ?? null,
        serviceEndsAt: booking?.serviceEndsAt ?? null,
        venueName: booking?.venueName ?? null,
        mapsUrl: booking?.mapsUrl ?? null,
        bookingId: booking?.id ?? null,
        status: this.getPublicEventStatus(booking),
      },
      { excludeExtraneousValues: true },
    );
  }
}
