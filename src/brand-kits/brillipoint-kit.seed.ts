import type { ThemeOverrides } from '../events/theme/theme.types';

/**
 * Fixed key for the Brillipoint brand kit, the global socialCta fallback
 * (decision R3, odd/tasks/theme-brand-kits.md). Never linked to a brand
 * automatically — it is looked up by key, not by `brands.brand_kit_id`.
 */
export const BRILLIPOINT_BRAND_KIT_KEY = 'brillipoint';

export const BRILLIPOINT_BRAND_KIT_NAME = 'Brillipoint';

/**
 * Seed payload for the Brillipoint kit's `overrides` column — the final
 * state after both seed migrations. Seeded by migration (never by hand) so
 * it exists identically in every environment. Kept here, rather than only
 * in the migration files, so a unit test can assert its shape without
 * running migrations (test DB uses `synchronize`).
 *
 * History: migration `1790560306542` inserted this payload WITHOUT
 * `primaryAction.message.fallback` (T3). Migration `1790583200000` (T6)
 * added `fallback` in place via `jsonb_set`, for when `honoreesName` is
 * missing from the resolved template params (decisions R6/R7). This
 * constant reflects the state after both have run.
 */
export const BRILLIPOINT_BRAND_KIT_OVERRIDES: ThemeOverrides = {
  socialCta: {
    brandKitKey: BRILLIPOINT_BRAND_KIT_KEY,
    headline: {
      text: {
        es: '¿Y si las próximas fotos son las tuyas?',
        en: 'What if the next photos are yours?',
      },
    },
    subtitle: {
      text: {
        es: 'Reserva Brillipoint para tu próximo evento.',
        en: 'Book Brillipoint for your next event.',
      },
    },
    followText: {
      text: {
        es: 'Síguenos para no perderte nuestras promociones',
        en: "Follow us so you don't miss our promotions",
      },
    },
    primaryAction: {
      channel: 'whatsapp',
      label: {
        text: {
          es: 'Reservar mi fecha',
          en: 'Book my date',
        },
      },
      phone: '5212215775211',
      message: {
        text: {
          es: 'Hola, te vi en la fiesta de {{honoreesName}} y me gustaría esto para mi fiesta',
          en: "Hi, I saw you at {{honoreesName}}'s party and I would like this for my party",
        },
        fallback: {
          text: {
            es: 'Hola, vi una galería de Brillipoint y me gustaría esto para mi fiesta',
            en: 'Hi, I saw a Brillipoint gallery and I would like this for my party',
          },
        },
      },
    },
    socials: {
      instagram: 'https://www.instagram.com/brillipoint',
      tiktok: 'https://www.tiktok.com/@brillipoint.glitterbar',
      facebook: 'https://www.facebook.com/profile.php?id=61579380963496',
    },
  },
};
