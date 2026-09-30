import {
  applyTemplateFallback,
  applyTemplateFallbacksToCopy,
  applyTemplateFallbacksToSocialCta,
} from './apply-template-fallback';
import type { SocialCta, ThemeCopy, ThemeText } from './theme.types';

describe('applyTemplateFallback', () => {
  it('keeps the text unchanged when it has no placeholders', () => {
    // Arrange
    const text: ThemeText = { text: { es: 'Hola', en: 'Hi' } };

    // Act
    const result = applyTemplateFallback(text, {});

    // Assert
    expect(result).toEqual(text);
  });

  it('keeps the text unchanged (minus the fallback field) when every referenced placeholder has a param', () => {
    // Arrange
    const text: ThemeText = {
      text: { es: 'Hola {{honoreesName}}', en: 'Hi {{honoreesName}}' },
      fallback: { text: { es: 'Hola', en: 'Hi' } },
    };

    // Act
    const result = applyTemplateFallback(text, { honoreesName: 'Ana' });

    // Assert
    expect(result).toEqual({
      text: { es: 'Hola {{honoreesName}}', en: 'Hi {{honoreesName}}' },
    });
  });

  it('never interpolates the placeholder itself, even when the param is present', () => {
    // Arrange
    const text: ThemeText = { text: { es: 'Hola {{honoreesName}}' } };

    // Act
    const result = applyTemplateFallback(text, { honoreesName: 'Ana' });

    // Assert
    expect((result as { text: { es?: string } }).text.es).toBe(
      'Hola {{honoreesName}}',
    );
  });

  it('replaces the text with its fallback when a referenced placeholder param is missing', () => {
    // Arrange
    const fallback: ThemeText = { text: { es: 'Hola', en: 'Hi' } };
    const text: ThemeText = {
      text: { es: 'Hola {{honoreesName}}', en: 'Hi {{honoreesName}}' },
      fallback,
    };

    // Act
    const result = applyTemplateFallback(text, {});

    // Assert
    expect(result).toEqual(fallback);
  });

  it('leaves the text as-is when a param is missing and no fallback is given', () => {
    // Arrange
    const text: ThemeText = { text: { es: 'Hola {{honoreesName}}' } };

    // Act
    const result = applyTemplateFallback(text, {});

    // Assert
    expect(result).toEqual(text);
  });

  it('detects placeholders on the key/params variant too', () => {
    // Arrange
    const fallback: ThemeText = { key: 'social.headline.fallback' };
    const text: ThemeText = {
      key: 'social.headline',
      params: { name: '{{honoreesName}}' },
      fallback,
    };

    // Act
    const result = applyTemplateFallback(text, {});

    // Assert
    expect(result).toEqual(fallback);
  });
});

describe('applyTemplateFallbacksToSocialCta', () => {
  it('returns null unchanged', () => {
    // Arrange / Act
    const result = applyTemplateFallbacksToSocialCta(null, {});

    // Assert
    expect(result).toBeNull();
  });

  it('applies the fallback rule to headline, subtitle, followText, and primaryAction label/message', () => {
    // Arrange
    const socialCta: SocialCta = {
      headline: {
        text: { es: 'Hola {{honoreesName}}' },
        fallback: { text: { es: 'Hola' } },
      },
      subtitle: {
        text: { es: 'De {{honoreesName}}' },
        fallback: { text: { es: 'De la fiesta' } },
      },
      followText: {
        text: { es: 'Sigue a {{honoreesName}}' },
        fallback: { text: { es: 'Síguenos' } },
      },
      primaryAction: {
        channel: 'whatsapp',
        phone: '5210000000000',
        label: { text: { es: 'Reservar' } },
        message: {
          text: { es: 'Hola, vi la fiesta de {{honoreesName}}' },
          fallback: { text: { es: 'Hola, vi una galería' } },
        },
      },
    };

    // Act
    const result = applyTemplateFallbacksToSocialCta(socialCta, {});

    // Assert
    expect(result?.headline).toEqual({ text: { es: 'Hola' } });
    expect(result?.subtitle).toEqual({ text: { es: 'De la fiesta' } });
    expect(result?.followText).toEqual({ text: { es: 'Síguenos' } });
    expect(
      result?.primaryAction &&
        'message' in result.primaryAction &&
        result.primaryAction.message,
    ).toEqual({ text: { es: 'Hola, vi una galería' } });
  });

  it('keeps the placeholder text untouched (never interpolated) when the param is satisfied, minus the fallback field', () => {
    // Arrange
    const socialCta: SocialCta = {
      headline: {
        text: { es: 'Hola {{honoreesName}}' },
        fallback: { text: { es: 'Hola' } },
      },
    };

    // Act
    const result = applyTemplateFallbacksToSocialCta(socialCta, {
      honoreesName: 'Ana',
    });

    // Assert
    expect(result?.headline).toEqual({ text: { es: 'Hola {{honoreesName}}' } });
  });
});

describe('applyTemplateFallbacksToCopy', () => {
  it('applies the fallback rule to every entry in the copy map', () => {
    // Arrange
    const copy: ThemeCopy = {
      thankYou: {
        text: { es: 'Gracias {{honoreesName}}' },
        fallback: { text: { es: 'Gracias' } },
      },
    };

    // Act
    const result = applyTemplateFallbacksToCopy(copy, {});

    // Assert
    expect(result.thankYou).toEqual({ text: { es: 'Gracias' } });
  });
});
