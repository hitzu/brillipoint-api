import * as fs from 'node:fs';
import * as path from 'node:path';

import {
  SYSTEM_DEFAULT_THEME,
  SYSTEM_DEFAULT_THEME_VERSION,
} from '../src/events/theme/system-default.theme';

/**
 * Regenerates `src/events/theme/system-default.json`, the committed offline
 * fallback the frontend bundles at build time (T7, odd/tasks/theme-brand-kits.md).
 * Run via `pnpm run theme:export-default` whenever `SYSTEM_DEFAULT_THEME` or
 * `SYSTEM_DEFAULT_THEME_VERSION` changes; `system-default.theme.spec.ts`
 * fails with this instruction if the committed file drifts from the code.
 */
function main(): void {
  const outputPath = path.resolve(
    __dirname,
    '../src/events/theme/system-default.json',
  );

  const payload = {
    version: SYSTEM_DEFAULT_THEME_VERSION,
    theme: SYSTEM_DEFAULT_THEME,
  };

  fs.writeFileSync(
    outputPath,
    `${JSON.stringify(payload, null, 2)}\n`,
    'utf-8',
  );

  console.log(`Wrote ${outputPath}`);
}

main();
