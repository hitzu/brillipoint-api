import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { AppDataSource as TestDataSource } from '../config/database/data-source';
import { EXCEPTION_RESPONSE } from '../config/errors/exception-response.config';
import { ContractFactory } from '../../test/factories/contracts/contract.factory';
import { BookingFactory } from '../../test/factories/bookings/booking.factory';
import { BookingsService } from './bookings.service';
import { CreateInternalBookingDto } from './dto/create-internal-booking.dto';
import { RescheduleBookingDto } from './dto/reschedule-booking.dto';
import { Booking } from './entities/booking.entity';
import { BOOKING_PURPOSE } from './constants/booking_purpose.enum';
import { BOOKING_STATUS } from './constants/booking_status.enum';
import { BOOKING_TYPE } from './constants/booking_type.enum';

describe('BookingsService', () => {
  let service: BookingsService;
  let bookingsRepository: Repository<Booking>;
  let bookingFactory: BookingFactory;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingsService,
        {
          provide: getRepositoryToken(Booking),
          useValue: TestDataSource.getRepository(Booking),
        },
      ],
    }).compile();

    service = module.get<BookingsService>(BookingsService);
    bookingsRepository = module.get<Repository<Booking>>(
      getRepositoryToken(Booking),
    );
    bookingFactory = new BookingFactory(TestDataSource);
  });

  const baseDto = (): CreateInternalBookingDto => ({
    scheduleType: 'exact',
    eventDate: '2026-10-01',
    serviceStartsAt: new Date('2026-10-01T14:00:00.000Z'),
    serviceEndsAt: new Date('2026-10-01T18:00:00.000Z'),
    title: 'Internal cleanup',
    purpose: BOOKING_PURPOSE.OTHER,
    venueName: 'Main hall',
    mapsUrl: 'https://maps.example.com/venue',
  });

  describe('createInternal', () => {
    it('creates a confirmed internal booking with no contract', async () => {
      // Arrange
      const dto = baseDto();

      // Act
      const result = await service.createInternal(dto);

      // Assert
      expect(result.id).toBeDefined();
      expect(result.status).toBe(BOOKING_STATUS.CONFIRMED);
      expect(result.eventDate).toBe('2026-10-01');
      expect(result.serviceStartsAt).toEqual(dto.serviceStartsAt);
      expect(result.serviceEndsAt).toEqual(dto.serviceEndsAt);
      expect(result.title).toBe('Internal cleanup');
      expect(result.purpose).toBe(BOOKING_PURPOSE.OTHER);
      expect(result.venueName).toBe('Main hall');
      expect(result.mapsUrl).toBe('https://maps.example.com/venue');
      expect(result.contract).toBeNull();

      const persisted = await bookingsRepository.findOneBy({ id: result.id });
      expect(persisted?.type).toBe(BOOKING_TYPE.INTERNAL);
      expect(persisted?.contractId).toBeNull();
    });

    it('creates an overnight booking whose serviceEndsAt falls on the next civil day', async () => {
      // Arrange
      const dto: CreateInternalBookingDto = {
        ...baseDto(),
        serviceStartsAt: new Date('2026-10-01T22:00:00.000Z'),
        serviceEndsAt: new Date('2026-10-02T02:00:00.000Z'),
      };

      // Act
      const result = await service.createInternal(dto);

      // Assert
      expect(result.serviceStartsAt.toISOString()).toBe(
        '2026-10-01T22:00:00.000Z',
      );
      expect(result.serviceEndsAt.toISOString()).toBe(
        '2026-10-02T02:00:00.000Z',
      );
    });

    it('rejects when serviceEndsAt is not after serviceStartsAt', async () => {
      // Arrange
      const sameInstant = new Date('2026-10-01T14:00:00.000Z');
      const dto: CreateInternalBookingDto = {
        ...baseDto(),
        serviceStartsAt: sameInstant,
        serviceEndsAt: sameInstant,
      };

      // Act + Assert
      await expect(service.createInternal(dto)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('rejects when scheduleType is not "exact"', async () => {
      // Arrange
      const dto = {
        ...baseDto(),
        scheduleType: 'approximate',
      } as unknown as CreateInternalBookingDto;

      // Act + Assert
      await expect(service.createInternal(dto)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('rejects when mapsUrl is not http/https', async () => {
      // Arrange
      const dto: CreateInternalBookingDto = {
        ...baseDto(),
        mapsUrl: 'ftp://maps.example.com/venue',
      };

      // Act + Assert
      await expect(service.createInternal(dto)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });

  describe('findDetailById', () => {
    it('returns the contract summary for a booking linked to a contract', async () => {
      // Arrange
      const contract = await new ContractFactory(TestDataSource).create();
      const booking = await bookingFactory.create({
        type: BOOKING_TYPE.COMMERCIAL,
        contractId: contract.id,
      });

      // Act
      const result = await service.findDetailById(booking.id);

      // Assert
      expect(result.contract).toEqual({
        sku: contract.sku,
        token: contract.token,
      });
    });

    it('returns contract: null for an internal booking', async () => {
      // Arrange
      const booking = await bookingFactory.create({
        type: BOOKING_TYPE.INTERNAL,
        contractId: null,
      });

      // Act
      const result = await service.findDetailById(booking.id);

      // Assert
      expect(result.contract).toBeNull();
    });

    it('throws NotFoundException when the booking does not exist', async () => {
      // Act + Assert
      await expect(service.findDetailById(999999)).rejects.toEqual(
        new NotFoundException(EXCEPTION_RESPONSE.BOOKING_NOT_FOUND),
      );
    });

    it('throws NotFoundException when the booking is soft-deleted', async () => {
      // Arrange
      const booking = await bookingFactory.create();
      await bookingsRepository.softDelete(booking.id);

      // Act + Assert
      await expect(service.findDetailById(booking.id)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('reschedule', () => {
    const rescheduleDto = (): RescheduleBookingDto => ({
      scheduleType: 'exact',
      eventDate: '2026-11-05',
      serviceStartsAt: new Date('2026-11-05T15:00:00.000Z'),
      serviceEndsAt: new Date('2026-11-05T19:00:00.000Z'),
      title: 'Rescheduled cleanup',
      purpose: BOOKING_PURPOSE.MEETING,
      venueName: 'Rear hall',
      mapsUrl: 'https://maps.example.com/rear-hall',
    });

    it('updates the schedule and metadata and returns the new detail', async () => {
      // Arrange
      const booking = await bookingFactory.create({
        eventDate: '2026-09-12',
        serviceStartsAt: new Date('2026-09-12T10:00:00.000Z'),
        serviceEndsAt: new Date('2026-09-12T18:00:00.000Z'),
        title: 'Original title',
        venueName: 'Original hall',
      });
      const dto = rescheduleDto();

      // Act
      const result = await service.reschedule(booking.id, dto);

      // Assert
      expect(result.eventDate).toBe(dto.eventDate);
      expect(result.serviceStartsAt).toEqual(dto.serviceStartsAt);
      expect(result.serviceEndsAt).toEqual(dto.serviceEndsAt);
      expect(result.title).toBe(dto.title);
      expect(result.purpose).toBe(dto.purpose);
      expect(result.venueName).toBe(dto.venueName);
      expect(result.mapsUrl).toBe(dto.mapsUrl);

      const persisted = await bookingsRepository.findOneBy({ id: booking.id });
      expect(persisted?.eventDate).toBe(dto.eventDate);
      expect(persisted?.title).toBe(dto.title);
    });

    it('reschedules to an overnight range', async () => {
      // Arrange
      const booking = await bookingFactory.create();
      const dto: RescheduleBookingDto = {
        ...rescheduleDto(),
        serviceStartsAt: new Date('2026-11-05T22:00:00.000Z'),
        serviceEndsAt: new Date('2026-11-06T02:00:00.000Z'),
      };

      // Act
      const result = await service.reschedule(booking.id, dto);

      // Assert
      expect(result.serviceStartsAt.toISOString()).toBe(
        '2026-11-05T22:00:00.000Z',
      );
      expect(result.serviceEndsAt.toISOString()).toBe(
        '2026-11-06T02:00:00.000Z',
      );
    });

    it('keeps type, status and contractId for a contract-linked booking and still returns the contract', async () => {
      // Arrange
      const contract = await new ContractFactory(TestDataSource).create();
      const booking = await bookingFactory.create({
        type: BOOKING_TYPE.COMMERCIAL,
        contractId: contract.id,
      });
      const dto = rescheduleDto();

      // Act
      const result = await service.reschedule(booking.id, dto);

      // Assert
      expect(result.contract).toEqual({
        sku: contract.sku,
        token: contract.token,
      });

      const persisted = await bookingsRepository.findOneBy({ id: booking.id });
      expect(persisted?.type).toBe(BOOKING_TYPE.COMMERCIAL);
      expect(persisted?.status).toBe(BOOKING_STATUS.CONFIRMED);
      expect(persisted?.contractId).toBe(contract.id);
    });

    it('clears optional fields omitted from the payload instead of leaving the stored value untouched', async () => {
      // Arrange
      const booking = await bookingFactory.create({
        title: 'Original title',
        venueName: 'Original hall',
        mapsUrl: 'https://maps.example.com/original',
      });
      const dto: RescheduleBookingDto = {
        scheduleType: 'exact',
        eventDate: '2026-11-05',
        serviceStartsAt: new Date('2026-11-05T15:00:00.000Z'),
        serviceEndsAt: new Date('2026-11-05T19:00:00.000Z'),
      };

      // Act
      const result = await service.reschedule(booking.id, dto);

      // Assert
      expect(result.title).toBeNull();
      expect(result.purpose).toBeNull();
      expect(result.venueName).toBeNull();
      expect(result.mapsUrl).toBeNull();
    });

    it('rejects when serviceEndsAt is not after serviceStartsAt', async () => {
      // Arrange
      const booking = await bookingFactory.create();
      const sameInstant = new Date('2026-11-05T15:00:00.000Z');
      const dto: RescheduleBookingDto = {
        ...rescheduleDto(),
        serviceStartsAt: sameInstant,
        serviceEndsAt: sameInstant,
      };

      // Act + Assert
      await expect(
        service.reschedule(booking.id, dto),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects when mapsUrl is not http/https', async () => {
      // Arrange
      const booking = await bookingFactory.create();
      const dto: RescheduleBookingDto = {
        ...rescheduleDto(),
        mapsUrl: 'ftp://maps.example.com/venue',
      };

      // Act + Assert
      await expect(
        service.reschedule(booking.id, dto),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws NotFoundException when the booking does not exist', async () => {
      // Act + Assert
      await expect(
        service.reschedule(999999, rescheduleDto()),
      ).rejects.toEqual(new NotFoundException(EXCEPTION_RESPONSE.BOOKING_NOT_FOUND));
    });
  });
});
