import { Expose, Type } from 'class-transformer';
import { IsBoolean, IsNumber, IsOptional, IsString } from 'class-validator';

import { ExtraResponseDto } from '../../extras/dto/extra-response.dto';
import { PromotionDto } from '../../promotions/dto/promotion.dto';
import { DeliverableItemDto } from './deliverable-item.dto';

export class ContractExtraDto {
  @Expose()
  @IsNumber()
  id!: number;

  @Expose()
  @IsNumber()
  contractId!: number;

  @Expose()
  @IsNumber()
  extraId!: number;

  @Expose()
  @IsNumber()
  quantity!: number;

  @Expose()
  @IsString()
  nameSnapshot!: string;

  @Expose()
  @IsNumber()
  basePriceSnapshot!: number;

  @Expose()
  @IsNumber()
  @IsOptional()
  contractPackageId?: number | null;

  @Expose()
  @IsNumber()
  discountPercentageSnapshot!: number;

  @Expose()
  @IsNumber()
  @IsOptional()
  finalPriceSnapshot?: number | null;

  @Expose()
  @IsBoolean()
  isGift!: boolean;

  @Expose()
  @Type(() => ExtraResponseDto)
  extra!: ExtraResponseDto;

  @Expose()
  @Type(() => PromotionDto)
  promotion?: PromotionDto;

  /**
   * Products delivered under this line: the contracting-time snapshot, or the
   * live catalog for contracts created before snapshots existed.
   */
  @Expose()
  @Type(() => DeliverableItemDto)
  deliverables: DeliverableItemDto[] = [];
}
