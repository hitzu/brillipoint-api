import type {
  SocialCta,
  SocialCtaPrimaryAction,
  ThemeCopy,
  ThemeTemplateParams,
  ThemeText,
} from './theme.types';

/** Matches `{{key}}` placeholders (whitespace inside the braces is tolerated). */
const PLACEHOLDER_RE = /\{\{\s*(\w+)\s*\}\}/g;

function extractPlaceholderKeys(text: ThemeText): string[] {
  const haystacks: string[] = [];

  if ('text' in text) {
    if (text.text.es) haystacks.push(text.text.es);
    if (text.text.en) haystacks.push(text.text.en);
  }

  if ('key' in text) {
    haystacks.push(text.key);
    if (text.params) {
      haystacks.push(...Object.values(text.params));
    }
  }

  const keys = new Set<string>();
  for (const haystack of haystacks) {
    for (const match of haystack.matchAll(PLACEHOLDER_RE)) {
      keys.add(match[1]);
    }
  }

  return [...keys];
}

/**
 * Detects (never substitutes) `{{key}}` placeholders in `text`. When any
 * referenced placeholder has no matching entry in `params` and a `fallback`
 * (itself a placeholder-free ThemeText) is present, returns the fallback.
 * Otherwise returns `text` unchanged. Either way, the returned value never
 * carries the `fallback` field — it is backend bookkeeping, not part of the
 * public response — and the frontend renders a missing param as `''` when
 * no fallback was given (decisions R6/R7).
 */
export function applyTemplateFallback(
  text: ThemeText,
  params: ThemeTemplateParams,
): ThemeText {
  const placeholderKeys = extractPlaceholderKeys(text);
  const availableParams = params as Record<string, string | undefined>;
  const hasMissingParam = placeholderKeys.some(
    (key) => availableParams[key] === undefined,
  );

  const { fallback, ...withoutFallback } = text;

  if (hasMissingParam && fallback) {
    return fallback;
  }

  return withoutFallback as ThemeText;
}

function applyToPrimaryAction(
  primaryAction: SocialCtaPrimaryAction | null | undefined,
  params: ThemeTemplateParams,
): SocialCtaPrimaryAction | null | undefined {
  if (!primaryAction) {
    return primaryAction;
  }

  const label = applyTemplateFallback(primaryAction.label, params);

  if (primaryAction.channel === 'whatsapp') {
    return {
      ...primaryAction,
      label,
      message: primaryAction.message
        ? applyTemplateFallback(primaryAction.message, params)
        : primaryAction.message,
    };
  }

  return { ...primaryAction, label };
}

/**
 * Applies `applyTemplateFallback` to every ThemeText inside a resolved
 * socialCta block: headline, subtitle, followText, and the primaryAction's
 * label/message (T6).
 */
export function applyTemplateFallbacksToSocialCta(
  socialCta: SocialCta | null,
  params: ThemeTemplateParams,
): SocialCta | null {
  if (!socialCta) {
    return null;
  }

  return {
    ...socialCta,
    headline: socialCta.headline
      ? applyTemplateFallback(socialCta.headline, params)
      : socialCta.headline,
    subtitle: socialCta.subtitle
      ? applyTemplateFallback(socialCta.subtitle, params)
      : socialCta.subtitle,
    followText: socialCta.followText
      ? applyTemplateFallback(socialCta.followText, params)
      : socialCta.followText,
    primaryAction: applyToPrimaryAction(socialCta.primaryAction, params),
  };
}

/** Applies `applyTemplateFallback` to every entry of a resolved copy map (T6). */
export function applyTemplateFallbacksToCopy(
  copy: ThemeCopy,
  params: ThemeTemplateParams,
): ThemeCopy {
  const result: ThemeCopy = {};

  for (const [key, text] of Object.entries(copy)) {
    result[key] = applyTemplateFallback(text, params);
  }

  return result;
}
