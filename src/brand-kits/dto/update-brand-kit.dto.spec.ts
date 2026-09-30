import 'reflect-metadata';
import { ArgumentMetadata, ValidationPipe } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';

import { UpdateBrandKitDto } from './update-brand-kit.dto';

describe('UpdateBrandKitDto', () => {
  it('strips a key field sent in the body (key is immutable)', async () => {
    // Arrange — mirrors the global ValidationPipe config in src/main.ts
    const pipe = new ValidationPipe({ transform: true, whitelist: true });
    const metadata: ArgumentMetadata = {
      type: 'body',
      metatype: UpdateBrandKitDto,
    };

    // Act
    const result = (await pipe.transform(
      { key: 'new-key', name: 'New Name' },
      metadata,
    )) as UpdateBrandKitDto & { key?: string };

    // Assert
    expect(result.key).toBeUndefined();
    expect(result.name).toBe('New Name');
  });

  it('accepts a name-only update', () => {
    // Arrange
    const instance = plainToInstance(UpdateBrandKitDto, {
      name: 'New Name',
    });

    // Act
    const errors = validateSync(instance);

    // Assert
    expect(errors).toHaveLength(0);
  });

  it('rejects overrides with an invalid nested value', () => {
    // Arrange
    const instance = plainToInstance(UpdateBrandKitDto, {
      overrides: { socialCta: { socials: { instagram: 'not-a-url' } } },
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
    ).toContain('must be an https URL');
  });

  it('accepts an empty body', () => {
    // Arrange
    const instance = plainToInstance(UpdateBrandKitDto, {});

    // Act
    const errors = validateSync(instance);

    // Assert
    expect(errors).toHaveLength(0);
  });
});
