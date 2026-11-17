import { BOOKING_PURPOSE } from '../../bookings/constants/booking_purpose.enum';
import { EXTRA_PRODUCT_ACTION } from '../../extras/types/extra-product-action.types';

export const TATTOO_DESIGNS_QUESTION_ID = 'tattoo_designs';
/** Uploaded photos and final designs (mixed). */
export const TATTOO_UPLOADS_MAX = 10;
/** Catalog templates and final designs the client chooses. Independent of the uploads cap. */
export const TATTOO_CATALOG_MAX = 10;
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
 * The section is enabled by NAME, not by ids (ids differ between stages and
 * change when a product is recreated): any contracted product or paid extra
 * whose name says both "tatuajes" and "personalizados". A stable product key
 * is planned to replace this.
 */
export function isTattooDesignsName(name: string | null | undefined): boolean {
  const normalized = (name ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  return normalized.includes('tatuaj') && normalized.includes('personaliz');
}

/**
 * Same source as the contract detail `deliverables`: the product snapshot
 * frozen at contracting time (it carries the product name), falling back to the
 * live package/extra products for contracts created before snapshots existed.
 * A paid extra also counts by its own name.
 */
export function hasTattooDesignsTrigger(
  packages:
    | ReadonlyArray<{
        itemsSnapshot?: ReadonlyArray<{ name: string }> | null;
        package?: {
          packageProducts?: ReadonlyArray<{
            product?: { name: string } | null;
          }> | null;
        } | null;
      }>
    | undefined,
  extras?: ReadonlyArray<{
    nameSnapshot?: string | null;
    itemsSnapshot?: ReadonlyArray<{ name: string }> | null;
    extra?: {
      extraProducts?: ReadonlyArray<{
        action: string;
        product?: { name: string } | null;
      }> | null;
    } | null;
  }>,
): boolean {
  const inPackages = (packages ?? []).some((line) => {
    const names =
      line.itemsSnapshot?.map((item) => item.name) ??
      (line.package?.packageProducts ?? []).map((p) => p.product?.name);
    return names.some(isTattooDesignsName);
  });
  // A paid extra delivers the products it adds; the ones it removes belong to
  // the package and never count.
  const inExtras = (extras ?? []).some((line) => {
    const names =
      line.itemsSnapshot?.map((item) => item.name) ??
      (line.extra?.extraProducts ?? [])
        .filter((p) => p.action === (EXTRA_PRODUCT_ACTION.ADD as string))
        .map((p) => p.product?.name);
    return (
      isTattooDesignsName(line.nameSnapshot) || names.some(isTattooDesignsName)
    );
  });
  return inPackages || inExtras;
}
