/**
 * Why a contract commits to a date. A contract carries several dated
 * commitments — the event itself plus the scoutings, meetings and trials
 * around it — and this is what tells them apart.
 *
 * The overlapping string values are copied verbatim from the slots side
 * (`contracts/constants/slot_purpose.enum.ts`) so both slices keep writing
 * comparable data, while the bookings slice stays free of any dependency on
 * the contracts module.
 */
export enum BOOKING_PURPOSE {
  EVENT = 'event',
  SCOUTING = 'scouting',
  MEETING = 'meeting',
  TRIAL_MAKEUP = 'trial_makeup',
  TRIAL_HAIR = 'trial_hair',
  TRIAL_NAIL = 'trial_nail',
  OTHER = 'other',
}
