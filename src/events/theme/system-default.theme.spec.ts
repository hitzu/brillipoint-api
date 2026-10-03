import * as fs from 'node:fs';
import * as path from 'node:path';

import {
  SYSTEM_DEFAULT_THEME,
  SYSTEM_DEFAULT_THEME_VERSION,
} from './system-default.theme';

/**
 * Drift guard for `system-default.json`, the committed offline fallback the
 * frontend bundles at build time (T7, odd/tasks/theme-brand-kits.md). The
 * file is generated, never hand-edited: `pnpm run theme:export-default`.
 */
describe('system-default.json', () => {
  it('deep-equals the SYSTEM_DEFAULT_THEME code constant', () => {
    // Arrange
    const jsonPath = path.resolve(__dirname, './system-default.json');
    const exists = fs.existsSync(jsonPath);

    // Act
    const committed = exists
      ? (JSON.parse(fs.readFileSync(jsonPath, 'utf-8')) as unknown)
      : undefined;

    // Assert
    expect(exists).toBe(true);
    expect(committed).toEqual({
      version: SYSTEM_DEFAULT_THEME_VERSION,
      theme: SYSTEM_DEFAULT_THEME,
    });

    if (!exists || !committed) {
      throw new Error(
        'src/events/theme/system-default.json is missing or stale. Run `pnpm run theme:export-default` and commit the result.',
      );
    }
  });
});

describe('SYSTEM_DEFAULT_THEME', () => {
  it('carries no reward promo so only a kit can show one', () => {
    // Arrange
    const theme = SYSTEM_DEFAULT_THEME;

    // Act
    const rewardPromo = theme.rewardPromo;

    // Assert
    expect(rewardPromo).toBeNull();
  });
});
