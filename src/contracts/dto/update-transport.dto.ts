import { IsEnum, IsNumber, IsOptional, Min } from 'class-validator';

import { CONTRACT_TRANSPORT_STATUS } from '../types/contract-transport-status.types';

export class UpdateTransportDto {
  @IsEnum(CONTRACT_TRANSPORT_STATUS)
  status!: CONTRACT_TRANSPORT_STATUS;

  /** Required and > 0 when status is `quoted`; must be omitted otherwise. */
  @IsOptional()
  @IsNumber()
  @Min(0)
  amount?: number;
}
