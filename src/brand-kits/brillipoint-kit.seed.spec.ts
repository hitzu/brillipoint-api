import { BRILLIPOINT_BRAND_KIT_OVERRIDES } from './brillipoint-kit.seed';

describe('BRILLIPOINT_BRAND_KIT_OVERRIDES', () => {
  it('has a localized subtitle', () => {
    // Assert
    expect(BRILLIPOINT_BRAND_KIT_OVERRIDES.socialCta?.subtitle).toEqual({
      text: {
        es: 'Reserva Brillipoint para tu próximo evento.',
        en: 'Book Brillipoint for your next event.',
      },
    });
  });

  it('has a localized followText', () => {
    // Assert
    expect(BRILLIPOINT_BRAND_KIT_OVERRIDES.socialCta?.followText).toEqual({
      text: {
        es: 'Síguenos para no perderte nuestras promociones',
        en: "Follow us so you don't miss our promotions",
      },
    });
  });
});
