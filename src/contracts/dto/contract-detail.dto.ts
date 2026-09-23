import { Expose, Type } from 'class-transformer';
import { IsArray, IsNumber } from 'class-validator';

import { SlotDto } from '../../slots/dto/slot.dto';
import { PaymentResponseDto } from '../../payments/dto/payment-response.dto';
import { ContractDto } from './contract.dto';
import { ContractExtraDto } from './contract-extra.dto';
import { ContractPackageDto } from './contract-package.dto';
import { ContractSlotDto } from './contractSlot.dto';
import { ContractBookingSummaryDto } from './contract-booking-summary.dto';

export class ContractDetailDto {
  @Expose()
  @Type(() => ContractDto)
  contract!: ContractDto;

  @Expose()
  @Type(() => SlotDto)
  slot!: SlotDto;

  @Expose()
  @IsArray()
  @Type(() => ContractPackageDto)
  items!: ContractPackageDto[];

  @Expose()
  @IsArray()
  @Type(() => ContractPackageDto)
  packages!: ContractPackageDto[];

  @Expose()
  @IsArray()
  @Type(() => ContractExtraDto)
  extras!: ContractExtraDto[];

  @Expose()
  @IsArray()
  @Type(() => PaymentResponseDto)
  payments!: PaymentResponseDto[];

  @Expose()
  @IsNumber()
  paidAmount!: number;

  @Expose()
  @IsArray()
  @Type(() => ContractSlotDto)
  contractSlots!: ContractSlotDto[];

  @Expose()
  @IsArray()
  @Type(() => ContractBookingSummaryDto)
  bookings!: ContractBookingSummaryDto[];
}
