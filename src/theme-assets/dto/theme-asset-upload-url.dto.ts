import { Expose } from 'class-transformer';
import { IsString } from 'class-validator';

export class ThemeAssetUploadUrlDto {
  @Expose()
  @IsString()
  bucket!: string;

  @Expose()
  @IsString()
  path!: string;

  @Expose()
  @IsString()
  signedUrl!: string;

  @Expose()
  @IsString()
  token!: string;

  @Expose()
  @IsString()
  publicUrl!: string;
}
