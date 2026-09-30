import { Column, Entity, OneToMany } from 'typeorm';

import { BaseTimeEntity } from '../../common/entities/base-time.entity';
import type { ThemeOverrides } from '../../events/theme/theme.types';
import { Brand } from '../../brands/entities/brand.entity';

@Entity('brand_kits')
export class BrandKit extends BaseTimeEntity {
  @Column('text', { unique: true })
  key!: string;

  @Column('text')
  name!: string;

  @Column('jsonb', { default: () => "'{}'" })
  overrides!: ThemeOverrides;

  @OneToMany(() => Brand, (brand) => brand.brandKit)
  brands?: Brand[];
}
