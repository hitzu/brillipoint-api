import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { plainToInstance } from 'class-transformer';
import { Repository } from 'typeorm';

import { Contract } from '../entities/contract.entity';
import { ContractPreparationProfile } from '../entities/contract-preparation-profile.entity';
import type { PrepProfileAssetsMode } from './dto/prep-profile-public.query.dto';
import { PrepProfileDto } from './dto/prep-profile.dto';
import { mapPrepProfileAnswersAssetsToUrls } from './prep-profile-assets.mapper';
import {
  PREP_PROFILE_QUESTIONS,
  PREP_PROFILE_QUESTION_IDS_OPTIONAL_FOR_COMPLETION,
  stripSocialPrefix,
} from './prep-profile.questions';
import { assertPrepProfileQuestionId, validatePrepProfileAnswer } from './prep-profile.validation';
import { PrepProfileUploadsService } from './prep-profile-uploads.service';
import {
  TATTOO_DESIGNS_MAX,
  TATTOO_DESIGNS_QUESTION_ID,
  hasGlitterBarPackage,
  isTattooDesignsClosed,
  resolveEventDate,
} from './tattoo-designs.policy';

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value != null && !Array.isArray(value);
}

type AssetLike = { path: string; mime: string; url?: string; assetId?: number };

function isAssetLike(value: unknown): value is AssetLike {
  if (!isPlainObject(value)) {
    return false;
  }
  return (
    typeof value.path === 'string' &&
    value.path.trim().length > 0 &&
    typeof value.mime === 'string' &&
    value.mime.trim().length > 0
  );
}

const SLOT_BASED_ASSET_ARRAY_LIMITS: Readonly<Record<string, number>> = {
  face_photos: 2,
  hair_photos: 2,
  makeup_references: 2,
  hair_references: 2,
  gift_makeup_references: 2,
  gift_hair_photo: 2,
  gift_hair_references: 2,
};

const SLOT_BASED_ASSET_SINGLE_LIMITS: Readonly<Record<string, number>> = {
  gift_face_photo: 1,
};

function getAssetSlotLimit(input: { questionId: string; questionType: string }): number | null {
  const base = stripSocialPrefix(input.questionId);
  const limit =
    input.questionType === 'asset_array'
      ? SLOT_BASED_ASSET_ARRAY_LIMITS[base]
      : input.questionType === 'asset'
        ? SLOT_BASED_ASSET_SINGLE_LIMITS[base]
        : undefined;
  return typeof limit === 'number' && Number.isFinite(limit) ? limit : null;
}

function appendAssetsUpToLimit(input: {
  questionId: string;
  current: unknown;
  incoming: unknown;
  limit: number;
}): AssetLike[] {
  const currentAssets = Array.isArray(input.current)
    ? input.current.filter((v) => isAssetLike(v))
    : [];
  const incomingAssets = Array.isArray(input.incoming)
    ? input.incoming.filter((v) => isAssetLike(v))
    : [];

  if (incomingAssets.length === 0) {
    // Validation already ensures non-empty for asset_array; this is just defensive.
    return currentAssets;
  }

  const merged: AssetLike[] = [...currentAssets];
  const seen = new Set(merged.map((a) => a.path));

  for (const asset of incomingAssets) {
    if (seen.has(asset.path)) {
      continue;
    }
    if (merged.length >= input.limit) {
      throw new ConflictException(`Question is locked: ${input.questionId}`);
    }
    merged.push(asset);
    seen.add(asset.path);
  }

  return merged;
}

function isSlotsCompleteArray(input: { value: unknown; limit: number }): boolean {
  if (input.limit <= 0) {
    return true;
  }
  if (!Array.isArray(input.value)) {
    return false;
  }
  const assets = input.value.filter((v) => isAssetLike(v));
  return assets.length >= input.limit;
}

function isSlotsCompleteAsset(input: { value: unknown; limit: number }): boolean {
  if (input.limit <= 0) {
    return true;
  }
  return isAssetLike(input.value);
}

