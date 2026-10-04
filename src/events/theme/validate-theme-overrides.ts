import {
  registerDecorator,
  Validate,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  type ValidationOptions,
} from 'class-validator';

import { contrastRatio, isHexColor } from './contrast-ratio';
import type { ThemeTemplateParams } from './theme.types';

/**
 * Pure validator for the `ThemeOverrides` shape shared by `event_themes`
 * presets and `events.theme_overrides`. Returns human-readable error paths;
 * an empty array means the value is valid. `null`/`undefined` are always
 * valid (absence means "inherit").
 */

/** The only placeholder keys any `ThemeText` (or its params) may reference. */
export const ALLOWED_TEMPLATE_PARAM_KEYS: ReadonlyArray<
  keyof ThemeTemplateParams
> = ['honoreesName'];

const PLACEHOLDER_RE = /\{\{\s*(\w+)\s*\}\}/g;

const COLOR_TOKEN_KEYS = [
  'background',
  'primary',
  'onPrimary',
  'secondary',
  'text',
  'textMuted',
  'surface',
  'onSecondary',
  'onSurface',
  'accent',
  'surfaceBorder',
  'divider',
] as const;
const FREE_STRING_TOKEN_KEYS = [
  'fontHeading',
  'fontBody',
  'surfaceShadow',
] as const;
const KNOWN_TOKEN_KEYS = new Set<string>([
  ...COLOR_TOKEN_KEYS,
  ...FREE_STRING_TOKEN_KEYS,
]);

/** Text and icon pairs used by the public UI; validate when both layer values exist. */
const CONTRAST_PAIRS: ReadonlyArray<readonly [string, string]> = [
  ['primary', 'onPrimary'],
  ['secondary', 'onSecondary'],
  ['surface', 'onSurface'],
  ['background', 'text'],
  ['background', 'textMuted'],
  ['surface', 'textMuted'],
];

/** Public theme pairs are not classified as large text, so use normal text AA. */
export const MIN_CONTRAST_RATIO = 4.5;

const REQUIRED_PUBLIC_COLOR_TOKENS = [
  'background',
  'text',
  'textMuted',
  'surface',
  'onSurface',
  'primary',
  'onPrimary',
  'secondary',
  'onSecondary',
  'surfaceBorder',
  'divider',
] as const;

const OPAQUE_HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;
const SUPPORTED_SURFACE_SHADOW_RE =
  /^0 (?:0|[1-9]\d?)px (?:0|[1-9]\d{0,2})px rgb\((?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d) (?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d) (?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d) \/ (?:0(?:\.\d+)?|1(?:\.0+)?)\)$/;

const IMAGE_SLOT_KEYS = [
  'logo',
  'splashIcon',
  'hero',
  'watermark',
  'background',
  'cover',
] as const;
const DECORATION_KEYS = ['confetti', 'sparkles'] as const;
const SOCIAL_KEYS = [
  'whatsapp',
  'instagram',
  'tiktok',
  'facebook',
  'url',
] as const;
/** `decorativeIcon` is legacy (T4 migration carry-over): allowed, not documented. */
const TOP_LEVEL_KEYS = [
  'tokens',
  'images',
  'decorations',
  'socialCta',
  'rewardPromo',
  'copy',
  'decorativeIcon',
] as const;
const REWARD_PROMO_KEYS = ['handle', 'title', 'disclaimer'] as const;
/** `@` plus 1-30 Instagram/TikTok-style handle characters. */
const REWARD_PROMO_HANDLE_RE = /^@[A-Za-z0-9._]{1,30}$/;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isHttpsUrl(value: unknown): boolean {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return false;
  }
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

function extractPlaceholderKeys(haystacks: string[]): string[] {
  const keys = new Set<string>();
  for (const haystack of haystacks) {
    for (const match of haystack.matchAll(PLACEHOLDER_RE)) {
      keys.add(match[1]);
    }
  }
  return [...keys];
}

