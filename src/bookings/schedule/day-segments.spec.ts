import {
  localDateOf,
  localMidnightOf,
  localMidnightOfDate,
  splitIntoDaySegments,
} from './day-segments';

describe('splitIntoDaySegments', () => {
  it('returns a single segment for an interval that stays within one local day', () => {
    // Arrange
    const startsAt = new Date('2026-09-15T14:00:00-06:00');
    const endsAt = new Date('2026-09-15T18:00:00-06:00');

    // Act
    const segments = splitIntoDaySegments(startsAt, endsAt);

    // Assert
    expect(segments).toHaveLength(1);
    expect(segments[0].date).toBe('2026-09-15');
    expect(segments[0].continuesFromPreviousDay).toBe(false);
    expect(segments[0].continuesNextDay).toBe(false);
  });

  it('splits an interval crossing local midnight into two segments', () => {
    // Arrange
    const startsAt = new Date('2026-09-15T22:00:00-06:00');
    const endsAt = new Date('2026-09-16T02:00:00-06:00');

    // Act
    const segments = splitIntoDaySegments(startsAt, endsAt);

    // Assert
    expect(segments).toHaveLength(2);
    expect(segments[0].date).toBe('2026-09-15');
    expect(segments[1].date).toBe('2026-09-16');
  });

  it('flags the continuation on both sides of the midnight it crosses', () => {
    // Arrange
    const startsAt = new Date('2026-09-15T22:00:00-06:00');
    const endsAt = new Date('2026-09-16T02:00:00-06:00');

    // Act
    const segments = splitIntoDaySegments(startsAt, endsAt);

    // Assert
    expect(segments[0].continuesFromPreviousDay).toBe(false);
    expect(segments[0].continuesNextDay).toBe(true);
    expect(segments[1].continuesFromPreviousDay).toBe(true);
    expect(segments[1].continuesNextDay).toBe(false);
  });

  it('repeats the full uncut interval on every segment', () => {
    // Arrange
    const startsAt = new Date('2026-09-15T22:00:00-06:00');
    const endsAt = new Date('2026-09-16T02:00:00-06:00');

    // Act
    const segments = splitIntoDaySegments(startsAt, endsAt);

    // Assert
    expect(segments[0].startsAt).toEqual(startsAt);
    expect(segments[0].endsAt).toEqual(endsAt);
    expect(segments[1].startsAt).toEqual(startsAt);
    expect(segments[1].endsAt).toEqual(endsAt);
  });

  it('clips each segment to its own day boundary, meeting exactly at local midnight', () => {
    // Arrange
    const startsAt = new Date('2026-09-15T22:00:00-06:00');
    const endsAt = new Date('2026-09-16T02:00:00-06:00');

    // Act
    const segments = splitIntoDaySegments(startsAt, endsAt);

    // Assert
    expect(segments[0].segmentStartsAt).toEqual(startsAt);
    expect(segments[0].segmentEndsAt).toEqual(segments[1].segmentStartsAt);
    expect(segments[1].segmentEndsAt).toEqual(endsAt);
  });

  it('returns no segments for a zero-length or inverted interval', () => {
    // Arrange
    const instant = new Date('2026-09-15T14:00:00-06:00');

    // Act
    const zeroLength = splitIntoDaySegments(instant, instant);
    const inverted = splitIntoDaySegments(
      new Date('2026-09-15T18:00:00-06:00'),
      new Date('2026-09-15T14:00:00-06:00'),
    );

    // Assert
    expect(zeroLength).toEqual([]);
    expect(inverted).toEqual([]);
  });
});

describe('localDateOf', () => {
  it('reads the local calendar date of an instant well within the day', () => {
    // Arrange
    const instant = Date.parse('2026-09-15T14:00:00-06:00');

    // Act
    const result = localDateOf(instant);

    // Assert
    expect(result).toBe('2026-09-15');
  });

  it('reads the previous local date for an instant just after UTC midnight', () => {
    // Arrange: 2026-09-15T04:00:00Z is 2026-09-14T22:00 in -06:00.
    const instant = Date.parse('2026-09-15T04:00:00Z');

    // Act
    const result = localDateOf(instant);

    // Assert
    expect(result).toBe('2026-09-14');
  });
});

describe('localMidnightOf', () => {
  it('returns the absolute instant of local midnight for a given instant during that day', () => {
    // Arrange
    const instant = Date.parse('2026-09-15T14:00:00-06:00');

    // Act
    const result = localMidnightOf(instant);

    // Assert
    expect(result).toBe(Date.parse('2026-09-15T00:00:00-06:00'));
  });
});

describe('localMidnightOfDate', () => {
  it('returns the absolute instant of local midnight for a YYYY-MM-DD date', () => {
    // Act
    const result = localMidnightOfDate('2026-09-15');

    // Assert
    expect(result).toBe(Date.parse('2026-09-15T00:00:00-06:00'));
  });
});
