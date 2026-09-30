/** Which entity owns the theme image being uploaded — maps to a storage folder. */
export enum ThemeAssetOwnerType {
  PRESET = 'preset',
  BRAND_KIT = 'brand-kit',
  EVENT = 'event',
}

/** Typed image slot, mirrors `ThemeImages` (`src/events/theme/theme.types.ts`). */
export enum ThemeAssetSlot {
  LOGO = 'logo',
  SPLASH_ICON = 'splashIcon',
  HERO = 'hero',
  WATERMARK = 'watermark',
  BACKGROUND = 'background',
  COVER = 'cover',
}
