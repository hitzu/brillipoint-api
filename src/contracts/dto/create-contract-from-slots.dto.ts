import { Type } from 'class-transformer';
import {
  IsArray,
  IsDate,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
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

  /**
   * Optional commercial-booking schedule (contract-first path). Field shapes
   * and validators are copied verbatim from `CreateInternalBookingDto` so
   * both entry points validate identically. A contract's main commitment is
   * always `BOOKING_PURPOSE.EVENT`, so no `purpose` is accepted here.
   */
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'eventDate must be a YYYY-MM-DD date',
  })
  @IsOptional()
  eventDate?: string;

  @Type(() => Date)
  @IsDate()
  @IsOptional()
  serviceStartsAt?: Date;

  @Type(() => Date)
  @IsDate()
  @IsOptional()
  serviceEndsAt?: Date;

  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  venueName?: string;

  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @IsOptional()
  mapsUrl?: string;

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
