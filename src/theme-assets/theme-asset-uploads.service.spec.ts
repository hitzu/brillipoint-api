import type { ConfigService } from '@nestjs/config';

import {
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { AppDataSource as TestDataSource } from '../config/database/data-source';
import { Event } from '../events/entities/event.entity';
import { EventTheme } from '../events/entities/event-themes.entity';
import { EventFactory } from '../../test/factories/events/event.factory';
import { EventThemeFactory } from '../../test/factories/events/event-theme.factory';
import { StorageService } from '../common/storage/storage.service';
import {
  ThemeAssetOwnerType,
  ThemeAssetSlot,
} from './dto/theme-asset-owner-type';
import { ThemeAssetUploadsService } from './theme-asset-uploads.service';

jest.mock('crypto', () => ({
  randomUUID: jest.fn(() => 'uuid-123'),
}));

describe('ThemeAssetUploadsService', () => {
  let service: ThemeAssetUploadsService;
  let eventFactory: EventFactory;
  let eventThemeFactory: EventThemeFactory;

  let storageCreateSignedUploadUrl: jest.Mock;
  let storageFrom: jest.Mock;
  let supabaseClient: { storage: { from: jest.Mock } };

  const bucket = 'theme-assets-bucket';
  const baseUrl = 'https://project.supabase.co/';

  beforeEach(async () => {
    storageCreateSignedUploadUrl = jest.fn().mockResolvedValue({
      data: { signedUrl: 'https://signed-upload-url', token: 'upload-token' },
      error: null,
    });
    storageFrom = jest.fn(() => ({
      createSignedUploadUrl: storageCreateSignedUploadUrl,
    }));
    supabaseClient = { storage: { from: storageFrom } };

    const configService: Pick<ConfigService, 'get'> = {
      get: jest.fn((key: string) => {
        if (key === 'SUPABASE_URL') return baseUrl;
        if (key === 'SUPABASE_STORAGE_BUCKET') return bucket;
        if (key === 'SUPABASE_SERVICE_ROLE_KEY') return 'service-role-key';
        return undefined;
      }),
    };

    // Mock ONLY the Supabase boundary — same technique as the prep-profile
    // spec: a real StorageService with its private `client` getter spied on.
    const storageService = new StorageService(configService as ConfigService);
    jest
      .spyOn(storageService as unknown as { client: unknown }, 'client', 'get')
      .mockReturnValue(supabaseClient);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ThemeAssetUploadsService,
        {
          provide: getRepositoryToken(EventTheme),
          useValue: TestDataSource.getRepository(EventTheme),
        },
        {
          provide: getRepositoryToken(Event),
          useValue: TestDataSource.getRepository(Event),
        },
        { provide: StorageService, useValue: storageService },
      ],
    }).compile();

    service = module.get<ThemeAssetUploadsService>(ThemeAssetUploadsService);
    eventFactory = new EventFactory(TestDataSource);
    eventThemeFactory = new EventThemeFactory(TestDataSource);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─── createSignedUploadUrl — path per ownerType ───────────────────────

  describe('createSignedUploadUrl', () => {
    it('builds the path under themes/presets for a preset owner', async () => {
      // Arrange
      const preset = await eventThemeFactory.create();

      // Act
      const result = await service.createSignedUploadUrl({
        ownerType: ThemeAssetOwnerType.PRESET,
        ownerId: preset.id,
        slot: ThemeAssetSlot.LOGO,
        fileName: 'logo.png',
        mime: 'image/png',
      });

      // Assert
      expect(result.path).toBe(
        `themes/presets/${preset.id}/logo/uuid-123_logo.png`,
      );
    });

    it('builds the path under themes/events for an event owner', async () => {
      // Arrange
      const event = await eventFactory.create();

      // Act
      const result = await service.createSignedUploadUrl({
        ownerType: ThemeAssetOwnerType.EVENT,
        ownerId: event.id,
        slot: ThemeAssetSlot.COVER,
        fileName: 'cover.webp',
        mime: 'image/webp',
      });

      // Assert
      expect(result.path).toBe(
        `themes/events/${event.id}/cover/uuid-123_cover.webp`,
      );
    });

    it('returns bucket, signedUrl, token and publicUrl on success', async () => {
      // Arrange
      const preset = await eventThemeFactory.create();

      // Act
      const result = await service.createSignedUploadUrl({
        ownerType: ThemeAssetOwnerType.PRESET,
        ownerId: preset.id,
        slot: ThemeAssetSlot.LOGO,
        fileName: 'logo.png',
        mime: 'image/png',
      });

      // Assert
      expect(result).toEqual({
        bucket,
        path: `themes/presets/${preset.id}/logo/uuid-123_logo.png`,
        signedUrl: 'https://signed-upload-url',
        token: 'upload-token',
        publicUrl: `${baseUrl.replace(/\/$/, '')}/storage/v1/object/public/${bucket}/themes/presets/${preset.id}/logo/uuid-123_logo.png`,
      });
    });

    it('sanitizes the file name before building the path', async () => {
      // Arrange
      const preset = await eventThemeFactory.create();

      // Act
      const result = await service.createSignedUploadUrl({
        ownerType: ThemeAssetOwnerType.PRESET,
        ownerId: preset.id,
        slot: ThemeAssetSlot.LOGO,
        fileName: '  ../evil/..\\path  .png ',
        mime: 'image/png',
      });

      // Assert
      expect(result.path).toBe(
        `themes/presets/${preset.id}/logo/uuid-123_.._evil_.._path_.png`,
      );
    });

    // ─── owner existence ─────────────────────────────────────────────────

    it('throws NotFoundException when the preset does not exist', async () => {
      // Arrange — no preset created

      // Act + Assert
      await expect(
        service.createSignedUploadUrl({
          ownerType: ThemeAssetOwnerType.PRESET,
          ownerId: 999999,
          slot: ThemeAssetSlot.LOGO,
          fileName: 'logo.png',
          mime: 'image/png',
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws NotFoundException when the event does not exist', async () => {
      // Arrange — no event created

      // Act + Assert
      await expect(
        service.createSignedUploadUrl({
          ownerType: ThemeAssetOwnerType.EVENT,
          ownerId: 999999,
          slot: ThemeAssetSlot.LOGO,
          fileName: 'logo.png',
          mime: 'image/png',
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    // ─── mime whitelist ────────────────────────────────────────────────

    it('throws UnprocessableEntityException for a gif on any slot', async () => {
      // Arrange
      const preset = await eventThemeFactory.create();

      // Act + Assert
      await expect(
        service.createSignedUploadUrl({
          ownerType: ThemeAssetOwnerType.PRESET,
          ownerId: preset.id,
          slot: ThemeAssetSlot.LOGO,
          fileName: 'logo.gif',
          mime: 'image/gif',
        }),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
    });

    it('throws UnprocessableEntityException for svg on the cover slot', async () => {
      // Arrange
      const preset = await eventThemeFactory.create();

      // Act + Assert
      await expect(
        service.createSignedUploadUrl({
          ownerType: ThemeAssetOwnerType.PRESET,
          ownerId: preset.id,
          slot: ThemeAssetSlot.COVER,
          fileName: 'cover.svg',
          mime: 'image/svg+xml',
        }),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
    });

    it('accepts svg on the logo slot', async () => {
      // Arrange
      const preset = await eventThemeFactory.create();

      // Act
      const result = await service.createSignedUploadUrl({
        ownerType: ThemeAssetOwnerType.PRESET,
        ownerId: preset.id,
        slot: ThemeAssetSlot.LOGO,
        fileName: 'logo.svg',
        mime: 'image/svg+xml',
      });

      // Assert
      expect(result.path).toBe(
        `themes/presets/${preset.id}/logo/uuid-123_logo.svg`,
      );
    });
  });
});
