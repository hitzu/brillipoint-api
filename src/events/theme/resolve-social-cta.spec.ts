import { resolveSocialCta } from './resolve-social-cta';
import type { SocialCta } from './theme.types';

const whatsappAction: SocialCta['primaryAction'] = {
  channel: 'whatsapp',
  label: { text: { es: 'Reservar', en: 'Book' } },
  phone: '5210000000000',
};

const defaultBlock: SocialCta = {
  headline: { text: { es: 'Default headline', en: 'Default headline' } },
  primaryAction: { ...whatsappAction, phone: '5219999999999' },
};

describe('resolveSocialCta', () => {
  it('uses the event override block when it is usable', () => {
    // Arrange
    const eventOverride: SocialCta = { primaryAction: whatsappAction };

    // Act
    const result = resolveSocialCta(eventOverride, defaultBlock);

    // Assert
    expect(result).toEqual(eventOverride);
  });

  it('treats an explicit null event override as no block and falls back to the default', () => {
    // Arrange — the Brillipoint CTA can never be hidden from an event theme

    // Act
    const result = resolveSocialCta(null, defaultBlock);

    // Assert
    expect(result).toEqual(defaultBlock);
  });

  it('falls back to the default block when the event override is undefined', () => {
    // Arrange

    // Act
    const result = resolveSocialCta(undefined, defaultBlock);

    // Assert
    expect(result).toEqual(defaultBlock);
  });

  it('skips an event override with neither a primaryAction nor a non-empty social', () => {
    // Arrange
    const unusable: SocialCta = { socials: { instagram: '' } };

    // Act
    const result = resolveSocialCta(unusable, defaultBlock);

    // Assert
    expect(result).toEqual(defaultBlock);
  });

  it('does not mix fields: picks the usable event override entirely', () => {
    // Arrange
    const eventOverride: SocialCta = {
      socials: { instagram: 'https://instagram.com/x' },
    };

    // Act
    const result = resolveSocialCta(eventOverride, defaultBlock);

    // Assert
    expect(result?.headline).toBeUndefined();
  });

  it('returns null when nothing usable exists', () => {
    // Arrange

    // Act
    const result = resolveSocialCta(undefined, { socials: { tiktok: '' } });

    // Assert
    expect(result).toBeNull();
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
    const result = resolveSocialCta(block, defaultBlock);

    // Assert
    expect(result?.socials).toEqual({ tiktok: 'https://tiktok.com/x' });
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
    const result = resolveSocialCta(block, defaultBlock);

    // Assert
    expect(result?.socials).toEqual({ tiktok: 'https://tiktok.com/x' });
  });

  it('keeps the event override own headline unchanged when it supplies the block', () => {
    // Arrange
    const eventOverride: SocialCta = {
      headline: { text: { es: 'Mi fiesta', en: 'My party' } },
      primaryAction: whatsappAction,
    };

    // Act
    const result = resolveSocialCta(eventOverride, defaultBlock);

    // Assert
    expect(result?.headline).toEqual({
      text: { es: 'Mi fiesta', en: 'My party' },
    });
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
    const result = resolveSocialCta(block, defaultBlock);

    // Assert
    expect(result?.socials).toEqual({ url: 'https://brillipoint.com' });
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
    const result = resolveSocialCta(block, defaultBlock);

    // Assert
    expect(result?.primaryAction).toEqual(block.primaryAction);
    expect(result?.socials).toEqual({ instagram: 'https://instagram.com/x' });
  });
});
