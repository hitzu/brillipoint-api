import { UnprocessableEntityException } from '@nestjs/common';

import { resolveTheme } from './resolve-theme';
import type { ThemeOverrides } from './theme.types';
import { validatePublicThemeTokens } from './validate-theme-overrides';

/** Validate tokens only after applying the same ordered public-theme layers. */
export function assertResolvedThemeTokensValid(
  ...layers: Array<ThemeOverrides | null | undefined>
): void {
  const errors = validatePublicThemeTokens(resolveTheme(...layers).tokens);
  if (errors.length > 0) {
    throw new UnprocessableEntityException({
      message: 'Resolved public event theme is invalid',
      errors,
    });
  }
}
