import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsOptional, IsString } from 'class-validator';

import type { ThemeOverrides } from '../../events/theme/theme.types';
import { IsThemeOverrides } from '../../events/theme/validate-theme-overrides';

/**
 * `key` is immutable and deliberately NOT declared here: the global
 * `ValidationPipe({ whitelist: true })` strips any `key` sent in the body.
 */
export class UpdateBrandKitDto {
  @ApiPropertyOptional({ example: 'Acme Corp' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    description:
      'Partial ThemeOverrides shape. When sent, REPLACES the stored ' +
      'overrides entirely — this is not a deep merge with the existing value.',
  })
  @IsOptional()
  @IsObject()
  @IsThemeOverrides()
  overrides?: ThemeOverrides;
}
