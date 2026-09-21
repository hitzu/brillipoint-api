import type { Repository } from 'typeorm';

import { AppDataSource as TestDataSource } from '../../config/database/data-source';
import { ContractFactory } from '../../../test/factories/contracts/contract.factory';
import { BookingFactory } from '../../../test/factories/bookings/booking.factory';
import { BOOKING_STATUS } from '../constants/booking_status.enum';
import { BOOKING_TYPE } from '../constants/booking_type.enum';
import { Booking } from './booking.entity';

describe('Booking entity', () => {
  let bookingsRepository: Repository<Booking>;
  let bookingFactory: BookingFactory;

  beforeEach(() => {
    bookingsRepository = TestDataSource.getRepository(Booking);
    bookingFactory = new BookingFactory(TestDataSource);
  });

  it('persists a booking and reads it back with its fields', async () => {
    // Arrange
    const serviceStartsAt = new Date('2026-09-12T10:00:00.000Z');
    const serviceEndsAt = new Date('2026-09-12T18:00:00.000Z');

    // Act
    const created = await bookingFactory.create({
      type: BOOKING_TYPE.INTERNAL,
      title: 'Boda García',
      venueName: 'Salón Jardín',
      eventDate: '2026-09-12',
      serviceStartsAt,
      serviceEndsAt,
    });
    const persisted = await bookingsRepository.findOneBy({ id: created.id });

    // Assert
    expect(persisted).not.toBeNull();
    expect(persisted?.status).toBe(BOOKING_STATUS.CONFIRMED);
    expect(persisted?.type).toBe(BOOKING_TYPE.INTERNAL);
    expect(persisted?.title).toBe('Boda García');
    expect(persisted?.venueName).toBe('Salón Jardín');
    expect(persisted?.eventDate).toBe('2026-09-12');
    expect(persisted?.serviceStartsAt.toISOString()).toBe(serviceStartsAt.toISOString());
    expect(persisted?.serviceEndsAt.toISOString()).toBe(serviceEndsAt.toISOString());
  });

  it('rejects a booking whose serviceEndsAt is not after serviceStartsAt', async () => {
    // Arrange
    const sameInstant = new Date('2026-09-12T10:00:00.000Z');
    const invalidBooking = bookingsRepository.create({
      status: BOOKING_STATUS.CONFIRMED,
      type: BOOKING_TYPE.INTERNAL,
      purpose: null,
      eventDate: '2026-09-12',
      serviceStartsAt: sameInstant,
      serviceEndsAt: sameInstant,
      title: 'Evento inválido',
      venueName: 'Salón Jardín',
      mapsUrl: null,
      contractId: null,
    });

    // Act + Assert
    await expect(bookingsRepository.save(invalidBooking)).rejects.toThrow();
  });

  it('persists a booking with title and venueName left null', async () => {
    // Arrange
    const booking = bookingsRepository.create({
      status: BOOKING_STATUS.CONFIRMED,
      type: BOOKING_TYPE.COMMERCIAL,
      purpose: null,
      eventDate: '2026-09-12',
      serviceStartsAt: new Date('2026-09-12T10:00:00.000Z'),
      serviceEndsAt: new Date('2026-09-12T18:00:00.000Z'),
      title: null,
      venueName: null,
      mapsUrl: null,
      contractId: null,
    });

    // Act
    const created = await bookingsRepository.save(booking);
    const persisted = await bookingsRepository.findOneBy({ id: created.id });

    // Assert
    expect(persisted).not.toBeNull();
    expect(persisted?.title).toBeNull();
    expect(persisted?.venueName).toBeNull();
  });

  it('loads the contract relation for a booking linked to a contract', async () => {
    // Arrange
    const contract = await new ContractFactory(TestDataSource).create();
    const booking = await bookingFactory.create({ contractId: contract.id });

    // Act
    const persisted = await bookingsRepository.findOne({
      where: { id: booking.id },
      relations: ['contract'],
    });

    // Assert
    expect(persisted?.contract).not.toBeNull();
    expect(persisted?.contract?.id).toBe(contract.id);
    expect(persisted?.contract?.sku).toBe(contract.sku);
  });
});
