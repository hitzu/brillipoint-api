import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';

import { CreateEventThemeDto } from './create-event-theme.dto';
import { UpdateEventThemeDto } from './update-event-theme.dto';
import { IsThemeImageMapConstraint } from './theme-images.dto';

const splash = {
  path: 'themes/x/splash.jpg',
  url: 'https://cdn.example.com/splash.jpg',
};

describe('IsThemeImageMapConstraint plate', () => {
  it('accepts a splashIcon slot carrying a plate', () => {
    // Arrange
    const constraint = new IsThemeImageMapConstraint();

    // Act
    const valid = constraint.validate({
      splashIcon: { ...splash, plate: '#000000' },
    });

    // Assert
    expect(valid).toBe(true);
  });

  it('rejects a splashIcon plate that is not an opaque hex color', () => {
    // Arrange
    const constraint = new IsThemeImageMapConstraint();

    // Act
    const valid = constraint.validate({
      splashIcon: { ...splash, plate: '#00000080' },
    });

    // Assert
    expect(valid).toBe(false);
  });

  it('rejects a plate on a slot other than splashIcon', () => {
    // Arrange
    const constraint = new IsThemeImageMapConstraint();

    // Act
    const valid = constraint.validate({
      logo: { ...splash, plate: '#000000' },
    });

    // Assert
    expect(valid).toBe(false);
  });
});

describe('preset DTOs keep splashIcon plate', () => {
  it('does not strip plate on CreateEventThemeDto images', () => {
    // Arrange
    const instance = plainToInstance(CreateEventThemeDto, {
      key: 'plate',
      name: 'Plate',
      images: { splashIcon: { ...splash, plate: '#000000' } },
    });

    // Act
    const errors = validateSync(instance, { whitelist: true });

    // Assert
    expect(errors.find((e) => e.property === 'images')).toBeUndefined();
    expect(instance.images?.splashIcon).toEqual({
      ...splash,
      plate: '#000000',
    });
  });

  it('does not strip plate on UpdateEventThemeDto images', () => {
    // Arrange
    const instance = plainToInstance(UpdateEventThemeDto, {
      images: { splashIcon: { ...splash, plate: '#000000' } },
    });

    // Act
    const errors = validateSync(instance, { whitelist: true });

    // Assert
    expect(errors.find((e) => e.property === 'images')).toBeUndefined();
    expect(instance.images?.splashIcon?.plate).toBe('#000000');
  });
});
