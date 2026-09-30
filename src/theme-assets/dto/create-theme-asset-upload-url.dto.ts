import { IsEnum, IsInt, IsNotEmpty, IsString, Min } from 'class-validator';

import { ThemeAssetOwnerType, ThemeAssetSlot } from './theme-asset-owner-type';

export class CreateThemeAssetUploadUrlDto {
  @IsEnum(ThemeAssetOwnerType)
  ownerType!: ThemeAssetOwnerType;

  @IsInt()
  @Min(1)
  ownerId!: number;

  @IsEnum(ThemeAssetSlot)
  slot!: ThemeAssetSlot;

  @IsString()
  @IsNotEmpty()
  fileName!: string;

  @IsString()
  @IsNotEmpty()
  mime!: string;
}
