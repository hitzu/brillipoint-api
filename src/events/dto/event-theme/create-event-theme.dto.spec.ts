import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';

import { CreateEventThemeDto } from './create-event-theme.dto';

describe('CreateEventThemeDto tokens contrast', () => {
  it('rejects tokens with insufficient primary/onPrimary contrast', () => {
    // Arrange
    const instance = plainToInstance(CreateEventThemeDto, {
      key: 'low-contrast',
      name: 'Low Contrast',
      tokens: { primary: '#ffffff', onPrimary: '#fefefe' },
    });

    // Act
    const errors = validateSync(instance);

    // Assert
    const tokensError = errors.find((error) => error.property === 'tokens');
    expect(tokensError).toBeDefined();
    expect(Object.values(tokensError?.constraints ?? {}).join(' ')).toContain(
      'primary/onPrimary',
    );
  });

  it('accepts tokens with sufficient contrast', () => {
    // Arrange
    const instance = plainToInstance(CreateEventThemeDto, {
      key: 'high-contrast',
      name: 'High Contrast',
      tokens: { primary: '#000000', onPrimary: '#ffffff' },
    });

    // Act
    const errors = validateSync(instance);

    // Assert
    expect(errors.find((error) => error.property === 'tokens')).toBeUndefined();
  });
});
