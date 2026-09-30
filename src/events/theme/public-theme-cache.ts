export const EVENT_THEME_CACHE_CONTROL =
  'public, max-age=300, stale-while-revalidate=2592000';

export const FRESH_EVENT_THEME_CACHE_CONTROL = 'no-store';

export interface PublicThemeCacheDecision {
  cacheControl: string;
  notModified: boolean;
}

/**
 * Selects HTTP caching behavior for the public theme response. Fresh mode is
 * intentionally opt-in and never evaluates the request's conditional ETag.
 */
export function resolvePublicThemeCache(
  cache: string | undefined,
  matchesEtag: () => boolean,
): PublicThemeCacheDecision {
  if (cache === 'off') {
    return {
      cacheControl: FRESH_EVENT_THEME_CACHE_CONTROL,
      notModified: false,
    };
  }

  return {
    cacheControl: EVENT_THEME_CACHE_CONTROL,
    notModified: matchesEtag(),
  };
}
