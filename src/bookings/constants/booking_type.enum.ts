/**
 * Who the booking is for: an internal booking is created directly by staff
 * (`POST /bookings/internal`), a commercial booking comes from a contract.
 */
export enum BOOKING_TYPE {
  INTERNAL = 'internal',
  COMMERCIAL = 'commercial',
}
