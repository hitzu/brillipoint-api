import {
  ApiExtraModels,
  ApiProperty,
  ApiPropertyOptional,
  getSchemaPath,
  PartialType,
} from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { IsOptional, IsString } from 'class-validator';

import {
  ThemeCoverImageAssetDto,
  ThemeImageAssetDto,
  ThemeSplashIconImageAssetDto,
} from './theme-images.dto';
import type {
  ThemeCopy,
  ThemeDecorations,
  ThemeImages,
  RewardPromo,
  SocialCta,
  ThemeText,
  ThemeTemplateParams,
} from '../../theme/theme.types';

/** Swagger shape for the `{ text: { es?, en? } }` ThemeText variant. */
class ThemeTextInlineDto {
  @ApiPropertyOptional({ example: '¿Y si las próximas fotos son las tuyas?' })
  es?: string;

  @ApiPropertyOptional({ example: 'What if the next photos are yours?' })
  en?: string;
}

/**
 * Documents the resolved `ThemeText` shape: either an i18n key (frontend
 * interpolates `params`) or inline localized `text`. Either variant may
 * contain `{{key}}` placeholders (decisions R6/R7); the backend never
 * substitutes them — see `PublicEventThemeDto.params`.
 */
class ThemeTextDto {
  @ApiPropertyOptional({ example: 'social.headline' })
  key?: string;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: { type: 'string' },
  })
  params?: Record<string, string>;

  @ApiPropertyOptional({ type: ThemeTextInlineDto })
  text?: ThemeTextInlineDto;
}

/** WhatsApp primaryAction: `phone` + an optional templated `message` (R7). */
class SocialCtaWhatsappActionDto {
  @ApiProperty({ example: 'whatsapp' })
  channel!: 'whatsapp';

  @ApiProperty({ type: ThemeTextDto })
  label!: ThemeTextDto;

  @ApiProperty({ example: '5212215775211' })
  phone!: string;

  @ApiPropertyOptional({ type: ThemeTextDto })
  message?: ThemeTextDto;
}

/** Every other socialCta channel: a ready-to-use `url`. */
class SocialCtaLinkActionDto {
  @ApiProperty({
    example: 'instagram',
    enum: ['instagram', 'tiktok', 'facebook', 'url'],
  })
  channel!: 'instagram' | 'tiktok' | 'facebook' | 'url';

  @ApiProperty({ type: ThemeTextDto })
  label!: ThemeTextDto;

  @ApiProperty({ example: 'https://www.instagram.com/brillipoint' })
  url!: string;
}

class SocialCtaSocialsDto {
  @ApiPropertyOptional({
    example: 'https://wa.me/5212215775211',
    description: 'Ready-to-use wa.me link, no prefilled message.',
  })
  whatsapp?: string;

  @ApiPropertyOptional({ example: 'https://www.instagram.com/brillipoint' })
  instagram?: string;

  @ApiPropertyOptional({
    example: 'https://www.tiktok.com/@brillipoint.glitterbar',
  })
  tiktok?: string;

  @ApiPropertyOptional({
    example: 'https://www.facebook.com/profile.php?id=61579380963496',
  })
  facebook?: string;

  @ApiPropertyOptional({ example: 'https://brillipoint.com' })
  url?: string;
}

/**
 * Resolved whole-block socialCta (T6): a single fallback block (event
 * override, else the code-owned Brillipoint default), never `null` mixed
 * with fields from another level.
 * `primaryAction.channel` is never repeated in `socials`.
 */
@ApiExtraModels(SocialCtaWhatsappActionDto, SocialCtaLinkActionDto)
class SocialCtaDto implements SocialCta {
  @ApiPropertyOptional({ type: ThemeTextDto })
  headline?: ThemeText;

  @ApiPropertyOptional({ type: ThemeTextDto })
  subtitle?: ThemeText;

  @ApiPropertyOptional({ type: ThemeTextDto })
  followText?: ThemeText;

  @ApiPropertyOptional({
    oneOf: [
      { $ref: getSchemaPath(SocialCtaWhatsappActionDto) },
      { $ref: getSchemaPath(SocialCtaLinkActionDto) },
    ],
    nullable: true,
  })
  primaryAction?: SocialCta['primaryAction'];

  @ApiPropertyOptional({ type: SocialCtaSocialsDto })
  socials?: SocialCta['socials'];
}

/**
 * Resolved reward promo block: a plain layered block (no fallback chain),
 * so it is `null` whenever an override hides it.
 */
class RewardPromoDto implements RewardPromo {
  @ApiProperty({
    example: '@brillipoint',
    description: 'Social handle guests tag when sharing to get the reward.',
  })
  handle!: string;

  @ApiPropertyOptional({
    type: ThemeTextDto,
    description: 'Promo headline; absent means the frontend i18n default.',
  })
  title?: ThemeText;

  @ApiPropertyOptional({
    type: ThemeTextDto,
    description: 'Promo fine print; absent means no disclaimer.',
  })
  disclaimer?: ThemeText;
}

/** Per-event values available for `{{key}}` placeholders (T6, R6/R7). */
class ThemeTemplateParamsDto implements ThemeTemplateParams {
  @ApiPropertyOptional({
    example: 'Ana y Luis',
    description:
      'Trimmed event.honoreesNames; omitted when the event has none.',
  })
  honoreesName?: string;
}

