/**
 * WCAG relative-luminance contrast ratio between two colors, and the hex
 * parsing it needs. Pure, no IO — see `validate-theme-overrides.ts` (T7) for where the minimum ratio is enforced.
 */

const HEX_COLOR_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

/** `#rgb`, `#rrggbb`, or `#rrggbbaa` (alpha ignored everywhere else in this module). */
export function isHexColor(value: unknown): value is string {
  return typeof value === 'string' && HEX_COLOR_RE.test(value);
}

function expandHex(hex: string): string {
  const body = hex.slice(1);
  if (body.length === 3) {
    return body
      .split('')
      .map((c) => c + c)
      .join('');
  }
  // 6 or 8 digits: take the first 6 (rrggbb), ignore any trailing alpha.
  return body.slice(0, 6);
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const expanded = expandHex(hex);
  return {
    r: parseInt(expanded.slice(0, 2), 16),
    g: parseInt(expanded.slice(2, 4), 16),
    b: parseInt(expanded.slice(4, 6), 16),
  };
}

function srgbChannelToLinear(channel255: number): number {
  const c = channel255 / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function relativeLuminance({
  r,
  g,
  b,
}: {
  r: number;
  g: number;
  b: number;
}): number {
  return (
    0.2126 * srgbChannelToLinear(r) +
    0.7152 * srgbChannelToLinear(g) +
    0.0722 * srgbChannelToLinear(b)
  );
}

/**
 * WCAG contrast ratio between two hex colors, from 1 (identical/no contrast)
 * to 21 (black on white). Both inputs must be valid hex colors (`isHexColor`);
 * throws otherwise — callers only invoke this once both sides are already
 * known to be hex (see `validateTokenContrast`).
 */
export function contrastRatio(colorA: string, colorB: string): number {
  if (!isHexColor(colorA) || !isHexColor(colorB)) {
    throw new Error(
      `contrastRatio requires two valid hex colors, got "${colorA}" and "${colorB}"`,
    );
  }

  const luminanceA = relativeLuminance(hexToRgb(colorA));
  const luminanceB = relativeLuminance(hexToRgb(colorB));
  const lighter = Math.max(luminanceA, luminanceB);
  const darker = Math.min(luminanceA, luminanceB);

  return (lighter + 0.05) / (darker + 0.05);
}
