/**
 * Lifecycle status of a booking. This slice has no holds and no cancel
 * endpoint (see `odd/tasks/booking-agenda.md`), so `confirmed` is currently
 * the only value; the enum shape is kept so a future status can be added
 * without a column type change.
 */
export enum BOOKING_STATUS {
  CONFIRMED = 'confirmed',
}
