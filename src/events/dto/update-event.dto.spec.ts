import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';

import { UpdateEventDto } from './update-event.dto';

describe('UpdateEventDto themeOverrides', () => {
  it('rejects a themeOverrides payload with an invalid nested value', () => {
    // Arrange
    const instance = plainToInstance(UpdateEventDto, {
      themeOverrides: { tokens: { primary: 'not-a-hex-color' } },
    });

    // Act
    const errors = validateSync(instance);

    // Assert
    const themeOverridesError = errors.find(
      (error) => error.property === 'themeOverrides',
    );
    expect(themeOverridesError).toBeDefined();
    expect(
      Object.values(themeOverridesError?.constraints ?? {}).join(' '),
    ).toContain('tokens.primary');
  });

  it('accepts a valid themeOverrides payload', () => {
    // Arrange
    const instance = plainToInstance(UpdateEventDto, {
      themeOverrides: {
        tokens: { primary: '#000000', onPrimary: '#ffffff' },
        decorations: { confetti: { shapes: ['rose', 'soccer-ball'] } },
      },
    });

    // Act
    const errors = validateSync(instance);

    // Assert
    expect(
      errors.find((error) => error.property === 'themeOverrides'),
    ).toBeUndefined();
  });

  it('rejects a null socialCta so the event cannot hide the Brillipoint CTA', () => {
    // Arrange
    const instance = plainToInstance(UpdateEventDto, {
      themeOverrides: { socialCta: null },
    });

    // Act
    const errors = validateSync(instance);

    // Assert
    const themeOverridesError = errors.find(
      (error) => error.property === 'themeOverrides',
    );
    expect(
      Object.values(themeOverridesError?.constraints ?? {}).join(' '),
    ).toContain('socialCta: must be an object');
  });

  it('accepts a null themeOverrides', () => {
    // Arrange
    const instance = plainToInstance(UpdateEventDto, { themeOverrides: null });

    // Act
    const errors = validateSync(instance);

    // Assert
    expect(
      errors.find((error) => error.property === 'themeOverrides'),
    ).toBeUndefined();
  });

  it('accepts a missing themeOverrides', () => {
    // Arrange
    const instance = plainToInstance(UpdateEventDto, {});

    // Act
    const errors = validateSync(instance);

    // Assert
    expect(
      errors.find((error) => error.property === 'themeOverrides'),
    ).toBeUndefined();
  });
});

describe('UpdateEventDto eventThemeId', () => {
  it('keeps eventThemeId through a whitelisting validation', () => {
    // Arrange
    const instance = plainToInstance(UpdateEventDto, { eventThemeId: 7 });

    // Act
    const errors = validateSync(instance, {
      whitelist: true,
      forbidUnknownValues: false,
    });

    // Assert
    expect(errors).toHaveLength(0);
    expect(instance.eventThemeId).toBe(7);
  });

  it('accepts a null eventThemeId to clear the preset', () => {
    // Arrange
    const instance = plainToInstance(UpdateEventDto, { eventThemeId: null });

    // Act
    const errors = validateSync(instance, { whitelist: true });

    // Assert
    expect(errors).toHaveLength(0);
    expect(instance.eventThemeId).toBeNull();
  });

  it('rejects a non-integer eventThemeId', () => {
    // Arrange
    const instance = plainToInstance(UpdateEventDto, { eventThemeId: 'abc' });

    // Act
    const errors = validateSync(instance);

    // Assert
    expect(errors.some((error) => error.property === 'eventThemeId')).toBe(
      true,
    );
  });
});
