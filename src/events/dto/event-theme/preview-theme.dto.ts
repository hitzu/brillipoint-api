import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsObject, IsOptional, IsString } from 'class-validator';

import type { ThemeOverrides } from '../../theme/theme.types';
import { IsThemeOverrides } from '../../theme/validate-theme-overrides';
import { PublicEventThemeDto } from './public-event-theme.dto';

/**
 * Dry-run preview of the resolved theme, staff-only. Resolves exactly like
 * the public endpoint (SystemDefault -> preset -> kit -> overrides) WITHOUT
 * persisting anything.
 *
 * `brandKitId` (an existing, saved kit) and `brandKit` (an inline, unsaved
 * `ThemeOverrides` layer) are mutually exclusive — sending both is a 400.
 * With neither, the socialCta chain falls back straight to the Brillipoint
 * default kit (there is no contract context to resolve a business kit from
 * in a preview).
 */
export class PreviewThemeDto {
  @ApiPropertyOptional({
    example: 12,
    description: 'Existing preset (event_themes) id to preview.',
  })
  @IsOptional()
  @IsInt()
  eventThemeId?: number;

  @ApiPropertyOptional({
    example: 3,
    description:
      'Existing brand kit id to preview as the kit layer. Mutually exclusive with `brandKit`.',
  })
  @IsOptional()
  @IsInt()
  brandKitId?: number;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    description:
      'Inline, unsaved ThemeOverrides to preview as the kit layer. Mutually exclusive with `brandKitId`.',
  })
  @IsOptional()
  @IsObject()
  @IsThemeOverrides()
  brandKit?: ThemeOverrides;

  @ApiPropertyOptional({
    example: 'Acme',
    description:
      'Display name for the inline `brandKit`, exposed as `params.brandName` when that kit supplies socialCta. Only valid together with `brandKit`.',
  })
  @IsOptional()
  @IsString()
  brandKitName?: string;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    description:
      'Per-event overrides layer to preview (same shape as events.theme_overrides).',
  })
  @IsOptional()
  @IsObject()
  @IsThemeOverrides()
  themeOverrides?: ThemeOverrides;

  @ApiPropertyOptional({ example: 'Ana y Luis' })
  @IsOptional()
  @IsString()
  honoreesName?: string;
}

export class PreviewThemeResponseDto {
  @ApiProperty({ type: PublicEventThemeDto })
  eventTheme!: PublicEventThemeDto;

  @ApiProperty({
    type: [String],
    description:
      'Non-blocking final-theme validation warnings computed on the RESOLVED tokens (including missing or malformed roles, unsupported effects, and contrast issues). ' +
      'Never blocks the preview — this endpoint exists to surface feedback.',
  })
  warnings!: string[];
}
