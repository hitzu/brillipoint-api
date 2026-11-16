import { BOOKING_PURPOSE } from '../../bookings/constants/booking_purpose.enum';

export const TATTOO_DESIGNS_QUESTION_ID = 'tattoo_designs';
export const TATTOO_DESIGNS_MAX = 5;
/**
 * Products that enable the tattoo designs section when a contracted package
 * includes them: "Tatuajes personalizados" of Glitter bar (131) and of
 * Photobooth (122). Hardcoded for now; to move to the database. Keep in sync
 * with TATTOO_DESIGNS_TRIGGER_PRODUCT_IDS in bookandsign-front
 * (src/features/booking/utils/tattooDesigns.ts).
 */
export const TATTOO_DESIGNS_TRIGGER_PRODUCT_IDS: readonly number[] = [131, 122];
export const TATTOO_DESIGNS_CLOSE_DAYS = 7;

const MS_PER_DAY = 24 * 60 * 60 * 1000;
// Mexico City has no DST (see bookings/schedule/day-segments.ts): fixed UTC-6.
const OPERATING_REGION_UTC_OFFSET_HOURS = -6;

function civilDateInOperatingRegion(now: Date): string {
  const shifted = new Date(
    now.getTime() + OPERATING_REGION_UTC_OFFSET_HOURS * 60 * 60 * 1000,
  );
  return shifted.toISOString().slice(0, 10);
}

/** True when the event is `TATTOO_DESIGNS_CLOSE_DAYS` days away or closer (or past). */
export function isTattooDesignsClosed(eventDate: string, now: Date): boolean {
  const today = civilDateInOperatingRegion(now);
  const daysUntilEvent =
    (Date.parse(`${eventDate}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) /
    MS_PER_DAY;
  return daysUntilEvent <= TATTOO_DESIGNS_CLOSE_DAYS;
}

export function resolveEventDate(
  bookings:
    | ReadonlyArray<{ purpose: string | null; eventDate: string }>
    | undefined,
): string | null {
  const eventBooking = bookings?.find(
    (b) => b.purpose === BOOKING_PURPOSE.EVENT,
  );
  return eventBooking?.eventDate ?? null;
}

/**
 * Same source as the contract detail `deliverables`: the product snapshot
 * frozen at contracting time, falling back to the live package products for
 * contracts created before snapshots existed.
 */
export function hasTattooDesignsProduct(
  items:
    | ReadonlyArray<{
        itemsSnapshot?: ReadonlyArray<{ productId: number }> | null;
        package?: {
          packageProducts?: ReadonlyArray<{ productId: number }> | null;
        } | null;
      }>
    | undefined,
): boolean {
  return (items ?? []).some((item) => {
    const products = item.itemsSnapshot ?? item.package?.packageProducts ?? [];
    return products.some((p) =>
      TATTOO_DESIGNS_TRIGGER_PRODUCT_IDS.includes(p.productId),
    );
  });
}
