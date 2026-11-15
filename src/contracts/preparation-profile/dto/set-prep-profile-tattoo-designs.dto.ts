import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsNotEmpty,
  IsString,
  ValidateNested,
} from 'class-validator';

import { TATTOO_DESIGNS_MAX } from '../tattoo-designs.policy';

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
  @ArrayMaxSize(TATTOO_DESIGNS_MAX)
  @ValidateNested({ each: true })
  @Type(() => PrepProfileTattooDesignAssetDto)
  assets!: PrepProfileTattooDesignAssetDto[];
}