function mergeAccessoriesValue(
  current: unknown,
  incoming: unknown,
): unknown {
  // If we don't have objects, fallback to overwrite.
  if (!isPlainObject(current) || !isPlainObject(incoming)) {
    return incoming;
  }

  const next: Record<string, unknown> = { ...current };

  for (const [key, incomingValue] of Object.entries(incoming)) {
    const currentValue = next[key];

    // Append asset arrays (de-dup by path).
    if (Array.isArray(currentValue) && Array.isArray(incomingValue)) {
      const currentAssets = currentValue.filter((v) => isAssetLike(v)) as Array<{
        path: string;
        mime: string;
      }>;
      const incomingAssets = incomingValue.filter((v) => isAssetLike(v)) as Array<{
        path: string;
        mime: string;
      }>;

      // Only do special append if both sides look like asset arrays.
      if (
        currentAssets.length === currentValue.length &&
        incomingAssets.length === incomingValue.length
      ) {
        const seen = new Set(currentAssets.map((a) => a.path));
        const appended = [
          ...currentAssets,
          ...incomingAssets.filter((a) => !seen.has(a.path)),
        ];
        next[key] = appended;
        continue;
      }
    }

    // Recurse nested objects.
    if (isPlainObject(currentValue) && isPlainObject(incomingValue)) {
      next[key] = mergeAccessoriesValue(currentValue, incomingValue);
      continue;
    }

    // Default: overwrite.
    next[key] = incomingValue;
  }

  return next;
}

