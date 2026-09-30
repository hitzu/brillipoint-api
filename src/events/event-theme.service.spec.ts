import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { AppDataSource as TestDataSource } from '../config/database/data-source';
import { BrandKit } from '../brand-kits/entities/brand-kit.entity';
import { BrandKitsService } from '../brand-kits/brand-kits.service';
import { BRILLIPOINT_BRAND_KIT_KEY } from '../brand-kits/brillipoint-kit.seed';
import { BrandKitFactory } from '../../test/factories/brand-kits/brand-kit.factory';
import { BrandFactory } from '../../test/factories/brands/brands.factories';
import { ContractFactory } from '../../test/factories/contracts/contract.factory';
import { Contract } from '../contracts/entities/contract.entity';
import { EventFactory } from '../../test/factories/events/event.factory';
import { EventThemeFactory } from '../../test/factories/events/event-theme.factory';

import { CreateEventThemeDto } from './dto/event-theme/create-event-theme.dto';
import { UpdateEventThemeDto } from './dto/event-theme/update-event-theme.dto';
import { EventTheme } from './entities/event-themes.entity';
import { Event } from './entities/event.entity';
import { EventThemeService } from './event-theme.service';
import { SYSTEM_DEFAULT_THEME_VERSION } from './theme/system-default.theme';
import type { ThemeOverrides } from './theme/theme.types';

const amorEternoTokens = {
  background: '#fff5f7',
  primary: '#9d174d',
  onPrimary: '#ffffff',
  secondary: '#a855f7',
  text: '#831843',
  textMuted: '#4b5563',
  surface: '#fce7f3',
  fontHeading: 'Futura',
  fontBody: 'Inter',
};

const loggerMock = { setContext: jest.fn(), error: jest.fn() };

async function setUpdatedAt(
  table: 'event_themes' | 'brand_kits' | 'events',
  id: number,
  date: Date,
): Promise<void> {
  await TestDataSource.query(
    `UPDATE ${table} SET updated_at = $1 WHERE id = $2`,
    [date, id],
  );
}

