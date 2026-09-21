import { Check, Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';

import { BaseTimeEntity } from '../../common/entities/base-time.entity';
import { Contract } from '../../contracts/entities/contract.entity';
import { BOOKING_PURPOSE } from '../constants/booking_purpose.enum';
import { BOOKING_STATUS } from '../constants/booking_status.enum';

/**
 * Every booking in this slice is an exact hour range (no holds, see
 * `odd/tasks/booking-agenda.md`), so the range must always be non-empty.
 */
export const BOOKING_SERVICE_RANGE_CHECK = 'service_ends_at > service_starts_at';

@Entity('bookings')
@Check('CHK_bookings_service_ends_after_starts', BOOKING_SERVICE_RANGE_CHECK)
@Index(['serviceStartsAt', 'serviceEndsAt'])
export class Booking extends BaseTimeEntity {
  @Column('enum', { enum: BOOKING_STATUS, default: BOOKING_STATUS.CONFIRMED })
  status: BOOKING_STATUS = BOOKING_STATUS.CONFIRMED;

  /** Which of the contract's dated commitments this booking is, when it has a contract. */
  @Column('enum', { enum: BOOKING_PURPOSE, nullable: true })
  purpose: BOOKING_PURPOSE | null = null;

  /** Civil (YMD) date the booking is displayed under in the agenda. */
  @Column('date', { name: 'event_date' })
  eventDate!: string;

  @Column('timestamptz', { name: 'service_starts_at' })
  serviceStartsAt!: Date;

  @Column('timestamptz', { name: 'service_ends_at' })
  serviceEndsAt!: Date;

  @Column('text', { nullable: true })
  title: string | null = null;

  @Column('text', { name: 'venue_name', nullable: true })
  venueName: string | null = null;

  @Column('text', { name: 'maps_url', nullable: true })
  mapsUrl: string | null = null;

  @Column('integer', { name: 'contract_id', nullable: true })
  contractId: number | null = null;

  @ManyToOne(() => Contract, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'contract_id' })
  contract?: Contract | null;
}
