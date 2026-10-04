import type { SocialCta, SocialCtaSocials } from './theme.types';

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
function cleanBlock(block: SocialCta): SocialCta {
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

  return cleaned;
}

/**
 * Whole-block socialCta fallback: the event override when usable, otherwise
 * the default block (the code-owned Brillipoint CTA).
 *
 * - `undefined` or `null` on the event override means "no block", never
 *   "hide": the CTA always reaches the default, our main acquisition point.
 * - A block is picked only if `isUsable`, and taken entirely (fields are
 *   never mixed between the override and the default).
 * - Nothing usable resolves to `null`.
 */
export function resolveSocialCta(
  eventOverride: SocialCta | null | undefined,
  defaultBlock: SocialCta | null | undefined,
): SocialCta | null {
  if (isUsable(eventOverride)) {
    return cleanBlock(eventOverride);
  }

  if (isUsable(defaultBlock)) {
    return cleanBlock(defaultBlock);
  }

  return null;
}
