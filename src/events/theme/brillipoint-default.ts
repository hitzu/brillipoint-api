import type { ThemeOverrides } from './theme.types';

/**
 * Code-owned Brillipoint default layer (T1):
 * the first layer of every resolved event theme, under the preset
 * (`eventThemeId`) and the event `themeOverrides`.
 *
 * - `rewardPromo` follows plain layer semantics: an event override replaces
 *   it, and an explicit `null` override hides it.
 * - `socialCta` is the never-hide fallback block: any usable event override
 *   wins whole, otherwise this block is shown.
 */
export const BRILLIPOINT_DEFAULT_OVERRIDES: ThemeOverrides = {
  socialCta: {
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
