import { Expose } from 'class-transformer';
import { IsString } from 'class-validator';

export class PaymentReceiptUploadUrlDto {
  @Expose()
  @IsString()
  path!: string;

  @Expose()
  @IsString()
  signedUrl!: string;

  @Expose()
  @IsString()
  token!: string;
}
