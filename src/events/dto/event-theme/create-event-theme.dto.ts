import {
  ApiExtraModels,
  ApiProperty,
  ApiPropertyOptional,
  getSchemaPath,
} from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsOptional, IsString, ValidateNested } from 'class-validator';

import { PresetThemeTokensDto } from './public-event-theme.dto';
import { IsThemeImageMap, ThemeImageAssetDto } from './theme-images.dto';
import type { ThemeImageMap } from './theme-images.dto';
import { IsTokenContrastValid } from '../../theme/validate-theme-overrides';

@ApiExtraModels(ThemeImageAssetDto)
export class CreateEventThemeDto {
  @ApiProperty({ example: 'amor-eterno' })
  @IsString()
  key!: string;

  @ApiProperty({ example: 'Amor Eterno' })
  @IsString()
  name!: string;

  @ApiPropertyOptional({ type: PresetThemeTokensDto, nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => PresetThemeTokensDto)
  @IsTokenContrastValid()
  tokens?: PresetThemeTokensDto | null;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: { $ref: getSchemaPath(ThemeImageAssetDto) },
    nullable: true,
  })
  @IsOptional()
  @IsThemeImageMap()
  images?: ThemeImageMap | null;
}
