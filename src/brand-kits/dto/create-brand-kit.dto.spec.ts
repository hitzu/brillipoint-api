import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';

import { CreateBrandKitDto } from './create-brand-kit.dto';

describe('CreateBrandKitDto', () => {
  it('accepts a valid slug key with a valid overrides payload', () => {
    // Arrange
    const instance = plainToInstance(CreateBrandKitDto, {
      key: 'acme-corp',
      name: 'Acme Corp',
      overrides: { tokens: { primary: '#000000', onPrimary: '#ffffff' } },
    });

    // Act
    const errors = validateSync(instance);

    // Assert
    expect(errors).toHaveLength(0);
  });

  it('rejects a key that is not a lowercase slug', () => {
    // Arrange
    const instance = plainToInstance(CreateBrandKitDto, {
      key: 'Acme_Corp!',
      name: 'Acme Corp',
    });

    // Act
    const errors = validateSync(instance);

    // Assert
    expect(errors.find((error) => error.property === 'key')).toBeDefined();
  });

  it('rejects overrides with an invalid nested value', () => {
    // Arrange
    const instance = plainToInstance(CreateBrandKitDto, {
      key: 'acme-corp',
      name: 'Acme Corp',
      overrides: { tokens: { primary: 'not-a-hex-color' } },
    });

    // Act
    const errors = validateSync(instance);

    // Assert
    const overridesError = errors.find(
      (error) => error.property === 'overrides',
    );
    expect(overridesError).toBeDefined();
    expect(
      Object.values(overridesError?.constraints ?? {}).join(' '),
    ).toContain('must be an opaque #RRGGBB color');
  });

  it('rejects overrides with insufficient primary/onPrimary contrast', () => {
    // Arrange
    const instance = plainToInstance(CreateBrandKitDto, {
      key: 'acme-corp',
      name: 'Acme Corp',
      overrides: { tokens: { primary: '#ffffff', onPrimary: '#fefefe' } },
    });

    // Act
    const errors = validateSync(instance);

    // Assert
    const overridesError = errors.find(
      (error) => error.property === 'overrides',
    );
    expect(overridesError).toBeDefined();
    expect(
      Object.values(overridesError?.constraints ?? {}).join(' '),
    ).toContain('primary/onPrimary');
  });

  it('accepts a missing overrides', () => {
    // Arrange
    const instance = plainToInstance(CreateBrandKitDto, {
      key: 'acme-corp',
      name: 'Acme Corp',
    });

    // Act
    const errors = validateSync(instance);

    // Assert
    expect(errors).toHaveLength(0);
  });
});
