import { IsInt, IsNotEmpty, IsString, Max, Min } from 'class-validator';

export const PAYMENT_RECEIPT_MIME = 'application/pdf';
export const PAYMENT_RECEIPT_MAX_BYTES = 10 * 1024 * 1024;

export class CreatePaymentReceiptUploadUrlDto {
  @IsString()
  @IsNotEmpty()
  fileName!: string;

  @IsString()
  @IsNotEmpty()
  mime!: string;

  @IsInt()
  @Min(1)
  @Max(PAYMENT_RECEIPT_MAX_BYTES)
  size!: number;
}
