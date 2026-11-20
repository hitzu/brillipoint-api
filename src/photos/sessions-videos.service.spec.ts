import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { PinoLogger } from 'nestjs-pino';

import { AppDataSource as TestDataSource } from '../config/database/data-source';
import { EventTheme } from '../events/entities/event-themes.entity';
import { Event } from '../events/entities/event.entity';
import { EventThemeService } from '../events/event-theme.service';
import { EventsService } from '../events/events.service';
import { Booking } from '../bookings/entities/booking.entity';
import { Contract } from '../contracts/entities/contract.entity';
import { EventFactory } from '../../test/factories/events/event.factory';
import { PhotoFactory } from '../../test/factories/photos/photo.factory';
import { SessionFactory } from '../../test/factories/photos/session.factory';
import { SessionVideoFactory } from '../../test/factories/photos/session-video.factory';
import { Photo } from './entities/photo.entity';
import { SessionVideo } from './entities/session-video.entity';
import { Session } from './entities/session.entity';
import { PhotoStatus } from './enums';
import { PhotosService } from './photos.service';
import { SessionVideosService } from './session-videos.service';
import { SessionsCache } from './sessions.cache';
import { SessionsService } from './sessions.service';

describe('SessionsService video reads', () => {
  let service: SessionsService;
  let eventFactory: EventFactory;
  let sessionFactory: SessionFactory;
  let photoFactory: PhotoFactory;
  let videoFactory: SessionVideoFactory;

  beforeEach(async () => {
    const loggerMock = {
      setContext: jest.fn(),
      error: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    };
    const photosService = {
      createStorageUploadUrl: jest.fn(),
      getPublicUrl: jest.fn((bucket: string, path: string) => `https://public.example/${bucket}/${path}`),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessionsService,
        SessionVideosService,
        SessionsCache,
        EventsService,
        EventThemeService,
        { provide: getRepositoryToken(Session), useValue: TestDataSource.getRepository(Session) },
        { provide: getRepositoryToken(Photo), useValue: TestDataSource.getRepository(Photo) },
        {
          provide: getRepositoryToken(SessionVideo),
          useValue: TestDataSource.getRepository(SessionVideo),
        },
        { provide: getRepositoryToken(Event), useValue: TestDataSource.getRepository(Event) },
        { provide: getRepositoryToken(Booking), useValue: TestDataSource.getRepository(Booking) },
        {
          provide: getRepositoryToken(EventTheme),
          useValue: TestDataSource.getRepository(EventTheme),
        },
        {
          provide: getRepositoryToken(Contract),
          useValue: TestDataSource.getRepository(Contract),
        },
        { provide: PhotosService, useValue: photosService },
        { provide: ConfigService, useValue: { get: jest.fn(() => 'local') } },
        { provide: PinoLogger, useValue: loggerMock },
      ],
    }).compile();

    service = module.get(SessionsService);
    eventFactory = new EventFactory(TestDataSource);
    sessionFactory = new SessionFactory(TestDataSource);
    photoFactory = new PhotoFactory(TestDataSource);
    videoFactory = new SessionVideoFactory(TestDataSource);
  });

  async function givenSessionWithOnePhoto() {
    const event = await eventFactory.create();
    const session = await sessionFactory.create({ eventId: event.id, photoCount: 1 });
    await photoFactory.create({
      eventId: event.id,
      sessionId: session.id,
      status: PhotoStatus.READY,
      publicUrl: 'https://public.example/original.jpg',
      minimizedPublicUrl: 'https://public.example/minimized.jpg',
    });
    return { event, session };
  }

  describe('getSession', () => {
    it('should expose the session video with public urls for the clip and its poster', async () => {
      // Arrange
      const { session } = await givenSessionWithOnePhoto();
      await videoFactory.create({
        sessionId: session.id,
        storagePath: 'photobooth/1/videos/abc.mp4',
        posterStoragePath: 'photobooth/1/videos/abc.jpg',
        durationMs: 3200,
      });

      // Act
      const result = await service.getSession(session.sessionToken);

      // Assert
      expect(result.videos).toEqual([
        {
          url: 'https://public.example/local/photobooth/1/videos/abc.mp4',
          posterUrl: 'https://public.example/local/photobooth/1/videos/abc.jpg',
          durationMs: 3200,
        },
      ]);
    });

    it('should omit the videos field when the session has none', async () => {
      // Arrange
      const { session } = await givenSessionWithOnePhoto();

      // Act
      const result = await service.getSession(session.sessionToken);

      // Assert
      expect(result).not.toHaveProperty('videos');
    });

    it('should keep the photo items identical when the session has a video', async () => {
      // Arrange
      const { session } = await givenSessionWithOnePhoto();
      const before = await service.getSession(session.sessionToken);
      await videoFactory.create({ sessionId: session.id });

      // Act
      const after = await service.getSession(session.sessionToken);

      // Assert
      expect(after.photos).toEqual(before.photos);
    });
  });

  describe('getGallery', () => {
    it('should expose the video on the gallery session item', async () => {
      // Arrange
      const { event, session } = await givenSessionWithOnePhoto();
      await videoFactory.create({
        sessionId: session.id,
        storagePath: 'photobooth/1/videos/abc.mp4',
        posterStoragePath: 'photobooth/1/videos/abc.jpg',
        durationMs: null,
      });

      // Act
      const result = await service.getGallery(event.token);

      // Assert
      expect(result.sessions[0].videos).toEqual([
        {
          url: 'https://public.example/local/photobooth/1/videos/abc.mp4',
          posterUrl: 'https://public.example/local/photobooth/1/videos/abc.jpg',
          durationMs: null,
        },
      ]);
    });

    it('should omit the videos field on gallery sessions without video', async () => {
      // Arrange
      const { event } = await givenSessionWithOnePhoto();

      // Act
      const result = await service.getGallery(event.token);

      // Assert
      expect(result.sessions[0]).not.toHaveProperty('videos');
    });

    it('should not change the gallery photo count or cover when the session has a video', async () => {
      // Arrange
      const { event, session } = await givenSessionWithOnePhoto();
      const before = await service.getGallery(event.token);
      service.clearCache();
      await videoFactory.create({ sessionId: session.id });

      // Act
      const after = await service.getGallery(event.token);

      // Assert
      expect({
        photoCount: after.sessions[0].photoCount,
        coverPhoto: after.sessions[0].coverPhoto,
      }).toEqual({
        photoCount: before.sessions[0].photoCount,
        coverPhoto: before.sessions[0].coverPhoto,
      });
    });

    it('should not list a session that only has a video', async () => {
      // Arrange
      const event = await eventFactory.create();
      const session = await sessionFactory.create({ eventId: event.id, photoCount: 0 });
      await videoFactory.create({ sessionId: session.id });

      // Act
      const result = await service.getGallery(event.token);

      // Assert
      expect(result.sessions).toEqual([]);
    });
  });
});
