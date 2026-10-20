import { Expose } from 'class-transformer';
import { IsNumber, IsString } from 'class-validator';

export class DeliverableItemDto {
  @Expose()
  @IsNumber()
  productId!: number;

  @Expose()
  @IsString()
  name!: string;

  @Expose()
  @IsNumber()
  quantity!: number;
}
