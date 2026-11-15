import { BOOKING_PURPOSE } from '../../bookings/constants/booking_purpose.enum';

export const TATTOO_DESIGNS_QUESTION_ID = 'tattoo_designs';
export const TATTOO_DESIGNS_MAX = 5;
export const GLITTER_BAR_BRAND_ID = 1;
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

export function hasGlitterBarPackage(
  items: ReadonlyArray<{ package?: { brandId: number } | null }> | undefined,
): boolean {
  return (items ?? []).some(
    (item) => item.package?.brandId === GLITTER_BAR_BRAND_ID,
  );
}
