import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  OneToOne,
} from 'typeorm';

import { BaseTimeEntity } from '../../common/entities/base-time.entity';
import { UseDto } from '../../common/dto/use-dto.decorator';
import { Booking } from '../../bookings/entities/booking.entity';
import { Payment } from '../../payments/entities/payment.entity';
import { ContractDto } from '../dto/contract.dto';
import { ContractExtra } from './contract-extra.entity';
import { ContractPackage } from './contract-package.entity';
import { Slot } from '../../slots/entities/slot.entity';
import { ContractPromotion } from './contract-promotion.entity';
import { CONTRACT_STATUS } from '../types/contract-status.types';
import { ContractSlot } from './contract-slot.entity';
import { User } from '../../users/entities/user.entity';
import { Event } from '../../events/entities/event.entity';
import { Brand } from '../../brands/entities/brand.entity';

@Entity('contracts')
@UseDto(ContractDto)
export class Contract extends BaseTimeEntity {
  @Column('integer', { name: 'user_id' })
  userId!: number;

  @Column('integer', { name: 'brand_id', nullable: true })
  brandId: number | null = null;

  @ManyToOne(() => Brand, { nullable: true })
  @JoinColumn({ name: 'brand_id' })
  brand?: Brand | null;

  @Column('text', { name: 'client_name', nullable: true })
  clientName: string | null = null;

  @Column('text', { name: 'client_phone', nullable: true })
  clientPhone: string | null = null;

  @Column('text', { name: 'client_email', nullable: true })
  clientEmail: string | null = null;

  @Column('decimal', {
    transformer: {
      to: (value: number | null) => value,
      from: (value: string | null) => (value == null ? null : Number(value)),
    },
    nullable: true,
  })
  subtotal: number | null = null;

  @Column('decimal', {
    name: 'discount_total',
    transformer: {
      to: (value: number | null) => value,
      from: (value: string | null) => (value == null ? null : Number(value)),
    },
    nullable: true,
  })
  discountTotal: number | null = null;

  @Column('decimal', {
    transformer: {
      to: (value: number | null) => value,
      from: (value: string | null) => (value == null ? null : Number(value)),
    },
    nullable: true,
  })
  total: number | null = null;

  @Column('text')
  sku!: string;

  @Column('text')
  token!: string;

  @Column('enum', { enum: CONTRACT_STATUS, default: CONTRACT_STATUS.ACTIVE })
  status: CONTRACT_STATUS = CONTRACT_STATUS.ACTIVE;

  /**
   * Legacy relation kept for compatibility while migrating to multi-slot.
   */
  @OneToOne(() => Slot, { nullable: true })
  @JoinColumn({ name: 'slot_id' })
  slot?: Slot | null;

  /**
   * Key relation: a Contract can have multiple Slots via `contract_slots`.
   */
  @OneToMany(() => ContractSlot, (contractSlot) => contractSlot.contract)
  contractSlots?: ContractSlot[];

  /**
   * Snapshot: contract_packages stores the package state at the time of contracting.
   */
  @OneToMany(() => ContractPackage, (item) => item.contract)
  items?: ContractPackage[];

  /**
   * Snapshot: contract_promotions stores the applied promotion state at the time of contracting.
   */
  @OneToMany(() => ContractPromotion, (item) => item.contract)
  promotions?: ContractPromotion[];

  /**
   * Snapshot: contract_extras stores the extra state at the time of contracting.
   */
  @OneToMany(() => ContractExtra, (extra) => extra.contract)
  extras?: ContractExtra[];

  @OneToMany(() => Payment, (payment) => payment.contract)
  payments?: Payment[];

  @OneToMany(() => Booking, (booking) => booking.contract)
  bookings?: Booking[];

  @ManyToOne(() => User, (user) => user.contracts)
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @OneToOne(() => Event, (event) => event.contract)
  event?: Event | null;
}
