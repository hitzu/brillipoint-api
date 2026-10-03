import { SYSTEM_DEFAULT_THEME } from './system-default.theme';
import type {
  ResolvedTheme,
  RewardPromo,
  SocialCta,
  ThemeCopy,
  ThemeDecorations,
  ThemeImages,
  ThemeOverrides,
  ThemeTokens,
} from './theme.types';

const IMAGE_SLOT_KEYS = [
  'logo',
  'splashIcon',
  'hero',
  'watermark',
  'background',
  'cover',
] as const;

const DECORATION_KEYS = ['confetti', 'sparkles'] as const;

/**
 * Maps an optional "role" token to the required "source" token it derives
 * from when no layer explicitly sets the role, mirroring how the production
 * frontend completed missing roles (odd/tasks/theme-refit.md T0b): a theme
 * with its own colors should never fall back to neutral system-default
 * grays for a role nobody set. `surfaceShadow` is intentionally excluded —
 * it always keeps the system default when absent, never derived.
 */
const ROLE_TOKEN_SOURCES = {
  accent: 'primary',
  onSecondary: 'onPrimary',
  divider: 'textMuted',
  surfaceBorder: 'textMuted',
  onSurface: 'text',
} as const satisfies Partial<Record<keyof ThemeTokens, keyof ThemeTokens>>;

function deepClone<T>(value: T): T {
  return structuredClone(value);
}

function mergeTokens(
  base: ThemeTokens,
  overrides: Partial<ThemeTokens> | undefined,
): ThemeTokens {
  const merged: ThemeTokens = { ...base };

  if (!overrides) {
    return merged;
  }

  // Tokens cannot be removed: null (possible in untyped jsonb) inherits too,
  // so the resolved theme always keeps every required token.
  for (const key of Object.keys(overrides) as Array<keyof ThemeTokens>) {
    const value = overrides[key];
    if (value !== undefined && value !== null) {
      merged[key] = value;
    }
  }

  return merged;
}

/**
 * Each typed image slot is merged atomically: undefined inherits the
 * previous slot, null removes it, and a provided slot object replaces the
 * previous one wholesale (never deep-merged field by field).
 */
function mergeImages(
  base: ThemeImages,
  overrides: ThemeOverrides['images'] | undefined,
): ThemeImages {
  const merged: ThemeImages = deepClone(base);

  if (!overrides) {
    return merged;
  }

  for (const key of IMAGE_SLOT_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(overrides, key)) {
      continue;
    }

    const value = overrides[key];

    if (value === null) {
      delete merged[key];
    } else if (value !== undefined) {
      (merged as Record<string, unknown>)[key] = deepClone(value);
    }
  }

  return merged;
}

/**
 * Decoration blocks (confetti, sparkles) merge field by field so a layer can
 * tweak one property (e.g. confetti colors) and inherit the rest. null
 * removes the whole block; arrays inside a block replace, never concatenate.
 */
function mergeDecorations(
  base: ThemeDecorations,
  overrides: ThemeOverrides['decorations'] | undefined,
): ThemeDecorations {
  const merged: ThemeDecorations = deepClone(base);

  if (!overrides) {
    return merged;
  }

  for (const key of DECORATION_KEYS) {
    const value = overrides[key];

    if (value === null) {
      delete merged[key];
    } else if (value !== undefined) {
      const block: Record<string, unknown> = { ...merged[key] };
      for (const [field, fieldValue] of Object.entries(value)) {
        if (fieldValue !== undefined) {
          block[field] = deepClone(fieldValue);
        }
      }
      (merged as Record<string, unknown>)[key] = block;
    }
  }

  return merged;
}

/**
 * socialCta is an atomic block per the design: undefined inherits, null
 * removes, and a provided object replaces the whole block (never deep
 * merged). Full fallback resolution is out of scope for T1 (see T6).
 */
function mergeSocialCta(
  base: SocialCta | null,
  override: SocialCta | null | undefined,
): SocialCta | null {
  if (override === undefined) {
    return base ? deepClone(base) : null;
  }

  if (override === null) {
    return null;
  }

  return deepClone(override);
}

/**
 * rewardPromo is an atomic block with plain layer semantics: undefined
 * inherits, null removes (hides the promo), and a provided object replaces
 * the whole block. Unlike socialCta there is no never-hide fallback chain.
 */
function mergeRewardPromo(
  base: RewardPromo | null,
  override: RewardPromo | null | undefined,
): RewardPromo | null {
  if (override === undefined) {
    return base ? deepClone(base) : null;
  }

  if (override === null) {
    return null;
  }

  return deepClone(override);
}

/** copy deep-merges by key; a null value for a key removes that key. */
function mergeCopy(
  base: ThemeCopy,
  overrides: ThemeOverrides['copy'] | undefined,
): ThemeCopy {
  const merged: ThemeCopy = deepClone(base);

  if (!overrides) {
    return merged;
  }

  for (const [key, value] of Object.entries(overrides)) {
    if (value === null) {
      delete merged[key];
    } else if (value !== undefined) {
      merged[key] = deepClone(value);
    }
  }

  return merged;
}

/**
 * Merges layered `ThemeOverrides` on top of `SYSTEM_DEFAULT_THEME`.
 *
 * - `undefined` fields inherit the previous layer's value.
 * - `null` fields explicitly remove the value (where nullable).
 * - Arrays always replace, never concatenate.
 * - Plain objects deep-merge, except `socialCta`, `rewardPromo` and image
 *   slots, which are atomic (whole-block replace).
 * - Required tokens are always present in the result.
 * - Inputs (including `SYSTEM_DEFAULT_THEME`) are never mutated; every
 *   returned object is freshly created.
 * - `null`/`undefined` layers are skipped entirely.
 */
export function resolveTheme(
  ...layers: Array<ThemeOverrides | null | undefined>
): ResolvedTheme {
  let result: ResolvedTheme = deepClone(SYSTEM_DEFAULT_THEME);
  const explicitTokenKeys = new Set<keyof ThemeTokens>();

  for (const layer of layers) {
    if (layer === null || layer === undefined) {
      continue;
    }

    if (layer.tokens) {
      for (const key of Object.keys(layer.tokens) as Array<
        keyof ThemeTokens
      >) {
        const value = layer.tokens[key];
        if (value !== undefined && value !== null) {
          explicitTokenKeys.add(key);
        }
      }
    }

    result = {
      tokens: mergeTokens(result.tokens, layer.tokens),
      images: mergeImages(result.images, layer.images),
      decorations: mergeDecorations(result.decorations, layer.decorations),
      socialCta: mergeSocialCta(result.socialCta, layer.socialCta),
      rewardPromo: mergeRewardPromo(result.rewardPromo, layer.rewardPromo),
      copy: mergeCopy(result.copy, layer.copy),
    };
  }

  // A role token nobody explicitly set is stale system-default gray as soon
  // as its source token changes: re-derive it from the theme's own final
  // color instead of leaving it pinned to the neutral default.
  for (const [role, source] of Object.entries(ROLE_TOKEN_SOURCES) as Array<
    [keyof ThemeTokens, keyof ThemeTokens]
  >) {
    if (!explicitTokenKeys.has(role) && explicitTokenKeys.has(source)) {
      const tokens = result.tokens as unknown as Record<string, string>;
      tokens[role] = tokens[source];
    }
  }

  return result;
}
