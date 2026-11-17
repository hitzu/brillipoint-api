import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

import { TATTOO_CATALOG_MAX, TATTOO_UPLOADS_MAX } from '../tattoo-designs.policy';

export class PrepProfileTattooDesignAssetDto {
  @IsString()
  @IsNotEmpty()
  path!: string;

  @IsString()
  @IsNotEmpty()
  mime!: string;
}

export class SetPrepProfileTattooDesignsDto {
  @IsArray()
  @ArrayMaxSize(TATTOO_UPLOADS_MAX)
  @ValidateNested({ each: true })
  @Type(() => PrepProfileTattooDesignAssetDto)
  assets!: PrepProfileTattooDesignAssetDto[];

  /** Catalog designs (carousel row ids) to choose; omitted keeps the current choice. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(TATTOO_CATALOG_MAX)
  @IsInt({ each: true })
  catalogDesignIds?: number[];
}
