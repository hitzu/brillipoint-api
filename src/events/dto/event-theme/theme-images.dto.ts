import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Type, plainToInstance } from 'class-transformer';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Validate,
  ValidateNested,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  validateSync,
} from 'class-validator';

import type {
  ThemeCoverImageSlot,
  ThemeImageOverrides,
  ThemeImageSlot,
  ThemeSplashIconImageSlot,
} from '../../theme/theme.types';

/** Typed image slot keys accepted on a preset (mirrors `ThemeImageOverrides`). */
const THEME_IMAGE_SLOT_KEYS = [
  'logo',
  'splashIcon',
  'hero',
  'watermark',
  'background',
  'cover',
] as const;

export class ThemeLocalizedTextDto {
  @Expose()
  @ApiPropertyOptional({ example: 'Amor Eterno' })
  @IsOptional()
  @IsString()
  es?: string;

  @Expose()
  @ApiPropertyOptional({ example: 'Eternal Love' })
  @IsOptional()
  @IsString()
  en?: string;
}

export class ThemeImageAssetDto implements ThemeImageSlot {
  @Expose()
  @ApiProperty({ example: 'themes/amor-eterno/logo.png' })
  @IsString()
  @IsNotEmpty()
  path!: string;

  @Expose()
  @ApiProperty({
    example:
      'https://<project>.supabase.co/storage/v1/object/public/public/themes/amor-eterno/logo.png',
  })
  @IsString()
  @IsNotEmpty()
  url!: string;

  @Expose()
  @ApiPropertyOptional({ type: ThemeLocalizedTextDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => ThemeLocalizedTextDto)
  alt?: ThemeLocalizedTextDto;
}

/** The `cover` slot additionally carries a link (fixed 4:5 aspect ratio, T6/T7). */
export class ThemeCoverImageAssetDto
  extends ThemeImageAssetDto
  implements ThemeCoverImageSlot
{
  @Expose()
  @ApiPropertyOptional({ example: 'https://brillipoint.com' })
  @IsOptional()
  @IsString()
  link?: string;
}

/** The `splashIcon` slot additionally carries an optional opaque `plate` color. */
export class ThemeSplashIconImageAssetDto
  extends ThemeImageAssetDto
  implements ThemeSplashIconImageSlot
{
  @Expose()
  @ApiPropertyOptional({
    example: '#000000',
    description:
      'Opaque #RRGGBB background of the circular container holding the splash logo.',
  })
  @IsOptional()
  @IsString()
  @Matches(/^#[0-9a-fA-F]{6}$/, {
    message: 'plate must be an opaque #RRGGBB color',
  })
  plate?: string;
}

export type ThemeImageMap = ThemeImageOverrides;

@ValidatorConstraint({ name: 'isThemeImageMap', async: false })
export class IsThemeImageMapConstraint implements ValidatorConstraintInterface {
  private lastError = 'images must be a map of typed theme image slots';

  validate(value: unknown): boolean {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      this.lastError = 'images must be an object map, not an array or scalar';
      return false;
    }

    for (const [key, entry] of Object.entries(
      value as Record<string, unknown>,
    )) {
      if (!(THEME_IMAGE_SLOT_KEYS as readonly string[]).includes(key)) {
        this.lastError = `${key} is not a known theme image slot (expected one of: ${THEME_IMAGE_SLOT_KEYS.join(', ')})`;
        return false;
      }

      // Slots may be explicitly removed with null (matches ThemeImageOverrides).
      if (entry === null) {
        continue;
      }

      const dtoClass =
        key === 'cover'
          ? ThemeCoverImageAssetDto
          : key === 'splashIcon'
            ? ThemeSplashIconImageAssetDto
            : ThemeImageAssetDto;
      const instance = plainToInstance(dtoClass, entry);
      const errors = validateSync(instance, {
        whitelist: true,
        forbidNonWhitelisted: true,
      });

      if (errors.length > 0) {
        const messages = errors
          .flatMap((error) => Object.values(error.constraints ?? {}))
          .join(', ');
        this.lastError = `${key}: ${messages}`;
        return false;
      }
    }

    return true;
  }

  defaultMessage(): string {
    return this.lastError;
  }
}

export function IsThemeImageMap() {
  return Validate(IsThemeImageMapConstraint);
}
