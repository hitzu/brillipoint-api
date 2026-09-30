import type {
  SocialCta,
  SocialCtaSocials,
  ThemeOverrides,
} from './theme.types';

/** A brand kit candidate for the socialCta fallback chain (T6, decision R3/T6 spec). */
export interface SocialCtaKitCandidate {
  key: string;
  name: string;
  overrides: ThemeOverrides;
}

export interface SocialCtaResolution {
  socialCta: SocialCta | null;
  /** Name of the kit that supplied the block; absent when the event override supplied it, or nothing did. */
  brandName?: string;
}

const SOCIAL_KEYS: readonly (keyof SocialCtaSocials)[] = [
  'whatsapp',
  'instagram',
  'tiktok',
  'facebook',
  'url',
];

/** A block is usable only if it has a primaryAction or at least one non-empty social. */
function isUsable(block: SocialCta | null | undefined): block is SocialCta {
  if (!block) {
    return false;
  }

  if (block.primaryAction) {
    return true;
  }

  return SOCIAL_KEYS.some((key) => {
    const value = block.socials?.[key];
    return typeof value === 'string' && value.trim().length > 0;
  });
}

/**
 * Removes the primary channel's entry from `socials` (not repeated) and
 * drops empty-string/null socials, keeping the rest of the block untouched.
 */
function cleanBlock(
  block: SocialCta,
  brandKitKey: string | undefined,
): SocialCta {
  const cleaned: SocialCta = { ...block };
  const primaryChannel = block.primaryAction?.channel;
  const socials: Partial<SocialCtaSocials> = { ...(block.socials ?? {}) };

  for (const key of SOCIAL_KEYS) {
    const value = socials[key];
    const isPrimaryChannel = key === primaryChannel;
    const isEmpty = typeof value !== 'string' || value.trim().length === 0;

    if (isPrimaryChannel || isEmpty) {
      delete socials[key];
    }
  }

  if (Object.keys(socials).length > 0) {
    cleaned.socials = socials;
  } else {
    delete cleaned.socials;
  }

  if (brandKitKey !== undefined) {
    cleaned.brandKitKey = brandKitKey;
  }

  return cleaned;
}

/**
 * Whole-block socialCta fallback (T6). Candidate blocks, in order:
 * event override -> client kit -> business kit -> Brillipoint default kit
 * (the caller supplies the ordered `kits` list).
 *
 * - `undefined` at a level means "go to the next level".
 * - `null` at any level (event override or kit) means "no block", never
 *   "hide"; the chain continues. The block cannot be hidden so it always
 *   reaches the Brillipoint kit, our main acquisition point.
 * - A block is picked only if `isUsable`; the FIRST usable block is taken
 *   entirely (fields are never mixed across levels).
 * - Nothing usable anywhere resolves to `{ socialCta: null }`.
 */
export function resolveSocialCta(
  eventOverride: SocialCta | null | undefined,
  kits: Array<SocialCtaKitCandidate | null | undefined>,
): SocialCtaResolution {
  if (isUsable(eventOverride)) {
    return { socialCta: cleanBlock(eventOverride, eventOverride.brandKitKey) };
  }

  for (const kit of kits) {
    if (!kit) {
      continue;
    }

    const block = kit.overrides.socialCta;
    if (!isUsable(block)) {
      continue;
    }

    return { socialCta: cleanBlock(block, kit.key), brandName: kit.name };
  }

  return { socialCta: null };
}