/** Strings a `ThemeText`-shaped object may hold a `{{placeholder}}` in. */
function themeTextHaystacks(value: Record<string, unknown>): string[] {
  const haystacks: string[] = [];

  if (typeof value.key === 'string') {
    haystacks.push(value.key);
  }
  if (isPlainObject(value.params)) {
    for (const paramValue of Object.values(value.params)) {
      if (typeof paramValue === 'string') {
        haystacks.push(paramValue);
      }
    }
  }
  if (isPlainObject(value.text)) {
    const text = value.text;
    if (typeof text.es === 'string') haystacks.push(text.es);
    if (typeof text.en === 'string') haystacks.push(text.en);
  }

  return haystacks;
}

/**
 * Validates a `ThemeText`: `{ key, params? }` xor `{ text: { es?, en? } }`
 * (at least one language), plus an optional `fallback` (itself a ThemeText
 * that must carry NO placeholders).
 */
function validateThemeText(
  value: unknown,
  path: string,
  errors: string[],
  options: { noPlaceholders?: boolean } = {},
): void {
  if (!isPlainObject(value)) {
    errors.push(`${path}: must be an object with either "key" or "text"`);
    return;
  }

  const hasKey = value.key !== undefined;
  const hasText = value.text !== undefined;

  if (hasKey === hasText) {
    errors.push(`${path}: must have exactly one of "key" or "text"`);
  } else if (hasKey) {
    if (typeof value.key !== 'string' || value.key.trim().length === 0) {
      errors.push(`${path}.key: must be a non-empty string`);
    }
    if (value.params !== undefined) {
      if (!isPlainObject(value.params)) {
        errors.push(`${path}.params: must be an object`);
      } else {
        for (const [paramKey, paramValue] of Object.entries(value.params)) {
          if (typeof paramValue !== 'string') {
            errors.push(`${path}.params.${paramKey}: must be a string`);
          }
        }
      }
    }
  } else {
    if (!isPlainObject(value.text)) {
      errors.push(`${path}.text: must be an object`);
    } else {
      const { es, en } = value.text;
      if (es === undefined && en === undefined) {
        errors.push(`${path}.text: must set at least one of "es" or "en"`);
      }
      if (es !== undefined && typeof es !== 'string') {
        errors.push(`${path}.text.es: must be a string`);
      }
      if (en !== undefined && typeof en !== 'string') {
        errors.push(`${path}.text.en: must be a string`);
      }
    }
  }

  const placeholderKeys = extractPlaceholderKeys(themeTextHaystacks(value));

  if (options.noPlaceholders) {
    if (placeholderKeys.length > 0) {
      errors.push(`${path}: must not contain placeholders`);
    }
  } else {
    for (const key of placeholderKeys) {
      if (!(ALLOWED_TEMPLATE_PARAM_KEYS as readonly string[]).includes(key)) {
        errors.push(
          `${path}: unknown placeholder "{{${key}}}" (allowed: ${ALLOWED_TEMPLATE_PARAM_KEYS.join(', ')})`,
        );
      }
    }
  }

  if (value.fallback !== undefined) {
    validateThemeText(value.fallback, `${path}.fallback`, errors, {
      noPlaceholders: true,
    });
  }
}

/**
 * Checks authored color/shadow formats and any foreground/background pairs
 * fully supplied by a partial layer. The final-theme validator below adds
 * required-role checks after all layers have been merged.
 */
export function validateTokenContrast(
  tokens: unknown,
  path = 'tokens',
): string[] {
  const errors: string[] = [];

  if (!isPlainObject(tokens)) {
    return errors;
  }

  for (const key of COLOR_TOKEN_KEYS) {
    if (
      typeof tokens[key] === 'string' &&
      !OPAQUE_HEX_COLOR_RE.test(tokens[key])
    ) {
      errors.push(`${path}.${key}: must be an opaque #RRGGBB color`);
    }
  }

  if (
    tokens.surfaceShadow !== undefined &&
    (typeof tokens.surfaceShadow !== 'string' ||
      !SUPPORTED_SURFACE_SHADOW_RE.test(tokens.surfaceShadow))
  ) {
    errors.push(`${path}.surfaceShadow: must use the supported shadow format`);
  }

  for (const [tokenA, tokenB] of CONTRAST_PAIRS) {
    const a = tokens[tokenA];
    const b = tokens[tokenB];

    if (
      typeof a === 'string' &&
      typeof b === 'string' &&
      OPAQUE_HEX_COLOR_RE.test(a) &&
      OPAQUE_HEX_COLOR_RE.test(b)
    ) {
      const ratio = contrastRatio(a, b);
      if (ratio < MIN_CONTRAST_RATIO) {
        errors.push(
          `${path}: ${tokenA}/${tokenB} contrast ratio ${ratio.toFixed(2)} is below the minimum ${MIN_CONTRAST_RATIO}`,
        );
      }
    }
  }

  return errors;
}

