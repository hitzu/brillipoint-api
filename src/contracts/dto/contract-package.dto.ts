import { Expose, Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString } from 'class-validator';
import { PackageResponseDto } from '../../packages/dto/package-response.dto';
import { PromotionDto } from '../../promotions/dto/promotion.dto';
import { DeliverableItemDto } from './deliverable-item.dto';

export class ContractPackageDto {
  @Expose()
  @IsNumber()
  id!: number;

  @Expose()
  @IsNumber()
  contractId!: number;

  @Expose()
  @IsNumber()
  packageId!: number;

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
  discountPercentageSnapshot!: number;

  @Expose()
  @IsNumber()
  @IsOptional()
  finalPriceSnapshot?: number | null;

  @Expose()
  @Type(() => PackageResponseDto)
  package!: PackageResponseDto;

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
