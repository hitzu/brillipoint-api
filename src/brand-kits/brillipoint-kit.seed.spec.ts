import { BRILLIPOINT_KIT_SEED_OVERRIDES } from '../database/migrations/1790985211804-Migration';
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

  it('has the @brillipoint reward promo with a localized title and disclaimer', () => {
    // Assert
    expect(BRILLIPOINT_BRAND_KIT_OVERRIDES.rewardPromo).toEqual({
      handle: '@brillipoint',
      title: {
        text: {
          es: '¡Comparte y recibe un regalo!',
          en: 'Share it and get a gift!',
        },
      },
      disclaimer: {
        text: {
          es: 'Válido para tu próxima reservación con Brillipoint',
          en: 'Valid on your next Brillipoint booking',
        },
      },
    });
  });

  it('matches the payload frozen in the Brillipoint kit seed migration', () => {
    // Assert
    expect(BRILLIPOINT_BRAND_KIT_OVERRIDES).toEqual(
      BRILLIPOINT_KIT_SEED_OVERRIDES,
    );
  });
});
