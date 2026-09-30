import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { plainToInstance } from 'class-transformer';
import { randomUUID } from 'crypto';
import { Repository } from 'typeorm';

import { Contract } from '../entities/contract.entity';
import { PrepProfileUploadUrlDto } from './dto/prep-profile-upload-url.dto';
import { assertPrepProfileQuestionId } from './prep-profile.validation';
import { StorageService } from '../../common/storage/storage.service';

function normalizePhone(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (digits.length <= 10) {
    return digits;
  }
  return digits.slice(-10);
}

function phonesMatch(a: string | null, b: string): boolean {
  if (!a) {
    return false;
  }
  const left = normalizePhone(a);
  const right = normalizePhone(b);
  return left.length > 0 && left === right;
}

@Injectable()
export class PrepProfileUploadsService {
  constructor(
    @InjectRepository(Contract)
    private readonly contractsRepository: Repository<Contract>,
    private readonly storageService: StorageService,
  ) {}

  getPublicUrl(path: string): string {
    return this.storageService.getPublicUrl(path);
  }

  async createSignedReadUrl(input: {
    path: string;
    expiresIn: number;
  }): Promise<string> {
    return this.storageService.createSignedReadUrl(input);
  }

  async createSignedUploadUrl(input: {
    token: string;
    phone: string;
    questionId: string;
    fileName: string;
    mime: string;
  }): Promise<PrepProfileUploadUrlDto> {
    const question = assertPrepProfileQuestionId(input.questionId);
    const objectQuestionsThatAcceptAssets = new Set<string>([
      'dress',
      'accessories',
    ]);
    const acceptsAssets =
      question.type === 'asset' ||
      question.type === 'asset_array' ||
      (question.type === 'object' &&
        objectQuestionsThatAcceptAssets.has(question.id));

    if (!acceptsAssets) {
      throw new UnprocessableEntityException(
        `Question ${input.questionId} does not accept assets`,
      );
    }

    const contract = await this.contractsRepository.findOne({
      where: { token: input.token },
      select: { id: true, clientPhone: true },
    });
    if (!contract || !phonesMatch(contract.clientPhone ?? null, input.phone)) {
      throw new NotFoundException('Contract not found');
    }

    const name = this.storageService.sanitizeFileName(input.fileName);
    const path = `${contract.id}/${input.questionId}/${randomUUID()}_${name}`;

    const { signedUrl, token } =
      await this.storageService.createSignedUploadUrl(path);

    return plainToInstance(
      PrepProfileUploadUrlDto,
      {
        contractId: contract.id,
        bucket: this.storageService.bucket,
        path,
        signedUrl,
        token,
        publicUrl: this.getPublicUrl(path),
      },
      { excludeExtraneousValues: true },
    );
  }
}
