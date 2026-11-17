import {
  hasTattooDesignsTrigger,
  isTattooDesignsName,
  isTattooDesignsClosed,
  resolveEventDate,
} from './tattoo-designs.policy';

describe('tattoo-designs.policy', () => {
  describe('isTattooDesignsClosed', () => {
    // Mexico City is UTC-6 year round: 2026-09-12T12:00Z is Sept 12 at 06:00 local.
    const now = new Date('2026-09-12T12:00:00.000Z');

    it('should stay open when the event is 8 days away', () => {
      expect(isTattooDesignsClosed('2026-09-20', now)).toBe(false);
    });

    it('should close when the event is exactly 7 days away', () => {
      expect(isTattooDesignsClosed('2026-09-19', now)).toBe(true);
    });

    it('should stay closed when the event is closer than 7 days or already past', () => {
      expect(isTattooDesignsClosed('2026-09-15', now)).toBe(true);
      expect(isTattooDesignsClosed('2026-09-01', now)).toBe(true);
    });

    it('should use the Mexico City civil date, not the UTC date', () => {
      // 2026-09-13T03:00Z is still Sept 12 at 21:00 in Mexico City.
      const lateNight = new Date('2026-09-13T03:00:00.000Z');
      expect(isTattooDesignsClosed('2026-09-20', lateNight)).toBe(false);
      expect(isTattooDesignsClosed('2026-09-19', lateNight)).toBe(true);
    });
  });

  describe('resolveEventDate', () => {
    it('should return the date of the booking whose purpose is event', () => {
      expect(
        resolveEventDate([
          { purpose: 'trial_makeup', eventDate: '2026-08-01' },
          { purpose: 'event', eventDate: '2026-09-20' },
        ]),
      ).toBe('2026-09-20');
    });

    it('should return null when there is no event booking', () => {
      expect(
        resolveEventDate([{ purpose: 'meeting', eventDate: '2026-08-01' }]),
      ).toBeNull();
      expect(resolveEventDate(undefined)).toBeNull();
    });
  });

  describe('isTattooDesignsName', () => {
    it.each([
      'Tatuajes personalizados',
      'TATUAJES PERSONALIZADOS',
      'Tatuajes personalizados (precio especial)',
      'Tatuaje personalizado',
      'Diseños personalizados de tatuajes',
      '  tatuajes   personalizados  ',
    ])('should match "%s"', (name) => {
      expect(isTattooDesignsName(name)).toBe(true);
    });

    it.each([
      'Tatuajes temporales',
      'Glitter tattoo',
      'Accesorios personalizados',
      'Personalización de fotos dentro de la galería',
      '',
      null,
      undefined,
    ])('should not match %p', (name) => {
      expect(isTattooDesignsName(name)).toBe(false);
    });

    it('should ignore accents', () => {
      expect(isTattooDesignsName('Tátuajes personalizádos')).toBe(true);
    });
  });

  describe('hasTattooDesignsTrigger', () => {
    it('should trigger when a contracted package product has a matching name in its snapshot', () => {
      expect(
        hasTattooDesignsTrigger([
          {
            itemsSnapshot: [
              { name: 'Glitter' },
              { name: 'Tatuajes personalizados' },
            ],
          },
        ]),
      ).toBe(true);
    });

    it('should be false when no contracted product name matches', () => {
      expect(
        hasTattooDesignsTrigger([
          { itemsSnapshot: [{ name: 'Tatuajes temporales' }] },
        ]),
      ).toBe(false);
      expect(hasTattooDesignsTrigger([])).toBe(false);
      expect(hasTattooDesignsTrigger(undefined)).toBe(false);
    });

    it('should fall back to the live package product names when the line has no snapshot', () => {
      expect(
        hasTattooDesignsTrigger([
          {
            itemsSnapshot: null,
            package: {
              packageProducts: [
                { product: { name: 'Tatuajes personalizados' } },
              ],
            },
          },
        ]),
      ).toBe(true);
      expect(
        hasTattooDesignsTrigger([
          {
            itemsSnapshot: null,
            package: {
              packageProducts: [
                { product: { name: 'Glitter' } },
                { product: null },
              ],
            },
          },
        ]),
      ).toBe(false);
      expect(
        hasTattooDesignsTrigger([{ itemsSnapshot: null, package: null }]),
      ).toBe(false);
    });

    it('should trust the snapshot over the live package when both exist', () => {
      expect(
        hasTattooDesignsTrigger([
          {
            itemsSnapshot: [{ name: 'Glitter' }],
            package: {
              packageProducts: [
                { product: { name: 'Tatuajes personalizados' } },
              ],
            },
          },
        ]),
      ).toBe(false);
    });

    describe('contracted extras', () => {
      it('should trigger on the extra name itself, even when the extra has no products', () => {
        expect(
          hasTattooDesignsTrigger(
            [{ itemsSnapshot: [{ name: 'Glitter' }] }],
            [
              {
                nameSnapshot: 'Tatuajes personalizados (precio especial)',
                itemsSnapshot: [],
              },
            ],
          ),
        ).toBe(true);
      });

      it('should trigger when a product delivered by the extra matches', () => {
        expect(
          hasTattooDesignsTrigger(undefined, [
            {
              nameSnapshot: 'Beneficio a elegir',
              itemsSnapshot: [{ name: 'Tatuajes personalizados' }],
            },
          ]),
        ).toBe(true);
      });

      it('should be false when neither the extra name nor its products match', () => {
        expect(
          hasTattooDesignsTrigger(
            [],
            [
              {
                nameSnapshot: '1 hora extra',
                itemsSnapshot: [{ name: 'Maquillista' }],
              },
            ],
          ),
        ).toBe(false);
      });

      it('should fall back to the live extra products that are added, never the removed ones', () => {
        const live = (action: string) => [
          {
            nameSnapshot: 'Beneficio a elegir',
            itemsSnapshot: null,
            extra: {
              extraProducts: [
                { action, product: { name: 'Tatuajes personalizados' } },
              ],
            },
          },
        ];
        expect(hasTattooDesignsTrigger([], live('add'))).toBe(true);
        expect(hasTattooDesignsTrigger([], live('remove'))).toBe(false);
      });
    });
  });
});
