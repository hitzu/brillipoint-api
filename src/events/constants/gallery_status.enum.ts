/**
 * Manual override of the public gallery lifecycle, set by staff.
 *
 * - `auto`: the public status is derived from the EVENT booking date
 *   (`active` for 30 days after `serviceStartsAt`, then `finished`).
 * - `demo`: the public gallery stays `active` regardless of dates
 *   (e.g. sales demos). Only affects viewing; uploads keep their own guard.
 *
 * This is an admin-only value: public endpoints expose only the effective
 * `active` / `finished` status, never `demo`.
 */
export enum GALLERY_STATUS {
  AUTO = 'auto',
  DEMO = 'demo',
}