describe('EventThemeService', () => {
  let service: EventThemeService;
  let eventThemeFactory: EventThemeFactory;
  let eventFactory: EventFactory;
  let brandKitFactory: BrandKitFactory;
  let brandFactory: BrandFactory;
  let contractFactory: ContractFactory;

  beforeEach(() => {
    const eventThemeRepository = TestDataSource.getRepository(EventTheme);
    const eventRepository = TestDataSource.getRepository(Event);
    const brandKitsService = new BrandKitsService(
      TestDataSource.getRepository(BrandKit),
    );

    service = new EventThemeService(
      eventThemeRepository,
      eventRepository,
      TestDataSource.getRepository(Contract),
      brandKitsService,
      loggerMock as any,
    );

    eventThemeFactory = new EventThemeFactory(TestDataSource);
    eventFactory = new EventFactory(TestDataSource);
    brandKitFactory = new BrandKitFactory(TestDataSource);
    brandFactory = new BrandFactory(TestDataSource);
    contractFactory = new ContractFactory(TestDataSource);
  });

  // ─── images DTO validation (no DB — pure class-validator) ────────────────

  describe('images DTO validation', () => {
    it('accepts a valid typed image slot', async () => {
      // Arrange
      const dto = plainToInstance(CreateEventThemeDto, {
        key: 'amor-eterno',
        name: 'Amor Eterno',
        images: {
          logo: {
            path: 'themes/amor-eterno/logo.png',
            url: 'https://cdn.example.com/themes/amor-eterno/logo.png',
          },
        },
      });

      // Act
      const errors = await validate(dto);

      // Assert
      expect(errors).toEqual([]);
    });

    it('accepts the cover slot with its extra link field', async () => {
      // Arrange
      const dto = plainToInstance(CreateEventThemeDto, {
        key: 'amor-eterno',
        name: 'Amor Eterno',
        images: {
          cover: {
            path: 'themes/amor-eterno/cover.png',
            url: 'https://cdn.example.com/themes/amor-eterno/cover.png',
            link: 'https://brillipoint.com',
            alt: { es: 'Portada', en: 'Cover' },
          },
        },
      });

      // Act
      const errors = await validate(dto);

      // Assert
      expect(errors).toEqual([]);
    });

    it('accepts an empty images object', async () => {
      // Arrange
      const dto = plainToInstance(CreateEventThemeDto, {
        key: 'amor-eterno',
        name: 'Amor Eterno',
        images: {},
      });

      // Act
      const errors = await validate(dto);

      // Assert
      expect(errors).toEqual([]);
    });

    it('rejects an unknown slot name', async () => {
      // Arrange
      const dto = plainToInstance(CreateEventThemeDto, {
        key: 'amor-eterno',
        name: 'Amor Eterno',
        images: {
          splashLogo: {
            path: 'themes/amor-eterno/splash.png',
            url: 'https://cdn.example.com/themes/amor-eterno/splash.png',
          },
        },
      });

      // Act
      const errors = await validate(dto);

      // Assert
      expect(errors.some((error) => error.property === 'images')).toBe(true);
    });

    it('rejects an entry missing the required path', async () => {
      // Arrange
      const dto = plainToInstance(CreateEventThemeDto, {
        key: 'amor-eterno',
        name: 'Amor Eterno',
        images: {
          logo: {
            url: 'https://cdn.example.com/themes/amor-eterno/logo.png',
          },
        },
      });

      // Act
      const errors = await validate(dto);

      // Assert
      expect(errors.some((error) => error.property === 'images')).toBe(true);
    });

    it('rejects an entry missing the required url', async () => {
      // Arrange
      const dto = plainToInstance(CreateEventThemeDto, {
        key: 'amor-eterno',
        name: 'Amor Eterno',
        images: {
          logo: {
            path: 'themes/amor-eterno/logo.png',
          },
        },
      });

      // Act
      const errors = await validate(dto);

      // Assert
      expect(errors.some((error) => error.property === 'images')).toBe(true);
    });

    it('rejects an entry with an unknown field', async () => {
      // Arrange
      const dto = plainToInstance(CreateEventThemeDto, {
        key: 'amor-eterno',
        name: 'Amor Eterno',
        images: {
          logo: {
            path: 'themes/amor-eterno/logo.png',
            url: 'https://cdn.example.com/themes/amor-eterno/logo.png',
            foo: 'bar',
          },
        },
      });

      // Act
      const errors = await validate(dto);

      // Assert
      expect(errors.some((error) => error.property === 'images')).toBe(true);
    });

    it('rejects an array value for images', async () => {
      // Arrange
      const dto = plainToInstance(CreateEventThemeDto, {
        key: 'amor-eterno',
        name: 'Amor Eterno',
        images: [
          {
            path: 'themes/amor-eterno/logo.png',
            url: 'https://cdn.example.com/themes/amor-eterno/logo.png',
          },
        ],
      });

      // Act
      const errors = await validate(dto);

      // Assert
      expect(errors.some((error) => error.property === 'images')).toBe(true);
    });

    it('rejects a scalar value for images', async () => {
      // Arrange
      const dto = plainToInstance(CreateEventThemeDto, {
        key: 'amor-eterno',
        name: 'Amor Eterno',
        images: 'not-a-map',
      });

      // Act
      const errors = await validate(dto);

      // Assert
      expect(errors.some((error) => error.property === 'images')).toBe(true);
    });
  });

  // ─── tokens DTO validation (no DB) ────────────────────────────────────────

  describe('tokens DTO validation', () => {
    it('accepts a partial preset that only overrides some tokens', async () => {
      // Arrange
      const dto = plainToInstance(CreateEventThemeDto, {
        key: 'garden',
        name: 'Garden',
        tokens: { primary: '#15803d', onPrimary: '#ffffff' },
      });

      // Act
      const errors = await validate(dto);

      // Assert
      expect(errors).toEqual([]);
    });

    it('still accepts a full preset with every token', async () => {
      // Arrange
      const dto = plainToInstance(CreateEventThemeDto, {
        key: 'amor-eterno',
        name: 'Amor Eterno',
        tokens: amorEternoTokens,
      });

      // Act
      const errors = await validate(dto);

      // Assert
      expect(errors).toEqual([]);
    });

    it('rejects a token that is not a string', async () => {
      // Arrange
      const dto = plainToInstance(CreateEventThemeDto, {
        key: 'garden',
        name: 'Garden',
        tokens: { primary: 42 },
      });

      // Act
      const errors = await validate(dto);

      // Assert
      expect(errors.some((error) => error.property === 'tokens')).toBe(true);
    });
  });

  // ─── createEventTheme ─────────────────────────────────────────────────────

  describe('createEventTheme', () => {
    it('persists tokens and typed images on the new preset', async () => {
      // Arrange
      const images = {
        logo: {
          path: 'themes/amor-eterno/logo.png',
          url: 'https://cdn.example.com/themes/amor-eterno/logo.png',
        },
      };

      // Act
      const result = await service.createEventTheme({
        key: `amor-eterno-${Date.now()}`,
        name: 'Amor Eterno',
        tokens: amorEternoTokens,
        images,
      });

      // Assert
      const saved = await TestDataSource.getRepository(EventTheme).findOne({
        where: { id: result.id },
      });
      expect(saved?.images).toEqual(images);
    });

    it('creates a preset without tokens for manual token setup', async () => {
      // Arrange — no tokens/images provided

      // Act
      const result = await service.createEventTheme({
        key: `mis-fotos-oscuro-${Date.now()}`,
        name: 'Mis Fotos Oscuro',
      });

      // Assert
      expect(result.tokens).toBeNull();
    });

    it('rejects a duplicated theme key', async () => {
      // Arrange
      const existing = await eventThemeFactory.create();

      // Act + Assert
      await expect(
        service.createEventTheme({
          key: existing.key,
          name: 'Duplicate',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  // ─── updateEventTheme ──────────────────────────────────────────────────────

  describe('updateEventTheme', () => {
    it('rejects a preset update that makes a linked event public theme invalid without changing the preset', async () => {
      // Arrange
      const preset = await eventThemeFactory.create({
        tokens: { primary: '#9d174d', onPrimary: '#ffffff' },
      });
      const event = await eventFactory.create({ eventThemeId: preset.id });

      // Act
      const update = service.updateEventTheme(preset.id, {
        tokens: { primary: '#ffffff', onPrimary: '#fefefe' },
      });

      // Assert
      await expect(update).rejects.toBeInstanceOf(UnprocessableEntityException);
      const saved = await TestDataSource.getRepository(EventTheme).findOne({
        where: { id: preset.id },
      });
      expect(saved?.tokens).toEqual({
        primary: '#9d174d',
        onPrimary: '#ffffff',
      });
      const publicTheme = await service.getPublicThemeByEventToken(event.token);
      expect(publicTheme.body.eventTheme.tokens.primary).toBe('#9d174d');
    });

    it('validates a preset update after event overrides repair its proposed palette', async () => {
      // Arrange
      const preset = await eventThemeFactory.create({
        tokens: { primary: '#9d174d', onPrimary: '#ffffff' },
      });
      await eventFactory.create({
        eventThemeId: preset.id,
        themeOverrides: {
          tokens: { primary: '#9d174d', onPrimary: '#ffffff' },
        },
      });

      // Act
      const result = await service.updateEventTheme(preset.id, {
        tokens: { primary: '#ffffff', onPrimary: '#fefefe' },
      });

      // Assert
      expect(result.tokens).toEqual({
        primary: '#ffffff',
        onPrimary: '#fefefe',
      });
    });

    it('replaces stored tokens entirely, not merging with the existing value', async () => {
      // Arrange
      const preset = await eventThemeFactory.create({
        tokens: { primary: '#111111', secondary: '#222222' },
      });

      // Act
      const result = await service.updateEventTheme(preset.id, {
        tokens: { primary: '#16a34a' },
      });

      // Assert
      expect(result.tokens).toEqual({ primary: '#16a34a' });
      const saved = await TestDataSource.getRepository(EventTheme).findOne({
        where: { id: preset.id },
      });
      expect(saved?.tokens).toEqual({ primary: '#16a34a' });
    });

    it('replaces stored images entirely, not merging with the existing value', async () => {
      // Arrange
      const preset = await eventThemeFactory.create({
        images: {
          logo: {
            path: 'themes/x/logo.png',
            url: 'https://cdn.example.com/themes/x/logo.png',
          },
        },
      });
      const newCover = {
        path: 'themes/x/cover.png',
        url: 'https://cdn.example.com/themes/x/cover.png',
      };

      // Act
      const result = await service.updateEventTheme(preset.id, {
        images: { cover: newCover },
      });

      // Assert
      expect(result.images).toEqual({ cover: newCover });
    });

    it('updates only the fields sent, leaving the rest untouched', async () => {
      // Arrange
      const preset = await eventThemeFactory.create({
        name: 'Original',
        tokens: { primary: '#111111' },
      });

      // Act
      const result = await service.updateEventTheme(preset.id, {
        name: 'Renamed',
      });

      // Assert
      expect(result.name).toBe('Renamed');
      expect(result.tokens).toEqual({ primary: '#111111' });
    });

    it('throws NotFoundException when the theme id does not exist', async () => {
      // Arrange — no theme created

      // Act + Assert
      await expect(
        service.updateEventTheme(999999, { name: 'Nope' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('rejects an update with an invalid primary/onPrimary contrast pair', async () => {
      // Arrange
      const dto = plainToInstance(UpdateEventThemeDto, {
        tokens: { primary: '#ffffff', onPrimary: '#fefefe' },
      });

      // Act
      const errors = await validate(dto);

      // Assert
      expect(errors.some((error) => error.property === 'tokens')).toBe(true);
    });
  });

  // ─── getPublicThemeByEventToken ────────────────────────────────────────────

  describe('getPublicThemeByEventToken', () => {
    it('throws NotFoundException when the event token does not exist', async () => {
      // Arrange — no event created

      // Act + Assert
      await expect(
        service.getPublicThemeByEventToken(
          '00000000-0000-0000-0000-000000000000',
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('resolves system default tokens when the event has no theme and no brand kit resolves at all', async () => {
      // Arrange
      const event = await eventFactory.create();

      // Act
      const result = await service.getPublicThemeByEventToken(event.token);

      // Assert
      expect(result.body.eventTheme).toMatchObject({
        id: null,
        key: 'system-default',
        name: 'System Default',
      });
    });

    it('layers preset, client kit and event overrides in order (later wins)', async () => {
      // Arrange
      const preset = await eventThemeFactory.create({
        tokens: { primary: '#111111', secondary: '#222222' },
      });
      const clientKit = await brandKitFactory.create({
        overrides: { tokens: { primary: '#333333' } },
      });
      const event = await eventFactory.create({
        eventThemeId: preset.id,
        brandKitId: clientKit.id,
        themeOverrides: { tokens: { primary: '#444444' } },
      });

      // Act
      const result = await service.getPublicThemeByEventToken(event.token);

      // Assert
      expect(result.body.eventTheme.tokens.primary).toBe('#444444');
      expect(result.body.eventTheme.tokens.secondary).toBe('#222222');
    });

    it('falls back to the business brand kit via the contract brand when the event has no client kit', async () => {
      // Arrange
      const businessKit = await brandKitFactory.create({
        overrides: { tokens: { primary: '#555555' } },
      });
      const brand = await brandFactory.create({ brandKitId: businessKit.id });
      const contract = await contractFactory.create({ brandId: brand.id });
      const event = await eventFactory.create({ contractId: contract.id });

      // Act
      const result = await service.getPublicThemeByEventToken(event.token);

      // Assert
      expect(result.body.eventTheme.tokens.primary).toBe('#555555');
    });

    it('falls back to the Brillipoint default kit when neither client nor business kit resolve', async () => {
      // Arrange
      await brandKitFactory.create({
        key: BRILLIPOINT_BRAND_KIT_KEY,
        overrides: { tokens: { primary: '#666666' } },
      });
      const event = await eventFactory.create();

      // Act
      const result = await service.getPublicThemeByEventToken(event.token);

      // Assert
      expect(result.body.eventTheme.tokens.primary).toBe('#666666');
    });

    it('treats a soft-deleted client kit as absent and falls back to the next layer', async () => {
      // Arrange
      const deletedKit = await brandKitFactory.create({
        overrides: { tokens: { primary: '#777777' } },
      });
      await TestDataSource.getRepository(BrandKit).softDelete(deletedKit.id);
      const businessKit = await brandKitFactory.create({
        overrides: { tokens: { primary: '#666666' } },
      });
      const brand = await brandFactory.create({ brandKitId: businessKit.id });
      const contract = await contractFactory.create({ brandId: brand.id });
      const event = await eventFactory.create({
        contractId: contract.id,
        brandKitId: deletedKit.id,
      });

      // Act
      const result = await service.getPublicThemeByEventToken(event.token);

      // Assert
      expect(result.body.eventTheme.tokens.primary).toBe('#666666');
    });

    it('rejects a merged invalid theme instead of publishing it', async () => {
      // Arrange
      const kit = await brandKitFactory.create({
        overrides: { tokens: { primary: '#fefefe' } },
      });
      const event = await eventFactory.create({ brandKitId: kit.id });

      // Act & Assert
      await expect(
        service.getPublicThemeByEventToken(event.token),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
    });

    it('combines the system default version with the max updatedAt among applied layers', async () => {
      // Arrange
      const preset = await eventThemeFactory.create();
      const kit = await brandKitFactory.create();
      const event = await eventFactory.create({
        eventThemeId: preset.id,
        brandKitId: kit.id,
      });

      await setUpdatedAt(
        'event_themes',
        preset.id,
        new Date('2020-01-01T00:00:00.000Z'),
      );
      await setUpdatedAt(
        'brand_kits',
        kit.id,
        new Date('2025-06-01T00:00:00.000Z'),
      );
      await setUpdatedAt(
        'events',
        event.id,
        new Date('2010-01-01T00:00:00.000Z'),
      );

      // Act
      const result = await service.getPublicThemeByEventToken(event.token);

      // Assert
      expect(result.body.eventTheme.version).toBe(
        `${SYSTEM_DEFAULT_THEME_VERSION}:2025-06-01T00:00:00.000Z`,
      );
    });

    it('returns the configured 5-minute cache header with a 30-day stale-while-revalidate window', async () => {
      // Arrange
      const event = await eventFactory.create();

      // Act
      const result = await service.getPublicThemeByEventToken(event.token);

      // Assert
      expect(result.cacheControl).toBe(
        'public, max-age=300, stale-while-revalidate=2592000',
      );
    });

    it('returns a sha256-based ETag of the response body', async () => {
      // Arrange
      const event = await eventFactory.create();

      // Act
      const result = await service.getPublicThemeByEventToken(event.token);

      // Assert
      expect(result.etag).toMatch(/^"event-theme-.+"$/);
    });

    // ─── T6: socialCta whole-block fallback ─────────────────────────────────

    it('uses the event override socialCta block when it is usable, over any kit', async () => {
      // Arrange
      const clientKit = await brandKitFactory.create({
        overrides: {
          socialCta: {
            primaryAction: {
              channel: 'whatsapp',
              phone: '5210000000001',
              label: { text: { es: 'Kit' } },
            },
          },
        },
      });
      const event = await eventFactory.create({
        brandKitId: clientKit.id,
        themeOverrides: {
          socialCta: {
            primaryAction: {
              channel: 'whatsapp',
              phone: '5210000000002',
              label: { text: { es: 'Override' } },
            },
          },
        },
      });

      // Act
      const result = await service.getPublicThemeByEventToken(event.token);

      // Assert
      expect(result.body.eventTheme.socialCta?.primaryAction).toMatchObject({
        phone: '5210000000002',
      });
    });

    it('ignores a legacy null socialCta event override and falls through to the kit', async () => {
      // Arrange
      const clientKit = await brandKitFactory.create({
        overrides: {
          socialCta: {
            primaryAction: {
              channel: 'whatsapp',
              phone: '5210000000003',
              label: { text: { es: 'Kit' } },
            },
          },
        },
      });
      const event = await eventFactory.create({
        brandKitId: clientKit.id,
        themeOverrides: { socialCta: null },
      });

      // Act
      const result = await service.getPublicThemeByEventToken(event.token);

      // Assert
      expect(result.body.eventTheme.socialCta?.primaryAction).toMatchObject({
        phone: '5210000000003',
      });
    });

    it('treats a null socialCta on the client kit as no block and falls through to the business kit', async () => {
      // Arrange
      const clientKit = await brandKitFactory.create({
        overrides: { socialCta: null },
      });
      const businessKit = await brandKitFactory.create({
        overrides: {
          socialCta: {
            primaryAction: {
              channel: 'whatsapp',
              phone: '5210000000004',
              label: { text: { es: 'Business' } },
            },
          },
        },
      });
      const brand = await brandFactory.create({ brandKitId: businessKit.id });
      const contract = await contractFactory.create({ brandId: brand.id });
      const event = await eventFactory.create({
        contractId: contract.id,
        brandKitId: clientKit.id,
      });

      // Act
      const result = await service.getPublicThemeByEventToken(event.token);

      // Assert
      expect(result.body.eventTheme.socialCta?.primaryAction).toMatchObject({
        phone: '5210000000004',
      });
      expect(result.body.eventTheme.socialCta?.brandKitKey).toBe(
        businessKit.key,
      );
    });

    it('skips a client kit socialCta block with no primaryAction and no non-empty social', async () => {
      // Arrange
      const clientKit = await brandKitFactory.create({
        overrides: { socialCta: { socials: { instagram: '' } } },
      });
      const businessKit = await brandKitFactory.create({
        overrides: {
          socialCta: {
            primaryAction: {
              channel: 'whatsapp',
              phone: '5210000000005',
              label: { text: { es: 'Business' } },
            },
          },
        },
      });
      const brand = await brandFactory.create({ brandKitId: businessKit.id });
      const contract = await contractFactory.create({ brandId: brand.id });
      const event = await eventFactory.create({
        contractId: contract.id,
        brandKitId: clientKit.id,
      });

      // Act
      const result = await service.getPublicThemeByEventToken(event.token);

      // Assert
      expect(result.body.eventTheme.socialCta?.primaryAction).toMatchObject({
        phone: '5210000000005',
      });
    });

    it('falls back to the Brillipoint default kit socialCta when neither client nor business kit has a usable block', async () => {
      // Arrange
      await brandKitFactory.create({
        key: BRILLIPOINT_BRAND_KIT_KEY,
        overrides: {
          socialCta: {
            primaryAction: {
              channel: 'whatsapp',
              phone: '5210000000006',
              label: { text: { es: 'Brillipoint' } },
            },
          },
        },
      });
      const event = await eventFactory.create();

      // Act
      const result = await service.getPublicThemeByEventToken(event.token);

      // Assert
      expect(result.body.eventTheme.socialCta?.primaryAction).toMatchObject({
        phone: '5210000000006',
      });
      expect(result.body.eventTheme.socialCta?.brandKitKey).toBe(
        BRILLIPOINT_BRAND_KIT_KEY,
      );
    });

    it('falls back to the hardcoded Brillipoint CTA when no kit, not even the Brillipoint row, is usable', async () => {
      // Arrange — no brand kit rows at all
      const event = await eventFactory.create();

      // Act
      const result = await service.getPublicThemeByEventToken(event.token);

      // Assert
      expect(result.body.eventTheme.socialCta?.brandKitKey).toBe(
        BRILLIPOINT_BRAND_KIT_KEY,
      );
      expect(result.body.eventTheme.socialCta?.primaryAction).toMatchObject({
        channel: 'whatsapp',
        phone: '5212215775211',
      });
    });

    it('removes the primary channel entry from socials in the resolved socialCta', async () => {
      // Arrange
      const clientKit = await brandKitFactory.create({
        overrides: {
          socialCta: {
            primaryAction: {
              channel: 'instagram',
              url: 'https://instagram.com/x',
              label: { text: { es: 'IG' } },
            },
            socials: {
              instagram: 'https://instagram.com/x',
              tiktok: 'https://tiktok.com/x',
            },
          },
        },
      });
      const event = await eventFactory.create({ brandKitId: clientKit.id });

      // Act
      const result = await service.getPublicThemeByEventToken(event.token);

      // Assert
      expect(result.body.eventTheme.socialCta?.socials).toEqual({
        tiktok: 'https://tiktok.com/x',
      });
    });

    // ─── T6: template params ────────────────────────────────────────────────

    it('includes the trimmed honoreesName param from the event', async () => {
      // Arrange
      const event = await eventFactory.create({
        honoreesNames: '  Ana y Luis  ',
      });

      // Act
      const result = await service.getPublicThemeByEventToken(event.token);

      // Assert
      expect(result.body.eventTheme.params?.honoreesName).toBe('Ana y Luis');
    });

    it('omits honoreesName when the event has none', async () => {
      // Arrange
      const event = await eventFactory.create({ honoreesNames: null });

      // Act
      const result = await service.getPublicThemeByEventToken(event.token);

      // Assert
      expect(result.body.eventTheme.params?.honoreesName).toBeUndefined();
    });

    it('includes brandName as the name of the kit that supplied socialCta', async () => {
      // Arrange
      const clientKit = await brandKitFactory.create({
        overrides: {
          socialCta: {
            primaryAction: {
              channel: 'whatsapp',
              phone: '5210000000007',
              label: { text: { es: 'Kit' } },
            },
          },
        },
      });
      const event = await eventFactory.create({ brandKitId: clientKit.id });

      // Act
      const result = await service.getPublicThemeByEventToken(event.token);

      // Assert
      expect(result.body.eventTheme.params?.brandName).toBe(clientKit.name);
    });

    it('omits brandName when the event override itself supplied socialCta', async () => {
      // Arrange
      const event = await eventFactory.create({
        themeOverrides: {
          socialCta: {
            primaryAction: {
              channel: 'whatsapp',
              phone: '5210000000008',
              label: { text: { es: 'Override' } },
            },
          },
        },
      });

      // Act
      const result = await service.getPublicThemeByEventToken(event.token);

      // Assert
      expect(result.body.eventTheme.params?.brandName).toBeUndefined();
    });

    it('replaces a socialCta text with its fallback when the referenced param is missing, and never interpolates', async () => {
      // Arrange
      const clientKit = await brandKitFactory.create({
        overrides: {
          socialCta: {
            headline: {
              text: { es: 'Hola {{honoreesName}}' },
              fallback: { text: { es: 'Hola' } },
            },
            primaryAction: {
              channel: 'whatsapp',
              phone: '5210000000009',
              label: { text: { es: 'Kit' } },
            },
          },
        },
      });
      const event = await eventFactory.create({
        brandKitId: clientKit.id,
        honoreesNames: null,
      });

      // Act
      const result = await service.getPublicThemeByEventToken(event.token);

      // Assert
      expect(result.body.eventTheme.socialCta?.headline).toEqual({
        text: { es: 'Hola' },
      });
    });

    it('keeps the placeholder text untouched (never interpolated) when the referenced param is present', async () => {
      // Arrange
      const clientKit = await brandKitFactory.create({
        overrides: {
          socialCta: {
            headline: {
              text: { es: 'Hola {{honoreesName}}' },
              fallback: { text: { es: 'Hola' } },
            },
            primaryAction: {
              channel: 'whatsapp',
              phone: '5210000000010',
              label: { text: { es: 'Kit' } },
            },
          },
        },
      });
      const event = await eventFactory.create({
        brandKitId: clientKit.id,
        honoreesNames: 'Ana',
      });

      // Act
      const result = await service.getPublicThemeByEventToken(event.token);

      // Assert
      expect(result.body.eventTheme.socialCta?.headline).toEqual({
        text: { es: 'Hola {{honoreesName}}' },
      });
    });

    // ─── T5/T6: cover slot passes through untouched ─────────────────────────

    it('passes the cover image slot through the response untouched', async () => {
      // Arrange
      const cover = {
        path: 'themes/x/cover.png',
        url: 'https://cdn.example.com/themes/x/cover.png',
        link: 'https://brillipoint.com',
      };
      const event = await eventFactory.create({
        themeOverrides: { images: { cover } },
      });

      // Act
      const result = await service.getPublicThemeByEventToken(event.token);

      // Assert
      expect(result.body.eventTheme.images?.cover).toEqual(cover);
    });
  });

  // ─── previewTheme ──────────────────────────────────────────────────────────

  describe('previewTheme', () => {
    it('resolves a preset-only preview against the system default', async () => {
      // Arrange
      const preset = await eventThemeFactory.create({
        tokens: { primary: '#16a34a' },
      });

      // Act
      const result = await service.previewTheme({ eventThemeId: preset.id });

      // Assert
      expect(result.eventTheme.id).toBe(preset.id);
      expect(result.eventTheme.tokens.primary).toBe('#16a34a');
      expect(result.eventTheme.tokens.onPrimary).toBe('#ffffff'); // inherited
    });

    it('layers a preset and an existing brand kit (brandKitId), kit wins', async () => {
      // Arrange
      const preset = await eventThemeFactory.create({
        tokens: { primary: '#16a34a', secondary: '#111111' },
      });
      const kit = await brandKitFactory.create({
        overrides: { tokens: { primary: '#2563eb' } },
      });

      // Act
      const result = await service.previewTheme({
        eventThemeId: preset.id,
        brandKitId: kit.id,
      });

      // Assert
      expect(result.eventTheme.tokens.primary).toBe('#2563eb');
      expect(result.eventTheme.tokens.secondary).toBe('#111111');
    });

    it('resolves an inline unsaved brandKit layer', async () => {
      // Act
      const result = await service.previewTheme({
        brandKit: { tokens: { primary: '#f59e0b' } },
      });

      // Assert
      expect(result.eventTheme.id).toBeNull();
      expect(result.eventTheme.key).toBe('system-default');
      expect(result.eventTheme.tokens.primary).toBe('#f59e0b');
    });

    it('exposes brandKitName as brandName when the inline brandKit supplies socialCta', async () => {
      // Act
      const result = await service.previewTheme({
        brandKit: {
          socialCta: { socials: { instagram: 'https://instagram.com/acme' } },
        },
        brandKitName: 'Acme',
      });

      // Assert
      expect(result.eventTheme.params?.brandName).toBe('Acme');
    });

    it('rejects brandKitName without an inline brandKit with a 400', async () => {
      // Arrange
      const kit = await brandKitFactory.create();

      // Act + Assert
      await expect(
        service.previewTheme({ brandKitId: kit.id, brandKitName: 'Acme' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('layers themeOverrides last, on top of the preset and kit', async () => {
      // Arrange
      const preset = await eventThemeFactory.create({
        tokens: { primary: '#16a34a' },
      });
      const kit = await brandKitFactory.create({
        overrides: { tokens: { primary: '#2563eb' } },
      });

      // Act
      const result = await service.previewTheme({
        eventThemeId: preset.id,
        brandKitId: kit.id,
        themeOverrides: { tokens: { primary: '#dc2626' } },
      });

      // Assert
      expect(result.eventTheme.tokens.primary).toBe('#dc2626');
    });

    it('rejects brandKitId and brandKit sent together with a 400', async () => {
      // Arrange
      const kit = await brandKitFactory.create();

      // Act + Assert
      await expect(
        service.previewTheme({
          brandKitId: kit.id,
          brandKit: { tokens: { primary: '#000000' } },
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws NotFoundException for an unknown eventThemeId', async () => {
      // Act + Assert
      await expect(
        service.previewTheme({ eventThemeId: 999999 }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws NotFoundException for an unknown brandKitId', async () => {
      // Act + Assert
      await expect(
        service.previewTheme({ brandKitId: 999999 }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('returns a resolved-contrast warning when a kit sets only primary against the inherited onPrimary', async () => {
      // Arrange — default onPrimary is #ffffff; #fefefe is near-white, so the
      // pair is illegible even though the per-layer validator never saw both
      // sides set by the SAME layer.
      const kit = await brandKitFactory.create({
        overrides: { tokens: { primary: '#fefefe' } },
      });

      // Act
      const result = await service.previewTheme({ brandKitId: kit.id });

      // Assert
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0]).toContain('primary/onPrimary');
    });

    it('does not warn when the resolved primary/onPrimary contrast is fine', async () => {
      // Arrange
      const kit = await brandKitFactory.create({
        overrides: { tokens: { primary: '#2563eb' } },
      });

      // Act
      const result = await service.previewTheme({ brandKitId: kit.id });

      // Assert
      expect(result.warnings).toEqual([]);
    });

    it('returns full final-theme validation errors as warnings without rejecting preview', async () => {
      // Arrange
      const invalidOverrides = {
        tokens: { undocumentedRole: 'unsafe value' },
      } as unknown as ThemeOverrides;

      // Act
      const result = await service.previewTheme({ brandKit: invalidOverrides });

      // Assert
      expect(result.warnings).toContain(
        'tokens.undocumentedRole: unknown token',
      );
    });

    it('falls back to the Brillipoint kit for socialCta when no kit is given', async () => {
      // Arrange
      const brillipoint = await brandKitFactory.create({
        key: BRILLIPOINT_BRAND_KIT_KEY,
        overrides: {
          socialCta: {
            headline: { text: { es: 'Hola' } },
            primaryAction: {
              channel: 'whatsapp',
              phone: '5210000000099',
              label: { text: { es: 'Brillipoint' } },
            },
          },
        },
      });

      // Act
      const result = await service.previewTheme({});

      // Assert
      expect(result.eventTheme.socialCta?.brandKitKey).toBe(brillipoint.key);
    });

    it('persists nothing: the preset and kit rows are unchanged after preview', async () => {
      // Arrange
      const preset = await eventThemeFactory.create({
        tokens: { primary: '#16a34a' },
      });
      const kit = await brandKitFactory.create({
        overrides: { tokens: { primary: '#2563eb' } },
      });

      // Act
      await service.previewTheme({
        eventThemeId: preset.id,
        brandKitId: kit.id,
        themeOverrides: { tokens: { primary: '#dc2626' } },
      });

      // Assert
      const presetAfter = await TestDataSource.getRepository(
        EventTheme,
      ).findOne({ where: { id: preset.id } });
      const kitAfter = await TestDataSource.getRepository(BrandKit).findOne({
        where: { id: kit.id },
      });
      expect(presetAfter?.tokens).toEqual({ primary: '#16a34a' });
      expect(kitAfter?.overrides).toEqual({ tokens: { primary: '#2563eb' } });
    });
  });

  // ─── isMatchingEtag ────────────────────────────────────────────────────────

  describe('isMatchingEtag', () => {
    it('matches strong and weak If-None-Match values', () => {
      // Arrange — pure function, no DB

      // Act + Assert
      expect(
        service.isMatchingEtag('"abc", "event-theme-123"', '"event-theme-123"'),
      ).toBe(true);
      expect(
        service.isMatchingEtag('W/"event-theme-123"', '"event-theme-123"'),
      ).toBe(true);
      expect(service.isMatchingEtag('"other"', '"event-theme-123"')).toBe(
        false,
      );
    });
  });
});
