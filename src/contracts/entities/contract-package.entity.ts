import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';

import { BaseTimeEntity } from '../../common/entities/base-time.entity';
import type { DeliverableItem } from '../deliverables/deliverables';
import { Contract } from './contract.entity';
import { Package } from '../../packages/entities/package.entity';
import { Promotion } from '../../promotions/entities/promotion.entity';

@Entity('contract_packages')
export class ContractPackage extends BaseTimeEntity {
  @Column('integer', { name: 'contract_id' })
  contractId!: number;

  @Column('integer', { name: 'package_id' })
  packageId!: number;

  @Column('integer', { name: 'promotion_id', nullable: true })
  promotionId: number | null = null;

  /**
   * Snapshot fields: these represent the package state at the moment the contract is created.
   */
  @Column('text', { name: 'name_snapshot' })
  nameSnapshot!: string;

  @Column('decimal', {
    name: 'base_price_snapshot',
    transformer: {
      to: (value: number) => value,
      from: (value: string) => Number(value),
    },
  })
  basePriceSnapshot!: number;

  @Column('decimal', {
    name: 'discount_percentage_snapshot',
    default: 0,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => Number(value),
    },
  })
  discountPercentageSnapshot: number = 0;

  /**
   * Null means no discount was computed for this row (e.g. legacy rows, or
   * packages created outside the promotion flow) — treat as full price.
   */
  @Column('decimal', {
    name: 'final_price_snapshot',
    nullable: true,
    transformer: {
      to: (value: number | null) => value,
      from: (value: string | null) => (value == null ? null : Number(value)),
    },
  })
  finalPriceSnapshot: number | null = null;

  @Column('integer', { default: 1 })
  quantity: number = 1;

  /**
   * Products delivered under this line, frozen at contracting time. Null on
   * rows created before snapshots existed — readers fall back to the catalog.
   */
  @Column('jsonb', { name: 'items_snapshot', nullable: true })
  itemsSnapshot: DeliverableItem[] | null = null;

  @ManyToOne(() => Contract, (contract) => contract.items, { nullable: false })
  @JoinColumn({ name: 'contract_id' })
  contract!: Contract;

  @ManyToOne(() => Package, { nullable: true })
  @JoinColumn({ name: 'package_id' })
  package?: Package | null;

  @ManyToOne(() => Promotion, { nullable: true })
  @JoinColumn({ name: 'promotion_id' })
  promotion?: Promotion | null;
}
