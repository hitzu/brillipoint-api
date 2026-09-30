import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsOptional, IsString, Matches } from 'class-validator';

import type { ThemeOverrides } from '../../events/theme/theme.types';
import { IsThemeOverrides } from '../../events/theme/validate-theme-overrides';

/** Lowercase slug: letters/digits segments separated by single hyphens. */
export const BRAND_KIT_KEY_REGEX = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export class CreateBrandKitDto {
  @ApiProperty({
    example: 'acme-corp',
    description:
      'Immutable lowercase slug, unique across kits (including soft-deleted ones).',
  })
  @IsString()
  @Matches(BRAND_KIT_KEY_REGEX, {
    message:
      'key must be a lowercase slug (letters, digits, single hyphens between segments)',
  })
  key!: string;

  @ApiProperty({ example: 'Acme Corp' })
  @IsString()
  name!: string;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    description: 'Partial ThemeOverrides shape applied over this kit.',
  })
  @IsOptional()
  @IsObject()
  @IsThemeOverrides()
  overrides?: ThemeOverrides;
}
