import type { ResolvedTheme } from './theme.types';

/**
 * Version tag for the system default theme. Bump it whenever
 * `SYSTEM_DEFAULT_THEME` changes so the frontend can detect drift against
 * its offline `system-default.json` fallback.
 */
export const SYSTEM_DEFAULT_THEME_VERSION = '2026-10-02';

/**
 * Full, neutral theme used as the base layer for `resolveTheme`.
 *
 * `satisfies ResolvedTheme` makes omitting a required token a compile-time
 * error. Values are intentionally neutral greys/near-black with no
 * Brillipoint branding; `socialCta` stays `null` (T6 decides fallbacks) and
 * so does `rewardPromo`: only the Brillipoint default layer shows one.
 */
export const SYSTEM_DEFAULT_THEME = {
  tokens: {
    background: '#ffffff',
    primary: '#111827',
    onPrimary: '#ffffff',
    secondary: '#6b7280',
    text: '#111827',
    textMuted: '#4b5563',
    surface: '#f3f4f6',
    fontHeading: 'Inter',
    fontBody: 'Inter',
    onSecondary: '#ffffff',
    onSurface: '#111827',
    accent: '#374151',
    surfaceBorder: '#e5e7eb',
    divider: '#e5e7eb',
    surfaceShadow: '0 10px 30px rgb(17 24 39 / 0.08)',
  },
  images: {},
  decorations: {},
  socialCta: null,
  rewardPromo: null,
  copy: {},
} satisfies ResolvedTheme;
