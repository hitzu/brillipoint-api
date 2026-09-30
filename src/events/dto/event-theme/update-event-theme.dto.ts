import {
  ApiExtraModels,
  ApiPropertyOptional,
  getSchemaPath,
} from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsOptional, IsString, ValidateNested } from 'class-validator';

import { PresetThemeTokensDto } from './public-event-theme.dto';
import { IsThemeImageMap, ThemeImageAssetDto } from './theme-images.dto';
import type { ThemeImageMap } from './theme-images.dto';
import { IsTokenContrastValid } from '../../theme/validate-theme-overrides';

/**
 * `key` is immutable and deliberately NOT declared here: the global
 * `ValidationPipe({ whitelist: true })` strips any `key` sent in the body.
 */
@ApiExtraModels(ThemeImageAssetDto)
export class UpdateEventThemeDto {
  @ApiPropertyOptional({ example: 'Amor Eterno' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({
    type: PresetThemeTokensDto,
    nullable: true,
    description:
      'Partial token overrides. When sent, REPLACES the stored tokens ' +
      'entirely — this is not a deep merge with the existing value. Omit ' +
      'to leave the stored tokens untouched.',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => PresetThemeTokensDto)
  @IsTokenContrastValid()
  tokens?: PresetThemeTokensDto | null;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: { $ref: getSchemaPath(ThemeImageAssetDto) },
    nullable: true,
    description:
      'Typed image slots. When sent, REPLACES the stored images entirely ' +
      '— this is not a deep merge with the existing value. Omit to leave ' +
      'the stored images untouched.',
  })
  @IsOptional()
  @IsThemeImageMap()
  images?: ThemeImageMap | null;
}
