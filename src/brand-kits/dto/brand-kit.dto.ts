import { Expose } from 'class-transformer';
import { IsDate, IsNumber, IsObject, IsString } from 'class-validator';

import type { ThemeOverrides } from '../../events/theme/theme.types';

export class BrandKitDto {
  @Expose()
  @IsNumber()
  id!: number;

  @Expose()
  @IsString()
  key!: string;

  @Expose()
  @IsString()
  name!: string;

  @Expose()
  @IsObject()
  overrides!: ThemeOverrides;

  @Expose()
  @IsDate()
  createdAt!: Date;

  @Expose()
  @IsDate()
  updatedAt!: Date;
}
