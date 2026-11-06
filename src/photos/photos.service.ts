import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { createClient } from '@supabase/supabase-js';
import { plainToInstance } from 'class-transformer';
import { randomUUID } from 'crypto';
import { Brackets, Repository } from 'typeorm';
import { EXCEPTION_RESPONSE } from '../config/errors/exception-response.config';
import { ListPhotosQueryDto } from './dto/list-photos.dto';
import { ListPhotosResponseDto } from './dto/list-photos-response.dto';
import { PhotoResponseDto } from './dto/photo-response.dto';
import { PresignResponseDto } from './dto/presign-response.dto';
import { Photo } from './entities/photo.entity';
import { Session } from './entities/session.entity';
import { SessionsCache } from './sessions.cache';
import { PhotoStatus } from './enums/index';
import { EventsService } from '../events/events.service';

type PhotoCursor = {
  createdAt: string;
  id: number;
};

type EventPresignUploadInput = {
  eventToken: string;
  fileName: string;
  mime: string;
  storageEnv: string;
};

type EventPresignSegment = 'personalized' | 'devoted';

@Injectable()
export class PhotosService {
  private readonly logger = new Logger(PhotosService.name);
  private _client:
    | ReturnType<typeof createClient>
    | undefined;

  constructor(
    @InjectRepository(Photo)
    private readonly photoRepository: Repository<Photo>,
    @InjectRepository(Session)
    private readonly sessionRepository: Repository<Session>,
    private readonly cache: SessionsCache,
    private readonly eventsService: EventsService,
    private readonly configService: ConfigService,
  ) { }

  private get client() {
    if (this._client) {
      return this._client;
    }

    const url = this.configService.get<string>('SUPABASE_URL');
    const serviceKey = this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !serviceKey) {
      throw new InternalServerErrorException(
        EXCEPTION_RESPONSE.SUPABASE_STORAGE_NOT_CONFIGURED,
      );
    }

