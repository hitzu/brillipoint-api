import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsObject, IsOptional, IsString } from 'class-validator';

import type { ThemeOverrides } from '../../theme/theme.types';
import { IsThemeOverrides } from '../../theme/validate-theme-overrides';
import { PublicEventThemeDto } from './public-event-theme.dto';

/**
 * Dry-run preview of the resolved theme, staff-only. Resolves exactly like
 * the public endpoint (SystemDefault -> Brillipoint default -> preset ->
 * overrides) WITHOUT persisting anything.
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
