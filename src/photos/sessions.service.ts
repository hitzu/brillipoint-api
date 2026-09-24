import {
  BadRequestException,
  ConflictException,
  GoneException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { plainToInstance } from 'class-transformer';
import { Repository } from 'typeorm';

import { formatDateTimeInTimeZone } from '../common/utils/format-datetime-in-time-zone';
import { EXCEPTION_RESPONSE } from '../config/errors/exception-response.config';
import { EventsService } from '../events/events.service';
import { Event } from '../events/entities/event.entity';
import { Photo } from './entities/photo.entity';
import { PhotoStatus } from './enums';
import { Session } from './entities/session.entity';
import {
  CreateSessionResponseDto,
  GalleryResponseDto,
  ListSessionsResponseDto,
  SessionDetailResponseDto,
  SessionListItemDto,
  SessionPhotoItemDto,
  SessionPhotoDto,
  SessionResponseDto,
} from './dto/session-response.dto';
import { SessionUploadUrlResponseDto } from './dto/create-session-upload-url.dto';
import { ConfirmPhotoDto } from './dto/confirm-photo.dto';
import { PresignedUploadDto, PresignedUploadResponseDto } from './dto/presigned-upload.dto';
import { PhotoResponseDto } from './dto/photo-response.dto';
import { PhotosService } from './photos.service';
import { ClearedSessionsCacheCounts, SessionsCache } from './sessions.cache';

const EVENT_EXPIRATION_DAYS = 15;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const UPLOAD_URL_TTL_SECONDS = 300;
const ALLOWED_MIMES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
};
const SESSION_UPLOAD_MIME_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
};

@Injectable()
export class SessionsService {
  constructor(
    @InjectRepository(Session)
    private readonly sessionRepository: Repository<Session>,
    @InjectRepository(Photo)
    private readonly photoRepository: Repository<Photo>,
    private readonly eventsService: EventsService,
    private readonly photosService: PhotosService,
    private readonly configService: ConfigService,
    private readonly cache: SessionsCache,
  ) { }

  // ── Legacy endpoints ──────────────────────────────────────────────────────────

  async create(
    eventToken: string,
    sessionToken: string,
  ): Promise<CreateSessionResponseDto> {
    const event = await this.eventsService.findOneByToken(eventToken);

    const existing = await this.sessionRepository.findOne({
      where: { sessionToken },
    });
    if (existing) {
      throw new ConflictException(EXCEPTION_RESPONSE.SESSION_ALREADY_EXISTS);
    }

    const entity = this.sessionRepository.create({
      sessionToken,
      eventId: event.id,
    });
    const saved = await this.sessionRepository.save(entity);

    return {
      id_session: saved.sessionToken,
      event_token: event.token,
      created_at: saved.createdAt,
    };
  }

  async listByEvent(eventToken: string): Promise<ListSessionsResponseDto> {
    const event = await this.eventsService.findOneByToken(eventToken);
    this.assertEventNotExpired(event);

    const sessions = await this.sessionRepository
      .createQueryBuilder('session')
      .where('session.eventId = :eventId', { eventId: event.id })
      .orderBy('session.createdAt', 'DESC')
      .getMany();

    if (sessions.length === 0) {
      return { event_token: event.token, session_count: 0, sessions: [] };
    }

    const sessionPks = sessions.map((s) => s.id);
    const photos = await this.photoRepository
      .createQueryBuilder('photo')
      .where('photo.sessionId IN (:...sessionPks)', { sessionPks })
      .andWhere('photo.status = :ready', { ready: PhotoStatus.READY })
      .orderBy('photo.createdAt', 'ASC')
      .addOrderBy('photo.id', 'ASC')
      .getMany();

    const photosBySession = new Map<number, Photo[]>();
    for (const photo of photos) {
      if (photo.sessionId == null) continue;
      const list = photosBySession.get(photo.sessionId) ?? [];
      list.push(photo);
      photosBySession.set(photo.sessionId, list);
    }

    const items: SessionListItemDto[] = sessions.map((session) => {
      const sessionPhotos = photosBySession.get(session.id) ?? [];
      const firstReady = sessionPhotos[0];
      const createdAt = firstReady?.createdAt ?? session.createdAt;
      const coverUrl = firstReady?.publicUrl ?? null;
      return {
        id_session: session.sessionToken,
        created_at: createdAt,
        cover_url: coverUrl,
        photo_count: sessionPhotos.length,
      };
    });

    items.sort((a, b) => b.created_at.getTime() - a.created_at.getTime());

    return {
      event_token: event.token,
      session_count: items.length,
      sessions: items,
    };
  }

