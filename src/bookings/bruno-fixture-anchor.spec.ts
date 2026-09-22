import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * The Bruno bookings collection computes its fixture dates once per run, in a
 * folder-level pre-request script, so a second run does not land on the ranges
 * the first run left occupied (the overlap guard makes booked ranges stick --
 * see `odd/tasks/booking-overlap-guard.md`).
 *
 * That arithmetic is the whole collision-avoidance guarantee, and it is plain
 * deterministic JavaScript, so it is checked here rather than only by running
 * the collection against a live server. It lives under `src/` because that is
 * jest's `rootDir`: a spec outside it is never collected, and this is the check
 * that catches an anchor regression before CI runs the collection at all.
 */
describe('bruno bookings fixture anchor', () => {
  const FOLDER_BRU = join(
    __dirname,
    '..',
    '..',
    'collection-bookandsign',
    'bookings',
    'folder.bru',
  );

  const runAnchorScript = (): Record<string, string> => {
    const source = readFileSync(FOLDER_BRU, 'utf8');
    const script = source.match(/script:pre-request \{([\s\S]*?)\n\}/);

    if (!script) {
      throw new Error('folder.bru no longer carries a script:pre-request block');
    }

    const vars: Record<string, string> = {};
    const bru = {
      getVar: (key: string): string | undefined => vars[key],
      setVar: (key: string, value: string): void => {
        vars[key] = value;
      },
    };

    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    new Function('bru', script[1])(bru);

    return vars;
  };

  const weekDates = (vars: Record<string, string>): string[] =>
    JSON.parse(vars.ov_week_dates_json) as string[];

  it('publishes a seven-day week window with the fixture on its third day', () => {
    // Arrange + Act
    const vars = runAnchorScript();

    // Assert
    const days = weekDates(vars);
    expect(days).toHaveLength(7);
    expect(days[0]).toBe(vars.ov_week_start);
    expect(days[6]).toBe(vars.ov_week_end);
    expect(days[2]).toBe(vars.ov_week_fixture_date);
  });

  it('places the overnight fixture after the week window so the week agenda never sees it', () => {
    // Arrange + Act
    const vars = runAnchorScript();

    // Assert
    expect(vars.ov_overnight_start_date > vars.ov_week_end).toBe(true);
    expect(vars.ov_overnight_end_date > vars.ov_overnight_start_date).toBe(true);
  });

  it('keeps every fixture date distinct and clear of the hardcoded 2026 literals', () => {
    // Arrange + Act
    const vars = runAnchorScript();

    // Assert
    const all = [
      vars.ov_standalone_date,
      vars.ov_standalone_next_date,
      ...weekDates(vars),
      vars.ov_overnight_start_date,
      vars.ov_overnight_end_date,
      vars.ov_guard_date,
    ];
    expect(new Set(all).size).toBe(all.length);
    all.forEach((date) => expect(date > '2027-01-01').toBe(true));
  });

  it('computes the anchor once per run instead of once per request', () => {
    // Arrange
    const source = readFileSync(FOLDER_BRU, 'utf8');

    // Assert: a folder-level pre-request script runs before EVERY request, so
    // recomputing would hand each fixture a different day and break the
    // relationships the agenda assertions depend on.
    expect(source).toContain("if (!bru.getVar('ov_week_start'))");
  });

  it('hands separate runs separate dates', () => {
    // Arrange + Act
    const anchors = new Set<string>();
    for (let run = 0; run < 50; run++) {
      anchors.add(runAnchorScript().ov_week_start);
    }

    // Assert: a repeat means the collection would replay a previous run's
    // ranges and hit the overlap guard with a 409 instead of creating its
    // fixtures. Some collision is possible by construction, so this asserts the
    // spread is overwhelming rather than demanding perfection.
    expect(anchors.size).toBeGreaterThan(45);
  });
});
