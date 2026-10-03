import type { ThemeOverrides } from '../events/theme/theme.types';

/**
 * Fixed key for the Brillipoint brand kit, the global socialCta fallback
 * (decision R3, odd/tasks/theme-brand-kits.md). Never linked to a brand
 * automatically — it is looked up by key, not by `brands.brand_kit_id`.
 */
export const BRILLIPOINT_BRAND_KIT_KEY = 'brillipoint';

export const BRILLIPOINT_BRAND_KIT_NAME = 'Brillipoint';

/**
 * Seed payload for the Brillipoint kit's `overrides` column. Seeded by
 * migration (never by hand) so it exists identically in every environment.
 * Kept here, rather than only in the migration file, so a unit test can
 * assert its shape without running migrations (test DB uses `synchronize`)
 * and so the theme resolver can use it as an in-code safety net when the
 * row is missing (`BRILLIPOINT_SOCIAL_CTA_SAFETY_NET`, `toVisualKitLayer`).
 *
 * History: the insert migrations originally written for this row
 * (`1790560306542`, plus `1790583200000` adding
 * `primaryAction.message.fallback`) were never committed — only the
 * `brand_kits` table migration `1790613866934` was — so environments built
 * from the repo had no `brillipoint` row. Migration `1790985211804`
 * (odd/tasks/reward-promo-theme-block.md, T2c) is now the source of truth
 * for the row: it inserts this payload when the row is missing and, on an
 * existing row, only adds a missing `rewardPromo`. Its payload is a frozen
 * literal; `brillipoint-kit.seed.spec.ts` asserts this constant still equals
 * it. Change this constant only together with a new migration for the delta.
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
  rewardPromo: {
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
  },
};
