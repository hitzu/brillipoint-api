import {
  BRILLIPOINT_BRAND_KIT_KEY,
  BRILLIPOINT_BRAND_KIT_OVERRIDES,
} from '../../brand-kits/brillipoint-kit.seed';
import { toVisualKitLayer } from './visual-kit-layer';

describe('toVisualKitLayer', () => {
  it('returns only the seed rewardPromo when no kit wins the visual layer', () => {
    // Act
    const layer = toVisualKitLayer(null);

    // Assert
    expect(layer).toEqual({
      rewardPromo: BRILLIPOINT_BRAND_KIT_OVERRIDES.rewardPromo,
    });
  });

  it('adds the seed rewardPromo to a Brillipoint kit that has none', () => {
    // Arrange
    const kit = {
      key: BRILLIPOINT_BRAND_KIT_KEY,
      overrides: { tokens: { primary: '#333333' } },
    };

    // Act
    const layer = toVisualKitLayer(kit);

    // Assert
    expect(layer).toEqual({
      tokens: { primary: '#333333' },
      rewardPromo: BRILLIPOINT_BRAND_KIT_OVERRIDES.rewardPromo,
    });
  });

  it('keeps an explicit null rewardPromo on the Brillipoint kit', () => {
    // Arrange
    const kit = { key: BRILLIPOINT_BRAND_KIT_KEY, overrides: { rewardPromo: null } };

    // Act
    const layer = toVisualKitLayer(kit);

    // Assert
    expect(layer?.rewardPromo).toBeNull();
  });

  it('keeps the Brillipoint kit rewardPromo when it has one', () => {
    // Arrange
    const rewardPromo = { handle: '@otro' };
    const kit = { key: BRILLIPOINT_BRAND_KIT_KEY, overrides: { rewardPromo } };

    // Act
    const layer = toVisualKitLayer(kit);

    // Assert
    expect(layer?.rewardPromo).toEqual(rewardPromo);
  });

  it('returns a client or business kit overrides untouched', () => {
    // Arrange
    const overrides = { tokens: { primary: '#333333' } };
    const kit = { key: 'client-kit', overrides };

    // Act
    const layer = toVisualKitLayer(kit);

    // Assert
    expect(layer).toBe(overrides);
  });

  it('does not mutate the Brillipoint kit overrides', () => {
    // Arrange
    const overrides = { tokens: { primary: '#333333' } };
    const kit = { key: BRILLIPOINT_BRAND_KIT_KEY, overrides };

    // Act
    toVisualKitLayer(kit);

    // Assert
    expect(overrides).toEqual({ tokens: { primary: '#333333' } });
  });
});
