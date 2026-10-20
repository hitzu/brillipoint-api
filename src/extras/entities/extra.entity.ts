import { Column, Entity, JoinColumn, ManyToOne, OneToMany } from 'typeorm';

import { Brand } from '../../brands/entities/brand.entity';
import { BaseTimeEntity } from '../../common/entities/base-time.entity';
import { EXTRA_STATUS } from '../types/extras-status.types';
import { ExtraProduct } from './extra-product.entity';

@Entity('extras')
export class Extra extends BaseTimeEntity {
  @Column('integer', { name: 'brand_id' })
  brandId!: number;

  @Column('text')
  name!: string;

  @Column('text', { nullable: true })
  description: string | null = null;

  @Column('decimal', {
    nullable: true,
    transformer: {
      to: (value: number | null) => value,
      from: (value: string | null) => (value == null ? null : Number(value)),
    },
  })
  price: number | null = null;

  @Column('enum', {
    enum: EXTRA_STATUS,
    name: 'status',
    default: EXTRA_STATUS.ACTIVE,
  })
  status: EXTRA_STATUS = EXTRA_STATUS.ACTIVE;

  @ManyToOne(() => Brand, { nullable: true })
  @JoinColumn({ name: 'brand_id' })
  brand?: Brand | null;

  @OneToMany(() => ExtraProduct, (extraProduct) => extraProduct.extra)
  extraProducts?: ExtraProduct[];
}
