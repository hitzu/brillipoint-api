import { Expose, Type } from 'class-transformer';
import {
  IsArray,
  IsEmail,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';

import { CONTRACT_STATUS } from '../types/contract-status.types';
import { ContractBookingSummaryDto } from './contract-booking-summary.dto';

export class ContractDto {
  @Expose()
  @IsNumber()
  id!: number;

  @Expose()
  @IsEnum(CONTRACT_STATUS)
  status!: CONTRACT_STATUS;

  @Expose()
  @IsNumber()
  slotId!: number;

  @Expose()
  @IsOptional()
  @IsString()
  clientName?: string | null;

  @Expose()
  @IsOptional()
  @IsString()
  clientPhone?: string | null;

  @Expose()
  @IsOptional()
  @IsEmail()
  clientEmail?: string | null;

  @Expose()
  @IsOptional()
  @IsNumber()
  subtotal?: number | null;

  @Expose()
  @IsOptional()
  @IsNumber()
  discountTotal?: number | null;

  @Expose()
  @IsOptional()
  @IsNumber()
  total?: number | null;

  @Expose()
  @IsOptional()
  @IsNumber()
  deposit?: number | null;

  @Expose()
  @IsString()
  sku!: string;

  @Expose()
  @IsString()
  token!: string;

  @Expose()
  @IsOptional()
  @IsString()
  eventToken?: string | null;

  @Expose()
  @IsString()
  createdAt!: string;

  @Expose()
  @IsArray()
  @Type(() => ContractBookingSummaryDto)
  bookings!: ContractBookingSummaryDto[];
}
