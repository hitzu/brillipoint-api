import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';

import { BaseTimeEntity } from '../../common/entities/base-time.entity';
import { Product } from '../../products/entities/product.entity';
import { EXTRA_PRODUCT_ACTION } from '../types/extra-product-action.types';
import { Extra } from './extra.entity';

/**
 * A product an extra adds to, or removes from, the deliverables of the
 * package it is linked to in a contract.
 */
@Entity('extra_products')
@Index(['extraId', 'productId', 'action'], { unique: true })
export class ExtraProduct extends BaseTimeEntity {
  @Column('integer', { name: 'extra_id' })
  extraId!: number;

  @Column('integer', { name: 'product_id' })
  productId!: number;

  @Column('integer', { default: 1 })
  quantity: number = 1;

  @Column('enum', { enum: EXTRA_PRODUCT_ACTION, name: 'action' })
  action!: EXTRA_PRODUCT_ACTION;

  @ManyToOne(() => Extra, (extra) => extra.extraProducts, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'extra_id' })
  extra!: Extra;

  @ManyToOne(() => Product, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'product_id' })
  product!: Product;
}