  async findOne(
    eventToken: string,
    sessionToken: string,
  ): Promise<SessionDetailResponseDto> {
    const event = await this.eventsService.findOneByToken(eventToken);
    this.assertEventNotExpired(event);

    const session = await this.sessionRepository.findOne({
      where: { sessionToken, eventId: event.id },
    });
    if (!session) {
      throw new NotFoundException(EXCEPTION_RESPONSE.SESSION_NOT_FOUND);
    }

    const [readyPhotos, processingCount] = await Promise.all([
      this.photoRepository
        .createQueryBuilder('photo')
        .where('photo.sessionId = :sessionPk', { sessionPk: session.id })
        .andWhere('photo.status = :ready', { ready: PhotoStatus.READY })
        .orderBy('photo.createdAt', 'ASC')
        .addOrderBy('photo.id', 'ASC')
        .getMany(),
      this.photoRepository
        .createQueryBuilder('photo')
        .where('photo.sessionId = :sessionPk', { sessionPk: session.id })
        .andWhere('photo.status = :processing', { processing: PhotoStatus.PROCESSING })
        .getCount(),
    ]);

    const photoDtos: SessionPhotoDto[] = readyPhotos.map((p) => ({
      photo_id: p.id,
      status: p.status,
      url: p.publicUrl,
      created_at: p.createdAt,
    }));

    return {
      id_session: session.sessionToken,
      event_token: event.token,
      allReady: processingCount === 0,
      photos: photoDtos,
    };
  }

  async createUploadUrl(
    eventToken: string,
    sessionToken: string,
    input: { fileName: string; mime: string },
  ): Promise<SessionUploadUrlResponseDto> {
    const extension = ALLOWED_MIMES[input.mime];
    if (!extension) {
      throw new NotFoundException('Unsupported mime type');
    }

    const event = await this.eventsService.findOneByToken(eventToken);
    this.assertEventNotExpired(event);

    const session = await this.sessionRepository.findOne({
      where: { sessionToken, eventId: event.id },
    });
    if (!session) {
      throw new NotFoundException(EXCEPTION_RESPONSE.SESSION_NOT_FOUND);
    }

    const bucket = this.resolveBucket();
    const storagePath = `${event.id}/${randomUUID()}.${extension}`;

    const signedUrl = await this.photosService.createStorageUploadUrl(bucket, storagePath);

    const photoEntity = this.photoRepository.create({
      eventId: event.id,
      sessionId: session.id,
      storagePath,
      publicUrl: null,
      consentAt: new Date(),
      status: PhotoStatus.PROCESSING,
    });
    const saved = await this.photoRepository.save(photoEntity);

    return {
      photo_id: saved.id,
      upload_url: signedUrl,
      storage_path: storagePath,
      expires_in: UPLOAD_URL_TTL_SECONDS,
    };
  }

  async confirmPhoto(eventToken: string, photoId: number): Promise<PhotoResponseDto> {
    const event = await this.eventsService.findOneByToken(eventToken);
    this.assertEventNotExpired(event);

    const photo = await this.photoRepository.findOne({
      where: { id: photoId, eventId: event.id },
    });
    if (!photo) throw new NotFoundException('Photo not found');

    if (photo.status === PhotoStatus.READY && photo.publicUrl) {
      return plainToInstance(PhotoResponseDto, photo, { excludeExtraneousValues: true });
    }

    const bucket = this.resolveBucket();
    photo.publicUrl = this.photosService.getPublicUrl(bucket, photo.storagePath);
    photo.status = PhotoStatus.READY;
    const saved = await this.photoRepository.save(photo);

    return plainToInstance(PhotoResponseDto, saved, { excludeExtraneousValues: true });
  }

