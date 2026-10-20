import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

import { EXTRA_STATUS } from '../types/extras-status.types';
import { ExtraProductInputDto } from './extra-product-input.dto';

export class CreateExtraDto {
  @IsNumber()
  @IsNotEmpty()
  brandId!: number;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsOptional()
  description?: string | null;

  @IsNumber()
  @IsOptional()
  price: number | null = null;

  @IsEnum(EXTRA_STATUS)
  @IsOptional()
  status?: EXTRA_STATUS;

  /**
   * Products this extra adds to, or removes from, the linked package.
   * On update, sending this list replaces the stored one; omitting it keeps it.
   */
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExtraProductInputDto)
  @IsOptional()
  products?: ExtraProductInputDto[];
}
