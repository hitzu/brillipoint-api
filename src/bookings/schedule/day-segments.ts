const HOUR_IN_MS = 60 * 60 * 1000;
const DAY_IN_MS = 24 * HOUR_IN_MS;

/**
 * Fixed UTC offset of the operating region (America/Mexico_City). Mexico
 * City stopped observing daylight saving time in 2022, so a constant offset
 * keeps the local-day projection deterministic without pulling in a
 * timezone database. Defined locally rather than imported from
 * `band-range.ts`: that file is hold/block projection logic, out of scope
 * for this slice (see `odd/tasks/booking-agenda.md`).
 */
export const BOOKING_SCHEDULE_UTC_OFFSET = '-06:00';

/**
 * One calendar day's slice of an interval. `startsAt` / `endsAt` repeat the
 * uncut interval on every slice so the frontend can paint a continuation
 * without doing any date maths of its own.
 */
export type DaySegment = {
  date: string;
  segmentStartsAt: Date;
  segmentEndsAt: Date;
  startsAt: Date;
  endsAt: Date;
  continuesFromPreviousDay: boolean;
  continuesNextDay: boolean;
};

/**
 * Offset of the operating region in milliseconds. Adding it to an absolute
 * instant yields the wall clock instant, which is what the UTC getters then
 * read as the local calendar day.
 */
const OFFSET_IN_MS = parseUtcOffset(BOOKING_SCHEDULE_UTC_OFFSET);

/**
 * Splits an interval at every local midnight it crosses and returns one
 * segment per touched day. A booking whose hours run late into the night is
 * the normal case rather than an edge case, so crossing midnight is always
 * handled, not special-cased.
 */
export function splitIntoDaySegments(
  startsAt: Date,
  endsAt: Date,
): DaySegment[] {
  const start = startsAt.getTime();
  const end = endsAt.getTime();
  if (!(end > start)) return [];
  const segments: DaySegment[] = [];
  let dayStart = localMidnightOf(start);
  while (dayStart < end) {
    const dayEnd = dayStart + DAY_IN_MS;
    const segmentStart = Math.max(start, dayStart);
    const segmentEnd = Math.min(end, dayEnd);
    segments.push({
      date: localDateOf(dayStart),
      segmentStartsAt: new Date(segmentStart),
      segmentEndsAt: new Date(segmentEnd),
      startsAt: new Date(start),
      endsAt: new Date(end),
      continuesFromPreviousDay: segmentStart > start,
      continuesNextDay: segmentEnd < end,
    });
    dayStart = dayEnd;
  }
  return segments;
}

/** Local calendar day of an absolute instant, as YYYY-MM-DD. */
export function localDateOf(instant: number): string {
  return new Date(instant + OFFSET_IN_MS).toISOString().slice(0, 10);
}

/** Absolute instant of local midnight opening the day that contains `instant`. */
export function localMidnightOf(instant: number): number {
  const local = instant + OFFSET_IN_MS;
  return local - modulo(local, DAY_IN_MS) - OFFSET_IN_MS;
}

/** Absolute instant of local midnight opening the given calendar day. */
export function localMidnightOfDate(date: string): number {
  return Date.parse(`${date}T00:00:00${BOOKING_SCHEDULE_UTC_OFFSET}`);
}

/** Remainder that stays non negative for instants before the Unix epoch. */
function modulo(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}

function parseUtcOffset(offset: string): number {
  const match = /^([+-])(\d{2}):(\d{2})$/.exec(offset);
  if (!match) throw new Error(`Unsupported UTC offset: ${offset}`);
  const [, sign, hours, minutes] = match;
  const magnitude = Number(hours) * HOUR_IN_MS + Number(minutes) * 60 * 1000;
  return sign === '-' ? -magnitude : magnitude;
}
