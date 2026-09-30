import type { ConfigService } from '@nestjs/config';
import type { Repository } from 'typeorm';

import {
  InternalServerErrorException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';

import { PrepProfileUploadsService } from './prep-profile-uploads.service';
import { assertPrepProfileQuestionId } from './prep-profile.validation';
import { EXCEPTION_RESPONSE } from '../../config/errors/exception-response.config';
import { Contract } from '../entities/contract.entity';
import { StorageService } from '../../common/storage/storage.service';

jest.mock('crypto', () => ({
  randomUUID: jest.fn(() => 'uuid-123'),
}));

jest.mock('./prep-profile.validation', () => ({
  assertPrepProfileQuestionId: jest.fn(),
}));

type ContractLike = {
  id: number;
  clientPhone: string | null;
};

describe('PrepProfileUploadsService', () => {
  let service: PrepProfileUploadsService;

  let configService: Pick<ConfigService, 'get'>;
  let contractsRepository: Pick<Repository<Contract>, 'findOne'>;

  let storageCreateSignedUrl: jest.Mock;
  let storageCreateSignedUploadUrl: jest.Mock;
  let storageFrom: jest.Mock;
  let supabaseClient: {
    storage: {
      from: jest.Mock;
    };
  };

  const bucket = 'prep-profile-bucket';
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

    contractsRepository = {
      findOne: jest.fn(),
    };

    // Storage boundary was extracted to StorageService (T4/theme-authoring
    // refactor): PrepProfileUploadsService now delegates to a real
    // StorageService instance instead of owning the Supabase client itself,
    // so it's constructed here and its private `client` getter is spied on
    // exactly like PrepProfileUploadsService's own getter used to be.
    const storageService = new StorageService(configService as ConfigService);
    jest
      .spyOn(storageService as unknown as { client: unknown }, 'client', 'get')
      .mockReturnValue(supabaseClient);

    service = new PrepProfileUploadsService(
      contractsRepository as Repository<Contract>,
      storageService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getPublicUrl', () => {
    it('builds a public URL using SUPABASE_URL and bucket', () => {
      const url = service.getPublicUrl('contracts/1/file.png');
      expect(url).toBe(
        'https://project.supabase.co/storage/v1/object/public/prep-profile-bucket/contracts/1/file.png',
      );
    });

    it('throws InternalServerErrorException when SUPABASE_URL is missing', () => {
      (configService.get as jest.Mock).mockImplementation((key: string) => {
        if (key === 'SUPABASE_STORAGE_BUCKET') {
          return bucket;
        }
        if (key === 'SUPABASE_SERVICE_ROLE_KEY') {
          return 'service-role-key';
        }
        return undefined;
      });

      expect(() => service.getPublicUrl('some/path.png')).toThrow(
        new InternalServerErrorException(
          EXCEPTION_RESPONSE.SUPABASE_STORAGE_NOT_CONFIGURED,
        ),
      );
    });
  });

  describe('createSignedReadUrl', () => {
    it('creates a signed read URL', async () => {
      storageCreateSignedUrl.mockResolvedValue({
        data: { signedUrl: 'https://signed-read-url' },
        error: null,
      });

      await expect(
        service.createSignedReadUrl({
          path: 'contracts/1/photo.png',
          expiresIn: 60,
        }),
      ).resolves.toBe('https://signed-read-url');

      expect(storageFrom).toHaveBeenCalledWith(bucket);
      expect(storageCreateSignedUrl).toHaveBeenCalledWith(
        'contracts/1/photo.png',
        60,
      );
    });

    it('throws when Supabase returns an error', async () => {
      storageCreateSignedUrl.mockResolvedValue({
        data: null,
        error: { message: 'boom' },
      });

      await expect(
        service.createSignedReadUrl({
          path: 'contracts/1/photo.png',
          expiresIn: 60,
        }),
      ).rejects.toBeInstanceOf(InternalServerErrorException);

      expect(storageFrom).toHaveBeenCalledWith(bucket);
    });

    it('throws when Supabase returns no signedUrl', async () => {
      storageCreateSignedUrl.mockResolvedValue({
        data: {},
        error: null,
      });

      await expect(
        service.createSignedReadUrl({
          path: 'contracts/1/photo.png',
          expiresIn: 60,
        }),
      ).rejects.toBeInstanceOf(InternalServerErrorException);

      expect(storageFrom).toHaveBeenCalledWith(bucket);
    });
  });

  describe('createSignedUploadUrl', () => {
    const token = 'token-123';
    const phone = '+1 (555) 111-2222';
    const questionId = 'face_photos';

    function mockQuestion(
      question: { id: string; type: string } = {
        id: questionId,
        type: 'asset',
      },
    ) {
      (assertPrepProfileQuestionId as unknown as jest.Mock).mockReturnValue(
        question,
      );
    }

    it('validates questionId and rejects questions that do not accept assets', async () => {
      mockQuestion({ id: 'prep_location_maps_url', type: 'string' });

      await expect(
        service.createSignedUploadUrl({
          token,
          phone,
          questionId: 'prep_location_maps_url',
          fileName: 'photo.png',
          mime: 'image/png',
        }),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);

      expect(assertPrepProfileQuestionId).toHaveBeenCalledWith(
        'prep_location_maps_url',
      );
      expect(contractsRepository.findOne).not.toHaveBeenCalled();
      expect(storageFrom).not.toHaveBeenCalled();
    });

    it('looks up contract by token and validates phone (phonesMatch)', async () => {
      mockQuestion();
      (contractsRepository.findOne as jest.Mock).mockResolvedValue(null);

      await expect(
        service.createSignedUploadUrl({
          token,
          phone,
          questionId,
          fileName: 'photo.png',
          mime: 'image/png',
        }),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(contractsRepository.findOne).toHaveBeenCalledWith({
        where: { token },
        select: { id: true, clientPhone: true },
      });
      expect(storageFrom).not.toHaveBeenCalled();
    });

    it('throws NotFound when phone does not match contract phone', async () => {
      mockQuestion();
      const contract: ContractLike = {
        id: 123,
        clientPhone: '+1 (555) 999-8888',
      };
      (contractsRepository.findOne as jest.Mock).mockResolvedValue(contract);

      await expect(
        service.createSignedUploadUrl({
          token,
          phone,
          questionId,
          fileName: 'photo.png',
          mime: 'image/png',
        }),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(storageFrom).not.toHaveBeenCalled();
      expect(storageCreateSignedUploadUrl).not.toHaveBeenCalled();
    });

    it('sanitizes fileName and returns required fields on success', async () => {
      mockQuestion({ id: 'dress', type: 'object' });

      const contract: ContractLike = {
        id: 42,
        clientPhone: '+1 (555) 111-2222',
      };
      (contractsRepository.findOne as jest.Mock).mockResolvedValue(contract);

      storageCreateSignedUploadUrl.mockResolvedValue({
        data: { signedUrl: 'https://signed-upload-url', token: 'upload-token' },
        error: null,
      });

      const dto = await service.createSignedUploadUrl({
        token,
        phone: '5551112222',
        questionId: 'dress',
        fileName: '  ../evil/..\\path  .png ',
        mime: 'image/png',
      });

      expect(assertPrepProfileQuestionId).toHaveBeenCalledWith('dress');
      expect(storageFrom).toHaveBeenCalledWith(bucket);

      const expectedSanitized = '.._evil_.._path_.png';
      const expectedPath = `42/dress/uuid-123_${expectedSanitized}`;

      expect(storageCreateSignedUploadUrl).toHaveBeenCalledWith(expectedPath);

      expect(dto).toEqual(
        expect.objectContaining({
          contractId: 42,
          bucket,
          path: expectedPath,
          signedUrl: 'https://signed-upload-url',
          token: 'upload-token',
          publicUrl:
            'https://project.supabase.co/storage/v1/object/public/prep-profile-bucket/' +
            expectedPath,
        }),
      );
    });

    it('accepts object questions that allow assets (accessories)', async () => {
      mockQuestion({ id: 'accessories', type: 'object' });

      const contract: ContractLike = {
        id: 7,
        clientPhone: '+52 1 55 1234 5678',
      };
      (contractsRepository.findOne as jest.Mock).mockResolvedValue(contract);

      storageCreateSignedUploadUrl.mockResolvedValue({
        data: { signedUrl: 'https://signed-upload-url', token: 'upload-token' },
        error: null,
      });

      const dto = await service.createSignedUploadUrl({
        token,
        phone: '5512345678',
        questionId: 'accessories',
        fileName: 'photo.png',
        mime: 'image/png',
      });

      expect(dto).toEqual(
        expect.objectContaining({
          contractId: 7,
          bucket,
          signedUrl: 'https://signed-upload-url',
          token: 'upload-token',
          publicUrl: expect.stringContaining(
            '/storage/v1/object/public/prep-profile-bucket/',
          ),
        }),
      );
    });

    it('throws when Supabase createSignedUploadUrl returns an error', async () => {
      mockQuestion();

      const contract: ContractLike = {
        id: 1,
        clientPhone: '+1 (555) 111-2222',
      };
      (contractsRepository.findOne as jest.Mock).mockResolvedValue(contract);

      storageCreateSignedUploadUrl.mockResolvedValue({
        data: null,
        error: { message: 'boom' },
      });

      await expect(
        service.createSignedUploadUrl({
          token,
          phone,
          questionId,
          fileName: 'photo.png',
          mime: 'image/png',
        }),
      ).rejects.toBeInstanceOf(InternalServerErrorException);

      expect(storageFrom).toHaveBeenCalledWith(bucket);
    });

    it('throws when Supabase createSignedUploadUrl returns missing signedUrl/token', async () => {
      mockQuestion();

      const contract: ContractLike = {
        id: 1,
        clientPhone: '+1 (555) 111-2222',
      };
      (contractsRepository.findOne as jest.Mock).mockResolvedValue(contract);

      storageCreateSignedUploadUrl.mockResolvedValue({
        data: { signedUrl: 'https://signed-upload-url' },
        error: null,
      });

      await expect(
        service.createSignedUploadUrl({
          token,
          phone,
          questionId,
          fileName: 'photo.png',
          mime: 'image/png',
        }),
      ).rejects.toBeInstanceOf(InternalServerErrorException);

      expect(storageFrom).toHaveBeenCalledWith(bucket);
    });
  });
});
