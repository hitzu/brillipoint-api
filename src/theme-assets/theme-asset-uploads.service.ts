import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { plainToInstance } from 'class-transformer';
import { randomUUID } from 'crypto';
import { Repository } from 'typeorm';

import { StorageService } from '../common/storage/storage.service';
import { EXCEPTION_RESPONSE } from '../config/errors/exception-response.config';
import { EventTheme } from '../events/entities/event-themes.entity';
import { Event } from '../events/entities/event.entity';
import { CreateThemeAssetUploadUrlDto } from './dto/create-theme-asset-upload-url.dto';
import {
  ThemeAssetOwnerType,
  ThemeAssetSlot,
} from './dto/theme-asset-owner-type';
import { ThemeAssetUploadUrlDto } from './dto/theme-asset-upload-url.dto';

const OWNER_TYPE_TO_FOLDER: Record<ThemeAssetOwnerType, string> = {
  [ThemeAssetOwnerType.PRESET]: 'presets',
  [ThemeAssetOwnerType.EVENT]: 'events',
};

/** Every slot accepts these raster formats. */
const MIME_WHITELIST = new Set<string>([
  'image/png',
  'image/jpeg',
  'image/webp',
]);

const SVG_MIME = 'image/svg+xml';

/** Only these slots also accept svg (icon-like assets). */
const SVG_ALLOWED_SLOTS = new Set<ThemeAssetSlot>([
  ThemeAssetSlot.LOGO,
  ThemeAssetSlot.SPLASH_ICON,
  ThemeAssetSlot.WATERMARK,
]);

/**
 * Signed upload URLs for theme image assets (T4/theme-authoring): the
 * client creates the owner (preset/event) first, uploads to the
 * returned `signedUrl`, then PATCHes the owner's overrides with
 * `{ path, url: publicUrl }` in the matching image slot. No drafts folder —
 * every upload is scoped to an existing owner.
 */
@Injectable()
export class ThemeAssetUploadsService {
  constructor(
    @InjectRepository(EventTheme)
    private readonly eventThemeRepository: Repository<EventTheme>,
    @InjectRepository(Event)
    private readonly eventRepository: Repository<Event>,
    private readonly storageService: StorageService,
  ) {}

  async createSignedUploadUrl(
    dto: CreateThemeAssetUploadUrlDto,
  ): Promise<ThemeAssetUploadUrlDto> {
    await this.assertOwnerExists(dto.ownerType, dto.ownerId);
    this.assertMimeAllowed(dto.slot, dto.mime);

    const folder = OWNER_TYPE_TO_FOLDER[dto.ownerType];
    const name = this.storageService.sanitizeFileName(dto.fileName);
    const path = `themes/${folder}/${dto.ownerId}/${dto.slot}/${randomUUID()}_${name}`;

    const { signedUrl, token } =
      await this.storageService.createSignedUploadUrl(path);

    return plainToInstance(
      ThemeAssetUploadUrlDto,
      {
        bucket: this.storageService.bucket,
        path,
        signedUrl,
        token,
        publicUrl: this.storageService.getPublicUrl(path),
      },
      { excludeExtraneousValues: true },
    );
  }

  private async assertOwnerExists(
    ownerType: ThemeAssetOwnerType,
    ownerId: number,
  ): Promise<void> {
    switch (ownerType) {
      case ThemeAssetOwnerType.PRESET: {
        const preset = await this.eventThemeRepository.findOne({
          where: { id: ownerId },
        });
        if (!preset) {
          throw new NotFoundException(EXCEPTION_RESPONSE.EVENT_THEME_NOT_FOUND);
        }
        return;
      }
      case ThemeAssetOwnerType.EVENT: {
        const event = await this.eventRepository.findOne({
          where: { id: ownerId },
        });
        if (!event) {
          throw new NotFoundException(EXCEPTION_RESPONSE.EVENT_NOT_FOUND);
        }
        return;
      }
    }
  }

  private assertMimeAllowed(slot: ThemeAssetSlot, mime: string): void {
    if (MIME_WHITELIST.has(mime)) {
      return;
    }
    if (mime === SVG_MIME && SVG_ALLOWED_SLOTS.has(slot)) {
      return;
    }
    throw new UnprocessableEntityException(
      `Mime type ${mime} is not allowed for slot ${slot}`,
    );
  }
}
