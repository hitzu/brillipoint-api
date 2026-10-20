import { Expose, Type } from 'class-transformer';
import { IsEnum, IsNumber, IsString } from 'class-validator';

import { BrandDto } from '../../brands/dto/brand.dto';
import { EXTRA_STATUS } from '../types/extras-status.types';
import { ExtraProductResponseDto } from './extra-product-response.dto';

export class ExtraResponseDto {
  @Expose()
  @IsNumber()
  id!: number;

  @Expose()
  @IsNumber()
  brandId!: number;

  @Expose()
  @IsString()
  name!: string;

  @Expose()
  @IsString()
  description: string | null = null;

  @Expose()
  @IsNumber()
  price: number | null = null;

  @Expose()
  @IsEnum(EXTRA_STATUS)
  status!: EXTRA_STATUS;

  @Expose()
  @Type(() => BrandDto)
  brand!: BrandDto;

  @Expose({ name: 'extraProducts' })
  @Type(() => ExtraProductResponseDto)
  products: ExtraProductResponseDto[] = [];
}
