import {
  BRILLIPOINT_BRAND_KIT_KEY,
  BRILLIPOINT_BRAND_KIT_OVERRIDES,
} from '../../brand-kits/brillipoint-kit.seed';
import type { RewardPromo, ThemeOverrides } from './theme.types';

/**
 * Hardcoded Brillipoint reward promo, the visual-layer counterpart of
 * `BRILLIPOINT_SOCIAL_CTA_SAFETY_NET`: if the `brillipoint` kit row is
 * missing or lacks a `rewardPromo` key, Brillipoint events still show the
 * promo (odd/tasks/reward-promo-theme-block.md, T2b).
 */
const BRILLIPOINT_REWARD_PROMO_SAFETY_NET: RewardPromo | null | undefined =
  BRILLIPOINT_BRAND_KIT_OVERRIDES.rewardPromo;

/**
 * Builds the kit layer passed to `resolveTheme` from the kit that won the
 * visual layer (`clientKit ?? businessKit ?? brillipointKit`).
 *
 * - A client/business kit is returned untouched: it never gets the
 *   Brillipoint promo, so it inherits the system default (`null`).
 * - No kit at all, or the Brillipoint kit without a `rewardPromo` key, gets
 *   the safety-net promo. An explicit `null` on the Brillipoint row still
 *   hides it. Event-level overrides keep winning in `resolveTheme`.
 */
export function toVisualKitLayer(
  visualKit: { key: string; overrides: ThemeOverrides } | null,
): ThemeOverrides | undefined {
  if (visualKit && visualKit.key !== BRILLIPOINT_BRAND_KIT_KEY) {
    return visualKit.overrides;
  }

  const overrides = visualKit?.overrides;
  if (overrides?.rewardPromo !== undefined) {
    return overrides;
  }

  return { ...overrides, rewardPromo: BRILLIPOINT_REWARD_PROMO_SAFETY_NET };
}
