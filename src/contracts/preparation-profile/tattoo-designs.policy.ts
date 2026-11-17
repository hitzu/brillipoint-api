import { BOOKING_PURPOSE } from '../../bookings/constants/booking_purpose.enum';
import { EXTRA_PRODUCT_ACTION } from '../../extras/types/extra-product-action.types';

export const TATTOO_DESIGNS_QUESTION_ID = 'tattoo_designs';
export const TATTOO_DESIGNS_MAX = 5;
// Chosen + uploaded designs share the same maximum (TATTOO_DESIGNS_MAX).
export const TATTOO_CATALOG_QUESTION_ID = 'tattoo_catalog_designs';
/** Frozen copy of the catalog row taken when the client chooses it. */
export type TattooCatalogDesign = {
  carouselId: number;
  title: string;
  imageUrl: string;
};

// The catalog is a page/section of the `carousels` table (global: no brand).
export const TATTOO_CATALOG_PAGE = 'reservation';
export const TATTOO_CATALOG_SECTION = 'tattoo-designs';
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
  packages:
    | ReadonlyArray<{
        itemsSnapshot?: ReadonlyArray<{ productId: number }> | null;
        package?: {
          packageProducts?: ReadonlyArray<{ productId: number }> | null;
        } | null;
      }>
    | undefined,
  extras?: ReadonlyArray<{
    itemsSnapshot?: ReadonlyArray<{ productId: number }> | null;
    extra?: {
      extraProducts?: ReadonlyArray<{
        productId: number;
        action: string;
      }> | null;
    } | null;
  }>,
): boolean {
  const isTrigger = (p: { productId: number }) =>
    TATTOO_DESIGNS_TRIGGER_PRODUCT_IDS.includes(p.productId);

  const inPackages = (packages ?? []).some((line) =>
    (line.itemsSnapshot ?? line.package?.packageProducts ?? []).some(isTrigger),
  );
  // A paid extra delivers the products it adds; the ones it removes belong to
  // the package and never count.
  const inExtras = (extras ?? []).some((line) =>
    (
      line.itemsSnapshot ??
      (line.extra?.extraProducts ?? []).filter(
        (p) => p.action === (EXTRA_PRODUCT_ACTION.ADD as string),
      )
    ).some(isTrigger),
  );
  return inPackages || inExtras;
}
