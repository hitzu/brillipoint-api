import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';

import { formatDateTimeInTimeZone } from '../common/utils/format-datetime-in-time-zone';
import { EventsService } from '../events/events.service';
import { PhotoStatus } from './enums';
import { Photo } from './entities/photo.entity';
import { Session } from './entities/session.entity';
import { PhotosService } from './photos.service';
import { SessionsCache } from './sessions.cache';
import { SessionsService } from './sessions.service';

jest.mock('node:crypto', () => ({
  randomUUID: jest.fn(() => 'uuid-123'),
}));

describe('SessionsService', () => {
  let service: SessionsService;
  let env: { STAGE?: string; NODE_ENV?: string };
  let sessionRepository: {
    findOne: jest.Mock;
    increment: jest.Mock;
    find: jest.Mock;
  };
  let photoRepository: {
    create: jest.Mock;
    save: jest.Mock;
    find: jest.Mock;
    findOne: jest.Mock;
    createQueryBuilder: jest.Mock;
  };
  let photosService: {
    createStorageUploadUrl: jest.Mock;
    getPublicUrl: jest.Mock;
  };
  let eventsService: {
    findOneByToken: jest.Mock;
    getByToken: jest.Mock;
    getPublicEventStatus: jest.Mock;
    findEventBooking: jest.Mock;
  };
  let configService: Pick<ConfigService, 'get'>;
  let cache: {
    getSession: jest.Mock;
    setSession: jest.Mock;
    invalidateSession: jest.Mock;
    getGallery: jest.Mock;
    setGallery: jest.Mock;
    invalidateGallery: jest.Mock;
    clearAll: jest.Mock;
  };

  beforeEach(() => {
    env = { NODE_ENV: 'local' };
    sessionRepository = {
      findOne: jest.fn(),
      increment: jest.fn(),
      find: jest.fn(),
    };
    photoRepository = {
      create: jest.fn((value) => value),
      save: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
      createQueryBuilder: jest.fn(),
    };
    photosService = {
      createStorageUploadUrl: jest.fn(),
      getPublicUrl: jest.fn(
        (bucket: string, path: string) => `https://public.example/${bucket}/${path}`,
      ),
    };
    eventsService = {
      findOneByToken: jest.fn(),
      getByToken: jest.fn(),
      getPublicEventStatus: jest.fn(),
      findEventBooking: jest.fn().mockResolvedValue(null),
    };
    configService = {
      get: jest.fn((key: string, defaultValue?: unknown) => {
        const value = env[key as keyof typeof env];
        return value !== undefined ? value : defaultValue;
      }),
    };
    cache = {
      getSession: jest.fn(() => null),
      setSession: jest.fn(),
      invalidateSession: jest.fn(),
      getGallery: jest.fn(() => null),
      setGallery: jest.fn(),
      invalidateGallery: jest.fn(),
      clearAll: jest.fn(),
    };

    service = new SessionsService(
      sessionRepository as unknown as Repository<Session>,
      photoRepository as unknown as Repository<Photo>,
      eventsService as unknown as EventsService,
      photosService as unknown as PhotosService,
      configService as ConfigService,
      cache as unknown as SessionsCache,
    );
  });

  it('should create one processing photo row and presigned URLs for both JPEG variants', async () => {
    const session = {
      id: 7,
      sessionToken: '5c95cf10-7e7e-4101-aa24-b7a4d3145df4',
      eventId: 12,
      event: { id: 12 },
    } as Session;
    const savedPhoto = {
      id: 99,
      eventId: 12,
      sessionId: 7,
      storagePath: 'photobooth/12/uuid-123.jpg',
      minimizedStoragePath: 'photobooth/12/minimized/uuid-123.jpg',
      publicUrl: null,
      minimizedPublicUrl: null,
      consentAt: new Date(),
      status: PhotoStatus.PROCESSING,
    } as Photo;

    sessionRepository.findOne.mockResolvedValue(session);
    photosService.createStorageUploadUrl.mockResolvedValue('https://signed.example/upload');
    photoRepository.save.mockResolvedValue(savedPhoto);
    env.STAGE = 'production';

    const result = await service.getPresignedUploadUrl({
      sessionToken: session.sessionToken,
      mime: 'image/jpeg',
    });

    expect(photosService.createStorageUploadUrl).toHaveBeenCalledWith(
      'prod',
      'photobooth/12/uuid-123.jpg',
    );
    expect(photosService.createStorageUploadUrl).toHaveBeenCalledWith(
      'prod',
      'photobooth/12/minimized/uuid-123.jpg',
    );
    expect(photoRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        eventId: 12,
        sessionId: 7,
        storagePath: 'photobooth/12/uuid-123.jpg',
        minimizedStoragePath: 'photobooth/12/minimized/uuid-123.jpg',
        publicUrl: null,
        minimizedPublicUrl: null,
        status: PhotoStatus.PROCESSING,
      }),
    );
    expect(result).toEqual({
      photoId: 99,
      original: {
        presignedUrl: 'https://signed.example/upload',
        photoPath: 'prod/photobooth/12/uuid-123.jpg',
      },
      minimized: {
        presignedUrl: 'https://signed.example/upload',
        photoPath: 'prod/photobooth/12/minimized/uuid-123.jpg',
      },
    });
  });

  it('should resolve staging to the local bucket for presigned uploads', async () => {
    const session = {
      id: 7,
      sessionToken: '5c95cf10-7e7e-4101-aa24-b7a4d3145df4',
      eventId: 12,
      event: { id: 12 },
    } as Session;
    const savedPhoto = {
      id: 100,
      eventId: 12,
      sessionId: 7,
      storagePath: 'photobooth/12/uuid-123.jpg',
      publicUrl: null,
      consentAt: new Date(),
      status: PhotoStatus.PROCESSING,
    } as Photo;

    env.STAGE = 'staging';
    env.NODE_ENV = 'production';
    sessionRepository.findOne.mockResolvedValue(session);
    photosService.createStorageUploadUrl.mockResolvedValue('https://signed.example/upload');
    photoRepository.save.mockResolvedValue(savedPhoto);

    const result = await service.getPresignedUploadUrl({
      sessionToken: session.sessionToken,
      mime: 'image/jpeg',
    });

    expect(photosService.createStorageUploadUrl).toHaveBeenCalledWith(
      'local',
      'photobooth/12/uuid-123.jpg',
    );
    expect(result.original.photoPath).toBe('local/photobooth/12/uuid-123.jpg');
    expect(result.minimized.photoPath).toBe('local/photobooth/12/minimized/uuid-123.jpg');
  });

  it('should reject unsupported mimes for photos/presigned', async () => {
    const session = {
      id: 7,
      sessionToken: '5c95cf10-7e7e-4101-aa24-b7a4d3145df4',
      eventId: 12,
      event: { id: 12 },
    } as Session;

    sessionRepository.findOne.mockResolvedValue(session);

    await expect(
      service.getPresignedUploadUrl({
        sessionToken: session.sessionToken,
        mime: 'image/png',
      }),
    ).rejects.toEqual(new BadRequestException('Only image/jpeg is allowed'));
  });

  it('should reject GIF uploads via photos/presigned', async () => {
    await expect(
      service.getPresignedUploadUrl({
        sessionToken: '5c95cf10-7e7e-4101-aa24-b7a4d3145df4',
        mime: 'image/gif',
      }),
    ).rejects.toEqual(new BadRequestException('Only image/jpeg is allowed'));
  });

  it('should confirm both photo variants and increment photoCount once', async () => {
    const photo = {
      id: 42,
      eventId: 12,
      sessionId: 7,
      storagePath: 'photobooth/12/upload.jpg',
      minimizedStoragePath: 'photobooth/12/minimized/upload.jpg',
      publicUrl: null,
      minimizedPublicUrl: null,
      consentAt: new Date(),
      status: PhotoStatus.PROCESSING,
    } as Photo;
    const savedPhoto = {
      ...photo,
      publicUrl: 'https://public.example/local/photobooth/12/upload.jpg',
      minimizedPublicUrl: 'https://public.example/local/photobooth/12/minimized/upload.jpg',
      status: PhotoStatus.READY,
    } as Photo;
    const session = {
      id: 7,
      sessionToken: 'ce0b5bb4-a448-441a-a48a-a7c2cf32d282',
      status: 'complete',
      event: {
        token: '0fe6c6df-f177-4e9b-a427-651c6d325d3e',
      },
    } as Session;

    photoRepository.findOne.mockResolvedValue(photo);
    photoRepository.save.mockResolvedValue(savedPhoto);
    sessionRepository.findOne.mockResolvedValue(session);
    sessionRepository.increment.mockResolvedValue({ affected: 1 });

    await expect(service.confirmPhotoV2({ photoId: 42 })).resolves.toEqual({ ok: true });

    expect(photosService.getPublicUrl).toHaveBeenCalledWith(
      'local',
      'photobooth/12/upload.jpg',
    );
    expect(photosService.getPublicUrl).toHaveBeenCalledWith(
      'local',
      'photobooth/12/minimized/upload.jpg',
    );
    expect(sessionRepository.increment).toHaveBeenCalledTimes(1);
    expect(cache.invalidateSession).toHaveBeenCalledWith(session.sessionToken);
    expect(cache.invalidateGallery).toHaveBeenCalledWith(session.event!.token);
  });

  it('should not increment photoCount for an already READY photo', async () => {
    photoRepository.findOne.mockResolvedValue({ id: 42, status: PhotoStatus.READY } as Photo);

    await expect(service.confirmPhotoV2({ photoId: 42 })).resolves.toEqual({ ok: true });

    expect(sessionRepository.increment).not.toHaveBeenCalled();
    expect(photoRepository.save).not.toHaveBeenCalled();
  });

  it('should not invalidate gallery cache when the updated session is still active', async () => {
    const photo = {
      id: 42,
      eventId: 12,
      sessionId: 7,
      storagePath: 'photobooth/12/active-upload.jpg',
      minimizedStoragePath: 'photobooth/12/minimized/active-upload.jpg',
      publicUrl: null,
      minimizedPublicUrl: null,
      consentAt: new Date(),
      status: PhotoStatus.PROCESSING,
    } as Photo;
    const savedPhoto = {
      ...photo,
      publicUrl: 'https://public.example/local/photobooth/12/active-upload.jpg',
      minimizedPublicUrl: 'https://public.example/local/photobooth/12/minimized/active-upload.jpg',
      status: PhotoStatus.READY,
    } as Photo;
    const session = {
      id: 7,
      sessionToken: 'f6f08798-45ca-46dd-bf8d-e95c4c247218',
      status: 'active',
      event: {
        token: '6e76e415-b5c3-4dca-b17e-24a4f0435a75',
      },
    } as Session;

    photoRepository.findOne.mockResolvedValueOnce(photo).mockResolvedValueOnce(savedPhoto);
    photoRepository.save.mockResolvedValue(savedPhoto);
    sessionRepository.findOne.mockResolvedValue(session);
    sessionRepository.increment.mockResolvedValue({ affected: 1 });

    await expect(service.confirmPhotoV2({ photoId: 42 })).resolves.toEqual({ ok: true });

    expect(cache.invalidateSession).toHaveBeenCalledWith(session.sessionToken);
    expect(cache.invalidateGallery).not.toHaveBeenCalled();
  });

  it('should clear the in-memory sessions cache through the cache service', () => {
    cache.clearAll.mockReturnValue({ sessions: 2, galleries: 1 });

    expect(service.clearCache()).toEqual({
      ok: true,
      cleared: {
        sessions: 2,
        galleries: 1,
      },
    });
    expect(cache.clearAll).toHaveBeenCalledTimes(1);
  });

  it('should exclude GIF assets and omit event.status before the cutoff in the public session response', async () => {
    const session = {
      id: 7,
      sessionToken: '9abfe43e-30d9-4614-a0b2-c4ef6ed3a76f',
      eventId: 12,
      status: 'complete',
      event: {
        id: 12,
        token: '6f01177a-d7ef-4342-a6e1-618da5230a06',
        honoreesNames: 'Alex y Sam',
        serviceStartsAt: new Date('2026-05-04T12:00:00.000Z'),
        albumPhrase: 'Nuestro album',
        eventTheme: null,
      },
    } as Session;
    const readyPhotos = [
      {
        id: 1,
        storagePath: 'photobooth/12/uuid-123.jpg',
        publicUrl: 'https://public.example/local/photobooth/12/uuid-123.jpg',
        minimizedPublicUrl: 'https://public.example/local/photobooth/12/minimized/uuid-123.jpg',
      },
      {
        id: 2,
        storagePath: 'photobooth/12/uuid-123.gif',
        publicUrl: 'https://public.example/local/photobooth/12/uuid-123.gif',
      },
    ] as Photo[];

    sessionRepository.findOne.mockResolvedValue(session);
    photoRepository.find.mockResolvedValue(readyPhotos);
    eventsService.getPublicEventStatus.mockReturnValue(undefined);

    const result = await service.getSession(session.sessionToken);

    expect(result.photos).toEqual([
      {
        minimizedUrl: 'https://public.example/local/photobooth/12/minimized/uuid-123.jpg',
        url: 'https://public.example/local/photobooth/12/uuid-123.jpg',
        position: 1,
      },
    ]);
    expect(result.event.status).toBeUndefined();
  });

  it('should return event.status finished in the public session response after the cutoff', async () => {
    const session = {
      id: 7,
      sessionToken: '9abfe43e-30d9-4614-a0b2-c4ef6ed3a76f',
      eventId: 12,
      status: 'complete',
      event: {
        id: 12,
        token: '6f01177a-d7ef-4342-a6e1-618da5230a06',
        honoreesNames: 'Alex y Sam',
        serviceStartsAt: new Date('2026-05-04T12:00:00.000Z'),
        albumPhrase: 'Nuestro album',
        eventTheme: null,
      },
    } as Session;

    sessionRepository.findOne.mockResolvedValue(session);
    photoRepository.find.mockResolvedValue([]);
    eventsService.getPublicEventStatus.mockReturnValue('finished');

    const result = await service.getSession(session.sessionToken);

    expect(result.event.status).toBe('finished');
  });

  it('should report the session event as finished when the contract has no EVENT booking, even though the legacy event.serviceStartsAt is recent', async () => {
    const session = {
      id: 7,
      sessionToken: '9abfe43e-30d9-4614-a0b2-c4ef6ed3a76f',
      eventId: 12,
      status: 'complete',
      event: {
        id: 12,
        contractId: 99,
        token: '6f01177a-d7ef-4342-a6e1-618da5230a06',
        honoreesNames: 'Alex y Sam',
        serviceStartsAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        albumPhrase: 'Nuestro album',
        eventTheme: null,
      },
    } as Session;

    sessionRepository.findOne.mockResolvedValue(session);
    photoRepository.find.mockResolvedValue([]);
    eventsService.findEventBooking.mockResolvedValue(null);
    eventsService.getPublicEventStatus.mockImplementation((booking) =>
      booking == null ? 'finished' : 'active',
    );

    const result = await service.getSession(session.sessionToken);

    expect(eventsService.findEventBooking).toHaveBeenCalledWith(99);
    expect(result.event.status).toBe('finished');
    expect(result.event.date).toBe('');
  });

  it('should take the session event date from the EVENT booking, not the legacy event.serviceStartsAt', async () => {
    const bookingStart = new Date('2026-07-01T15:00:00.000Z');
    const session = {
      id: 7,
      sessionToken: '9abfe43e-30d9-4614-a0b2-c4ef6ed3a76f',
      eventId: 12,
      status: 'complete',
      event: {
        id: 12,
        contractId: 99,
        token: '6f01177a-d7ef-4342-a6e1-618da5230a06',
        honoreesNames: 'Alex y Sam',
        serviceStartsAt: new Date('2020-01-01T00:00:00.000Z'),
        albumPhrase: 'Nuestro album',
        eventTheme: null,
      },
    } as Session;

    sessionRepository.findOne.mockResolvedValue(session);
    photoRepository.find.mockResolvedValue([]);
    eventsService.findEventBooking.mockResolvedValue({ serviceStartsAt: bookingStart });
    eventsService.getPublicEventStatus.mockReturnValue('active');

    const result = await service.getSession(session.sessionToken);

    expect(result.event.date).toBe(
      formatDateTimeInTimeZone(bookingStart, 'America/Mexico_City'),
    );
  });

  it('should return the cached session when cache status matches the computed event status and no GIFs exist', async () => {
    const session = {
      id: 7,
      sessionToken: '9abfe43e-30d9-4614-a0b2-c4ef6ed3a76f',
      eventId: 12,
      status: 'complete',
      photoCount: 2,
      event: {
        id: 12,
        token: '6f01177a-d7ef-4342-a6e1-618da5230a06',
        honoreesNames: 'Alex y Sam',
        serviceStartsAt: new Date('2026-05-04T12:00:00.000Z'),
        albumPhrase: 'Nuestro album',
        eventTheme: null,
      },
    } as Session;
    const cachedSession = {
      sessionToken: session.sessionToken,
      status: 'complete' as const,
      photos: [
        {
          url: 'https://public.example/local/photobooth/12/uuid-123.jpg',
          minimizedUrl: 'https://public.example/local/photobooth/12/minimized/uuid-123.jpg',
          position: 1,
        },
      ],
      event: {
        eventToken: session.event!.token,
        honoreesNames: session.event!.honoreesNames!,
        date: 'cached',
        albumPhase: session.event!.albumPhrase!,
        status: 'finished' as const,
        eventTheme: null,
      },
    };

    sessionRepository.findOne.mockResolvedValue(session);
    cache.getSession.mockReturnValue(cachedSession);
    eventsService.getPublicEventStatus.mockReturnValue('finished');

    const result = await service.getSession(session.sessionToken);

    expect(result).toEqual(cachedSession);
    expect(photoRepository.find).not.toHaveBeenCalled();
  });

  it('should bypass a cached session when event.status became finished after caching', async () => {
    const session = {
      id: 7,
      sessionToken: '9abfe43e-30d9-4614-a0b2-c4ef6ed3a76f',
      eventId: 12,
      status: 'complete',
      photoCount: 2,
      event: {
        id: 12,
        token: '6f01177a-d7ef-4342-a6e1-618da5230a06',
        honoreesNames: 'Alex y Sam',
        serviceStartsAt: new Date('2026-05-04T12:00:00.000Z'),
        albumPhrase: 'Nuestro album',
        eventTheme: null,
      },
    } as Session;
    const readyPhotos = [
      {
        id: 1,
        storagePath: 'photobooth/12/uuid-123.jpg',
        publicUrl: 'https://public.example/local/photobooth/12/uuid-123.jpg',
        minimizedPublicUrl: 'https://public.example/local/photobooth/12/minimized/uuid-123.jpg',
      },
    ] as Photo[];

    sessionRepository.findOne.mockResolvedValue(session);
    cache.getSession.mockReturnValue({
      sessionToken: session.sessionToken,
      status: 'complete',
      photos: [
        {
          url: 'https://public.example/local/photobooth/12/uuid-123.jpg',
          position: 1,
        },
      ],
      event: {
        eventToken: session.event!.token,
        honoreesNames: session.event!.honoreesNames!,
        date: 'cached',
        albumPhase: session.event!.albumPhrase!,
        eventTheme: null,
      },
    });
    photoRepository.find.mockResolvedValue(readyPhotos);
    eventsService.getPublicEventStatus.mockReturnValue('finished');

    const result = await service.getSession(session.sessionToken);

    expect(result.event.status).toBe('finished');
    expect(photoRepository.find).toHaveBeenCalled();
  });

  it('should bypass a cached session when the cached response still contains a GIF', async () => {
    const session = {
      id: 7,
      sessionToken: '9abfe43e-30d9-4614-a0b2-c4ef6ed3a76f',
      eventId: 12,
      status: 'complete',
      photoCount: 2,
      event: {
        id: 12,
        token: '6f01177a-d7ef-4342-a6e1-618da5230a06',
        honoreesNames: 'Alex y Sam',
        serviceStartsAt: new Date('2026-05-04T12:00:00.000Z'),
        albumPhrase: 'Nuestro album',
        eventTheme: null,
      },
    } as Session;
    const readyPhotos = [
      {
        id: 1,
        storagePath: 'photobooth/12/uuid-123.jpg',
        publicUrl: 'https://public.example/local/photobooth/12/uuid-123.jpg',
        minimizedPublicUrl: 'https://public.example/local/photobooth/12/minimized/uuid-123.jpg',
      },
      {
        id: 2,
        storagePath: 'photobooth/12/uuid-123.gif',
        publicUrl: 'https://public.example/local/photobooth/12/uuid-123.gif',
      },
    ] as Photo[];

    sessionRepository.findOne.mockResolvedValue(session);
    cache.getSession.mockReturnValue({
      sessionToken: session.sessionToken,
      status: 'complete',
      photos: [
        {
          url: 'https://public.example/local/photobooth/12/uuid-123.gif',
          position: 2,
        },
      ],
      event: {
        eventToken: session.event!.token,
        honoreesNames: session.event!.honoreesNames!,
        date: 'cached',
        albumPhase: session.event!.albumPhrase!,
        eventTheme: null,
      },
    });
    photoRepository.find.mockResolvedValue(readyPhotos);
    eventsService.getPublicEventStatus.mockReturnValue(undefined);

    const result = await service.getSession(session.sessionToken);

    expect(result.photos).toEqual([
      {
        minimizedUrl: 'https://public.example/local/photobooth/12/minimized/uuid-123.jpg',
        url: 'https://public.example/local/photobooth/12/uuid-123.jpg',
        position: 1,
      },
    ]);
    expect(photoRepository.find).toHaveBeenCalled();
  });

  it('should prefer the minimized URL for the gallery cover photo', async () => {
    // Arrange
    const event = {
      id: 12,
      token: '6f01177a-d7ef-4342-a6e1-618da5230a06',
      serviceStartsAt: new Date('2026-05-04T12:00:00.000Z'),
      honoreesNames: 'Alex y Sam',
      albumPhrase: 'Nuestro album',
      eventTheme: null,
    };
    const sessions = [
      {
        id: 7,
        sessionToken: '9abfe43e-30d9-4614-a0b2-c4ef6ed3a76f',
        photoCount: 2,
      },
    ] as Session[];
    const coverPhotos = [
      {
        id: 2,
        sessionId: 7,
        storagePath: 'photobooth/12/uuid-123.gif',
        publicUrl: 'https://public.example/local/photobooth/12/uuid-123.gif',
      },
      {
        id: 1,
        sessionId: 7,
        storagePath: 'photobooth/12/uuid-123.jpg',
        publicUrl: 'https://public.example/local/photobooth/12/uuid-123.jpg',
        minimizedPublicUrl: 'https://public.example/local/photobooth/12/minimized/uuid-123.jpg',
      },
    ] as Photo[];
    const queryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue(coverPhotos),
    };

    eventsService.getByToken.mockResolvedValue(event);
    eventsService.getPublicEventStatus.mockReturnValue(undefined);
    sessionRepository.find.mockResolvedValue(sessions);
    photoRepository.createQueryBuilder.mockReturnValue(queryBuilder);

    // Act
    const result = await service.getGallery(event.token);

    // Assert
    expect(result.event.status).toBeUndefined();
    expect(result.sessions).toEqual([
      {
        sessionToken: '9abfe43e-30d9-4614-a0b2-c4ef6ed3a76f',
        coverPhoto: 'https://public.example/local/photobooth/12/minimized/uuid-123.jpg',
        photoCount: 2,
      },
    ]);
  });

  it('should include sessions with ready photos even when the session is not completed and photoCount is stale', async () => {
    // Arrange
    const event = {
      id: 12,
      token: '6f01177a-d7ef-4342-a6e1-618da5230a06',
      serviceStartsAt: new Date('2026-05-04T12:00:00.000Z'),
      honoreesNames: 'Alex y Sam',
      albumPhrase: 'Nuestro album',
      eventTheme: null,
    };
    const sessions = [
      {
        id: 7,
        sessionToken: '9abfe43e-30d9-4614-a0b2-c4ef6ed3a76f',
        status: 'active',
        photoCount: 0,
      },
    ] as Session[];
    const coverPhotos = [
      {
        id: 1,
        sessionId: 7,
        storagePath: 'photobooth/12/uuid-123.jpg',
        publicUrl: 'https://public.example/local/photobooth/12/uuid-123.jpg',
        minimizedPublicUrl: 'https://public.example/local/photobooth/12/minimized/uuid-123.jpg',
      },
    ] as Photo[];
    const queryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue(coverPhotos),
    };

    eventsService.getByToken.mockResolvedValue(event);
    eventsService.getPublicEventStatus.mockReturnValue(undefined);
    sessionRepository.find.mockResolvedValue(sessions);
    photoRepository.createQueryBuilder.mockReturnValue(queryBuilder);

    // Act
    const result = await service.getGallery(event.token);

    // Assert
    expect(sessionRepository.find).toHaveBeenCalledWith({
      where: { eventId: event.id },
      order: { createdAt: 'DESC' },
    });
    expect(result.sessions).toEqual([
      {
        sessionToken: '9abfe43e-30d9-4614-a0b2-c4ef6ed3a76f',
        coverPhoto: 'https://public.example/local/photobooth/12/minimized/uuid-123.jpg',
        photoCount: 1,
      },
    ]);
  });

  it('should fallback to the original URL when a minimized gallery cover is missing', async () => {
    // Arrange
    const event = {
      id: 12,
      token: '6f01177a-d7ef-4342-a6e1-618da5230a06',
      serviceStartsAt: new Date('2026-05-04T12:00:00.000Z'),
      honoreesNames: 'Alex y Sam',
      albumPhrase: 'Nuestro album',
      eventTheme: null,
    };
    const sessions = [
      {
        id: 7,
        sessionToken: '9abfe43e-30d9-4614-a0b2-c4ef6ed3a76f',
        status: 'active',
        photoCount: 0,
      },
    ] as Session[];
    const coverPhotos = [
      {
        id: 1,
        sessionId: 7,
        storagePath: 'photobooth/12/uuid-123.jpg',
        publicUrl: 'https://public.example/local/photobooth/12/uuid-123.jpg',
        minimizedPublicUrl: null,
      },
    ] as Photo[];
    const queryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue(coverPhotos),
    };

    eventsService.getByToken.mockResolvedValue(event);
    eventsService.getPublicEventStatus.mockReturnValue(undefined);
    sessionRepository.find.mockResolvedValue(sessions);
    photoRepository.createQueryBuilder.mockReturnValue(queryBuilder);

    // Act
    const result = await service.getGallery(event.token);

    // Assert
    expect(result.sessions).toEqual([
      {
        sessionToken: '9abfe43e-30d9-4614-a0b2-c4ef6ed3a76f',
        coverPhoto: 'https://public.example/local/photobooth/12/uuid-123.jpg',
        photoCount: 1,
      },
    ]);
  });

  it('should not return coverPhotoMinimized in gallery session items', async () => {
    // Arrange
    const event = {
      id: 12,
      token: '6f01177a-d7ef-4342-a6e1-618da5230a06',
      serviceStartsAt: new Date('2026-05-04T12:00:00.000Z'),
      honoreesNames: 'Alex y Sam',
      albumPhrase: 'Nuestro album',
      eventTheme: null,
    };
    const sessions = [
      {
        id: 7,
        sessionToken: '9abfe43e-30d9-4614-a0b2-c4ef6ed3a76f',
        photoCount: 1,
      },
    ] as Session[];
    const coverPhotos = [
      {
        id: 1,
        sessionId: 7,
        storagePath: 'photobooth/12/uuid-123.jpg',
        publicUrl: 'https://public.example/local/photobooth/12/uuid-123.jpg',
        minimizedPublicUrl: 'https://public.example/local/photobooth/12/minimized/uuid-123.jpg',
      },
    ] as Photo[];
    const queryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue(coverPhotos),
    };

    eventsService.getByToken.mockResolvedValue(event);
    eventsService.getPublicEventStatus.mockReturnValue(undefined);
    sessionRepository.find.mockResolvedValue(sessions);
    photoRepository.createQueryBuilder.mockReturnValue(queryBuilder);

    // Act
    const result = await service.getGallery(event.token);

    // Assert
    expect(result.sessions[0]).not.toHaveProperty('coverPhotoMinimized');
  });

  it('should return event.status finished in the gallery response after the cutoff', async () => {
    const event = {
      id: 12,
      token: '6f01177a-d7ef-4342-a6e1-618da5230a06',
      serviceStartsAt: new Date('2026-05-04T12:00:00.000Z'),
      honoreesNames: 'Alex y Sam',
      albumPhrase: 'Nuestro album',
      eventTheme: null,
    };
    const queryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    };

    eventsService.getByToken.mockResolvedValue(event);
    eventsService.getPublicEventStatus.mockReturnValue('finished');
    sessionRepository.find.mockResolvedValue([]);
    photoRepository.createQueryBuilder.mockReturnValue(queryBuilder);

    const result = await service.getGallery(event.token);

    expect(result.event.status).toBe('finished');
  });

  it('should report the gallery event as finished when the contract has no EVENT booking, even though the legacy event.serviceStartsAt is recent', async () => {
    const event = {
      id: 12,
      contractId: 99,
      token: '6f01177a-d7ef-4342-a6e1-618da5230a06',
      serviceStartsAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      honoreesNames: 'Alex y Sam',
      albumPhrase: 'Nuestro album',
      eventTheme: null,
    };
    const queryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    };

    eventsService.getByToken.mockResolvedValue(event);
    eventsService.findEventBooking.mockResolvedValue(null);
    eventsService.getPublicEventStatus.mockImplementation((booking) =>
      booking == null ? 'finished' : 'active',
    );
    sessionRepository.find.mockResolvedValue([]);
    photoRepository.createQueryBuilder.mockReturnValue(queryBuilder);

    const result = await service.getGallery(event.token);

    expect(eventsService.findEventBooking).toHaveBeenCalledWith(99);
    expect(result.event.status).toBe('finished');
    expect(result.event.date).toBe('');
  });

  it('should take the gallery event date from the EVENT booking, not the legacy event.serviceStartsAt', async () => {
    const bookingStart = new Date('2026-07-01T15:00:00.000Z');
    const event = {
      id: 12,
      contractId: 99,
      token: '6f01177a-d7ef-4342-a6e1-618da5230a06',
      serviceStartsAt: new Date('2020-01-01T00:00:00.000Z'),
      honoreesNames: 'Alex y Sam',
      albumPhrase: 'Nuestro album',
      eventTheme: null,
    };
    const queryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    };

    eventsService.getByToken.mockResolvedValue(event);
    eventsService.findEventBooking.mockResolvedValue({ serviceStartsAt: bookingStart });
    eventsService.getPublicEventStatus.mockReturnValue('active');
    sessionRepository.find.mockResolvedValue([]);
    photoRepository.createQueryBuilder.mockReturnValue(queryBuilder);

    const result = await service.getGallery(event.token);

    expect(result.event.date).toBe(
      formatDateTimeInTimeZone(bookingStart, 'America/Mexico_City'),
    );
  });

  it('should return an empty gallery cover photo when only GIF assets exist', async () => {
    // Arrange
    const event = {
      id: 12,
      token: '6f01177a-d7ef-4342-a6e1-618da5230a06',
      serviceStartsAt: new Date('2026-05-04T12:00:00.000Z'),
      honoreesNames: 'Alex y Sam',
      albumPhrase: 'Nuestro album',
      eventTheme: null,
    };
    const sessions = [
      {
        id: 7,
        sessionToken: '9abfe43e-30d9-4614-a0b2-c4ef6ed3a76f',
        photoCount: 1,
      },
    ] as Session[];
    const coverPhotos = [
      {
        id: 2,
        sessionId: 7,
        storagePath: 'photobooth/12/uuid-123.gif',
        publicUrl: 'https://public.example/local/photobooth/12/uuid-123.gif',
      },
    ] as Photo[];
    const queryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue(coverPhotos),
    };

    eventsService.getByToken.mockResolvedValue(event);
    eventsService.getPublicEventStatus.mockReturnValue(undefined);
    sessionRepository.find.mockResolvedValue(sessions);
    photoRepository.createQueryBuilder.mockReturnValue(queryBuilder);

    // Act
    const result = await service.getGallery(event.token);

    // Assert
    expect(result.sessions).toEqual([
      {
        sessionToken: '9abfe43e-30d9-4614-a0b2-c4ef6ed3a76f',
        coverPhoto: '',
        photoCount: 1,
      },
    ]);
  });

  it('should bypass a cached gallery when event.status became finished after caching', async () => {
    // Arrange
    const event = {
      id: 12,
      token: '6f01177a-d7ef-4342-a6e1-618da5230a06',
      serviceStartsAt: new Date('2026-05-04T12:00:00.000Z'),
      honoreesNames: 'Alex y Sam',
      albumPhrase: 'Nuestro album',
      eventTheme: null,
    };
    const sessions = [
      {
        id: 7,
        sessionToken: '9abfe43e-30d9-4614-a0b2-c4ef6ed3a76f',
        photoCount: 2,
      },
    ] as Session[];
    const coverPhotos = [
      {
        id: 1,
        sessionId: 7,
        storagePath: 'photobooth/12/uuid-123.jpg',
        publicUrl: 'https://public.example/local/photobooth/12/uuid-123.jpg',
        minimizedPublicUrl: 'https://public.example/local/photobooth/12/minimized/uuid-123.jpg',
      },
    ] as Photo[];
    const queryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue(coverPhotos),
    };

    eventsService.getByToken.mockResolvedValue(event);
    eventsService.getPublicEventStatus.mockReturnValue('finished');
    cache.getGallery.mockReturnValue({
      event: {
        eventToken: event.token,
        honoreesNames: event.honoreesNames,
        date: 'cached',
        albumPhase: event.albumPhrase,
        eventTheme: null,
      },
      sessions: [
        {
          sessionToken: '9abfe43e-30d9-4614-a0b2-c4ef6ed3a76f',
          coverPhoto: 'https://public.example/local/photobooth/12/uuid-123.jpg',
          photoCount: 2,
        },
      ],
    });
    sessionRepository.find.mockResolvedValue(sessions);
    photoRepository.createQueryBuilder.mockReturnValue(queryBuilder);

    // Act
    const result = await service.getGallery(event.token);

    // Assert
    expect(result.event.status).toBe('finished');
    expect(photoRepository.createQueryBuilder).toHaveBeenCalled();
  });
});
