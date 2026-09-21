import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import 'reflect-metadata';

import { AppDataSource as TestDataSource } from '../config/database/data-source';
import { ContractFactory } from '../../test/factories/contracts/contract.factory';
import { BookingFactory } from '../../test/factories/bookings/booking.factory';
import { IS_PUBLIC_KEY } from '../auth/decorators/public.decorator';
import { BookingsAgendaService } from './bookings-agenda.service';
import { BookingsController } from './bookings.controller';
import { ScheduleAgendaQueryDto } from './dto/schedule-agenda-query.dto';
import { Booking } from './entities/booking.entity';
import { BOOKING_STATUS } from './constants/booking_status.enum';

describe('BookingsAgendaService', () => {
  let service: BookingsAgendaService;
  let bookingFactory: BookingFactory;
  let contractFactory: ContractFactory;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingsAgendaService,
        {
          provide: getRepositoryToken(Booking),
          useValue: TestDataSource.getRepository(Booking),
        },
      ],
    }).compile();

    service = module.get<BookingsAgendaService>(BookingsAgendaService);
    module.get<Repository<Booking>>(getRepositoryToken(Booking));
    bookingFactory = new BookingFactory(TestDataSource);
    contractFactory = new ContractFactory(TestDataSource);
  });

  describe('getAgenda', () => {
    it('returns every day in an inclusive range, including empty ones', async () => {
      // Arrange
      const query: ScheduleAgendaQueryDto = {
        from: '2026-09-14',
        to: '2026-09-20',
      };

      // Act
      const result = await service.getAgenda(query);

      // Assert
      expect(result.days).toHaveLength(7);
      expect(result.days.map((day) => day.date)).toEqual([
        '2026-09-14',
        '2026-09-15',
        '2026-09-16',
        '2026-09-17',
        '2026-09-18',
        '2026-09-19',
        '2026-09-20',
      ]);
      result.days.forEach((day) => expect(day.entries).toEqual([]));
    });

    it('shows a booking inside the window on its own day', async () => {
      // Arrange
      const booking = await bookingFactory.create({
        eventDate: '2026-09-15',
        serviceStartsAt: new Date('2026-09-15T14:00:00-06:00'),
        serviceEndsAt: new Date('2026-09-15T18:00:00-06:00'),
      });

      // Act
      const result = await service.getAgenda({
        from: '2026-09-14',
        to: '2026-09-16',
      });

      // Assert
      const day = result.days.find((d) => d.date === '2026-09-15');
      expect(day?.entries).toHaveLength(1);
      expect(day?.entries[0].id).toBe(booking.id);
      expect(day?.entries[0].segmentStartsAt).toEqual(booking.serviceStartsAt);
      expect(day?.entries[0].segmentEndsAt).toEqual(booking.serviceEndsAt);
    });

    it('splits an overnight booking across both days with continuation flags and the full interval on both', async () => {
      // Arrange
      const startsAt = new Date('2026-09-15T22:00:00-06:00');
      const endsAt = new Date('2026-09-16T02:00:00-06:00');
      const booking = await bookingFactory.create({
        eventDate: '2026-09-15',
        serviceStartsAt: startsAt,
        serviceEndsAt: endsAt,
      });

      // Act
      const result = await service.getAgenda({
        from: '2026-09-15',
        to: '2026-09-16',
      });

      // Assert
      const firstDay = result.days.find((d) => d.date === '2026-09-15');
      const secondDay = result.days.find((d) => d.date === '2026-09-16');
      const firstEntry = firstDay?.entries.find((e) => e.id === booking.id);
      const secondEntry = secondDay?.entries.find((e) => e.id === booking.id);

      expect(firstEntry?.continuesFromPreviousDay).toBe(false);
      expect(firstEntry?.continuesNextDay).toBe(true);
      expect(secondEntry?.continuesFromPreviousDay).toBe(true);
      expect(secondEntry?.continuesNextDay).toBe(false);

      expect(firstEntry?.startsAt).toEqual(startsAt);
      expect(firstEntry?.endsAt).toEqual(endsAt);
      expect(secondEntry?.startsAt).toEqual(startsAt);
      expect(secondEntry?.endsAt).toEqual(endsAt);
    });

    it('shows a booking that started before "from" but is still running inside the window', async () => {
      // Arrange
      const startsAt = new Date('2026-09-14T22:00:00-06:00');
      const endsAt = new Date('2026-09-15T02:00:00-06:00');
      const booking = await bookingFactory.create({
        eventDate: '2026-09-14',
        serviceStartsAt: startsAt,
        serviceEndsAt: endsAt,
      });

      // Act
      const result = await service.getAgenda({
        from: '2026-09-15',
        to: '2026-09-15',
      });

      // Assert
      expect(result.days).toHaveLength(1);
      const entries = result.days[0].entries;
      expect(entries).toHaveLength(1);
      expect(entries[0].id).toBe(booking.id);
      expect(entries[0].continuesFromPreviousDay).toBe(true);
      expect(entries[0].continuesNextDay).toBe(false);
      expect(entries[0].startsAt).toEqual(startsAt);
    });

    it('does not show a booking entirely outside the queried window', async () => {
      // Arrange
      await bookingFactory.create({
        eventDate: '2026-01-01',
        serviceStartsAt: new Date('2026-01-01T14:00:00-06:00'),
        serviceEndsAt: new Date('2026-01-01T18:00:00-06:00'),
      });

      // Act
      const result = await service.getAgenda({
        from: '2026-09-14',
        to: '2026-09-20',
      });

      // Assert
      const allEntries = result.days.flatMap((day) => day.entries);
      expect(allEntries).toEqual([]);
    });

    it('carries the linked contract sku and client name on a commercial booking', async () => {
      // Arrange
      const contract = await contractFactory.create({
        sku: 'SKU-AGENDA-001',
        clientName: 'Jane Doe',
      });
      const booking = await bookingFactory.create({
        contractId: contract.id,
        eventDate: '2026-09-15',
        serviceStartsAt: new Date('2026-09-15T14:00:00-06:00'),
        serviceEndsAt: new Date('2026-09-15T18:00:00-06:00'),
      });

      // Act
      const result = await service.getAgenda({
        from: '2026-09-15',
        to: '2026-09-15',
      });

      // Assert
      const entry = result.days[0].entries.find((e) => e.id === booking.id);
      expect(entry?.sku).toBe('SKU-AGENDA-001');
      expect(entry?.clientName).toBe('Jane Doe');
      expect(entry?.contractId).toBe(contract.id);
    });

    it('leaves sku, clientName and contractId null for a booking with no contract', async () => {
      // Arrange
      const booking = await bookingFactory.create({
        eventDate: '2026-09-15',
        serviceStartsAt: new Date('2026-09-15T14:00:00-06:00'),
        serviceEndsAt: new Date('2026-09-15T18:00:00-06:00'),
      });

      // Act
      const result = await service.getAgenda({
        from: '2026-09-15',
        to: '2026-09-15',
      });

      // Assert
      const entry = result.days[0].entries.find((e) => e.id === booking.id);
      expect(entry?.sku).toBeNull();
      expect(entry?.clientName).toBeNull();
      expect(entry?.contractId).toBeNull();
    });

    it('sorts entries within a day by their segment start', async () => {
      // Arrange
      const later = await bookingFactory.create({
        eventDate: '2026-09-15',
        serviceStartsAt: new Date('2026-09-15T18:00:00-06:00'),
        serviceEndsAt: new Date('2026-09-15T20:00:00-06:00'),
      });
      const earlier = await bookingFactory.create({
        eventDate: '2026-09-15',
        serviceStartsAt: new Date('2026-09-15T08:00:00-06:00'),
        serviceEndsAt: new Date('2026-09-15T10:00:00-06:00'),
      });

      // Act
      const result = await service.getAgenda({
        from: '2026-09-15',
        to: '2026-09-15',
      });

      // Assert
      const ids = result.days[0].entries.map((e) => e.id);
      expect(ids).toEqual([earlier.id, later.id]);
    });

    it('only serves confirmed bookings', async () => {
      // Arrange
      const booking = await bookingFactory.create({
        status: BOOKING_STATUS.CONFIRMED,
        eventDate: '2026-09-15',
        serviceStartsAt: new Date('2026-09-15T14:00:00-06:00'),
        serviceEndsAt: new Date('2026-09-15T18:00:00-06:00'),
      });

      // Act
      const result = await service.getAgenda({
        from: '2026-09-15',
        to: '2026-09-15',
      });

      // Assert
      expect(result.days[0].entries.map((e) => e.id)).toContain(booking.id);
    });

    it('rejects a range where "from" is after "to"', async () => {
      // Arrange
      const query: ScheduleAgendaQueryDto = {
        from: '2026-09-20',
        to: '2026-09-14',
      };

      // Act + Assert
      await expect(service.getAgenda(query)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('rejects a malformed calendar date', async () => {
      // Arrange
      const query: ScheduleAgendaQueryDto = {
        from: '2026-02-30',
        to: '2026-03-01',
      };

      // Act + Assert
      await expect(service.getAgenda(query)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('rejects a range wider than 366 days', async () => {
      // Arrange
      const query: ScheduleAgendaQueryDto = {
        from: '2026-01-01',
        to: '2027-01-03',
      };

      // Act + Assert
      await expect(service.getAgenda(query)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('accepts a range exactly at the 366 day boundary', async () => {
      // Arrange
      const query: ScheduleAgendaQueryDto = {
        from: '2026-01-01',
        to: '2027-01-01',
      };

      // Act
      const result = await service.getAgenda(query);

      // Assert
      expect(result.days).toHaveLength(366);
    });
  });

  describe('getCalendarByMonth', () => {
    it('returns every civil day of a 30-day month', async () => {
      // Arrange + Act
      const result = await service.getCalendarByMonth(2026, 9);

      // Assert
      expect(result.days).toHaveLength(30);
      expect(result.days[0].date).toBe('2026-09-01');
      expect(result.days[29].date).toBe('2026-09-30');
    });

    it('returns every civil day of a 31-day month', async () => {
      // Arrange + Act
      const result = await service.getCalendarByMonth(2026, 10);

      // Assert
      expect(result.days).toHaveLength(31);
      expect(result.days[0].date).toBe('2026-10-01');
      expect(result.days[30].date).toBe('2026-10-31');
    });

    it('returns every civil day of February in a non-leap year', async () => {
      // Arrange + Act
      const result = await service.getCalendarByMonth(2026, 2);

      // Assert
      expect(result.days).toHaveLength(28);
      expect(result.days[27].date).toBe('2026-02-28');
    });

    it('returns every civil day of February in a leap year', async () => {
      // Arrange + Act
      const result = await service.getCalendarByMonth(2028, 2);

      // Assert
      expect(result.days).toHaveLength(29);
      expect(result.days[28].date).toBe('2028-02-29');
    });

    it('places a booking on the right day with its segment times', async () => {
      // Arrange
      const startsAt = new Date('2026-09-15T14:00:00-06:00');
      const endsAt = new Date('2026-09-15T18:00:00-06:00');
      await bookingFactory.create({
        eventDate: '2026-09-15',
        serviceStartsAt: startsAt,
        serviceEndsAt: endsAt,
      });

      // Act
      const result = await service.getCalendarByMonth(2026, 9);

      // Assert
      const day = result.days.find((d) => d.date === '2026-09-15');
      expect(day?.entries).toHaveLength(1);
      expect(day?.entries[0].segmentStartsAt).toEqual(startsAt);
      expect(day?.entries[0].segmentEndsAt).toEqual(endsAt);
      expect(day?.entries[0].startsAt).toEqual(startsAt);
      expect(day?.entries[0].endsAt).toEqual(endsAt);
    });

    it('exposes only timing and occupancy fields, never id, sku, clientName, title, venueName or contractId', async () => {
      // Arrange
      const contract = await contractFactory.create({
        sku: 'SKU-CAL-SECRET',
        clientName: 'Secret Client',
      });
      await bookingFactory.create({
        contractId: contract.id,
        title: 'Secret Title',
        venueName: 'Secret Venue',
        eventDate: '2026-09-15',
        serviceStartsAt: new Date('2026-09-15T14:00:00-06:00'),
        serviceEndsAt: new Date('2026-09-15T18:00:00-06:00'),
      });

      // Act
      const result = await service.getCalendarByMonth(2026, 9);

      // Assert
      const day = result.days.find((d) => d.date === '2026-09-15');
      expect(day?.entries).toHaveLength(1);
      const entry = day?.entries[0] as unknown as Record<string, unknown>;
      expect(entry).not.toHaveProperty('id');
      expect(entry).not.toHaveProperty('contractId');
      expect(entry).not.toHaveProperty('sku');
      expect(entry).not.toHaveProperty('clientName');
      expect(entry).not.toHaveProperty('title');
      expect(entry).not.toHaveProperty('venueName');
      expect(entry).not.toHaveProperty('purpose');
      expect(entry).not.toHaveProperty('status');
      expect(entry).not.toHaveProperty('type');
      expect(entry).not.toHaveProperty('eventDate');
      expect(entry).not.toHaveProperty('serviceStartsAt');
      expect(entry).not.toHaveProperty('serviceEndsAt');
      expect(Object.keys(entry)).toEqual(
        expect.arrayContaining([
          'segmentStartsAt',
          'segmentEndsAt',
          'startsAt',
          'endsAt',
          'continuesFromPreviousDay',
          'continuesNextDay',
        ]),
      );
      expect(Object.keys(entry)).toHaveLength(6);
    });

    it('splits an overnight booking across a month boundary onto both months', async () => {
      // Arrange
      const startsAt = new Date('2026-09-30T22:00:00-06:00');
      const endsAt = new Date('2026-10-01T02:00:00-06:00');
      await bookingFactory.create({
        eventDate: '2026-09-30',
        serviceStartsAt: startsAt,
        serviceEndsAt: endsAt,
      });

      // Act
      const september = await service.getCalendarByMonth(2026, 9);
      const october = await service.getCalendarByMonth(2026, 10);

      // Assert
      const lastDayOfSeptember = september.days.find(
        (d) => d.date === '2026-09-30',
      );
      const firstDayOfOctober = october.days.find(
        (d) => d.date === '2026-10-01',
      );
      expect(lastDayOfSeptember?.entries).toHaveLength(1);
      expect(lastDayOfSeptember?.entries[0].continuesNextDay).toBe(true);
      expect(lastDayOfSeptember?.entries[0].continuesFromPreviousDay).toBe(
        false,
      );
      expect(firstDayOfOctober?.entries).toHaveLength(1);
      expect(firstDayOfOctober?.entries[0].continuesFromPreviousDay).toBe(
        true,
      );
      expect(firstDayOfOctober?.entries[0].continuesNextDay).toBe(false);
    });

    it('rejects month 0', async () => {
      // Act + Assert
      await expect(service.getCalendarByMonth(2026, 0)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('rejects month 13', async () => {
      // Act + Assert
      await expect(
        service.getCalendarByMonth(2026, 13),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects a non-numeric month', async () => {
      // Act + Assert
      await expect(
        service.getCalendarByMonth(2026, Number('not-a-month')),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects a year that is not a sane 4-digit year', async () => {
      // Act + Assert
      await expect(
        service.getCalendarByMonth(99, 9),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('BookingsController route metadata', () => {
    it('marks GET /bookings/calendar as public', () => {
      // Arrange + Act
      const isPublic = Reflect.getMetadata(
        IS_PUBLIC_KEY,
        BookingsController.prototype.getCalendar,
      );

      // Assert
      expect(isPublic).toBe(true);
    });
  });
});
