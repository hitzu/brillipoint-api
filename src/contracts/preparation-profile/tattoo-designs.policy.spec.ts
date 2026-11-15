import {
  hasGlitterBarPackage,
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

  describe('hasGlitterBarPackage', () => {
    it('should be true only when some package belongs to brand 1', () => {
      expect(hasGlitterBarPackage([{ package: { brandId: 2 } }])).toBe(false);
      expect(
        hasGlitterBarPackage([
          { package: { brandId: 2 } },
          { package: { brandId: 1 } },
        ]),
      ).toBe(true);
      expect(hasGlitterBarPackage(undefined)).toBe(false);
      expect(hasGlitterBarPackage([{ package: null }])).toBe(false);
    });
  });
});
