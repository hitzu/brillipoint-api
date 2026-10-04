import { Column, Entity, OneToMany } from 'typeorm';

import { BaseTimeEntity } from '../../common/entities/base-time.entity';
import { Product } from '../../products/entities/product.entity';
import { BrandDto } from '../dto/brand.dto';
import { UseDto } from '../../common/dto/use-dto.decorator';
import { BrandTerm } from '../../terms/entities/brand-term.entity';

@Entity('brands')
@UseDto(BrandDto)
export class Brand extends BaseTimeEntity {
  @Column('text')
  name!: string;

  @Column('text', { name: 'logo_url', nullable: true })
  logoUrl: string | null = null;

  @Column('text', { name: 'phone_number', nullable: true })
  phoneNumber: string | null = null;

  @Column('text', { name: 'email', nullable: true })
  email: string | null = null;

  @Column('boolean', { name: 'expo_monthly_risk_enabled', default: false })
  expoMonthlyRiskEnabled: boolean = false;

  @Column('decimal', {
    name: 'min_amount_hold_slot',
    nullable: true,
    transformer: {
      to: (value: number | null) => value,
      from: (value: string | null) => (value == null ? null : Number(value)),
    },
  })
  minAmountHoldSlot: number | null = null;

  @OneToMany(() => Product, (product) => product.brand)
  products!: Product[];

  @OneToMany(() => BrandTerm, (brandTerm) => brandTerm.brand)
  brandTerms?: BrandTerm[];
}
