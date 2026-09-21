import type { FactorizedAttrs } from '@jorgebodega/typeorm-factory';
import { Factory } from '@jorgebodega/typeorm-factory';
import { faker } from '@faker-js/faker';
import type { DataSource } from 'typeorm';

import { Booking } from '../../../src/bookings/entities/booking.entity';
import { BOOKING_STATUS } from '../../../src/bookings/constants/booking_status.enum';
import { BOOKING_TYPE } from '../../../src/bookings/constants/booking_type.enum';

export class BookingFactory extends Factory<Booking> {
  protected entity = Booking;
  protected dataSource: DataSource;

  constructor(dataSource: DataSource) {
    super();
    this.dataSource = dataSource;
  }

  protected attrs(): FactorizedAttrs<Booking> {
    return {
      status: BOOKING_STATUS.CONFIRMED,
      type: BOOKING_TYPE.INTERNAL,
      purpose: null,
      eventDate: '2026-09-12',
      serviceStartsAt: new Date('2026-09-12T10:00:00.000Z'),
      serviceEndsAt: new Date('2026-09-12T18:00:00.000Z'),
      title: faker.lorem.words(3),
      venueName: faker.company.name(),
      mapsUrl: null,
      contractId: null,
    };
  }

  async create(attrs?: Partial<Booking>): Promise<Booking> {
    const booking = await this.make({ ...attrs });
    return this.dataSource.getRepository(Booking).save(booking);
  }
}
