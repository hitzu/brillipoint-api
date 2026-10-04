import { resolveTheme } from './resolve-theme';
import { SYSTEM_DEFAULT_THEME } from './system-default.theme';
import type { ThemeOverrides } from './theme.types';

describe('resolveTheme', () => {
  it('returns the system default when no layers are given', () => {
    // Arrange / Act
    const resolved = resolveTheme();

    // Assert
    expect(resolved).toEqual(SYSTEM_DEFAULT_THEME);
  });

  it('skips null and undefined layers and still returns the default', () => {
    // Arrange
    const layers: Array<ThemeOverrides | null | undefined> = [null, undefined];

    // Act
    const resolved = resolveTheme(...layers);

    // Assert
    expect(resolved).toEqual(SYSTEM_DEFAULT_THEME);
  });

  it('overrides only the given tokens and keeps the rest of the defaults', () => {
    // Arrange
    const preset: ThemeOverrides = {
      tokens: { primary: '#ec4899', onPrimary: '#ffffff' },
    };

    // Act
    const resolved = resolveTheme(preset);

    // Assert
    expect(resolved.tokens.primary).toBe('#ec4899');
    expect(resolved.tokens.onPrimary).toBe('#ffffff');
    expect(resolved.tokens.background).toBe(
      SYSTEM_DEFAULT_THEME.tokens.background,
    );
    expect(resolved.tokens.fontBody).toBe(SYSTEM_DEFAULT_THEME.tokens.fontBody);
  });

  it('lets a later layer win over an earlier layer for the same token', () => {
    // Arrange
    const preset: ThemeOverrides = { tokens: { primary: '#111111' } };
    const middleLayer: ThemeOverrides = { tokens: { primary: '#222222' } };
    const eventOverrides: ThemeOverrides = { tokens: { primary: '#333333' } };

    // Act
    const resolved = resolveTheme(preset, middleLayer, eventOverrides);

    // Assert
    expect(resolved.tokens.primary).toBe('#333333');
  });

  it('sets an image slot when a layer provides one', () => {
    // Arrange
    const preset: ThemeOverrides = {
      images: {
        logo: { path: 'themes/x/logo.png', url: 'https://cdn/logo.png' },
      },
    };

    // Act
    const resolved = resolveTheme(preset);

    // Assert
    expect(resolved.images.logo).toEqual({
      path: 'themes/x/logo.png',
      url: 'https://cdn/logo.png',
    });
  });

  it('keeps the plate of a splashIcon slot through the merge', () => {
    // Arrange
    const preset: ThemeOverrides = {
      images: {
        splashIcon: {
          path: 'themes/x/splash.jpg',
          url: 'https://cdn/splash.jpg',
          plate: '#000000',
        },
      },
    };

    // Act
    const resolved = resolveTheme(preset);

    // Assert
    expect(resolved.images.splashIcon?.plate).toBe('#000000');
  });

  it('removes an image slot set by an earlier layer when a later layer sets it to null', () => {
    // Arrange
    const preset: ThemeOverrides = {
      images: {
        logo: { path: 'themes/x/logo.png', url: 'https://cdn/logo.png' },
      },
    };
    const overrides: ThemeOverrides = { images: { logo: null } };

    // Act
    const resolved = resolveTheme(preset, overrides);

    // Assert
    expect(resolved.images.logo).toBeUndefined();
  });

  it('replaces array values instead of concatenating them across layers', () => {
    // Arrange
    const preset: ThemeOverrides = {
      decorations: {
        confetti: { enabled: true, colors: ['#ff0000', '#00ff00'] },
      },
    };
    const overrides: ThemeOverrides = {
      decorations: { confetti: { enabled: true, colors: ['#0000ff'] } },
    };

    // Act
    const resolved = resolveTheme(preset, overrides);

    // Assert
    expect(resolved.decorations.confetti?.colors).toEqual(['#0000ff']);
  });

  it('replaces the whole socialCta block atomically rather than deep-merging it', () => {
    // Arrange
    const defaultLayer: ThemeOverrides = {
      socialCta: {
        headline: { key: 'socialCta.default.headline' },
        socials: { instagram: '@brillipoint' },
      },
    };
    const eventOverrides: ThemeOverrides = {
      socialCta: {
        headline: { text: { es: 'Hola', en: 'Hi' } },
      },
    };

    // Act
    const resolved = resolveTheme(defaultLayer, eventOverrides);

    // Assert: the event's socialCta fully replaces the default layer's,
    // it does not keep `socials` from the earlier layer.
    expect(resolved.socialCta).toEqual({
      headline: { text: { es: 'Hola', en: 'Hi' } },
    });
  });

  it('sets socialCta to null when a layer explicitly removes it', () => {
    // Arrange
    const defaultLayer: ThemeOverrides = {
      socialCta: { socials: { instagram: '@brillipoint' } },
    };
    const eventOverrides: ThemeOverrides = { socialCta: null };

    // Act
    const resolved = resolveTheme(defaultLayer, eventOverrides);

    // Assert
    expect(resolved.socialCta).toBeNull();
  });

  it('deep-merges copy by key and removes a key set to null', () => {
    // Arrange
    const preset: ThemeOverrides = {
      copy: {
        welcome: { text: { es: 'Bienvenido', en: 'Welcome' } },
        farewell: { text: { es: 'Adios', en: 'Bye' } },
      },
    };
    const overrides: ThemeOverrides = {
      copy: {
        welcome: { text: { es: 'Hola', en: 'Hello' } },
        farewell: null,
      },
    };

    // Act
    const resolved = resolveTheme(preset, overrides);

    // Assert
    expect(resolved.copy.welcome).toEqual({
      text: { es: 'Hola', en: 'Hello' },
    });
    expect(resolved.copy.farewell).toBeUndefined();
  });

  it('does not mutate the input layers or the system default', () => {
    // Arrange
    const preset: ThemeOverrides = {
      tokens: { primary: '#123456' },
      images: { logo: { path: 'a', url: 'b' } },
    };
    const presetSnapshot = structuredClone(preset);
    const defaultSnapshot = structuredClone(SYSTEM_DEFAULT_THEME);

    // Act
    resolveTheme(preset);

    // Assert
    expect(preset).toEqual(presetSnapshot);
    expect(SYSTEM_DEFAULT_THEME).toEqual(defaultSnapshot);
  });

  it('always includes every required token in the resolved theme', () => {
    // Arrange
    const overrides: ThemeOverrides = { tokens: { primary: '#abcdef' } };

    // Act
    const resolved = resolveTheme(overrides);

    // Assert
    expect(resolved.tokens.background).toBeDefined();
    expect(resolved.tokens.primary).toBeDefined();
    expect(resolved.tokens.onPrimary).toBeDefined();
    expect(resolved.tokens.secondary).toBeDefined();
    expect(resolved.tokens.text).toBeDefined();
    expect(resolved.tokens.textMuted).toBeDefined();
    expect(resolved.tokens.surface).toBeDefined();
    expect(resolved.tokens.fontHeading).toBeDefined();
    expect(resolved.tokens.fontBody).toBeDefined();
  });
  it('ignores null values for tokens coming from untyped storage and keeps the inherited token', () => {
    // Arrange
    const layerFromJsonb = {
      tokens: { primary: null, secondary: '#a855f7' },
    } as unknown as ThemeOverrides;

    // Act
    const resolved = resolveTheme(layerFromJsonb);

    // Assert
    expect(resolved.tokens.primary).toBe(SYSTEM_DEFAULT_THEME.tokens.primary);
    expect(resolved.tokens.secondary).toBe('#a855f7');
  });

  it('merges decoration blocks field by field so a later layer can change only confetti colors', () => {
    // Arrange
    const preset: ThemeOverrides = {
      decorations: {
        confetti: {
          enabled: true,
          colors: ['#f9a8d4'],
          shapes: ['heart'],
          amount: 80,
        },
      },
    };
    const middleLayer: ThemeOverrides = {
      decorations: { confetti: { colors: ['#e11d48', '#ffffff'] } },
    };

    // Act
    const resolved = resolveTheme(preset, middleLayer);

    // Assert
    expect(resolved.decorations.confetti).toEqual({
      enabled: true,
      colors: ['#e11d48', '#ffffff'],
      shapes: ['heart'],
      amount: 80,
    });
  });

  it('derives missing optional roles from the theme own colors instead of the neutral system defaults', () => {
    // Arrange
    const preset: ThemeOverrides = {
      tokens: {
        background: '#fff5f7',
        primary: '#db2777',
        onPrimary: '#ffffff',
        secondary: '#9333ea',
        text: '#831843',
        textMuted: '#9d174d',
        surface: '#fce7f3',
      },
    };

    // Act
    const resolved = resolveTheme(preset);

    // Assert
    expect(resolved.tokens.accent).toBe('#db2777');
    expect(resolved.tokens.onSecondary).toBe('#ffffff');
    expect(resolved.tokens.divider).toBe('#9d174d');
    expect(resolved.tokens.surfaceBorder).toBe('#9d174d');
    expect(resolved.tokens.onSurface).toBe('#831843');
    // surfaceShadow keeps the system default when absent
    expect(resolved.tokens.surfaceShadow).toBe(
      SYSTEM_DEFAULT_THEME.tokens.surfaceShadow,
    );
  });

  it('lets an explicit role override win over derivation from its own source token', () => {
    // Arrange
    const preset: ThemeOverrides = {
      tokens: {
        primary: '#db2777',
        onPrimary: '#ffffff',
        accent: '#f59e0b',
      },
    };

    // Act
    const resolved = resolveTheme(preset);

    // Assert
    expect(resolved.tokens.accent).toBe('#f59e0b');
  });

  it('keeps the system default optional roles when no layer changes their source token', () => {
    // Arrange
    const preset: ThemeOverrides = {
      tokens: { fontHeading: 'Futura' },
    };

    // Act
    const resolved = resolveTheme(preset);

    // Assert
    expect(resolved.tokens.accent).toBe(SYSTEM_DEFAULT_THEME.tokens.accent);
    expect(resolved.tokens.onSecondary).toBe(
      SYSTEM_DEFAULT_THEME.tokens.onSecondary,
    );
    expect(resolved.tokens.divider).toBe(SYSTEM_DEFAULT_THEME.tokens.divider);
    expect(resolved.tokens.surfaceBorder).toBe(
      SYSTEM_DEFAULT_THEME.tokens.surfaceBorder,
    );
    expect(resolved.tokens.onSurface).toBe(
      SYSTEM_DEFAULT_THEME.tokens.onSurface,
    );
  });

  describe('rewardPromo', () => {
    const brillipointPromo = {
      handle: '@brillipoint',
      title: { text: { es: 'Regalo', en: 'Gift' } },
      disclaimer: { text: { es: 'Aplica', en: 'Applies' } },
    };

    it('inherits the rewardPromo block from an earlier layer when a later layer omits it', () => {
      // Arrange
      const defaultLayer: ThemeOverrides = { rewardPromo: brillipointPromo };
      const eventOverrides: ThemeOverrides = { tokens: { primary: '#ec4899' } };

      // Act
      const resolved = resolveTheme(defaultLayer, eventOverrides);

      // Assert
      expect(resolved.rewardPromo).toEqual(brillipointPromo);
    });

    it('removes the rewardPromo block when a later layer sets it to null', () => {
      // Arrange
      const defaultLayer: ThemeOverrides = { rewardPromo: brillipointPromo };
      const eventOverrides: ThemeOverrides = { rewardPromo: null };

      // Act
      const resolved = resolveTheme(defaultLayer, eventOverrides);

      // Assert
      expect(resolved.rewardPromo).toBeNull();
    });

    it('replaces the whole rewardPromo block atomically rather than deep-merging it', () => {
      // Arrange
      const defaultLayer: ThemeOverrides = { rewardPromo: brillipointPromo };
      const eventOverrides: ThemeOverrides = {
        rewardPromo: { handle: '@otra.marca' },
      };

      // Act
      const resolved = resolveTheme(defaultLayer, eventOverrides);

      // Assert: title/disclaimer from the earlier layer are not kept.
      expect(resolved.rewardPromo).toEqual({ handle: '@otra.marca' });
    });

    it('resolves rewardPromo to null when no layer provides it', () => {
      // Arrange
      const preset: ThemeOverrides = { tokens: { primary: '#ec4899' } };

      // Act
      const resolved = resolveTheme(preset);

      // Assert
      expect(resolved.rewardPromo).toBeNull();
    });
  });
});
