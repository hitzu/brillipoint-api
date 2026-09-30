import { resolveSocialCta } from './resolve-social-cta';
import type { SocialCta, ThemeOverrides } from './theme.types';

function kit(
  key: string,
  name: string,
  socialCta: SocialCta | null | undefined,
): { key: string; name: string; overrides: ThemeOverrides } {
  return { key, name, overrides: { socialCta } };
}

const whatsappAction: SocialCta['primaryAction'] = {
  channel: 'whatsapp',
  label: { text: { es: 'Reservar', en: 'Book' } },
  phone: '5210000000000',
};

describe('resolveSocialCta', () => {
  it('uses the event override block when it is usable', () => {
    // Arrange
    const eventOverride: SocialCta = { primaryAction: whatsappAction };

    // Act
    const result = resolveSocialCta(eventOverride, [
      kit('client', 'Client Co', { primaryAction: whatsappAction }),
    ]);

    // Assert
    expect(result.socialCta).toEqual(eventOverride);
    expect(result.brandName).toBeUndefined();
  });

  it('treats an explicit null event override as inherit and falls through to the kits', () => {
    // Arrange — the Brillipoint CTA can never be hidden from an event theme
    const clientBlock: SocialCta = { primaryAction: whatsappAction };

    // Act
    const result = resolveSocialCta(null, [
      kit('client', 'Client Co', clientBlock),
    ]);

    // Assert
    expect(result.socialCta).toEqual({ ...clientBlock, brandKitKey: 'client' });
    expect(result.brandName).toBe('Client Co');
  });

  it('falls through to the first kit when the event override is undefined', () => {
    // Arrange
    const clientBlock: SocialCta = { primaryAction: whatsappAction };

    // Act
    const result = resolveSocialCta(undefined, [
      kit('client', 'Client Co', clientBlock),
    ]);

    // Assert
    expect(result.socialCta?.primaryAction).toEqual(whatsappAction);
    expect(result.brandName).toBe('Client Co');
    expect(result.socialCta?.brandKitKey).toBe('client');
  });

  it('treats a null block on a kit as no block and continues to the next kit', () => {
    // Arrange
    const businessBlock: SocialCta = { primaryAction: whatsappAction };

    // Act
    const result = resolveSocialCta(undefined, [
      kit('client', 'Client Co', null),
      kit('business', 'Business Co', businessBlock),
    ]);

    // Assert
    expect(result.brandName).toBe('Business Co');
    expect(result.socialCta?.brandKitKey).toBe('business');
  });

  it('skips a kit block that has neither a primaryAction nor a non-empty social', () => {
    // Arrange
    const unusable: SocialCta = { socials: { instagram: '' } };
    const usable: SocialCta = {
      socials: { instagram: 'https://instagram.com/x' },
    };

    // Act
    const result = resolveSocialCta(undefined, [
      kit('client', 'Client Co', unusable),
      kit('business', 'Business Co', usable),
    ]);

    // Assert
    expect(result.brandName).toBe('Business Co');
  });

  it('does not mix fields across levels: picks the first usable block entirely', () => {
    // Arrange
    const clientBlock: SocialCta = {
      headline: { text: { es: 'Client headline', en: 'Client headline' } },
      primaryAction: whatsappAction,
    };
    const businessBlock: SocialCta = {
      headline: { text: { es: 'Business headline', en: 'Business headline' } },
      primaryAction: whatsappAction,
    };

    // Act
    const result = resolveSocialCta(undefined, [
      kit('client', 'Client Co', clientBlock),
      kit('business', 'Business Co', businessBlock),
    ]);

    // Assert
    expect(result.socialCta?.headline).toEqual(clientBlock.headline);
  });

  it('returns socialCta null when nothing usable exists anywhere', () => {
    // Arrange

    // Act
    const result = resolveSocialCta(undefined, [
      kit('client', 'Client Co', undefined),
      null,
      undefined,
    ]);

    // Assert
    expect(result.socialCta).toBeNull();
    expect(result.brandName).toBeUndefined();
  });

  it('removes the primary channel entry from socials when present', () => {
    // Arrange
    const block: SocialCta = {
      primaryAction: {
        ...whatsappAction,
        channel: 'instagram',
        url: 'https://instagram.com/x',
      } as SocialCta['primaryAction'],
      socials: {
        instagram: 'https://instagram.com/x',
        tiktok: 'https://tiktok.com/x',
      },
    };

    // Act
    const result = resolveSocialCta(undefined, [
      kit('client', 'Client Co', block),
    ]);

    // Assert
    expect(result.socialCta?.socials).toEqual({
      tiktok: 'https://tiktok.com/x',
    });
  });

  it('drops empty-string and null socials', () => {
    // Arrange
    const block: SocialCta = {
      primaryAction: whatsappAction,
      socials: {
        instagram: '',
        tiktok: 'https://tiktok.com/x',
        facebook: null as unknown as string,
      },
    };

    // Act
    const result = resolveSocialCta(undefined, [
      kit('client', 'Client Co', block),
    ]);

    // Assert
    expect(result.socialCta?.socials).toEqual({
      tiktok: 'https://tiktok.com/x',
    });
  });

  it('sets brandKitKey to the supplying kit key even when the block did not carry one', () => {
    // Arrange
    const block: SocialCta = { primaryAction: whatsappAction };

    // Act
    const result = resolveSocialCta(undefined, [
      kit('brillipoint', 'Brillipoint', block),
    ]);

    // Assert
    expect(result.socialCta?.brandKitKey).toBe('brillipoint');
  });

  it('keeps the event override own brandKitKey unchanged when it supplies the block', () => {
    // Arrange
    const eventOverride: SocialCta = {
      brandKitKey: 'custom-key',
      primaryAction: whatsappAction,
    };

    // Act
    const result = resolveSocialCta(eventOverride, []);

    // Assert
    expect(result.socialCta?.brandKitKey).toBe('custom-key');
  });

  it('removes socials.whatsapp when whatsapp is the primary channel, keeping other socials', () => {
    // Arrange
    const block: SocialCta = {
      primaryAction: whatsappAction,
      socials: {
        whatsapp: 'https://wa.me/5210000000000',
        url: 'https://brillipoint.com',
      },
    };

    // Act
    const result = resolveSocialCta(undefined, [
      kit('client', 'Client Co', block),
    ]);

    // Assert
    expect(result.socialCta?.socials).toEqual({
      url: 'https://brillipoint.com',
    });
  });

  it('accepts a website url as the primary channel', () => {
    // Arrange
    const block: SocialCta = {
      primaryAction: {
        channel: 'url',
        label: { text: { es: 'Visítanos', en: 'Visit us' } },
        url: 'https://brillipoint.com',
      },
      socials: { url: 'https://brillipoint.com', instagram: 'https://instagram.com/x' },
    };

    // Act
    const result = resolveSocialCta(undefined, [
      kit('client', 'Client Co', block),
    ]);

    // Assert
    expect(result.socialCta?.primaryAction).toEqual(block.primaryAction);
    expect(result.socialCta?.socials).toEqual({
      instagram: 'https://instagram.com/x',
    });
  });
});