/** Validate the complete palette after all authoring layers have been merged. */
export function validatePublicThemeTokens(
  tokens: unknown,
  path = 'tokens',
): string[] {
  const errors: string[] = [];

  if (!isPlainObject(tokens)) {
    return [`${path}: must be an object`];
  }

  for (const key of REQUIRED_PUBLIC_COLOR_TOKENS) {
    if (tokens[key] === undefined || tokens[key] === null) {
      errors.push(`${path}.${key}: is required`);
    }
  }

  for (const key of COLOR_TOKEN_KEYS) {
    if (tokens[key] !== undefined && typeof tokens[key] !== 'string') {
      errors.push(`${path}.${key}: must be an opaque #RRGGBB color`);
    }
  }

  for (const [key, value] of Object.entries(tokens)) {
    if (!KNOWN_TOKEN_KEYS.has(key)) {
      errors.push(`${path}.${key}: unknown token`);
    } else if (
      FREE_STRING_TOKEN_KEYS.includes(
        key as (typeof FREE_STRING_TOKEN_KEYS)[number],
      ) &&
      typeof value !== 'string'
    ) {
      errors.push(`${path}.${key}: must be a string`);
    }
  }

  errors.push(...validateTokenContrast(tokens, path));
  return errors;
}

function validateTokens(tokens: unknown, path: string, errors: string[]): void {
  if (!isPlainObject(tokens)) {
    errors.push(`${path}: must be an object`);
    return;
  }

  for (const [key, value] of Object.entries(tokens)) {
    const tokenPath = `${path}.${key}`;

    if (!KNOWN_TOKEN_KEYS.has(key)) {
      errors.push(`${tokenPath}: unknown token`);
      continue;
    }

    if (typeof value !== 'string') {
      errors.push(`${tokenPath}: must be a string`);
      continue;
    }
  }

  errors.push(...validateTokenContrast(tokens, path));
}

function validateImages(images: unknown, path: string, errors: string[]): void {
  if (!isPlainObject(images)) {
    errors.push(`${path}: must be an object`);
    return;
  }

  for (const [key, value] of Object.entries(images)) {
    const slotPath = `${path}.${key}`;

    if (!(IMAGE_SLOT_KEYS as readonly string[]).includes(key)) {
      errors.push(`${slotPath}: unknown image slot`);
      continue;
    }

    if (value === null) {
      continue; // explicit removal
    }

    if (!isPlainObject(value)) {
      errors.push(`${slotPath}: must be an object`);
      continue;
    }

    if (!isHttpsUrl(value.url)) {
      errors.push(`${slotPath}.url: must be an https URL`);
    }

    if (
      key === 'cover' &&
      value.link !== undefined &&
      value.link !== null &&
      !isHttpsUrl(value.link)
    ) {
      errors.push(`${slotPath}.link: must be an https URL`);
    }

    if (value.plate !== undefined) {
      if (key !== 'splashIcon') {
        errors.push(`${slotPath}.plate: only allowed on splashIcon`);
      } else if (
        typeof value.plate !== 'string' ||
        !OPAQUE_HEX_COLOR_RE.test(value.plate)
      ) {
        errors.push(`${slotPath}.plate: must be an opaque #RRGGBB color`);
      }
    }
  }
}

/**
 * Confetti shapes are keys into the frontend SVG catalog (e.g. `rose`,
 * `soccer-ball`). Only the slug format is validated here, never a fixed
 * list, so adding a shape needs a frontend deploy only; the frontend
 * ignores unknown keys and falls back to the default confetti.
 */
const MAX_CONFETTI_SHAPES = 20;
const CONFETTI_SHAPE_SLUG = /^[a-z0-9][a-z0-9-]{0,39}$/;

function isConfettiShapeSlug(shape: unknown): boolean {
  return typeof shape === 'string' && CONFETTI_SHAPE_SLUG.test(shape);
}

