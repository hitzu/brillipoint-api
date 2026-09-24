import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AppDataSource as TestDataSource } from '../config/database/data-source';
import { EXCEPTION_RESPONSE } from '../config/errors/exception-response.config';
import { ContractFactory } from '../../test/factories/contracts/contract.factory';
import { EventFactory } from '../../test/factories/events/event.factory';
import { BookingFactory } from '../../test/factories/bookings/booking.factory';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { Event } from './entities/event.entity';
import { EventsService } from './events.service';
import { EventTypeFactory } from '../../test/factories/events/event-type.factory'
import { ServiceTypeFactory } from '../../test/factories/events/service-type.factory';
import { PinoLogger } from 'nestjs-pino';
import { Booking } from '../bookings/entities/booking.entity';
import { BOOKING_PURPOSE } from '../bookings/constants/booking_purpose.enum';

describe('EventsService', () => {
  let service: EventsService;
  let eventFactory: EventFactory;
  let bookingFactory: BookingFactory;

  beforeEach(async () => {

    const loggerMock = {
      setContext: jest.fn(),
      error: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventsService,
        {
          provide: getRepositoryToken(Event),
          useValue: TestDataSource.getRepository(Event),
        },
        {
          provide: getRepositoryToken(Booking),
          useValue: TestDataSource.getRepository(Booking),
        },
        {
          provide: PinoLogger,
          useValue: loggerMock,
        },
      ],
    }).compile();

    service = module.get<EventsService>(EventsService);
    eventFactory = new EventFactory(TestDataSource);
    bookingFactory = new BookingFactory(TestDataSource);
  });

  describe('printTemplates DTO validation', () => {
    it('should accept any valid JSON shape for create and update payloads', async () => {
      const printTemplates = [
        { template_id: 'polaroid', settings: { copies: 2, enabled: true } },
        { arbitrary: ['nested', 123, null, { ok: true }] },
      ];

      const createDto = plainToInstance(CreateEventDto, {
        contractId: 1,
        key: 'json-templates-create',
        eventTypeId: 1,
        printTemplates,
      });
      const updateDto = plainToInstance(UpdateEventDto, { printTemplates });

      await expect(validate(createDto)).resolves.toEqual([]);
      await expect(validate(updateDto)).resolves.toEqual([]);
    });
  });

  describe('create', () => {
    it('should create event with generated UUID token', async () => {
      const contractFactory = new ContractFactory(TestDataSource);
      const contract = await contractFactory.create();
      const eventTypeFactory = new EventTypeFactory(TestDataSource)
      const eventType = await eventTypeFactory.create()

      const result = await service.create({
        eventTypeId: eventType.id,
        contractId: contract.id,
        key: 'unique-key-001',
      });

      expect(result.id).toBeDefined();
      expect(result.token).toBeDefined();
      expect(result.token).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );
      expect(result.key).toBe('unique-key-001');
      expect(result.contractId).toBe(contract.id);
    });

    it('should throw ConflictException when key already exists', async () => {
      const event = await eventFactory.create({ key: 'duplicate-key' });
      const eventTypeFactory = new EventTypeFactory(TestDataSource)
      const eventType = await eventTypeFactory.create()

      await expect(
        service.create({
          eventTypeId: eventType.id,
          contractId: event.contractId,
          key: 'duplicate-key',
        }),
      ).rejects.toEqual(
        new ConflictException(EXCEPTION_RESPONSE.EVENT_KEY_ALREADY_EXISTS),
      );
    });

    it('should throw ConflictException when contract already has an event', async () => {
      const existing = await eventFactory.create({ key: 'existing-for-contract' });
      const eventTypeFactory = new EventTypeFactory(TestDataSource)
      const eventType = await eventTypeFactory.create()

      await expect(
        service.create({
          eventTypeId: eventType.id,
          contractId: existing.contractId,
          key: 'another-unique-key',
        }),
      ).rejects.toEqual(
        new ConflictException(
          EXCEPTION_RESPONSE.EVENT_CONTRACT_ALREADY_HAS_EVENT,
        ),
      );
    });

    it('should persist optional metadata and return it in the response', async () => {
      const contractFactory = new ContractFactory(TestDataSource);
      const contract = await contractFactory.create();
      const serviceStartsAt = new Date('2026-06-01T18:00:00.000Z');
      const serviceEndsAt = new Date('2026-06-01T23:00:00.000Z');
      const eventTypeFactory = new EventTypeFactory(TestDataSource)
      const eventType = await eventTypeFactory.create()
      const serviceTypeFactory = new ServiceTypeFactory(TestDataSource);
      const serviceType = await serviceTypeFactory.create();

      const result = await service.create({
        contractId: contract.id,
        key: 'unique-key-metadata-001',
        eventTypeId: eventType.id,
        serviceTypeId: serviceType.id,
        honoreesNames: 'Ana y Luis',
        albumPhrase: 'Para siempre',
        venueName: 'Salón Jardín',
        serviceLocationUrl: 'https://maps.example.com/place/abc',
        serviceStartsAt,
        serviceEndsAt,
        delegateName: 'María Pérez',
      });

      expect(result.eventTypeId).toBe(eventType.id);
      expect(result.serviceTypeId).toBe(serviceType.id);
      expect(result.honoreesNames).toBe('Ana y Luis');
      expect(result.albumPhrase).toBe('Para siempre');
      expect(result.venueName).toBe('Salón Jardín');
      expect(result.serviceLocationUrl).toBe('https://maps.example.com/place/abc');
      expect(result.delegateName).toBe('María Pérez');
      expect(result.serviceStartsAt?.getTime()).toBe(serviceStartsAt.getTime());
      expect(result.serviceEndsAt?.getTime()).toBe(serviceEndsAt.getTime());
    });

    it('should persist serviceTypeId and printTemplates', async () => {
      const contractFactory = new ContractFactory(TestDataSource);
      const contract = await contractFactory.create();
      const eventTypeFactory = new EventTypeFactory(TestDataSource);
      const eventType = await eventTypeFactory.create();
      const serviceTypeFactory = new ServiceTypeFactory(TestDataSource);
      const serviceType = await serviceTypeFactory.create();
      const printTemplates = [
        { type: 'polaroid', template: 'polaroid_2', icon: 'cake' },
        { type: 'keychain', template: 'keychain_2', icon: 'cake' },
      ];

      const result = await service.create({
        contractId: contract.id,
        key: 'multi-product-001',
        eventTypeId: eventType.id,
        serviceTypeId: serviceType.id,
        printTemplates,
      });

      expect(result.serviceTypeId).toBe(serviceType.id);
      expect(result.printTemplates).toEqual(printTemplates);
    });

    it('should throw BadRequestException when serviceEndsAt is not after serviceStartsAt', async () => {
      const contractFactory = new ContractFactory(TestDataSource);
      const contract = await contractFactory.create();
      const eventTypeFactory = new EventTypeFactory(TestDataSource)
      const eventType = await eventTypeFactory.create()

      await expect(
        service.create({
          eventTypeId: eventType.id,
          contractId: contract.id,
          key: 'unique-key-bad-window',
          serviceStartsAt: new Date('2026-06-01T18:00:00.000Z'),
          serviceEndsAt: new Date('2026-06-01T12:00:00.000Z'),
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('getByToken', () => {
    it('should return event when token exists', async () => {
      const event = await eventFactory.create();

      const result = await service.getByToken(event.token);

      expect(result.id).toBe(event.id);
      expect(result.token).toBe(event.token);
      expect(result.key).toBe(event.key);
    });

    it('should throw NotFoundException when token does not exist', async () => {
      await expect(
        service.getByToken('00000000-0000-0000-0000-000000000000'),
      ).rejects.toEqual(
        new NotFoundException(EXCEPTION_RESPONSE.EVENT_NOT_FOUND),
      );
    });
  });

  describe('list', () => {
    it('should return an empty array when no events exist', async () => {
      const result = await service.list();

      expect(result).toEqual([]);
    });

    it('should return all events ordered by createdAt DESC', async () => {
      const event1 = await eventFactory.create({ key: 'list-event-001' });
      const event2 = await eventFactory.create({ key: 'list-event-002' });

      const result = await service.list();

      expect(result.length).toBeGreaterThanOrEqual(2);
      expect(result[0].id).toBe(event2.id);
      expect(result[1].id).toBe(event1.id);
    });

    it('should return EventResponseDto instances with expected properties', async () => {
      await eventFactory.create({ key: 'list-event-dto-check' });

      const result = await service.list();

      expect(result[0]).toHaveProperty('id');
      expect(result[0]).toHaveProperty('key');
      expect(result[0]).toHaveProperty('token');
      expect(result[0]).toHaveProperty('createdAt');
    });
  });

  describe('update', () => {
    it('should update venue and return updated response', async () => {
      const event = await eventFactory.create({ key: 'update-name-001' });

      const result = await service.update(event.id, { venueName: 'Updated Venue' });

      expect(result.id).toBe(event.id);
      expect(result.venueName).toBe('Updated Venue');
    });

    it('should update multiple optional fields', async () => {
      const event = await eventFactory.create({ key: 'update-multi-001' });
      const eventTypeFactory = new EventTypeFactory(TestDataSource)
      const eventType = await eventTypeFactory.create()
      const serviceTypeFactory = new ServiceTypeFactory(TestDataSource);
      const serviceType = await serviceTypeFactory.create();

      const result = await service.update(event.id, {
        eventTypeId: eventType.id,
        serviceTypeId: serviceType.id,
        honoreesNames: 'Sofía',
        albumPhrase: 'Mis XV',
        venueName: 'Salón Real',
        delegateName: 'Mamá de Sofía',
      });

      expect(result.eventTypeId).toBe(eventType.id);
      expect(result.serviceTypeId).toBe(serviceType.id);
      expect(result.honoreesNames).toBe('Sofía');
      expect(result.albumPhrase).toBe('Mis XV');
      expect(result.venueName).toBe('Salón Real');
      expect(result.delegateName).toBe('Mamá de Sofía');
    });

    it('should update service time window', async () => {
      const event = await eventFactory.create({ key: 'update-time-001' });
      const newStart = new Date('2026-08-01T16:00:00.000Z');
      const newEnd = new Date('2026-08-01T22:00:00.000Z');

      const result = await service.update(event.id, {
        serviceStartsAt: newStart,
        serviceEndsAt: newEnd,
      });

      expect(result.serviceStartsAt?.getTime()).toBe(newStart.getTime());
      expect(result.serviceEndsAt?.getTime()).toBe(newEnd.getTime());
    });

    it('should throw NotFoundException when event does not exist', async () => {
      await expect(
        service.update(999999, { venueName: 'Does not matter' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('should throw BadRequestException when serviceEndsAt is before serviceStartsAt', async () => {
      const event = await eventFactory.create({ key: 'update-bad-window-001' });

      await expect(
        service.update(event.id, {
          serviceStartsAt: new Date('2026-08-01T22:00:00.000Z'),
          serviceEndsAt: new Date('2026-08-01T16:00:00.000Z'),
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('should throw BadRequestException when new serviceEndsAt conflicts with existing serviceStartsAt', async () => {
      const event = await eventFactory.create({
        key: 'update-partial-window-001',
        serviceStartsAt: new Date('2026-08-01T18:00:00.000Z'),
        serviceEndsAt: new Date('2026-08-01T23:00:00.000Z'),
      });

      await expect(
        service.update(event.id, {
          serviceEndsAt: new Date('2026-08-01T12:00:00.000Z'),
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('should update serviceTypeId and printTemplates', async () => {
      const event = await eventFactory.create({ key: 'update-multi-product-001' });
      const serviceTypeFactory = new ServiceTypeFactory(TestDataSource);
      const serviceType = await serviceTypeFactory.create();
      const printTemplates = [
        { type: 'polaroid', template: 'polaroid_2', icon: 'rings' },
      ];

      const result = await service.update(event.id, {
        serviceTypeId: serviceType.id,
        printTemplates,
      });

      expect(result.serviceTypeId).toBe(serviceType.id);
      expect(result.printTemplates).toEqual(printTemplates);
    });

    it('should allow setting printTemplates to null', async () => {
      const event = await eventFactory.create({ key: 'update-null-templates-001' });

      const result = await service.update(event.id, { printTemplates: null });

      expect(result.printTemplates).toBeNull();
    });

    it('should not modify fields that are not in the dto', async () => {
      const event = await eventFactory.create({
        key: 'update-preserve-001',
        venueName: 'Original Venue',
      });

      const result = await service.update(event.id, { honoreesNames: 'New Honoree' });

      expect(result.honoreesNames).toBe('New Honoree');
      expect(result.venueName).toBe('Original Venue');
      expect(result.key).toBe('update-preserve-001');
    });
  });

  describe('getByKey', () => {
    it('should return event when key exists', async () => {
      const event = await eventFactory.create({ key: 'wedding-2025-001' });

      const result = await service.getByKey('wedding-2025-001');

      expect(result.id).toBe(event.id);
      expect(result.key).toBe('wedding-2025-001');
      expect(result.token).toBe(event.token);
    });

    it('should throw NotFoundException when key does not exist', async () => {
      await expect(
        service.getByKey('non-existent-key'),
      ).rejects.toEqual(
        new NotFoundException(EXCEPTION_RESPONSE.EVENT_NOT_FOUND),
      );
    });
  });

  describe('getPublicEventStatus', () => {
    it('should return finished when there is no EVENT booking', () => {
      expect(service.getPublicEventStatus(null)).toBe('finished');
    });

    it('should return active before the 30-day cutoff', () => {
      const serviceStartsAt = new Date('2026-05-01T12:00:00.000Z');
      const now = new Date('2026-05-31T11:59:59.999Z');

      expect(
        service.getPublicEventStatus({ serviceStartsAt } as Booking, now),
      ).toBe('active');
    });

    it('should return active exactly at the 30-day cutoff', () => {
      const serviceStartsAt = new Date('2026-05-01T12:00:00.000Z');
      const now = new Date('2026-05-31T12:00:00.000Z');

      expect(
        service.getPublicEventStatus({ serviceStartsAt } as Booking, now),
      ).toBe('active');
    });

    it('should return finished after the 30-day cutoff', () => {
      const serviceStartsAt = new Date('2026-05-01T12:00:00.000Z');
      const now = new Date('2026-05-31T12:00:00.001Z');

      expect(
        service.getPublicEventStatus({ serviceStartsAt } as Booking, now),
      ).toBe('finished');
    });
  });

  describe('getByTokenV2', () => {
    it('should resolve schedule/venue/mapsUrl from the contract EVENT booking when one exists', async () => {
      // Arrange
      const contractFactory = new ContractFactory(TestDataSource);
      const contract = await contractFactory.create();
      const event = await eventFactory.create({
        contractId: contract.id,
        serviceStartsAt: new Date('2020-01-01T10:00:00.000Z'),
        serviceEndsAt: new Date('2020-01-01T14:00:00.000Z'),
        venueName: 'Legacy venue',
        serviceLocationUrl: 'https://maps.example.com/legacy',
      });
      const booking = await bookingFactory.create({
        contractId: contract.id,
        purpose: BOOKING_PURPOSE.EVENT,
        serviceStartsAt: new Date('2026-06-01T10:00:00.000Z'),
        serviceEndsAt: new Date('2026-06-01T18:00:00.000Z'),
        venueName: 'Booking venue',
        mapsUrl: 'https://maps.example.com/booking',
      });

      // Act
      const result = await service.getByTokenV2(event.token);

      // Assert
      expect(result).toMatchObject({
        serviceStartsAt: booking.serviceStartsAt,
        serviceEndsAt: booking.serviceEndsAt,
        venueName: 'Booking venue',
        mapsUrl: 'https://maps.example.com/booking',
        bookingId: booking.id,
      });
    });

    it('should return null schedule/venue/location and no bookingId when the contract has no EVENT booking, ignoring the legacy event fields', async () => {
      // Arrange
      const contractFactory = new ContractFactory(TestDataSource);
      const contract = await contractFactory.create();
      const event = await eventFactory.create({
        contractId: contract.id,
        serviceStartsAt: new Date('2026-05-01T10:00:00.000Z'),
        venueName: 'Legacy venue',
        serviceLocationUrl: 'https://maps.example.com/legacy',
      });

      // Act
      const result = await service.getByTokenV2(event.token);

      // Assert
      expect(result).toMatchObject({
        serviceStartsAt: null,
        serviceEndsAt: null,
        venueName: null,
        mapsUrl: null,
        bookingId: null,
        status: 'finished',
      });
    });

    it('should return no schedule when the contract only has a non-EVENT booking', async () => {
      // Arrange
      const contractFactory = new ContractFactory(TestDataSource);
      const contract = await contractFactory.create();
      const event = await eventFactory.create({ contractId: contract.id });
      await bookingFactory.create({
        contractId: contract.id,
        purpose: BOOKING_PURPOSE.SCOUTING,
      });

      // Act
      const result = await service.getByTokenV2(event.token);

      // Assert
      expect(result.bookingId).toBeNull();
      expect(result.serviceStartsAt).toBeNull();
    });

    it('should ignore a soft-deleted EVENT booking and return no schedule', async () => {
      // Arrange
      const contractFactory = new ContractFactory(TestDataSource);
      const contract = await contractFactory.create();
      const event = await eventFactory.create({ contractId: contract.id });
      const booking = await bookingFactory.create({
        contractId: contract.id,
        purpose: BOOKING_PURPOSE.EVENT,
      });
      await TestDataSource.getRepository(Booking).softDelete(booking.id);

      // Act
      const result = await service.getByTokenV2(event.token);

      // Assert
      expect(result.bookingId).toBeNull();
      expect(result.serviceStartsAt).toBeNull();
      expect(result.status).toBe('finished');
    });

    it('should compute status from the booking serviceStartsAt, ignoring the stale event one', async () => {
      // Arrange
      const contractFactory = new ContractFactory(TestDataSource);
      const contract = await contractFactory.create();
      const event = await eventFactory.create({
        contractId: contract.id,
        serviceStartsAt: new Date('2020-01-01T10:00:00.000Z'),
      });
      await bookingFactory.create({
        contractId: contract.id,
        purpose: BOOKING_PURPOSE.EVENT,
        serviceStartsAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        serviceEndsAt: new Date(Date.now() + 28 * 60 * 60 * 1000),
      });

      // Act
      const result = await service.getByTokenV2(event.token);

      // Assert
      expect(result.status).toBe('active');
    });

    it('should throw NotFoundException when token does not exist', async () => {
      await expect(
        service.getByTokenV2('11111111-1111-1111-1111-111111111111'),
      ).rejects.toEqual(new NotFoundException(EXCEPTION_RESPONSE.EVENT_NOT_FOUND));
    });
  });

  describe('getByIdV2 / getByKeyV2', () => {
    it('should resolve schedule from the EVENT booking when fetching by id', async () => {
      // Arrange
      const contractFactory = new ContractFactory(TestDataSource);
      const contract = await contractFactory.create();
      const event = await eventFactory.create({ contractId: contract.id });
      const booking = await bookingFactory.create({
        contractId: contract.id,
        purpose: BOOKING_PURPOSE.EVENT,
      });

      // Act
      const result = await service.getByIdV2(event.id);

      // Assert
      expect(result.bookingId).toBe(booking.id);
      expect(result.serviceStartsAt).toEqual(booking.serviceStartsAt);
    });

    it('should resolve schedule from the EVENT booking when fetching by key', async () => {
      // Arrange
      const contractFactory = new ContractFactory(TestDataSource);
      const contract = await contractFactory.create();
      const event = await eventFactory.create({ contractId: contract.id });
      const booking = await bookingFactory.create({
        contractId: contract.id,
        purpose: BOOKING_PURPOSE.EVENT,
      });

      // Act
      const result = await service.getByKeyV2(event.key);

      // Assert
      expect(result.bookingId).toBe(booking.id);
      expect(result.serviceStartsAt).toEqual(booking.serviceStartsAt);
    });
  });

  describe('listV2', () => {
    it('should resolve each event independently by its own contract booking', async () => {
      // Arrange
      const contractFactory = new ContractFactory(TestDataSource);
      const contractWithBooking = await contractFactory.create();
      const contractWithoutBooking = await contractFactory.create();
      const eventWithBooking = await eventFactory.create({
        contractId: contractWithBooking.id,
      });
      const eventWithoutBooking = await eventFactory.create({
        contractId: contractWithoutBooking.id,
      });
      const booking = await bookingFactory.create({
        contractId: contractWithBooking.id,
        purpose: BOOKING_PURPOSE.EVENT,
      });

      // Act
      const result = await service.listV2();

      // Assert
      const resolvedWithBooking = result.find((e) => e.id === eventWithBooking.id);
      const resolvedWithoutBooking = result.find((e) => e.id === eventWithoutBooking.id);
      expect(resolvedWithBooking).toMatchObject({
        bookingId: booking.id,
      });
      expect(resolvedWithoutBooking).toMatchObject({
        bookingId: null,
        serviceStartsAt: null,
      });
    });
  });

  describe('findEventBooking', () => {
    it('should return the contract EVENT booking when one exists', async () => {
      // Arrange
      const contractFactory = new ContractFactory(TestDataSource);
      const contract = await contractFactory.create();
      const booking = await bookingFactory.create({
        contractId: contract.id,
        purpose: BOOKING_PURPOSE.EVENT,
      });

      // Act
      const result = await service.findEventBooking(contract.id);

      // Assert
      expect(result?.id).toBe(booking.id);
    });

    it('should return null when the contract has no EVENT booking', async () => {
      // Arrange
      const contractFactory = new ContractFactory(TestDataSource);
      const contract = await contractFactory.create();

      // Act
      const result = await service.findEventBooking(contract.id);

      // Assert
      expect(result).toBeNull();
    });
  });
});