function normalizePhone(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (digits.length <= 10) {
    return digits;
  }
  // Common case: include country code. Compare by last 10 digits.
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
export class ContractsPreparationProfileService {
  constructor(
    @InjectRepository(Contract)
    private readonly contractsRepository: Repository<Contract>,
    @InjectRepository(ContractPreparationProfile)
    private readonly profilesRepository: Repository<ContractPreparationProfile>,
    private readonly prepProfileUploadsService: PrepProfileUploadsService,
  ) { }

  private async getContractIdByTokenAndPhone(
    token: string,
    phone: string,
  ): Promise<number> {
    const contract = await this.contractsRepository.findOne({
      where: { token },
      select: { id: true, clientPhone: true },
    });
    if (!contract || !phonesMatch(contract.clientPhone ?? null, phone)) {
      throw new NotFoundException('Contract not found');
    }
    return contract.id;
  }

  private isComplete(answers: Record<string, unknown>): boolean {
    return PREP_PROFILE_QUESTIONS.every((q) => {
      if (PREP_PROFILE_QUESTION_IDS_OPTIONAL_FOR_COMPLETION.has(q.id)) {
        return true;
      }

      // Business rule: when client accepts coming to the salon, location URL is optional.
      if (q.id === 'prep_location_maps_url') {
        if (answers.prep_at_salon === 'sucursal') {
          return true;
        }
      }

      if (!Object.prototype.hasOwnProperty.call(answers, q.id)) {
        return false;
      }
      const limit = getAssetSlotLimit({ questionId: q.id, questionType: q.type });
      if (limit == null) {
        return true;
      }
      // Slot-based fields only count as complete once all required slots are filled.
      if (q.type === 'asset') {
        return isSlotsCompleteAsset({ value: answers[q.id], limit });
      }
      return isSlotsCompleteArray({ value: answers[q.id], limit });
    });
  }

  private async toDto(
    contractId: number,
    profile?: ContractPreparationProfile | null,
    options?: { assets?: PrepProfileAssetsMode; expiresIn?: number },
  ): Promise<PrepProfileDto> {
    const assetsMode = options?.assets ?? 'public';
    const expiresIn = options?.expiresIn ?? 900;

    const answers = profile?.answers ?? {};
    const mappedAnswers =
      assetsMode === 'none'
        ? answers
        : await mapPrepProfileAnswersAssetsToUrls({
          answers,
          mode: assetsMode,
          getPublicUrl: (path) => this.prepProfileUploadsService.getPublicUrl(path),
          getSignedUrl: (path) =>
            this.prepProfileUploadsService.createSignedReadUrl({
              path,
              expiresIn,
            }),
        });

    const locked: Record<string, boolean> = { ...(profile?.locked ?? {}) };
    const tattoo = await this.getTattooContext(contractId);
    if (tattoo.isGlitterBar && tattoo.closed) {
      locked[TATTOO_DESIGNS_QUESTION_ID] = true;
    }

    return plainToInstance(
      PrepProfileDto,
      {
        contractId,
        answers: mappedAnswers,
        locked,
      },
      { excludeExtraneousValues: true },
    );
  }

  async getByToken(input: {
    token: string;
    phone: string;
    assets?: PrepProfileAssetsMode;
    expiresIn?: number;
  }): Promise<PrepProfileDto> {
    const contractId = await this.getContractIdByTokenAndPhone(
      input.token,
      input.phone,
    );
    const profile = await this.profilesRepository.findOne({
      where: { contractId },
    });
    return await this.toDto(contractId, profile, {
      assets: input.assets,
      expiresIn: input.expiresIn,
    });
  }

  async saveAnswerByPhone(input: {
    token: string;
    phone: string;
    questionId: string;
    value: unknown;
    assets?: PrepProfileAssetsMode;
    expiresIn?: number;
  }): Promise<PrepProfileDto> {
    const contractId = await this.getContractIdByTokenAndPhone(
      input.token,
      input.phone,
    );

    validatePrepProfileAnswer({
      questionId: input.questionId,
      value: input.value,
    });

    return await this.saveAnswersBulkByContractId(
      contractId,
      [{ questionId: input.questionId, value: input.value }],
      { assets: input.assets, expiresIn: input.expiresIn },
    );
  }

  async saveAnswersBulkByToken(input: {
    token: string;
    phone: string;
    answers: Array<{ questionId: string; value: unknown }>;
    assets?: PrepProfileAssetsMode;
    expiresIn?: number;
  }): Promise<PrepProfileDto> {
    const contractId = await this.getContractIdByTokenAndPhone(
      input.token,
      input.phone,
    );
    return await this.saveAnswersBulkByContractId(contractId, input.answers, {
      assets: input.assets,
      expiresIn: input.expiresIn,
    });
  }

  private async saveAnswersBulkByContractId(
    contractId: number,
    answers: Array<{ questionId: string; value: unknown }>,
    options?: { assets?: PrepProfileAssetsMode; expiresIn?: number },
  ): Promise<PrepProfileDto> {
    // Validate and de-dup by questionId (last value wins).
    const valueByQuestionId = new Map<string, unknown>();
    for (const item of answers) {
      if (item.questionId === TATTOO_DESIGNS_QUESTION_ID) {
        throw new UnprocessableEntityException(
          `Question ${TATTOO_DESIGNS_QUESTION_ID} is managed by the tattoo designs endpoint`,
        );
      }
      validatePrepProfileAnswer({
        questionId: item.questionId,
        value: item.value,
      });
      valueByQuestionId.set(item.questionId, item.value);
    }

    let profile = await this.profilesRepository.findOne({
      where: { contractId },
    });
    if (!profile) {
      profile = this.profilesRepository.create({
        contractId,
        answers: {},
        locked: {},
      });
    }

    for (const questionId of valueByQuestionId.keys()) {
      const lockedValue = profile.locked?.[questionId];
      if (lockedValue !== true) {
        continue;
      }

      // Accessories must remain editable to allow incremental photo uploads.
      if (questionId === 'accessories') {
        continue;
      }

      const question = assertPrepProfileQuestionId(questionId);
      const limit = getAssetSlotLimit({ questionId, questionType: question.type });
      if (limit == null) {
        throw new ConflictException(`Question is locked: ${questionId}`);
      }

      // If a slot-based asset field is locked but still incomplete (legacy state),
      // allow patches until it reaches the slot limit.
      const currentValue = (profile.answers ?? {})[questionId];
      if (question.type === 'asset') {
        if (isSlotsCompleteAsset({ value: currentValue, limit })) {
          throw new ConflictException(`Question is locked: ${questionId}`);
        }
        // If still incomplete, allow a new asset to be set.
        continue;
      }
      if (isSlotsCompleteArray({ value: currentValue, limit })) {
        throw new ConflictException(`Question is locked: ${questionId}`);
      }
    }

    const currentAnswers = profile.answers ?? {};
    const currentLocked = profile.locked ?? {};

    const nextAnswers: Record<string, unknown> = { ...currentAnswers };
    const nextLocked: Record<string, boolean> = { ...currentLocked };

    for (const [questionId, value] of valueByQuestionId.entries()) {
      if (questionId === 'accessories') {
        nextAnswers[questionId] = mergeAccessoriesValue(
          nextAnswers[questionId],
          value,
        );
        // Keep accessories editable, but preserve legacy behavior of recording it in locked.
        nextLocked[questionId] = true;
        continue;
      }

      const question = assertPrepProfileQuestionId(questionId);
      const limit = getAssetSlotLimit({ questionId, questionType: question.type });
      if (limit != null) {
        if (question.type === 'asset') {
          nextAnswers[questionId] = value;
          if (isSlotsCompleteAsset({ value, limit })) {
            nextLocked[questionId] = true;
          } else {
            delete nextLocked[questionId];
          }
          continue;
        }

        const merged = appendAssetsUpToLimit({
          questionId,
          current: nextAnswers[questionId],
          incoming: value,
          limit,
        });
        nextAnswers[questionId] = merged;

        if (isSlotsCompleteArray({ value: merged, limit })) {
          nextLocked[questionId] = true;
        } else {
          delete nextLocked[questionId];
        }
        continue;
      }

      // Default: overwrite and lock.
      {
        nextAnswers[questionId] = value;
        nextLocked[questionId] = true;
      }
    }

    profile.answers = nextAnswers;
    profile.locked = nextLocked;

    if (this.isComplete(profile.answers)) {
      const lockedAll: Record<string, boolean> = { ...(profile.locked ?? {}) };
      for (const q of PREP_PROFILE_QUESTIONS) {
        if (q.id === TATTOO_DESIGNS_QUESTION_ID) {
          continue;
        }
        lockedAll[q.id] = true;
      }
      profile.locked = lockedAll;
    }

    const saved = await this.profilesRepository.save(profile);
    return await this.toDto(contractId, saved, options);
  }

  private async getTattooContext(
    contractId: number,
  ): Promise<{ isGlitterBar: boolean; closed: boolean }> {
    const contract = await this.contractsRepository.findOne({
      where: { id: contractId },
      relations: { bookings: true, items: { package: true } },
    });
    const eventDate = resolveEventDate(contract?.bookings);
    return {
      isGlitterBar: hasGlitterBarPackage(contract?.items),
      closed:
        eventDate != null && isTattooDesignsClosed(eventDate, new Date()),
    };
  }

  /**
   * Replaces the whole list of tattoo designs (add, replace and delete are all
   * "set the new list"). Open only for Glitter bar contracts, until 7 days
   * before the event.
   */
  async setTattooDesigns(input: {
    token: string;
    phone: string;
    assets: Array<{ path: string; mime: string }>;
    assetsMode?: PrepProfileAssetsMode;
    expiresIn?: number;
  }): Promise<PrepProfileDto> {
    const contractId = await this.getContractIdByTokenAndPhone(
      input.token,
      input.phone,
    );

    const tattoo = await this.getTattooContext(contractId);
    if (!tattoo.isGlitterBar) {
      throw new UnprocessableEntityException(
        'Contract has no Glitter bar package',
      );
    }
    if (tattoo.closed) {
      throw new ConflictException(
        `Question is locked: ${TATTOO_DESIGNS_QUESTION_ID}`,
      );
    }
    if (input.assets.length > TATTOO_DESIGNS_MAX) {
      throw new UnprocessableEntityException(
        `At most ${TATTOO_DESIGNS_MAX} tattoo designs are allowed`,
      );
    }
    const folder = `${contractId}/${TATTOO_DESIGNS_QUESTION_ID}/`;
    for (const asset of input.assets) {
      if (!isAssetLike(asset) || !asset.path.startsWith(folder)) {
        throw new UnprocessableEntityException(
          'Invalid tattoo design asset path',
        );
      }
      if (!asset.mime.startsWith('image/')) {
        throw new UnprocessableEntityException(
          'Tattoo designs must be images',
        );
      }
    }

    let profile = await this.profilesRepository.findOne({
      where: { contractId },
    });
    if (!profile) {
      profile = this.profilesRepository.create({
        contractId,
        answers: {},
        locked: {},
      });
    }
    profile.answers = {
      ...(profile.answers ?? {}),
      [TATTOO_DESIGNS_QUESTION_ID]: input.assets.map((a) => ({
        path: a.path,
        mime: a.mime,
      })),
    };
    const saved = await this.profilesRepository.save(profile);
    return await this.toDto(contractId, saved, {
      assets: input.assetsMode,
      expiresIn: input.expiresIn,
    });
  }

  async unlockQuestion(input: {
    contractId: number;
    questionId: string;
    reason: string;
  }): Promise<PrepProfileDto> {
    void input.reason;

    const contract = await this.contractsRepository.findOne({
      where: { id: input.contractId },
      select: { id: true },
    });
    if (!contract) {
      throw new NotFoundException('Contract not found');
    }

    assertPrepProfileQuestionId(input.questionId);

    let profile = await this.profilesRepository.findOne({
      where: { contractId: input.contractId },
    });
    if (!profile) {
      profile = this.profilesRepository.create({
        contractId: input.contractId,
        answers: {},
        locked: {},
      });
    }

    const locked = { ...(profile.locked ?? {}) };
    delete locked[input.questionId];
    profile.locked = locked;

    const saved = await this.profilesRepository.save(profile);
    return await this.toDto(input.contractId, saved, { assets: 'none' });
  }
}

