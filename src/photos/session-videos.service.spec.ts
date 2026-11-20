import { ConflictException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';

import { AppDataSource as TestDataSource } from '../config/database/data-source';
import { Event } from '../events/entities/event.entity';
import { SessionFactory } from '../../test/factories/photos/session.factory';
import { SessionVideoFactory } from '../../test/factories/photos/session-video.factory';
import { SessionVideo } from './entities/session-video.entity';
import { Session } from './entities/session.entity';
import { PhotosService } from './photos.service';
import { SessionVideosService } from './session-videos.service';
import { SessionsCache } from './sessions.cache';

describe('SessionVideosService', () => {
  let service: SessionVideosService;
  let cache: SessionsCache;
  let sessionFactory: SessionFactory;
  let videoFactory: SessionVideoFactory;

  beforeEach(async () => {
    const photosService = {
      createStorageUploadUrl: jest.fn(
        async (bucket: string, path: string) => `https://signed.example/${bucket}/${path}`,
      ),
    };
    const configService = { get: jest.fn(() => 'local') };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessionVideosService,
        SessionsCache,
        { provide: getRepositoryToken(Session), useValue: TestDataSource.getRepository(Session) },
        {
          provide: getRepositoryToken(SessionVideo),
          useValue: TestDataSource.getRepository(SessionVideo),
        },
        { provide: PhotosService, useValue: photosService },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get(SessionVideosService);
    cache = module.get(SessionsCache);
    sessionFactory = new SessionFactory(TestDataSource);
    videoFactory = new SessionVideoFactory(TestDataSource);
  });

  describe('createUploadUrls', () => {
    it('should return signed urls for the mp4 and its jpg poster under the event videos folder', async () => {
      // Arrange
      const session = await sessionFactory.create();

      // Act
      const result = await service.createUploadUrls(session.sessionToken);

      // Assert
      const base = `photobooth/${session.eventId}/videos/${result.fileId}`;
      expect({
        video: result.video.photoPath,
        poster: result.poster.photoPath,
      }).toEqual({ video: `local/${base}.mp4`, poster: `local/${base}.jpg` });
    });

    it('should return a presigned url for each file', async () => {
      // Arrange
      const session = await sessionFactory.create();

      // Act
      const result = await service.createUploadUrls(session.sessionToken);

      // Assert
      expect({
        video: result.video.presignedUrl,
        poster: result.poster.presignedUrl,
      }).toEqual({
        video: `https://signed.example/${result.video.photoPath}`,
        poster: `https://signed.example/${result.poster.photoPath}`,
      });
    });

    it('should not touch the session photo count', async () => {
      // Arrange
      const session = await sessionFactory.create({ photoCount: 2 });

      // Act
      await service.createUploadUrls(session.sessionToken);

      // Assert
      const reloaded = await TestDataSource.getRepository(Session).findOneByOrFail({
        id: session.id,
      });
      expect(reloaded.photoCount).toBe(2);
    });

    it('should throw NotFoundException when the session does not exist', async () => {
      // Arrange
      const unknownToken = randomUUID();

      // Act + Assert
      await expect(service.createUploadUrls(unknownToken)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('should throw ConflictException when the session already has a video', async () => {
      // Arrange
      const session = await sessionFactory.create();
      await videoFactory.create({ sessionId: session.id });

      // Act + Assert
      await expect(service.createUploadUrls(session.sessionToken)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });
  });

  describe('confirm', () => {
    it('should persist the video with paths rebuilt from the file id', async () => {
      // Arrange
      const session = await sessionFactory.create();
      const fileId = randomUUID();

      // Act
      await service.confirm(session.sessionToken, { fileId, durationMs: 3200 });

      // Assert
      const saved = await TestDataSource.getRepository(SessionVideo).findOneByOrFail({
        sessionId: session.id,
      });
      expect({
        storagePath: saved.storagePath,
        posterStoragePath: saved.posterStoragePath,
        mime: saved.mime,
        durationMs: saved.durationMs,
      }).toEqual({
        storagePath: `photobooth/${session.eventId}/videos/${fileId}.mp4`,
        posterStoragePath: `photobooth/${session.eventId}/videos/${fileId}.jpg`,
        mime: 'video/mp4',
        durationMs: 3200,
      });
    });

    it('should leave the session photo count untouched', async () => {
      // Arrange
      const session = await sessionFactory.create({ photoCount: 2 });

      // Act
      await service.confirm(session.sessionToken, { fileId: randomUUID() });

      // Assert
      const reloaded = await TestDataSource.getRepository(Session).findOneByOrFail({
        id: session.id,
      });
      expect(reloaded.photoCount).toBe(2);
    });

    it('should be idempotent when the same file id is confirmed twice', async () => {
      // Arrange
      const session = await sessionFactory.create();
      const fileId = randomUUID();
      await service.confirm(session.sessionToken, { fileId });

      // Act
      const result = await service.confirm(session.sessionToken, { fileId });

      // Assert
      expect(result).toEqual({ ok: true });
    });

    it('should keep a single video row when the same file id is confirmed twice', async () => {
      // Arrange
      const session = await sessionFactory.create();
      const fileId = randomUUID();
      await service.confirm(session.sessionToken, { fileId });

      // Act
      await service.confirm(session.sessionToken, { fileId });

      // Assert
      const count = await TestDataSource.getRepository(SessionVideo).countBy({
        sessionId: session.id,
      });
      expect(count).toBe(1);
    });

    it('should invalidate the cached session response', async () => {
      // Arrange
      const session = await sessionFactory.create();
      const invalidate = jest.spyOn(cache, 'invalidateSession');

      // Act
      await service.confirm(session.sessionToken, { fileId: randomUUID() });

      // Assert
      expect(invalidate).toHaveBeenCalledWith(session.sessionToken);
    });

    it('should invalidate the cached gallery of the session event', async () => {
      // Arrange
      const session = await sessionFactory.create();
      const event = await TestDataSource.getRepository(Event).findOneByOrFail({
        id: session.eventId,
      });
      const invalidate = jest.spyOn(cache, 'invalidateGallery');

      // Act
      await service.confirm(session.sessionToken, { fileId: randomUUID() });

      // Assert
      expect(invalidate).toHaveBeenCalledWith(event.token);
    });

    it('should throw ConflictException when another video is already confirmed', async () => {
      // Arrange
      const session = await sessionFactory.create();
      await videoFactory.create({ sessionId: session.id });

      // Act + Assert
      await expect(
        service.confirm(session.sessionToken, { fileId: randomUUID() }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('should throw NotFoundException when the session does not exist', async () => {
      // Arrange
      const unknownToken = randomUUID();

      // Act + Assert
      await expect(
        service.confirm(unknownToken, { fileId: randomUUID() }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