function validateDecorations(
  decorations: unknown,
  path: string,
  errors: string[],
): void {
  if (!isPlainObject(decorations)) {
    errors.push(`${path}: must be an object`);
    return;
  }

  for (const [key, value] of Object.entries(decorations)) {
    const blockPath = `${path}.${key}`;

    if (!(DECORATION_KEYS as readonly string[]).includes(key)) {
      errors.push(`${blockPath}: unknown decoration`);
      continue;
    }

    if (value === null) {
      continue; // explicit removal
    }

    if (!isPlainObject(value)) {
      errors.push(`${blockPath}: must be an object`);
      continue;
    }

    if (value.enabled !== undefined && typeof value.enabled !== 'boolean') {
      errors.push(`${blockPath}.enabled: must be a boolean`);
    }

    if (key === 'confetti') {
      if (value.colors !== undefined) {
        const colors = value.colors;
        if (
          !Array.isArray(colors) ||
          colors.some((color) => !isHexColor(color))
        ) {
          errors.push(
            `${blockPath}.colors: must be an array of valid hex colors`,
          );
        }
      }

      if (value.shapes !== undefined) {
        const shapes = value.shapes;
        if (
          !Array.isArray(shapes) ||
          shapes.length > MAX_CONFETTI_SHAPES ||
          shapes.some((shape) => !isConfettiShapeSlug(shape))
        ) {
          errors.push(
            `${blockPath}.shapes: must be an array of up to ${MAX_CONFETTI_SHAPES} slugs (lowercase letters, digits and hyphens)`,
          );
        }
      }

      if (value.amount !== undefined) {
        const amount = value.amount;
        if (
          typeof amount !== 'number' ||
          !Number.isInteger(amount) ||
          amount < 0 ||
          amount > 500
        ) {
          errors.push(
            `${blockPath}.amount: must be an integer between 0 and 500`,
          );
        }
      }
    }
  }
}

function validatePrimaryAction(
  value: unknown,
  path: string,
  errors: string[],
): void {
  if (!isPlainObject(value)) {
    errors.push(`${path}: must be an object`);
    return;
  }

  if (value.label === undefined) {
    errors.push(`${path}.label: is required`);
  } else {
    validateThemeText(value.label, `${path}.label`, errors);
  }

  const channel = value.channel;

  if (channel === 'whatsapp') {
    if (typeof value.phone !== 'string' || !/^\d{8,15}$/.test(value.phone)) {
      errors.push(`${path}.phone: must contain only digits, 8-15 characters`);
    }
    if (value.message !== undefined) {
      validateThemeText(value.message, `${path}.message`, errors);
    }
  } else if (
    channel === 'instagram' ||
    channel === 'tiktok' ||
    channel === 'facebook' ||
    channel === 'url'
  ) {
    if (!isHttpsUrl(value.url)) {
      errors.push(`${path}.url: must be an https URL`);
    }
  } else {
    errors.push(
      `${path}.channel: must be one of whatsapp, instagram, tiktok, facebook, url`,
    );
  }
}

function validateSocialCta(
  socialCta: unknown,
  path: string,
  errors: string[],
): void {
  // No `null`: the socialCta block can never be hidden, so the chain always
  // reaches the Brillipoint default, our main acquisition point.
  if (!isPlainObject(socialCta)) {
    errors.push(`${path}: must be an object`);
    return;
  }

  for (const field of ['headline', 'subtitle', 'followText'] as const) {
    const value = socialCta[field];
    if (value !== undefined) {
      validateThemeText(value, `${path}.${field}`, errors);
    }
  }

  if (
    socialCta.primaryAction !== undefined &&
    socialCta.primaryAction !== null
  ) {
    validatePrimaryAction(
      socialCta.primaryAction,
      `${path}.primaryAction`,
      errors,
    );
  }

  if (socialCta.socials !== undefined) {
    const socials = socialCta.socials;
    if (!isPlainObject(socials)) {
      errors.push(`${path}.socials: must be an object`);
    } else {
      for (const [key, value] of Object.entries(socials)) {
        const socialPath = `${path}.socials.${key}`;
        if (!(SOCIAL_KEYS as readonly string[]).includes(key)) {
          errors.push(`${socialPath}: unknown social`);
          continue;
        }
        if (!isHttpsUrl(value)) {
          errors.push(`${socialPath}: must be an https URL`);
        }
      }
    }
  }
}

