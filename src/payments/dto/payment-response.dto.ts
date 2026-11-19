import { Expose, Type } from 'class-transformer';
import {
  IsDate,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';

import { PAYMENT_METHOD } from '../../contracts/types/payment-method.types';

export class PaymentResponseDto {
  @Expose()
  @IsNumber()
  id!: number;

  @Expose()
  @IsNumber()
  contractId!: number;

  @Expose()
  @IsNumber()
  amount!: number;

  @Expose()
  @IsEnum(PAYMENT_METHOD)
  method!: PAYMENT_METHOD;

  @Expose()
  @Type(() => Date)
  @IsDate()
  receivedAt!: Date;

  @Expose()
  @IsString()
  @IsOptional()
  note!: string | null;

  @Expose()
  @IsString()
  @IsOptional()
  reference!: string | null;

  @Expose()
  @Type(() => Date)
  @IsDate()
  createdAt!: Date;

  @Expose()
  @IsString()
  @IsOptional()
  receiptUrl?: string | null;
}
