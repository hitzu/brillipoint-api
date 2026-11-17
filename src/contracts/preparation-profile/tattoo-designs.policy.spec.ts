import {
  hasTattooDesignsProduct,
  TATTOO_DESIGNS_TRIGGER_PRODUCT_IDS,
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

  describe('hasTattooDesignsProduct', () => {
    const [triggerProductId] = TATTOO_DESIGNS_TRIGGER_PRODUCT_IDS;

    it('should trigger on the products "Tatuajes personalizados" of Glitter bar (131) and Photobooth (122)', () => {
      expect([...TATTOO_DESIGNS_TRIGGER_PRODUCT_IDS].sort()).toEqual([
        122, 131,
      ]);
    });

    it('should be true when the contracted snapshot includes a trigger product', () => {
      expect(
        hasTattooDesignsProduct([
          {
            itemsSnapshot: [{ productId: 1 }, { productId: triggerProductId }],
          },
        ]),
      ).toBe(true);
    });

    it('should be false when no contracted product is a trigger product', () => {
      expect(
        hasTattooDesignsProduct([{ itemsSnapshot: [{ productId: 1 }] }]),
      ).toBe(false);
      expect(hasTattooDesignsProduct([])).toBe(false);
      expect(hasTattooDesignsProduct(undefined)).toBe(false);
    });

    it('should fall back to the live package products when the line has no snapshot', () => {
      expect(
        hasTattooDesignsProduct([
          {
            itemsSnapshot: null,
            package: { packageProducts: [{ productId: triggerProductId }] },
          },
        ]),
      ).toBe(true);
      expect(
        hasTattooDesignsProduct([
          {
            itemsSnapshot: null,
            package: { packageProducts: [{ productId: 1 }] },
          },
        ]),
      ).toBe(false);
      expect(
        hasTattooDesignsProduct([{ itemsSnapshot: null, package: null }]),
      ).toBe(false);
    });

    it('should trust the snapshot over the live package when both exist', () => {
      expect(
        hasTattooDesignsProduct([
          {
            itemsSnapshot: [{ productId: 1 }],
            package: { packageProducts: [{ productId: triggerProductId }] },
          },
        ]),
      ).toBe(false);
    });

    describe('contracted extras', () => {
      const [triggerProductId] = TATTOO_DESIGNS_TRIGGER_PRODUCT_IDS;

      it('should trigger when a contracted extra snapshot includes a trigger product', () => {
        expect(
          hasTattooDesignsProduct(
            [{ itemsSnapshot: [{ productId: 1 }] }],
            [{ itemsSnapshot: [{ productId: triggerProductId }] }],
          ),
        ).toBe(true);
      });

      it('should work with extras only (no package trigger)', () => {
        expect(
          hasTattooDesignsProduct(undefined, [
            { itemsSnapshot: [{ productId: triggerProductId }] },
          ]),
        ).toBe(true);
        expect(
          hasTattooDesignsProduct([], [{ itemsSnapshot: [{ productId: 1 }] }]),
        ).toBe(false);
      });

      it('should fall back to the live extra products that are added, never the removed ones', () => {
        expect(
          hasTattooDesignsProduct(
            [],
            [
              {
                itemsSnapshot: null,
                extra: {
                  extraProducts: [
                    { productId: triggerProductId, action: 'add' },
                  ],
                },
              },
            ],
          ),
        ).toBe(true);
        expect(
          hasTattooDesignsProduct(
            [],
            [
              {
                itemsSnapshot: null,
                extra: {
                  extraProducts: [
                    { productId: triggerProductId, action: 'remove' },
                  ],
                },
              },
            ],
          ),
        ).toBe(false);
        expect(
          hasTattooDesignsProduct([], [{ itemsSnapshot: null, extra: null }]),
        ).toBe(false);
      });

      it('should trust the extra snapshot over the live extra when both exist', () => {
        expect(
          hasTattooDesignsProduct(
            [],
            [
              {
                itemsSnapshot: [{ productId: 1 }],
                extra: {
                  extraProducts: [
                    { productId: triggerProductId, action: 'add' },
                  ],
                },
              },
            ],
          ),
        ).toBe(false);
      });
    });
  });
});
