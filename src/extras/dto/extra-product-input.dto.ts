import { IsEnum, IsInt, IsNumber, IsOptional, Min } from 'class-validator';

import { EXTRA_PRODUCT_ACTION } from '../types/extra-product-action.types';

export class ExtraProductInputDto {
  @IsNumber()
  productId!: number;

  @IsInt()
  @Min(1)
  @IsOptional()
  quantity?: number;

  @IsEnum(EXTRA_PRODUCT_ACTION)
  action!: EXTRA_PRODUCT_ACTION;
}
