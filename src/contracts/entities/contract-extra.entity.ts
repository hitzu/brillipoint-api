import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';

import { BaseTimeEntity } from '../../common/entities/base-time.entity';
import type { DeliverableItem } from '../deliverables/deliverables';
import { Extra } from '../../extras/entities/extra.entity';
import { Promotion } from '../../promotions/entities/promotion.entity';
import { Contract } from './contract.entity';
import { ContractPackage } from './contract-package.entity';

@Entity('contract_extras')
export class ContractExtra extends BaseTimeEntity {
  @Column('integer', { name: 'contract_id' })
  contractId!: number;

  @Column('integer', { name: 'extra_id' })
  extraId!: number;

  @Column('integer', { name: 'contract_package_id', nullable: true })
  contractPackageId: number | null = null;

  @Column('integer', { name: 'promotion_id', nullable: true })
  promotionId: number | null = null;

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
   * extras created outside the tiered-promotion flow) — treat as full price.
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

  @Column('boolean', { name: 'is_gift', default: false })
  isGift: boolean = false;

  @ManyToOne(() => Contract, (contract) => contract.extras, { nullable: false })
  @JoinColumn({ name: 'contract_id' })
  contract!: Contract;

  @ManyToOne(() => Extra, { nullable: true })
  @JoinColumn({ name: 'extra_id' })
  extra?: Extra | null;

  @ManyToOne(() => ContractPackage, { nullable: true })
  @JoinColumn({ name: 'contract_package_id' })
  contractPackage?: ContractPackage | null;

  @ManyToOne(() => Promotion, { nullable: true })
  @JoinColumn({ name: 'promotion_id' })
  promotion?: Promotion | null;
}