    this._client = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    return this._client;
  }

  async createStorageUploadUrl(
    bucket: string,
    path: string,
  ): Promise<string> {
    const { data, error } = await this.client.storage
      .from(bucket)
      .createSignedUploadUrl(path);
    if (error || !data?.signedUrl) {
      throw new InternalServerErrorException('Failed to create signed upload URL');
    }
    return data.signedUrl;
  }

  getPublicUrl(bucket: string, path: string): string {
    const baseUrl = this.configService.get<string>('SUPABASE_URL');

    if (!baseUrl) {
      throw new InternalServerErrorException(
        EXCEPTION_RESPONSE.SUPABASE_STORAGE_NOT_CONFIGURED,
      );
    }

    return `${baseUrl.replace(/\/$/, '')}/storage/v1/object/public/${bucket}/${path}`;
  }

  async listByEventToken(
    eventToken: string,
    query: ListPhotosQueryDto,
  ): Promise<ListPhotosResponseDto> {
    const event = await this.eventsService.findOneByToken(eventToken);
    const limit = query.limit ?? 20;
    const cursor = this.decodeCursor(query.cursor);
    const queryBuilder = this.photoRepository
      .createQueryBuilder('photo')
      .where('photo.eventId = :eventId', { eventId: event.id })
      .orderBy('photo.createdAt', 'DESC')
      .addOrderBy('photo.id', 'DESC')
      .take(limit + 1);
    if (cursor) {
      queryBuilder.andWhere(
        new Brackets((qb) => {
          qb.where('photo.createdAt < :cursorCreatedAt', {
            cursorCreatedAt: cursor.createdAt,
          }).orWhere(
            'photo.createdAt = :cursorCreatedAt AND photo.id < :cursorId',
            {
              cursorCreatedAt: cursor.createdAt,
              cursorId: cursor.id,
            },
          );
        }),
      );
    }
    const photos = await queryBuilder.getMany();
    const hasMore = photos.length > limit;
    const pageItems = hasMore ? photos.slice(0, limit) : photos;
    const items = plainToInstance(PhotoResponseDto, pageItems, {
      excludeExtraneousValues: true,
    });
    const lastItem = pageItems[pageItems.length - 1];
    const nextCursor = hasMore && lastItem
      ? this.encodeCursor({
        createdAt: lastItem.createdAt.toISOString(),
        id: lastItem.id,
      })
      : null;
    return {
      items,
      hasMore,
      nextCursor,
    };
  }

  private decodeCursor(cursor?: string): PhotoCursor | null {
    if (!cursor) {
      return null;
    }
    try {
      const decoded = Buffer.from(cursor, 'base64url').toString('utf8');
      const parsed = JSON.parse(decoded) as Partial<PhotoCursor>;
      if (
        !parsed.createdAt
        || typeof parsed.createdAt !== 'string'
        || typeof parsed.id !== 'number'
        || !Number.isInteger(parsed.id)
      ) {
        throw new Error('Invalid cursor payload');
      }
      const createdAt = new Date(parsed.createdAt);
      if (Number.isNaN(createdAt.getTime())) {
        throw new Error('Invalid cursor date');
      }
      return {
        createdAt: createdAt.toISOString(),
        id: parsed.id,
      };
    } catch {
      throw new BadRequestException('Invalid cursor');
    }
  }

  private encodeCursor(cursor: PhotoCursor): string {
    return Buffer.from(JSON.stringify(cursor)).toString('base64url');
  }

  async create(dto: {
    eventToken: string;
    storagePath: string;
    publicUrl: string;
  }): Promise<PhotoResponseDto> {
    const event = await this.eventsService.findOneByToken(dto.eventToken);
    const existing = await this.photoRepository.findOne({
      where: { eventId: event.id, storagePath: dto.storagePath },
    });
    if (existing) {
      return plainToInstance(PhotoResponseDto, existing, {
        excludeExtraneousValues: true,
      });
    }
    const consentAt = new Date();
    const entity = this.photoRepository.create({
      eventId: event.id,
      storagePath: dto.storagePath,
      publicUrl: dto.publicUrl,
      consentAt,
    });
    const saved = await this.photoRepository.save(entity);
    return plainToInstance(PhotoResponseDto, saved, {
      excludeExtraneousValues: true,
    });
  }

  async createPersonalizedUploadUrl(
    input: EventPresignUploadInput,
  ): Promise<PresignResponseDto> {
    return this.createEventPresignedUploadUrl(input, 'personalized');
  }

  async createDevotedUploadUrl(
    input: EventPresignUploadInput,
  ): Promise<PresignResponseDto> {
    return this.createEventPresignedUploadUrl(input, 'devoted');
  }

  private async createEventPresignedUploadUrl(
    input: EventPresignUploadInput,
    segment: EventPresignSegment,
  ): Promise<PresignResponseDto> {
    if (input.mime !== 'image/jpeg') {
      throw new BadRequestException('Only image/jpeg is allowed');
    }

    if (!['local', 'prod'].includes(input.storageEnv)) {
      throw new BadRequestException('storageEnv must be local or prod');
    }

    const event = await this.eventsService.findOneByToken(input.eventToken);
    const bucket = input.storageEnv;
    const path = `${segment}/event_${event.id}/${randomUUID()}.jpg`;

    const { data, error } = await this.client.storage
      .from(bucket)
      .createSignedUploadUrl(path);

    if (error || !data?.signedUrl) {
      throw new InternalServerErrorException('Failed to create signed upload URL');
    }

    return plainToInstance(
      PresignResponseDto,
      {
        eventId: event.id,
        bucket,
        path,
        signedUrl: data.signedUrl,
        publicUrl: this.getPublicUrl(bucket, path),
      },
      { excludeExtraneousValues: true },
    );
  }

  /**
   * [TEST ONLY - Remove manually] Seeds N photos (1.jpg to N.jpg) for an event.
   * Use for bulk testing without Bruno's paid Run with Parameters.
   */
  async bulkSeed(dto: {
    eventToken: string;
    storageBase?: string;
    count?: number;
  }): Promise<PhotoResponseDto[]> {
    const storageBase = dto.storageBase ?? 'local/photobooth/event_1';
    const count = dto.count ?? 82;
    const event = await this.eventsService.findOneByToken(dto.eventToken);

    const supabaseUrl = this.configService.get<string>('SUPABASE_URL');
    const publicUrlBase = supabaseUrl
      ? `${supabaseUrl.replace(/\/$/, '')}/storage/v1/object/public`
      : 'https://uljzbxuxzknilubykrlw.supabase.co/storage/v1/object/public';

    const results: PhotoResponseDto[] = [];
    const consentAt = new Date();

    for (let i = 1; i <= count; i++) {
      const fileName = `${i}.jpg`;
      const storagePath = `${storageBase}/${fileName}`;
      const publicUrl = `${publicUrlBase}/${storagePath}`;

      const existing = await this.photoRepository.findOne({
        where: { eventId: event.id, storagePath },
      });
      if (existing) {
        results.push(
          plainToInstance(PhotoResponseDto, existing, {
            excludeExtraneousValues: true,
          }),
        );
        continue;
      }

      const entity = this.photoRepository.create({
        eventId: event.id,
        storagePath,
        publicUrl,
        consentAt,
      });
      const saved = await this.photoRepository.save(entity);
      results.push(
        plainToInstance(PhotoResponseDto, saved, {
          excludeExtraneousValues: true,
        }),
      );
    }

    return results;
  }

  async listFiles(bucket: string, prefix: string): Promise<string[]> {
    const { data, error } = await this.client.storage
      .from(bucket)
      .list(prefix, { limit: 1000 });
    if (error) return [];
    return (data ?? []).map((f) => `${prefix}/${f.name}`);
  }

  async remove(id: number): Promise<void> {
    const photo = await this.photoRepository.findOne({ where: { id } });
    if (!photo) {
      throw new NotFoundException('Photo not found');
    }

    await this.photoRepository.delete(id);
    await this.removeFromStorage(photo);
    await this.syncSessionAfterPhotoRemoval(photo);
  }

  /**
   * Keeps the session consistent after one of its photos is gone: the cached
   * `photoCount` goes down and, once a completed session has no photos left,
   * the session itself is removed. Active sessions are kept because the cabin
   * may still be uploading into them.
   */
  private async syncSessionAfterPhotoRemoval(photo: Photo): Promise<void> {
    if (!photo.sessionId) {
      return;
    }
    const session = await this.sessionRepository.findOne({
      where: { id: photo.sessionId },
      relations: ['event'],
    });
    if (!session) {
      return;
    }

    const remaining = await this.photoRepository.count({
      where: { sessionId: session.id },
    });

    if (remaining === 0 && session.status === 'complete') {
      await this.sessionRepository.delete(session.id);
    } else if (photo.status === PhotoStatus.READY && session.photoCount > 0) {
      await this.sessionRepository.decrement(
        { id: session.id },
        'photoCount',
        1,
      );
    }

    this.cache.invalidateSession(session.sessionToken);
    if (session.event) {
      this.cache.invalidateGallery(session.event.token);
    }
  }

  /**
   * Best effort: the DB soft delete is the source of truth, so a Supabase
   * failure is logged (orphan file) instead of failing the request.
   */
  private async removeFromStorage(photo: Photo): Promise<void> {
    const paths = [photo.storagePath, photo.minimizedStoragePath].filter(
      (p): p is string => !!p,
    );
    if (paths.length === 0) {
      return;
    }

    try {
      const { error } = await this.client.storage
        .from(this.resolvePhotoBucket(photo))
        .remove(paths);
      if (error) {
        throw error;
      }
    } catch (error) {
      this.logger.error(
        `Failed to remove storage objects for photo ${photo.id}: ${String(error)}`,
      );
    }
  }

  /** Bucket from the stored public URL; falls back to the stage bucket. */
  private resolvePhotoBucket(photo: Photo): string {
    const match = photo.publicUrl?.match(/\/object\/public\/([^/]+)\//);
    if (match) {
      return match[1];
    }
    const stage = (
      this.configService.get<string>('STAGE') ??
      this.configService.get<string>('NODE_ENV') ??
      'local'
    ).toLowerCase();
    return stage === 'production' || stage === 'prod' ? 'prod' : 'local';
  }
}