export class EventThemeTokensDto {
  @Expose()
  @ApiProperty({ example: '#fff5f7' })
  @IsString()
  background!: string;

  @Expose()
  @ApiProperty({ example: '#ec4899' })
  @IsString()
  primary!: string;

  @Expose()
  @ApiProperty({ example: '#ffffff' })
  @IsString()
  onPrimary!: string;

  @Expose()
  @ApiProperty({ example: '#a855f7' })
  @IsString()
  secondary!: string;

  @Expose()
  @ApiProperty({ example: '#831843' })
  @IsString()
  text!: string;

  @Expose()
  @ApiProperty({ example: '#9ca3af' })
  @IsString()
  textMuted!: string;

  @Expose()
  @ApiProperty({ example: '#fce7f3' })
  @IsString()
  surface!: string;

  @Expose()
  @ApiProperty({ example: 'Futura' })
  @IsString()
  fontHeading!: string;

  @Expose()
  @ApiProperty({ example: 'Inter' })
  @IsString()
  fontBody!: string;

  @Expose()
  @ApiPropertyOptional({ example: '#ffffff' })
  @IsString()
  @IsOptional()
  onSecondary?: string;

  @Expose()
  @ApiPropertyOptional({ example: '#831843' })
  @IsString()
  @IsOptional()
  onSurface?: string;

  @Expose()
  @ApiPropertyOptional({ example: '#f59e0b' })
  @IsString()
  @IsOptional()
  accent?: string;

  @Expose()
  @ApiPropertyOptional({ example: '#fbcfe8' })
  @IsString()
  @IsOptional()
  surfaceBorder?: string;

  @Expose()
  @ApiPropertyOptional({ example: '#f9a8d4' })
  @IsString()
  @IsOptional()
  divider?: string;

  @Expose()
  @ApiPropertyOptional({ example: '0 10px 30px rgb(131 24 67 / 0.12)' })
  @IsString()
  @IsOptional()
  surfaceShadow?: string;
}

/**
 * Tokens stored on a preset: every token is optional because missing ones
 * are inherited from SYSTEM_DEFAULT_THEME when the theme is resolved.
 */
export class PresetThemeTokensDto extends PartialType(EventThemeTokensDto) {}

@ApiExtraModels(
  ThemeImageAssetDto,
  ThemeCoverImageAssetDto,
  ThemeSplashIconImageAssetDto,
)
export class PublicEventThemeDto {
  /** Preset id, or `null` when the event has no preset (system default only). */
  @ApiProperty({
    example: 12,
    nullable: true,
    description:
      'Preset (event_themes) id, or null when the event has no preset and only the system default applies.',
  })
  id!: number | null;

  /** Preset key, or the fixed literal `'system-default'` when there is no preset. */
  @ApiProperty({
    example: 'amor-eterno',
    description:
      "Preset key, or the fixed literal 'system-default' when the event has no preset.",
  })
  key!: string;

  /** Preset name, or the fixed literal `'System Default'` when there is no preset. */
  @ApiProperty({
    example: 'Amor Eterno',
    description:
      "Preset name, or the fixed literal 'System Default' when the event has no preset.",
  })
  name!: string;

  @ApiProperty({
    example: '2026-09-27:2026-06-21T10:00:00.000Z',
    description:
      'SYSTEM_DEFAULT_THEME_VERSION combined with the max updatedAt ISO timestamp among the DB layers applied (preset, event overrides).',
  })
  version!: string;

  @ApiProperty({
    type: EventThemeTokensDto,
    description:
      'Complete resolved tokens: SYSTEM_DEFAULT_THEME merged with the Brillipoint default, preset and event overrides. Always fully populated.',
  })
  tokens!: EventThemeTokensDto;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: { $ref: getSchemaPath(ThemeImageAssetDto) },
    description:
      'Resolved typed image slots (logo, splashIcon, hero, watermark, background, cover). The cover slot additionally carries a `link` field (see ThemeCoverImageAssetDto). The splashIcon slot may carry an opaque `plate` color (see ThemeSplashIconImageAssetDto).',
  })
  images?: ThemeImages;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    description: 'Resolved decoration blocks (confetti, sparkles).',
  })
  decorations?: ThemeDecorations;

  @ApiPropertyOptional({
    type: SocialCtaDto,
    nullable: true,
    description:
      'Resolved social CTA block (T6 whole-block fallback: event override, else the code-owned Brillipoint default). The block cannot be hidden: when the event override is not usable it falls back to the Brillipoint block, so it is always present.',
  })
  socialCta?: SocialCta | null;

  @ApiPropertyOptional({
    type: RewardPromoDto,
    nullable: true,
    description:
      'Resolved reward promo block (plain layered merge, no fallback chain): the code-owned Brillipoint default carries one, an event override replaces it, and an override set to null hides it.',
  })
  rewardPromo?: RewardPromo | null;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    description: 'Free-form localized copy map.',
  })
  copy?: ThemeCopy;

  @ApiPropertyOptional({
    type: ThemeTemplateParamsDto,
    description:
      'Per-event values for the `{{key}}` placeholders that may appear inside resolved theme texts (T6). The backend never interpolates them.',
  })
  params?: ThemeTemplateParams;
}

export class PublicEventThemeResponseDto {
  @ApiProperty({ type: PublicEventThemeDto })
  eventTheme!: PublicEventThemeDto;
}