  async failPhoto(eventToken: string, photoId: number): Promise<PhotoResponseDto> {
    const event = await this.eventsService.findOneByToken(eventToken);
    this.assertEventNotExpired(event);

    const photo = await this.photoRepository.findOne({
      where: { id: photoId, eventId: event.id },
    });
    if (!photo) throw new NotFoundException('Photo not found');

    if (photo.status !== PhotoStatus.ERROR) {
      photo.status = PhotoStatus.ERROR;
      await this.photoRepository.save(photo);
    }

    return plainToInstance(PhotoResponseDto, photo, { excludeExtraneousValues: true });
  }

  // ── v2 endpoints ──────────────────────────────────────────────────────────────

  async createSession(
    sessionToken: string,
    eventToken: string,
  ): Promise<Session> {
    const event = await this.eventsService.findOneByToken(eventToken);

    const existing = await this.sessionRepository.findOne({ where: { sessionToken } });
    if (existing) {
      throw new ConflictException(EXCEPTION_RESPONSE.SESSION_ALREADY_EXISTS);
    }

    const session = this.sessionRepository.create({ sessionToken, eventId: event.id })

    await this.sessionRepository.save(session);

    return session;
  }

  async completeSession(sessionToken: string): Promise<{ ok: boolean }> {
    const session = await this.sessionRepository.findOne({
      where: { sessionToken },
      relations: ['event'],
    });
    if (!session) {
      throw new NotFoundException(EXCEPTION_RESPONSE.SESSION_NOT_FOUND);
    }

    await this.sessionRepository.update(
      { sessionToken },
      { status: 'complete', completedAt: new Date() },
    );

    this.cache.invalidateGallery(session.event!.token);
    return { ok: true };
  }

  async getSession(sessionToken: string): Promise<SessionResponseDto> {
    const session = await this.sessionRepository.findOne({
      where: { sessionToken },
      relations: ['event'],
    });
    if (!session) {
      throw new NotFoundException(EXCEPTION_RESPONSE.SESSION_NOT_FOUND);
    }
    const eventBooking = session.event
      ? await this.eventsService.findEventBooking(session.event.contractId)
      : null;
    const eventStatus = this.eventsService.getPublicEventStatus(eventBooking);

    const cached = this.cache.getSession(sessionToken);
    if (
      cached &&
      cached.photos.every((photo) => this.hasUsableSessionPhotoItem(photo)) &&
      cached.event.status === eventStatus
    ) {
      return cached;
    }

    if (session.status === 'complete' && session.photoCount === 0) {
      throw new NotFoundException(EXCEPTION_RESPONSE.SESSION_NOT_FOUND);
    }

    const photos = await this.photoRepository.find({
      where: { sessionId: session.id, status: PhotoStatus.READY },
      order: { createdAt: 'ASC' },
    });

    const photoItems: SessionPhotoItemDto[] = [];
    for (const photo of photos) {
      if (this.hasBothPhotoVariants(photo) && !this.isGifPath(photo.storagePath)) {
        photoItems.push(this.toSessionPhotoItem(photo));
      }
    }

    const result: SessionResponseDto = {
      sessionToken: session.sessionToken,
      status: session.status,
      photos: photoItems,
      event: {
        eventToken: session.event?.token ?? '',
        honoreesNames: session.event?.honoreesNames ?? '',
        date:
          eventBooking != null
            ? formatDateTimeInTimeZone(eventBooking.serviceStartsAt, this.eventDisplayTimeZone())
            : '',
        albumPhase: session.event?.albumPhrase ?? '',
        status: eventStatus,
      },
    };

    if (session.status === 'complete') {
      this.cache.setSession(sessionToken, result);
    }

    return result;
  }

