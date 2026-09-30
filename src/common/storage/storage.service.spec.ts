import type { ConfigService } from '@nestjs/config';

import { InternalServerErrorException } from '@nestjs/common';

import { StorageService } from './storage.service';
import { EXCEPTION_RESPONSE } from '../../config/errors/exception-response.config';

describe('StorageService', () => {
  let service: StorageService;

  let configService: Pick<ConfigService, 'get'>;

  let storageCreateSignedUrl: jest.Mock;
  let storageCreateSignedUploadUrl: jest.Mock;
  let storageFrom: jest.Mock;
  let supabaseClient: {
    storage: {
      from: jest.Mock;
    };
  };

  const bucket = 'theme-assets-bucket';
  const baseUrl = 'https://project.supabase.co/';

  beforeEach(() => {
    storageCreateSignedUrl = jest.fn();
    storageCreateSignedUploadUrl = jest.fn();
    storageFrom = jest.fn(() => ({
      createSignedUrl: storageCreateSignedUrl,
      createSignedUploadUrl: storageCreateSignedUploadUrl,
    }));
    supabaseClient = {
      storage: {
        from: storageFrom,
      },
    };

    configService = {
      get: jest.fn((key: string) => {
        if (key === 'SUPABASE_URL') {
          return baseUrl;
        }
        if (key === 'SUPABASE_STORAGE_BUCKET') {
          return bucket;
        }
        if (key === 'SUPABASE_SERVICE_ROLE_KEY') {
          return 'service-role-key';
        }
        return undefined;
      }),
    };

    service = new StorageService(configService as ConfigService);

    jest
      .spyOn(service as unknown as { client: unknown }, 'client', 'get')
      .mockReturnValue(supabaseClient);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─── bucket ────────────────────────────────────────────────────────────

  describe('bucket', () => {
    it('returns SUPABASE_STORAGE_BUCKET when set', () => {
      // Arrange — configService returns bucket

      // Act
      const result = service.bucket;

      // Assert
      expect(result).toBe(bucket);
    });

    it('falls back to "public" when SUPABASE_STORAGE_BUCKET is unset', () => {
      // Arrange
      (configService.get as jest.Mock).mockImplementation((key: string) => {
        if (key === 'SUPABASE_URL') {
          return baseUrl;
        }
        return undefined;
      });

      // Act
      const result = service.bucket;

      // Assert
      expect(result).toBe('public');
    });
  });

  // ─── getPublicUrl ──────────────────────────────────────────────────────

  describe('getPublicUrl', () => {
    it('builds a public URL using SUPABASE_URL and bucket', () => {
      // Arrange — configService set in beforeEach

      // Act
      const url = service.getPublicUrl('themes/presets/1/logo/file.png');

      // Assert
      expect(url).toBe(
        'https://project.supabase.co/storage/v1/object/public/theme-assets-bucket/themes/presets/1/logo/file.png',
      );
    });

    it('throws InternalServerErrorException when SUPABASE_URL is missing', () => {
      // Arrange
      (configService.get as jest.Mock).mockImplementation((key: string) => {
        if (key === 'SUPABASE_STORAGE_BUCKET') {
          return bucket;
        }
        return undefined;
      });

      // Act + Assert
      expect(() => service.getPublicUrl('some/path.png')).toThrow(
        new InternalServerErrorException(
          EXCEPTION_RESPONSE.SUPABASE_STORAGE_NOT_CONFIGURED,
        ),
      );
    });
  });

  // ─── createSignedReadUrl ───────────────────────────────────────────────

  describe('createSignedReadUrl', () => {
    it('creates a signed read URL', async () => {
      // Arrange
      storageCreateSignedUrl.mockResolvedValue({
        data: { signedUrl: 'https://signed-read-url' },
        error: null,
      });

      // Act
      const result = await service.createSignedReadUrl({
        path: 'themes/presets/1/logo/file.png',
        expiresIn: 60,
      });

      // Assert
      expect(result).toBe('https://signed-read-url');
      expect(storageFrom).toHaveBeenCalledWith(bucket);
      expect(storageCreateSignedUrl).toHaveBeenCalledWith(
        'themes/presets/1/logo/file.png',
        60,
      );
    });

    it('throws when Supabase returns an error', async () => {
      // Arrange
      storageCreateSignedUrl.mockResolvedValue({
        data: null,
        error: { message: 'boom' },
      });

      // Act + Assert
      await expect(
        service.createSignedReadUrl({ path: 'a.png', expiresIn: 60 }),
      ).rejects.toBeInstanceOf(InternalServerErrorException);
    });

    it('throws when Supabase returns no signedUrl', async () => {
      // Arrange
      storageCreateSignedUrl.mockResolvedValue({ data: {}, error: null });

      // Act + Assert
      await expect(
        service.createSignedReadUrl({ path: 'a.png', expiresIn: 60 }),
      ).rejects.toBeInstanceOf(InternalServerErrorException);
    });
  });

  // ─── createSignedUploadUrl ─────────────────────────────────────────────

  describe('createSignedUploadUrl', () => {
    it('creates a signed upload URL for the given path', async () => {
      // Arrange
      storageCreateSignedUploadUrl.mockResolvedValue({
        data: { signedUrl: 'https://signed-upload-url', token: 'upload-token' },
        error: null,
      });

      // Act
      const result = await service.createSignedUploadUrl(
        'themes/presets/1/logo/uuid_file.png',
      );

      // Assert
      expect(result).toEqual({
        signedUrl: 'https://signed-upload-url',
        token: 'upload-token',
      });
      expect(storageFrom).toHaveBeenCalledWith(bucket);
      expect(storageCreateSignedUploadUrl).toHaveBeenCalledWith(
        'themes/presets/1/logo/uuid_file.png',
      );
    });

    it('throws when Supabase returns an error', async () => {
      // Arrange
      storageCreateSignedUploadUrl.mockResolvedValue({
        data: null,
        error: { message: 'boom' },
      });

      // Act + Assert
      await expect(
        service.createSignedUploadUrl('a.png'),
      ).rejects.toBeInstanceOf(InternalServerErrorException);
    });

    it('throws when Supabase returns missing signedUrl/token', async () => {
      // Arrange
      storageCreateSignedUploadUrl.mockResolvedValue({
        data: { signedUrl: 'https://signed-upload-url' },
        error: null,
      });

      // Act + Assert
      await expect(
        service.createSignedUploadUrl('a.png'),
      ).rejects.toBeInstanceOf(InternalServerErrorException);
    });
  });

  // ─── sanitizeFileName ──────────────────────────────────────────────────

  describe('sanitizeFileName', () => {
    it('trims, strips path separators and replaces unsafe characters', () => {
      // Arrange
      const input = '  ../evil/..\\path  .png ';

      // Act
      const result = service.sanitizeFileName(input);

      // Assert
      expect(result).toBe('.._evil_.._path_.png');
    });

    it('truncates names longer than 120 characters, keeping the tail', () => {
      // Arrange
      const input = `${'a'.repeat(130)}.png`;

      // Act
      const result = service.sanitizeFileName(input);

      // Assert
      expect(result).toHaveLength(120);
      expect(result.endsWith('.png')).toBe(true);
    });
  });
});
