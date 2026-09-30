import { contrastRatio, isHexColor } from './contrast-ratio';

describe('isHexColor', () => {
  it('accepts a 3-digit hex color', () => {
    // Arrange
    const value = '#fff';

    // Act
    const result = isHexColor(value);

    // Assert
    expect(result).toBe(true);
  });

  it('accepts a 6-digit hex color', () => {
    // Arrange
    const value = '#ff00aa';

    // Act
    const result = isHexColor(value);

    // Assert
    expect(result).toBe(true);
  });

  it('accepts an 8-digit hex color with alpha', () => {
    // Arrange
    const value = '#ff00aa80';

    // Act
    const result = isHexColor(value);

    // Assert
    expect(result).toBe(true);
  });

  it('rejects a named CSS color', () => {
    // Arrange
    const value = 'red';

    // Act
    const result = isHexColor(value);

    // Assert
    expect(result).toBe(false);
  });

  it('rejects a non-string value', () => {
    // Arrange
    const value = 123;

    // Act
    const result = isHexColor(value);

    // Assert
    expect(result).toBe(false);
  });
});

describe('contrastRatio', () => {
  it('returns 21 for black on white', () => {
    // Arrange
    const black = '#000000';
    const white = '#ffffff';

    // Act
    const ratio = contrastRatio(black, white);

    // Assert
    expect(ratio).toBeCloseTo(21, 1);
  });

  it('returns 1 for identical colors', () => {
    // Arrange
    const white = '#ffffff';

    // Act
    const ratio = contrastRatio(white, white);

    // Assert
    expect(ratio).toBeCloseTo(1, 5);
  });

  it('is symmetric regardless of argument order', () => {
    // Arrange
    const a = '#111827';
    const b = '#ffffff';

    // Act
    const forward = contrastRatio(a, b);
    const backward = contrastRatio(b, a);

    // Assert
    expect(forward).toBeCloseTo(backward, 10);
  });

  it('ignores alpha and treats short 3-digit hex like its expansion', () => {
    // Arrange

    // Act
    const short = contrastRatio('#000', '#fff');
    const withAlpha = contrastRatio('#000000ff', '#ffffff80');

    // Assert
    expect(short).toBeCloseTo(21, 1);
    expect(withAlpha).toBeCloseTo(21, 1);
  });

  it('throws when given an invalid hex color', () => {
    // Arrange
    const invalid = 'not-a-color';

    // Act
    const act = () => contrastRatio(invalid, '#fff');

    // Assert
    expect(act).toThrow();
  });
});
