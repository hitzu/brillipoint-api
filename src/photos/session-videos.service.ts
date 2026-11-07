import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { In, QueryFailedError, Repository } from 'typeorm';

import {
  ConfirmSessionVideoDto,
  SessionVideoItemDto,
  SessionVideoPresignedResponseDto,
} from './dto/session-video.dto';
import { SessionVideo } from './entities/session-video.entity';
import { Session } from './entities/session.entity';
import { PhotosService } from './photos.service';
import { SessionsCache } from './sessions.cache';

const UNIQUE_VIOLATION = '23505';

/**
 * Video upload flow, kept apart from `SessionsService` on purpose: videos never touch
 * `photos` or `photoCount`, so this whole file can be deleted without photos noticing.
 */
@Injectable()
export class SessionVideosService {
  constructor(
    @InjectRepository(Session)
    private readonly sessionRepository: Repository<Session>,
    @InjectRepository(SessionVideo)
    private readonly videoRepository: Repository<SessionVideo>,
    private readonly photosService: PhotosService,
    private readonly configService: ConfigService,
    private readonly cache: SessionsCache,
  ) {}

  async createUploadUrls(sessionToken: string): Promise<SessionVideoPresignedResponseDto> {
    const session = await this.findSession(sessionToken);
    if (await this.videoRepository.existsBy({ sessionId: session.id })) {
      throw new ConflictException('Session already has a video');
    }

    const bucket = this.resolveBucket();
    const fileId = randomUUID();
    const { storagePath, posterStoragePath } = this.buildPaths(session.eventId, fileId);
    const [videoUrl, posterUrl] = await Promise.all([
      this.photosService.createStorageUploadUrl(bucket, storagePath),
      this.photosService.createStorageUploadUrl(bucket, posterStoragePath),
    ]);

    return {
      fileId,
      video: { presignedUrl: videoUrl, photoPath: `${bucket}/${storagePath}` },
      poster: { presignedUrl: posterUrl, photoPath: `${bucket}/${posterStoragePath}` },
    };
  }

  async confirm(sessionToken: string, dto: ConfirmSessionVideoDto): Promise<{ ok: boolean }> {
    const session = await this.findSession(sessionToken);
    const { storagePath, posterStoragePath } = this.buildPaths(session.eventId, dto.fileId);

    const existing = await this.videoRepository.findOne({ where: { sessionId: session.id } });
    if (existing) {
      if (existing.storagePath === storagePath) return { ok: true };
      throw new ConflictException('Session already has a video');
    }

    try {
      await this.videoRepository.save(
        this.videoRepository.create({
          sessionId: session.id,
          storagePath,
          posterStoragePath,
          mime: 'video/mp4',
          durationMs: dto.durationMs ?? null,
        }),
      );
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException('Session already has a video');
      }
      throw error;
    }

    this.cache.invalidateSession(session.sessionToken);
    if (session.event?.token) this.cache.invalidateGallery(session.event.token);
    return { ok: true };
  }

  /** Public video items per session id; sessions without a video are absent from the map. */
  async listBySessionIds(sessionIds: number[]): Promise<Map<number, SessionVideoItemDto[]>> {
    const bySession = new Map<number, SessionVideoItemDto[]>();
    if (sessionIds.length === 0) return bySession;

    const bucket = this.resolveBucket();
    const videos = await this.videoRepository.find({
      where: { sessionId: In(sessionIds) },
      order: { createdAt: 'ASC' },
    });
    for (const video of videos) {
      const items = bySession.get(video.sessionId) ?? [];
      items.push({
        url: this.photosService.getPublicUrl(bucket, video.storagePath),
        posterUrl: this.photosService.getPublicUrl(bucket, video.posterStoragePath),
        durationMs: video.durationMs,
      });
      bySession.set(video.sessionId, items);
    }
    return bySession;
  }

  private async findSession(sessionToken: string): Promise<Session> {
    const session = await this.sessionRepository.findOne({ where: { sessionToken },
      relations: ['event'],
    });
    if (!session) throw new NotFoundException('Session not found');
    return session;
  }

  // The client only sends the file id; paths are always rebuilt here so a caller can
  // never register an arbitrary storage path.
  private buildPaths(eventId: number, fileId: string) {
    const base = `photobooth/${eventId}/videos/${fileId}`;
    return { storagePath: `${base}.mp4`, posterStoragePath: `${base}.jpg` };
  }

  private resolveBucket(): string {
    const stage = this.configService.get<string>('STAGE');
    const nodeEnv = this.configService.get<string>('NODE_ENV');
    const current = (stage ?? nodeEnv ?? 'local').toLowerCase();

    return current === 'production' || current === 'prod' ? 'prod' : 'local';
  }

  private isUniqueViolation(error: unknown): boolean {
    return (
      error instanceof QueryFailedError &&
      (error.driverError as { code?: string } | undefined)?.code === UNIQUE_VIOLATION
    );
  }
}
