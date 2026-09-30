/**
 * Pure domain types for the layered theme system.
 *
 * Layers (merged at read time by `resolveTheme`):
 *   SystemDefault (code) -> event_themes preset -> brand_kits -> events.theme_overrides
 *
 * See odd/tasks/theme-brand-kits.md for the full design and decisions.
 */

/** The 9 tokens every resolved theme is guaranteed to have. */
export interface RequiredThemeTokens {
  background: string;
  primary: string;
  onPrimary: string;
  secondary: string;
  text: string;
  textMuted: string;
  surface: string;
  fontHeading: string;
  fontBody: string;
}

/** Optional tokens that may be absent from any layer, including the default. */
export interface OptionalThemeTokens {
  onSecondary?: string;
  onSurface?: string;
  accent?: string;
  surfaceBorder?: string;
  divider?: string;
  surfaceShadow?: string;
}

/** Full set of theme tokens (mirrors `EventThemeTokensDto`). */
export type ThemeTokens = RequiredThemeTokens & OptionalThemeTokens;

/** Localized text: es/en pair, used across image alt text and social copy. */
export interface LocalizedText {
  es?: string;
  en?: string;
}

/** A single typed image slot. */
export interface ThemeImageSlot {
  path: string;
  url: string;
  alt?: LocalizedText;
}

/** The `cover` slot additionally carries a link and a fixed 4:5 aspect ratio. */
export interface ThemeCoverImageSlot extends ThemeImageSlot {
  link?: string;
}

export interface ThemeImages {
  logo?: ThemeImageSlot;
  splashIcon?: ThemeImageSlot;
  hero?: ThemeImageSlot;
  watermark?: ThemeImageSlot;
  background?: ThemeImageSlot;
  cover?: ThemeCoverImageSlot;
}

/** Overridable image slots: any slot may be explicitly removed with `null`. */
export type ThemeImageOverrides = {
  logo?: ThemeImageSlot | null;
  splashIcon?: ThemeImageSlot | null;
  hero?: ThemeImageSlot | null;
  watermark?: ThemeImageSlot | null;
  background?: ThemeImageSlot | null;
  cover?: ThemeCoverImageSlot | null;
};

export interface ThemeConfettiDecoration {
  enabled?: boolean;
  colors?: string[];
  shapes?: string[];
  amount?: number;
}

export interface ThemeSparklesDecoration {
  enabled?: boolean;
}

export interface ThemeDecorations {
  confetti?: ThemeConfettiDecoration;
  sparkles?: ThemeSparklesDecoration;
}

/** Overridable decorations: each block may be explicitly removed with `null`. */
export interface ThemeDecorationOverrides {
  confetti?: ThemeConfettiDecoration | null;
  sparkles?: ThemeSparklesDecoration | null;
}

/**
 * A piece of copy, resolved either from an i18n key (frontend interpolates
 * `params`) or from inline localized text.
 *
 * Either variant may reference a `{{key}}` placeholder (T6, decisions
 * R6/R7); the backend never interpolates it. `fallback` is an optional
 * ThemeText WITHOUT placeholders that `applyTemplateFallback` (T6) swaps in
 * when a referenced placeholder has no matching entry in the resolved
 * `params`. When no `fallback` is given, the frontend renders a missing
 * param as `''`.
 */
export type ThemeText =
  | { key: string; params?: Record<string, string>; fallback?: ThemeText }
  | { text: LocalizedText; fallback?: ThemeText };

/**
 * Per-event values available for `{{key}}` placeholders in resolved theme
 * texts (T6, decisions R6/R7). The backend exposes these so the frontend can
 * interpolate; it never substitutes them itself.
 */
export interface ThemeTemplateParams {
  /** Trimmed `event.honoreesNames`; omitted when empty. */
  honoreesName?: string;
  /** Name of the brand kit that supplied the resolved socialCta block; omitted when none did. */
  brandName?: string;
}

export type SocialCtaChannel =
  | 'whatsapp'
  | 'instagram'
  | 'tiktok'
  | 'facebook'
  | 'url';

/** WhatsApp stores `phone` + a `message` template; the frontend interpolates
 * and builds the `https://wa.me/<phone>?text=<encoded>` link. */
export interface SocialCtaWhatsappAction {
  channel: 'whatsapp';
  label: ThemeText;
  phone: string;
  message?: ThemeText;
}

/** Every other channel stores a ready-to-use URL. */
export interface SocialCtaLinkAction {
  channel: 'instagram' | 'tiktok' | 'facebook' | 'url';
  label: ThemeText;
  url: string;
}

export type SocialCtaPrimaryAction =
  | SocialCtaWhatsappAction
  | SocialCtaLinkAction;

/**
 * `whatsapp` is a ready `https://wa.me/<digits>` link (no prefilled message —
 * that stays exclusive to a whatsapp `primaryAction`). `url` is a generic
 * website link.
 */
export interface SocialCtaSocials {
  whatsapp?: string;
  instagram?: string;
  tiktok?: string;
  facebook?: string;
  url?: string;
}

/**
 * Whole-block social CTA. Merge treats this as ATOMIC: a layer either omits
 * it (inherit), sets it to `null` (remove), or replaces the whole block.
 * Full resolution/fallback rules (T6) are out of scope here.
 */
export interface SocialCta {
  brandKitKey?: string;
  headline?: ThemeText;
  subtitle?: ThemeText;
  followText?: ThemeText;
  primaryAction?: SocialCtaPrimaryAction | null;
  socials?: SocialCtaSocials;
}

/** Free-form copy map, deep-merged by key; a `null` value removes that key. */
export type ThemeCopy = Record<string, ThemeText>;
export type ThemeCopyOverrides = Record<string, ThemeText | null>;

/**
 * Shared partial shape for presets, brand kits, and per-event overrides.
 * Every field is optional; `undefined` means inherit from the previous
 * layer, `null` means explicitly remove (where removal is meaningful).
 */
export interface ThemeOverrides {
  /**
   * Token values. Required tokens can only be overridden with a string,
   * never removed with `null` — that is why this is `Partial<ThemeTokens>`
   * rather than a nullable variant.
   */
  tokens?: Partial<ThemeTokens>;
  images?: ThemeImageOverrides;
  decorations?: ThemeDecorationOverrides;
  socialCta?: SocialCta | null;
  copy?: ThemeCopyOverrides;
  /**
   * T4 migration-only field: preserves the legacy `events.decorative_icon`
   * value (a short icon key such as `rings`/`balloon`/`graduation`, not an
   * image) when that column is dropped. No typed image or decoration slot
   * is a faithful match, so it is carried here verbatim. Not read by
   * `resolveTheme`, not exposed by any DTO, and not written by any API —
   * a future task may give it real behavior or remove it.
   */
  decorativeIcon?: string;
}

/** The fully merged theme returned by `resolveTheme`. */
export interface ResolvedTheme {
  tokens: ThemeTokens;
  images: ThemeImages;
  decorations: ThemeDecorations;
  socialCta: SocialCta | null;
  copy: ThemeCopy;
}
