import { Type } from 'class-transformer';
import {
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { AddItemDto } from './add-item.dto';
import { AddExtraDto } from './add-extra.dto';

export class CreateContractFromSlotsDto {
  @IsNumber()
  userId!: number;

  @IsNumber()
  @IsOptional()
  slotId?: number;

  @IsNumber()
  @IsOptional()
  brandId?: number | null;

  @IsString()
  sku!: string;

  @IsString()
  clientName!: string;

  @IsString()
  @IsOptional()
  clientPhone?: string | null;

  @IsString()
  @IsOptional()
  clientEmail?: string | null;

  /**
   * subtotal/discountTotal/total are no longer trusted from the client — the
   * server always recomputes them from package/extra snapshots and resolved
   * promotion tiers. Kept optional here only so legacy callers sending these
   * fields don't fail validation; the values are ignored.
   */
  @IsNumber()
  @IsOptional()
  subtotal?: number;

  @IsNumber()
  @IsOptional()
  discountTotal?: number;

  @IsNumber()
  @IsOptional()
  total?: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AddItemDto)
  packages!: AddItemDto[];

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => AddExtraDto)
  extras?: AddExtraDto[];
}