  async getGallery(eventToken: string): Promise<GalleryResponseDto> {
    const event = await this.eventsService.getByToken(eventToken);
    const eventBooking = await this.eventsService.findEventBooking(event.contractId);
    const eventStatus = this.eventsService.getPublicEventStatus(eventBooking);

    const cached = this.cache.getGallery(eventToken);
    if (
      cached &&
      cached.sessions.every(
        (session) =>
          session.coverPhoto?.length > 0 &&
          !this.isGifPath(session.coverPhoto),
      ) &&
      cached.event.status === eventStatus
    ) {
      return cached;
    }

    const sessions = await this.sessionRepository.find({
      where: { eventId: event.id },
      order: { createdAt: 'DESC' },
    });

    const sessionIds = sessions.map((s) => s.id);
    const coverPhotos = sessionIds.length
      ? await this.photoRepository
        .createQueryBuilder('photo')
        .where('photo.sessionId IN (:...sessionIds)', { sessionIds })
        .andWhere('photo.status = :ready', { ready: PhotoStatus.READY })
        .orderBy('photo.sessionId')
        .addOrderBy('photo.createdAt', 'ASC')
        .getMany()
      : [];

    const firstPhotoBySession = new Map<number, Photo>();
    const usablePhotoCountBySession = new Map<number, number>();
    for (const photo of coverPhotos) {
      if (!photo.sessionId) continue;
      if (!this.hasUsableGalleryPhoto(photo)) continue;

      usablePhotoCountBySession.set(
        photo.sessionId,
        (usablePhotoCountBySession.get(photo.sessionId) ?? 0) + 1,
      );

      if (!firstPhotoBySession.has(photo.sessionId)) {
        firstPhotoBySession.set(photo.sessionId, photo);
      }
    }

    const visibleSessions = sessions.filter(
      (session) => session.photoCount > 0 || firstPhotoBySession.has(session.id),
    );

    const result: GalleryResponseDto = {
      event: {
        eventToken: event.token ?? '',
        honoreesNames: event.honoreesNames ?? '',
        date:
          eventBooking != null
            ? formatDateTimeInTimeZone(eventBooking.serviceStartsAt, this.eventDisplayTimeZone())
            : '',
        albumPhase: event.albumPhrase ?? '',
        status: eventStatus,
      },
      sessions: visibleSessions.map((s) => ({
        sessionToken: s.sessionToken,
        coverPhoto: this.toGalleryCoverPhoto(firstPhotoBySession.get(s.id)),
        photoCount: Math.max(s.photoCount, usablePhotoCountBySession.get(s.id) ?? 0),
      })),
    };

    this.cache.setGallery(eventToken, result);
    return result;
  }

  clearCache(): { ok: true; cleared: ClearedSessionsCacheCounts } {
    return {
      ok: true,
      cleared: this.cache.clearAll(),
    };
  }

  async getPresignedUploadUrl(dto: PresignedUploadDto): Promise<PresignedUploadResponseDto> {
    if (!dto.sessionToken && !dto.eventToken) {
      throw new BadRequestException('Either sessionToken or eventToken must be provided');
    }

    const bucket = this.resolveBucket();
    const extension = SESSION_UPLOAD_MIME_EXTENSIONS[dto.mime];
    if (!extension) {
      throw new BadRequestException('Only image/jpeg is allowed');
    }


    let session: Session | null

    session = await this.sessionRepository.findOne({
      where: { sessionToken: dto.sessionToken },
      relations: ['event'],
    });

    if (!session) {
      if (!dto.eventToken) {
        throw new BadRequestException('eventToken is required when creating a session');
      }
      session = await this.createSession(dto.sessionToken, dto.eventToken)
    }

    const eventId = session.event?.id ?? session.eventId;
    const fileId = randomUUID();
    const storagePath = `photobooth/${eventId}/${fileId}.${extension}`;
    const minimizedStoragePath = `photobooth/${eventId}/minimized/${fileId}.${extension}`;
    const [presignedUrl, minimizedPresignedUrl] = await Promise.all([
      this.photosService.createStorageUploadUrl(bucket, storagePath),
      this.photosService.createStorageUploadUrl(bucket, minimizedStoragePath),
    ]);

    const photo = await this.photoRepository.save(
      this.photoRepository.create({
        eventId,
        sessionId: session.id,
        storagePath,
        minimizedStoragePath,
        publicUrl: null,
        minimizedPublicUrl: null,
        consentAt: new Date(),
        status: PhotoStatus.PROCESSING,
      }),
    );

    return {
      photoId: photo.id,
      original: {
        presignedUrl,
        photoPath: `${bucket}/${storagePath}`,
      },
      minimized: {
        presignedUrl: minimizedPresignedUrl,
        photoPath: `${bucket}/${minimizedStoragePath}`,
      },
    };
  }

