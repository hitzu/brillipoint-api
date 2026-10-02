import { BRILLIPOINT_BRAND_KIT_OVERRIDES } from '../../brand-kits/brillipoint-kit.seed';
import {
  validatePublicThemeTokens,
  validateThemeOverrides,
} from './validate-theme-overrides';

describe('validateThemeOverrides', () => {
  it('accepts null and undefined as always valid', () => {
    // Arrange

    // Act & Assert
    expect(validateThemeOverrides(null)).toEqual([]);
    expect(validateThemeOverrides(undefined)).toEqual([]);
  });

  it('rejects an unknown top-level key', () => {
    // Arrange
    const value = { notAllowed: true };

    // Act
    const errors = validateThemeOverrides(value);

    // Assert
    expect(errors).toContain('notAllowed: unknown top-level key');
  });

  it('accepts the legacy decorativeIcon top-level key', () => {
    // Arrange
    const value = { decorativeIcon: 'rings' };

    // Act
    const errors = validateThemeOverrides(value);

    // Assert
    expect(errors).toEqual([]);
  });

  describe('tokens', () => {
    it('accepts a valid hex color token and a free-string font token', () => {
      // Arrange
      const value = { tokens: { primary: '#ff0000', fontHeading: 'Futura' } };

      // Act
      const errors = validateThemeOverrides(value);

      // Assert
      expect(errors).toEqual([]);
    });

    it('rejects an unknown token name', () => {
      // Arrange
      const value = { tokens: { notAToken: '#fff' } };

      // Act
      const errors = validateThemeOverrides(value);

      // Assert
      expect(errors).toContain('tokens.notAToken: unknown token');
    });

    it('rejects a color token that is not a valid hex color', () => {
      // Arrange
      const value = { tokens: { primary: 'red' } };

      // Act
      const errors = validateThemeOverrides(value);

      // Assert
      expect(errors).toContain(
        'tokens.primary: must be an opaque #RRGGBB color',
      );
    });

    it('rejects alpha colors and arbitrary CSS in partial authoring layers', () => {
      // Arrange
      const value = {
        tokens: {
          primary: '#ffffff80',
          surfaceShadow: '0 0 8px red; color: white',
        },
      };

      // Act
      const errors = validateThemeOverrides(value);

      // Assert
      expect(errors).toContain(
        'tokens.primary: must be an opaque #RRGGBB color',
      );
      expect(errors).toContain(
        'tokens.surfaceShadow: must use the supported shadow format',
      );
    });

    it('accepts a pair with sufficient contrast', () => {
      // Arrange
      const value = { tokens: { primary: '#000000', onPrimary: '#ffffff' } };

      // Act
      const errors = validateThemeOverrides(value);

      // Assert
      expect(errors).toEqual([]);
    });

    it('rejects a pair below the minimum contrast ratio when both sides are set', () => {
      // Arrange
      const value = { tokens: { primary: '#ffffff', onPrimary: '#fefefe' } };

      // Act
      const errors = validateThemeOverrides(value);

      // Assert
      expect(
        errors.some((error) => error.startsWith('tokens: primary/onPrimary')),
      ).toBe(true);
    });

    it('skips the contrast check when only one side of a pair is set', () => {
      // Arrange
      const value = { tokens: { primary: '#ffffff' } };

      // Act
      const errors = validateThemeOverrides(value);

      // Assert
      expect(errors).toEqual([]);
    });
  });

  describe('validatePublicThemeTokens', () => {
    const validTokens = {
      background: '#FFFFFF',
      text: '#111827',
      textMuted: '#4B5563',
      surface: '#F3F4F6',
      onSurface: '#111827',
      primary: '#111827',
      onPrimary: '#FFFFFF',
      secondary: '#6B7280',
      onSecondary: '#FFFFFF',
      surfaceBorder: '#E5E7EB',
      divider: '#E5E7EB',
    };

    it('accepts a complete public palette with readable text pairs', () => {
      // Arrange

      // Act
      const errors = validatePublicThemeTokens(validTokens);

      // Assert
      expect(errors).toEqual([]);
    });

    it('rejects missing required roles and non-opaque or malformed colors', () => {
      // Arrange
      const tokens = {
        ...validTokens,
        textMuted: '#abc',
        divider: 'var(--line)',
      };
      delete (tokens as Partial<typeof tokens>).onSecondary;

      // Act
      const errors = validatePublicThemeTokens(tokens);

      // Assert
      expect(errors).toContain('tokens.onSecondary: is required');
      expect(errors).toContain(
        'tokens.textMuted: must be an opaque #RRGGBB color',
      );
      expect(errors).toContain(
        'tokens.divider: must be an opaque #RRGGBB color',
      );
    });

    it('requires normal text contrast for every published foreground/background pair', () => {
      // Arrange
      const tokens = {
        ...validTokens,
        text: '#777777',
        textMuted: '#777777',
        onSurface: '#777777',
        onPrimary: '#777777',
        onSecondary: '#777777',
      };

      // Act
      const errors = validatePublicThemeTokens(tokens);

      // Assert
      expect(errors).toEqual(
        expect.arrayContaining([
          expect.stringContaining('background/text contrast ratio'),
          expect.stringContaining('background/textMuted contrast ratio'),
          expect.stringContaining('surface/onSurface contrast ratio'),
          expect.stringContaining('surface/textMuted contrast ratio'),
          expect.stringContaining('primary/onPrimary contrast ratio'),
          expect.stringContaining('secondary/onSecondary contrast ratio'),
        ]),
      );
    });

    it('rejects arbitrary CSS shadows while accepting the supported shadow syntax', () => {
      // Arrange

      // Act
      const arbitrary = validatePublicThemeTokens({
        ...validTokens,
        surfaceShadow: '0 0 8px red; color: white',
      });
      const supported = validatePublicThemeTokens({
        ...validTokens,
        surfaceShadow: '0 10px 30px rgb(17 24 39 / 0.08)',
      });

      // Assert
      expect(arbitrary).toContain(
        'tokens.surfaceShadow: must use the supported shadow format',
      );
      expect(supported).toEqual([]);
    });

    it('rejects unexpected token fields in a resolved public payload', () => {
      // Arrange
      const tokens = {
        ...validTokens,
        arbitraryCss: 'url(javascript:alert(1))',
      };

      // Act
      const errors = validatePublicThemeTokens(tokens);

      // Assert
      expect(errors).toContain('tokens.arbitraryCss: unknown token');
    });
  });

  describe('images', () => {
    it('accepts a slot with an https url', () => {
      // Arrange
      const value = {
        images: {
          logo: {
            path: 'themes/x/logo.png',
            url: 'https://cdn.example.com/logo.png',
          },
        },
      };

      // Act
      const errors = validateThemeOverrides(value);

      // Assert
      expect(errors).toEqual([]);
    });

    it('accepts a splashIcon slot with an opaque hex plate', () => {
      // Arrange
      const value = {
        images: {
          splashIcon: {
            path: 'themes/x/splash.jpg',
            url: 'https://cdn.example.com/splash.jpg',
            plate: '#000000',
          },
        },
      };

      // Act
      const errors = validateThemeOverrides(value);

      // Assert
      expect(errors).toEqual([]);
    });

    it.each(['#000', '#00000080', 'black'])(
      'rejects splashIcon plate %s as not an opaque hex color',
      (plate) => {
        // Arrange
        const value = {
          images: {
            splashIcon: {
              path: 'themes/x/splash.jpg',
              url: 'https://cdn.example.com/splash.jpg',
              plate,
            },
          },
        };

        // Act
        const errors = validateThemeOverrides(value);

        // Assert
        expect(errors).toContain(
          'images.splashIcon.plate: must be an opaque #RRGGBB color',
        );
      },
    );

    it('rejects a plate on a slot other than splashIcon', () => {
      // Arrange
      const value = {
        images: {
          background: {
            path: 'themes/x/bg.jpg',
            url: 'https://cdn.example.com/bg.jpg',
            plate: '#000000',
          },
        },
      };

      // Act
      const errors = validateThemeOverrides(value);

      // Assert
      expect(errors).toContain(
        'images.background.plate: only allowed on splashIcon',
      );
    });

    it('rejects an unknown image slot', () => {
      // Arrange
      const value = {
        images: { notASlot: { url: 'https://cdn.example.com/x.png' } },
      };

      // Act
      const errors = validateThemeOverrides(value);

      // Assert
      expect(errors).toContain('images.notASlot: unknown image slot');
    });

    it('rejects a slot url that is not https', () => {
      // Arrange
      const value = {
        images: { logo: { url: 'http://cdn.example.com/logo.png' } },
      };

      // Act
      const errors = validateThemeOverrides(value);

      // Assert
      expect(errors).toContain('images.logo.url: must be an https URL');
    });

    it('rejects a cover link that is not https', () => {
      // Arrange
      const value = {
        images: {
          cover: {
            url: 'https://cdn.example.com/cover.png',
            link: 'ftp://example.com',
          },
        },
      };

      // Act
      const errors = validateThemeOverrides(value);

      // Assert
      expect(errors).toContain('images.cover.link: must be an https URL');
    });

    it('allows removing a slot with null', () => {
      // Arrange
      const value = { images: { logo: null } };

      // Act
      const errors = validateThemeOverrides(value);

      // Assert
      expect(errors).toEqual([]);
    });
  });

  describe('decorations', () => {
    it('accepts confetti shapes that are catalog slugs', () => {
      // Arrange
      const value = {
        decorations: { confetti: { shapes: ['rose', 'soccer-ball', 'tire2'] } },
      };

      // Act
      const errors = validateThemeOverrides(value);

      // Assert
      expect(errors).toEqual([]);
    });

    it.each([
      ['Rose'],
      ['soccer ball'],
      ['<svg/>'],
      [''],
      ['-rose'],
      ['a'.repeat(41)],
    ])('rejects confetti shape %p that is not a catalog slug', (shape) => {
      // Arrange
      const value = { decorations: { confetti: { shapes: [shape] } } };

      // Act
      const errors = validateThemeOverrides(value);

      // Assert
      expect(errors).toEqual([
        'decorations.confetti.shapes: must be an array of up to 20 slugs (lowercase letters, digits and hyphens)',
      ]);
    });

    it('rejects more than 20 confetti shapes', () => {
      // Arrange
      const shapes = Array.from({ length: 21 }, (_, i) => `shape-${i}`);
      const value = { decorations: { confetti: { shapes } } };

      // Act
      const errors = validateThemeOverrides(value);

      // Assert
      expect(errors).toEqual([
        'decorations.confetti.shapes: must be an array of up to 20 slugs (lowercase letters, digits and hyphens)',
      ]);
    });

    it('accepts a valid confetti block', () => {
      // Arrange
      const value = {
        decorations: {
          confetti: {
            enabled: true,
            colors: ['#ff0000'],
            shapes: ['circle'],
            amount: 100,
          },
        },
      };

      // Act
      const errors = validateThemeOverrides(value);

      // Assert
      expect(errors).toEqual([]);
    });

    it('rejects a confetti amount outside 0-500', () => {
      // Arrange
      const value = { decorations: { confetti: { amount: 501 } } };

      // Act
      const errors = validateThemeOverrides(value);

      // Assert
      expect(errors).toContain(
        'decorations.confetti.amount: must be an integer between 0 and 500',
      );
    });

    it('rejects a non-hex confetti color', () => {
      // Arrange
      const value = { decorations: { confetti: { colors: ['blue'] } } };

      // Act
      const errors = validateThemeOverrides(value);

      // Assert
      expect(errors).toContain(
        'decorations.confetti.colors: must be an array of valid hex colors',
      );
    });

    it('accepts a valid sparkles block', () => {
      // Arrange
      const value = { decorations: { sparkles: { enabled: false } } };

      // Act
      const errors = validateThemeOverrides(value);

      // Assert
      expect(errors).toEqual([]);
    });

    it('rejects a non-boolean sparkles enabled', () => {
      // Arrange
      const value = { decorations: { sparkles: { enabled: 'yes' } } };

      // Act
      const errors = validateThemeOverrides(value);

      // Assert
      expect(errors).toContain(
        'decorations.sparkles.enabled: must be a boolean',
      );
    });

    it('allows removing a decoration block with null', () => {
      // Arrange
      const value = { decorations: { confetti: null } };

      // Act
      const errors = validateThemeOverrides(value);

      // Assert
      expect(errors).toEqual([]);
    });
  });

  describe('socialCta', () => {
    it('rejects null: the socialCta block cannot be hidden', () => {
      // Arrange
      const value = { socialCta: null };

      // Act
      const errors = validateThemeOverrides(value);

      // Assert
      expect(errors).toEqual(['socialCta: must be an object']);
    });

    it('accepts a valid whatsapp primaryAction', () => {
      // Arrange
      const value = {
        socialCta: {
          primaryAction: {
            channel: 'whatsapp',
            label: { text: { es: 'Reservar' } },
            phone: '5212215775211',
          },
        },
      };

      // Act
      const errors = validateThemeOverrides(value);

      // Assert
      expect(errors).toEqual([]);
    });

    it('rejects a whatsapp phone with non-digit characters', () => {
      // Arrange
      const value = {
        socialCta: {
          primaryAction: {
            channel: 'whatsapp',
            label: { text: { es: 'Reservar' } },
            phone: '+52 121 000',
          },
        },
      };

      // Act
      const errors = validateThemeOverrides(value);

      // Assert
      expect(errors).toContain(
        'socialCta.primaryAction.phone: must contain only digits, 8-15 characters',
      );
    });

    it('rejects a link-channel primaryAction with a non-https url', () => {
      // Arrange
      const value = {
        socialCta: {
          primaryAction: {
            channel: 'instagram',
            label: { text: { es: 'Síguenos' } },
            url: 'http://instagram.com/x',
          },
        },
      };

      // Act
      const errors = validateThemeOverrides(value);

      // Assert
      expect(errors).toContain(
        'socialCta.primaryAction.url: must be an https URL',
      );
    });

    it('rejects an empty-string social', () => {
      // Arrange
      const value = { socialCta: { socials: { instagram: '' } } };

      // Act
      const errors = validateThemeOverrides(value);

      // Assert
      expect(errors).toContain(
        'socialCta.socials.instagram: must be an https URL',
      );
    });

    it('accepts a valid https social', () => {
      // Arrange
      const value = {
        socialCta: { socials: { instagram: 'https://instagram.com/x' } },
      };

      // Act
      const errors = validateThemeOverrides(value);

      // Assert
      expect(errors).toEqual([]);
    });

    it('accepts a whatsapp wa.me link and a website url in socials', () => {
      // Arrange
      const value = {
        socialCta: {
          socials: {
            whatsapp: 'https://wa.me/5210000000000',
            url: 'https://brillipoint.com',
          },
        },
      };

      // Act
      const errors = validateThemeOverrides(value);

      // Assert
      expect(errors).toEqual([]);
    });
  });

  describe('ThemeText placeholders', () => {
    it('accepts an allowed placeholder', () => {
      // Arrange
      const value = {
        copy: { greeting: { text: { es: 'Hola {{honoreesName}}' } } },
      };

      // Act
      const errors = validateThemeOverrides(value);

      // Assert
      expect(errors).toEqual([]);
    });

    it('rejects an unknown placeholder', () => {
      // Arrange
      const value = {
        copy: { greeting: { text: { es: 'Hola {{unknownParam}}' } } },
      };

      // Act
      const errors = validateThemeOverrides(value);

      // Assert
      expect(
        errors.some((error) =>
          error.includes('unknown placeholder "{{unknownParam}}"'),
        ),
      ).toBe(true);
    });

    it('rejects a fallback that itself contains a placeholder', () => {
      // Arrange
      const value = {
        copy: {
          greeting: {
            text: { es: 'Hola {{honoreesName}}' },
            fallback: { text: { es: 'Hola {{honoreesName}}' } },
          },
        },
      };

      // Act
      const errors = validateThemeOverrides(value);

      // Assert
      expect(errors).toContain(
        'copy.greeting.fallback: must not contain placeholders',
      );
    });

    it('accepts a placeholder-free fallback', () => {
      // Arrange
      const value = {
        copy: {
          greeting: {
            text: { es: 'Hola {{honoreesName}}' },
            fallback: { text: { es: 'Hola' } },
          },
        },
      };

      // Act
      const errors = validateThemeOverrides(value);

      // Assert
      expect(errors).toEqual([]);
    });

    it('rejects a ThemeText with neither key nor text', () => {
      // Arrange
      const value = { copy: { greeting: {} } };

      // Act
      const errors = validateThemeOverrides(value);

      // Assert
      expect(errors).toContain(
        'copy.greeting: must have exactly one of "key" or "text"',
      );
    });

    it('rejects a text variant with no language set', () => {
      // Arrange
      const value = { copy: { greeting: { text: {} } } };

      // Act
      const errors = validateThemeOverrides(value);

      // Assert
      expect(errors).toContain(
        'copy.greeting.text: must set at least one of "es" or "en"',
      );
    });

    it('allows removing a copy entry with null', () => {
      // Arrange
      const value = { copy: { greeting: null } };

      // Act
      const errors = validateThemeOverrides(value);

      // Assert
      expect(errors).toEqual([]);
    });
  });

  it('passes the Brillipoint brand kit seed against its own rules', () => {
    // Arrange

    // Act
    const errors = validateThemeOverrides(BRILLIPOINT_BRAND_KIT_OVERRIDES);

    // Assert
    expect(errors).toEqual([]);
  });
});