function validateRewardPromo(
  rewardPromo: unknown,
  path: string,
  errors: string[],
): void {
  // Unlike socialCta, `null` is allowed: it hides the reward promo.
  if (rewardPromo === null) {
    return;
  }

  if (!isPlainObject(rewardPromo)) {
    errors.push(`${path}: must be an object or null`);
    return;
  }

  for (const key of Object.keys(rewardPromo)) {
    if (!(REWARD_PROMO_KEYS as readonly string[]).includes(key)) {
      errors.push(`${path}.${key}: unknown field`);
    }
  }

  if (
    typeof rewardPromo.handle !== 'string' ||
    !REWARD_PROMO_HANDLE_RE.test(rewardPromo.handle)
  ) {
    errors.push(
      `${path}.handle: must be an @handle of 1-30 letters, digits, dots or underscores`,
    );
  }

  for (const field of ['title', 'disclaimer'] as const) {
    const value = rewardPromo[field];
    if (value !== undefined) {
      validateThemeText(value, `${path}.${field}`, errors);
    }
  }
}

function validateCopy(copy: unknown, path: string, errors: string[]): void {
  if (!isPlainObject(copy)) {
    errors.push(`${path}: must be an object`);
    return;
  }

  for (const [key, value] of Object.entries(copy)) {
    if (value === null) {
      continue; // explicit removal
    }
    validateThemeText(value, `${path}.${key}`, errors);
  }
}

/**
 * Validates a `ThemeOverrides`-shaped value, returning human-readable error
 * paths (e.g. `socialCta.socials.instagram: must be an https URL`). An empty
 * array means the value is valid. `null`/`undefined` are always valid.
 */
export function validateThemeOverrides(value: unknown): string[] {
  const errors: string[] = [];

  if (value === null || value === undefined) {
    return errors;
  }

  if (!isPlainObject(value)) {
    errors.push('root: must be an object');
    return errors;
  }

  for (const key of Object.keys(value)) {
    if (!(TOP_LEVEL_KEYS as readonly string[]).includes(key)) {
      errors.push(`${key}: unknown top-level key`);
    }
  }

  if (value.tokens !== undefined) {
    validateTokens(value.tokens, 'tokens', errors);
  }
  if (value.images !== undefined) {
    validateImages(value.images, 'images', errors);
  }
  if (value.decorations !== undefined) {
    validateDecorations(value.decorations, 'decorations', errors);
  }
  if (value.socialCta !== undefined) {
    validateSocialCta(value.socialCta, 'socialCta', errors);
  }
  if (value.rewardPromo !== undefined) {
    validateRewardPromo(value.rewardPromo, 'rewardPromo', errors);
  }
  if (value.copy !== undefined) {
    validateCopy(value.copy, 'copy', errors);
  }
  if (
    value.decorativeIcon !== undefined &&
    typeof value.decorativeIcon !== 'string'
  ) {
    errors.push('decorativeIcon: must be a string');
  }

  return errors;
}

/** class-validator property decorator wrapping `validateThemeOverrides`. */
export function IsThemeOverrides(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isThemeOverrides',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown) {
          if (value === null || value === undefined) {
            return true;
          }
          return validateThemeOverrides(value).length === 0;
        },
        defaultMessage(args) {
          const errors = validateThemeOverrides(args?.value);
          return errors.length > 0
            ? errors.join('; ')
            : `${args?.property} must be a valid ThemeOverrides object`;
        },
      },
    });
  };
}

@ValidatorConstraint({ name: 'isTokenContrastValid', async: false })
export class IsTokenContrastValidConstraint
  implements ValidatorConstraintInterface
{
  private lastErrors: string[] = [];

  validate(value: unknown): boolean {
    this.lastErrors = validateTokenContrast(value);
    return this.lastErrors.length === 0;
  }

  defaultMessage(): string {
    return this.lastErrors.join('; ');
  }
}

/** Applies partial token format and contrast rules to an authoring property. */
export function IsTokenContrastValid() {
  return Validate(IsTokenContrastValidConstraint);
}
