import { Expose, Type } from 'class-transformer';
import { IsEnum, IsNumber } from 'class-validator';

import { ProductDto } from '../../products/dto/product.dto';
import { EXTRA_PRODUCT_ACTION } from '../types/extra-product-action.types';

export class ExtraProductResponseDto {
  @Expose()
  @IsNumber()
  productId!: number;

  @Expose()
  @IsNumber()
  quantity!: number;

  @Expose()
  @IsEnum(EXTRA_PRODUCT_ACTION)
  action!: EXTRA_PRODUCT_ACTION;

  @Expose()
  @Type(() => ProductDto)
  product?: ProductDto;
}
