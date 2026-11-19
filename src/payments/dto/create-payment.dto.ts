import { Type } from 'class-transformer';
import {
  IsDate,
  IsEnum,
  IsOptional,
  IsPositive,
  IsString,
} from 'class-validator';

import { PAYMENT_METHOD } from '../../contracts/types/payment-method.types';

export class CreatePaymentDto {
  @IsPositive()
  amount!: number;

  @IsEnum(PAYMENT_METHOD)
  method!: PAYMENT_METHOD;

  @Type(() => Date)
  @IsDate()
  receivedAt!: Date;

  @IsString()
  @IsOptional()
  note?: string;

  @IsString()
  @IsOptional()
  reference?: string;

  @IsString()
  @IsOptional()
  receiptPath?: string | null;
}