  async confirmPhotoV2(dto: ConfirmPhotoDto): Promise<{ ok: boolean }> {
    const photo = await this.photoRepository.findOne({ where: { id: dto.photoId } });
    if (!photo) throw new NotFoundException('Photo not found');

    if (photo.status === PhotoStatus.READY) return { ok: true };
    if (!photo.minimizedStoragePath) {
      throw new BadRequestException('Photo is missing minimized storage path');
    }

    const bucket = this.resolveBucket();
    photo.publicUrl = this.photosService.getPublicUrl(bucket, photo.storagePath);
    photo.minimizedPublicUrl = this.photosService.getPublicUrl(bucket, photo.minimizedStoragePath);
    photo.status = PhotoStatus.READY;
    await this.photoRepository.save(photo);

    await this.sessionRepository.increment(
      { id: photo.sessionId ?? -1 },
      'photoCount',
      1,
    );

    if (photo.sessionId) {
      const session = await this.sessionRepository.findOne({
        where: { id: photo.sessionId },
        relations: ['event'],
      });

      if (session) {
        this.cache.invalidateSession(session.sessionToken);

        if (session.status === 'complete' && session.event?.token) {
          this.cache.invalidateGallery(session.event.token);
        }
      }
    }

    return { ok: true };
  }

  private isGifPath(path: string | null | undefined): boolean {
    return path?.toLowerCase().endsWith('.gif') ?? false;
  }

  private hasBothPhotoVariants(photo: Photo): photo is Photo & {
    publicUrl: string;
    minimizedPublicUrl: string;
  } {
    return Boolean(photo.publicUrl && photo.minimizedPublicUrl);
  }

  private hasUsableGalleryPhoto(photo: Photo): photo is Photo & { publicUrl: string } {
    return Boolean(
      photo.publicUrl &&
      !this.isGifPath(photo.storagePath) &&
      !this.isGifPath(photo.publicUrl),
    );
  }

  private toGalleryCoverPhoto(photo: Photo | undefined): string {
    if (!photo?.publicUrl) return '';
    if (photo.minimizedPublicUrl && !this.isGifPath(photo.minimizedPublicUrl)) {
      return photo.minimizedPublicUrl;
    }

    return photo.publicUrl;
  }

  private hasUsableSessionPhotoItem(photo: SessionPhotoItemDto): boolean {
    return Boolean(
      photo.url &&
      photo.minimizedUrl &&
      !this.isGifPath(photo.url) &&
      !this.isGifPath(photo.minimizedUrl),
    );
  }

  private toSessionPhotoItem(photo: Photo & {
    publicUrl: string;
    minimizedPublicUrl: string;
  }): SessionPhotoItemDto {
    return {
      url: photo.publicUrl,
      minimizedUrl: photo.minimizedPublicUrl,
      position: photo.id,
    };
  }

  private resolveBucket(): string {
    const stage = this.configService.get<string>('STAGE');
    const nodeEnv = this.configService.get<string>('NODE_ENV');
    const current = (stage ?? nodeEnv ?? 'local').toLowerCase();

    return current === 'production' || current === 'prod' ? 'prod' : 'local';
  }

  private eventDisplayTimeZone(): string {
    return this.configService.get<string>('EVENT_DISPLAY_TIMEZONE', 'America/Mexico_City');
  }

  private assertEventNotExpired(event: Event): void {
    const expiresAt = new Date(
      event.createdAt.getTime() + EVENT_EXPIRATION_DAYS * MS_PER_DAY,
    );
    if (Date.now() > expiresAt.getTime()) {
      throw new GoneException(EXCEPTION_RESPONSE.EVENT_EXPIRED);
    }
  }
}
