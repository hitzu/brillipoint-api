import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { faker } from '@faker-js/faker';
import { AppDataSource as TestDataSource } from '../../config/database/data-source';
import { EventFactory } from '../../../test/factories/events/event.factory';
import { EventAnalyticFactory } from '../../../test/factories/event-analytics/event-analytic.factory';
import { EventAnalytic } from '../entities/event-analytic.entity';
import { EventAnalyticsService } from './event-analytics.service';
import { AnalyticsAction } from './enums/analytics-action.enum';
import { AnalyticsSource } from './enums/analytics-source.enum';
import { ReservationAnalyticsAction } from './enums/reservation-analytics-action.enum';
import { ContractFactory } from '../../../test/factories/contracts/contract.factory';
import { NotFoundException } from '@nestjs/common';

describe('EventAnalyticsService', () => {
  let service: EventAnalyticsService;
  let eventFactory: EventFactory;
  let analyticFactory: EventAnalyticFactory;
  let contractFactory: ContractFactory;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventAnalyticsService,
        {
          provide: getRepositoryToken(EventAnalytic),
          useValue: TestDataSource.getRepository(EventAnalytic),
        },
      ],
    }).compile();

    service = module.get<EventAnalyticsService>(EventAnalyticsService);
    eventFactory = new EventFactory(TestDataSource);
    analyticFactory = new EventAnalyticFactory(TestDataSource);
    contractFactory = new ContractFactory(TestDataSource);
  });

  describe('track', () => {
    it('should persist an analytics record', async () => {
      const event = await eventFactory.create();

      await service.track(
        {
          action: AnalyticsAction.GALLERY_OPENED,
          eventToken: event.token,
          source: AnalyticsSource.QR_FIESTA,
        },
        'Mozilla/5.0 Test',
      );

      const repo = TestDataSource.getRepository(EventAnalytic);
      const rows = await repo.find({ where: { eventToken: event.token } });

      expect(rows).toHaveLength(1);
      expect(rows[0].action).toBe(AnalyticsAction.GALLERY_OPENED);
      expect(rows[0].source).toBe(AnalyticsSource.QR_FIESTA);
      expect(rows[0].sessionId).toBeNull();
      expect(rows[0].userAgent).toBe('Mozilla/5.0 Test');
    });

    it('should require sessionId for session_opened', async () => {
      const event = await eventFactory.create();

      await expect(
        service.track(
          {
            action: AnalyticsAction.SESSION_OPENED,
            eventToken: event.token,
            source: AnalyticsSource.FIESTA_TO_SESSION,
          },
          'Mozilla/5.0 Test',
        ),
      ).rejects.toThrow('sessionId is required for this event');
    });

    it('should persist metadata when provided', async () => {
      const event = await eventFactory.create();
      const metadata = { photoId: 'abc-123', format: 'png' };

      await service.track(
        {
          action: AnalyticsAction.CUSTOMIZE,
          eventToken: event.token,
          metadata,
        },
        'TestAgent',
      );

      const repo = TestDataSource.getRepository(EventAnalytic);
      const [row] = await repo.find({ where: { eventToken: event.token } });

      expect(row.metadata).toEqual(metadata);
    });

    it('should default sessionId and metadata to null when not provided', async () => {
      const event = await eventFactory.create();

      await service.track(
        {
          action: AnalyticsAction.DEDICATE,
          eventToken: event.token,
        },
        'TestAgent',
      );

      const repo = TestDataSource.getRepository(EventAnalytic);
      const [row] = await repo.find({ where: { eventToken: event.token } });

      expect(row.sessionId).toBeNull();
      expect(row.source).toBeNull();
      expect(row.metadata).toBeNull();
    });

    it('should allow multiple tracks for the same event', async () => {
      const event = await eventFactory.create();

      await service.track(
        { action: AnalyticsAction.DOWNLOAD, eventToken: event.token },
        'Agent1',
      );
      await service.track(
        { action: AnalyticsAction.DOWNLOAD, eventToken: event.token },
        'Agent2',
      );
      await service.track(
        { action: AnalyticsAction.CTA_WA_MODAL, eventToken: event.token },
        'Agent3',
      );

      const repo = TestDataSource.getRepository(EventAnalytic);
      const rows = await repo.find({ where: { eventToken: event.token } });

      expect(rows).toHaveLength(3);
    });
  });

  describe('getSummary', () => {
    it('should return zeroed summary when no actions exist', async () => {
      const event = await eventFactory.create();

      const result = await service.getSummary(event.token);

      expect(result.eventToken).toBe(event.token);
      expect(result.totalActions).toBe(0);
      expect(result.byAction).toEqual({});
    });

    it('should return correct counts grouped by action', async () => {
      const event = await eventFactory.create();

      await analyticFactory.createForEvent(
        event.token,
        AnalyticsAction.DOWNLOAD,
      );
      await analyticFactory.createForEvent(
        event.token,
        AnalyticsAction.DOWNLOAD,
      );
      await analyticFactory.createForEvent(
        event.token,
        AnalyticsAction.DOWNLOAD,
      );
      await analyticFactory.createForEvent(
        event.token,
        AnalyticsAction.CTA_WA_MODAL,
      );
      await analyticFactory.createForEvent(
        event.token,
        AnalyticsAction.CUSTOMIZE,
      );

      const result = await service.getSummary(event.token);

      expect(result.totalActions).toBe(5);
      expect(result.byAction['download']).toBe(3);
      expect(result.byAction['cta_whatsapp_modal']).toBe(1);
      expect(result.byAction['customize']).toBe(1);
    });

    it('should calculate conversion rates correctly', async () => {
      const event = await eventFactory.create();

      // 10 downloads
      for (let i = 0; i < 10; i++) {
        await analyticFactory.createForEvent(
          event.token,
          AnalyticsAction.DOWNLOAD,
        );
      }
      // 3 cta_whatsapp_modal (30% of downloads)
      for (let i = 0; i < 3; i++) {
        await analyticFactory.createForEvent(
          event.token,
          AnalyticsAction.CTA_WA_MODAL,
        );
      }
      // 2 cta_whatsapp_post_download (20% of downloads)
      for (let i = 0; i < 2; i++) {
        await analyticFactory.createForEvent(
          event.token,
          AnalyticsAction.CTA_WA_POST_DOWNLOAD,
        );
      }
      // 5 share_confirm_open, 3 share_confirm_executed (60%)
      for (let i = 0; i < 5; i++) {
        await analyticFactory.createForEvent(
          event.token,
          AnalyticsAction.SHARE_CONFIRM_OPEN,
        );
      }
      for (let i = 0; i < 3; i++) {
        await analyticFactory.createForEvent(
          event.token,
          AnalyticsAction.SHARE_CONFIRM_EXECUTED,
        );
      }

      const result = await service.getSummary(event.token);

      expect(result.conversionRates.download_to_cta_modal).toBe('30%');
      expect(result.conversionRates.download_to_cta_post_download).toBe('20%');
      expect(result.conversionRates.share_open_to_executed).toBe('60%');
    });

    it('should return 0% conversion when denominator is zero', async () => {
      const event = await eventFactory.create();

      // Only modal clicks, no downloads
      await analyticFactory.createForEvent(
        event.token,
        AnalyticsAction.CTA_WA_MODAL,
      );

      const result = await service.getSummary(event.token);

      expect(result.conversionRates.download_to_cta_modal).toBe('0%');
      expect(result.conversionRates.download_to_cta_post_download).toBe('0%');
    });

    it('should not mix actions from different events', async () => {
      const event1 = await eventFactory.create();
      const event2 = await eventFactory.create();

      await analyticFactory.createForEvent(
        event1.token,
        AnalyticsAction.DOWNLOAD,
      );
      await analyticFactory.createForEvent(
        event1.token,
        AnalyticsAction.DOWNLOAD,
      );
      await analyticFactory.createForEvent(
        event2.token,
        AnalyticsAction.DOWNLOAD,
      );

      const result1 = await service.getSummary(event1.token);
      const result2 = await service.getSummary(event2.token);

      expect(result1.totalActions).toBe(2);
      expect(result2.totalActions).toBe(1);
    });
  });

  describe('getActions', () => {
    it('should return paginated results ordered by createdAt DESC', async () => {
      const event = await eventFactory.create();

      await analyticFactory.createForEvent(
        event.token,
        AnalyticsAction.DOWNLOAD,
      );
      await analyticFactory.createForEvent(
        event.token,
        AnalyticsAction.CUSTOMIZE,
      );
      await analyticFactory.createForEvent(
        event.token,
        AnalyticsAction.DEDICATE,
      );

      const result = await service.getActions(event.token, 1, 2);

      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(3);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(2);
    });

    it('should return second page correctly', async () => {
      const event = await eventFactory.create();

      await analyticFactory.createForEvent(
        event.token,
        AnalyticsAction.DOWNLOAD,
      );
      await analyticFactory.createForEvent(
        event.token,
        AnalyticsAction.CUSTOMIZE,
      );
      await analyticFactory.createForEvent(
        event.token,
        AnalyticsAction.DEDICATE,
      );

      const result = await service.getActions(event.token, 2, 2);

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(3);
      expect(result.page).toBe(2);
    });

    it('should return empty data when no actions exist', async () => {
      const event = await eventFactory.create();

      const result = await service.getActions(event.token, 1, 50);

      expect(result.data).toEqual([]);
      expect(result.total).toBe(0);
    });

    it('should only return actions for the specified event', async () => {
      const event1 = await eventFactory.create();
      const event2 = await eventFactory.create();

      await analyticFactory.createForEvent(
        event1.token,
        AnalyticsAction.DOWNLOAD,
      );
      await analyticFactory.createForEvent(
        event2.token,
        AnalyticsAction.DOWNLOAD,
      );

      const result = await service.getActions(event1.token, 1, 50);

      expect(result.total).toBe(1);
      expect(result.data[0].eventToken).toBe(event1.token);
    });
  });

  describe('getSourceSummary', () => {
    it('should group openings by action and source', async () => {
      const event = await eventFactory.create();

      await analyticFactory.createForEvent(event.token, AnalyticsAction.GALLERY_OPENED, {
        source: AnalyticsSource.QR_FIESTA,
      });
      await analyticFactory.createForEvent(event.token, AnalyticsAction.GALLERY_OPENED, {
        source: AnalyticsSource.QR_FIESTA,
      });
      await analyticFactory.createForEvent(event.token, AnalyticsAction.GALLERY_OPENED, {
        source: AnalyticsSource.SESSION_TO_FIESTA,
      });
      await analyticFactory.createForEvent(event.token, AnalyticsAction.SESSION_OPENED, {
        source: AnalyticsSource.FIESTA_TO_SESSION,
      });

      const result = await service.getSourceSummary(event.token);

      expect(result).toEqual({
        eventToken: event.token,
        actions: {
          gallery_opened: {
            qr_fiesta: 2,
            qr_inspiracion: 0,
            qr_session: 0,
            qr_printed: 0,
            fiesta_to_session: 0,
            session_to_fiesta: 1,
            photobooth: 0,
            admin_page: 0,
            total: 3,
          },
          session_opened: {
            qr_fiesta: 0,
            qr_inspiracion: 0,
            qr_session: 0,
            qr_printed: 0,
            fiesta_to_session: 1,
            session_to_fiesta: 0,
            photobooth: 0,
            admin_page: 0,
            total: 1,
          },
        },
      });
    });
  });

  describe('getExpired', () => {
    it('should return empty surfaces array when no expired events exist', async () => {
      // Arrange
      const event = await eventFactory.create();

      // Act
      const result = await service.getExpired(event.token);

      // Assert
      expect(result.eventToken).toBe(event.token);
      expect(result.surfaces).toEqual([]);
    });

    it('should count expired events grouped by surface', async () => {
      // Arrange
      const event = await eventFactory.create();
      const sessionId = faker.string.uuid();

      await analyticFactory.createForEvent(event.token, AnalyticsAction.SESSION_EXPIRED_VIEWED, {
        surface: 'session_expired',
        sessionId,
      });
      await analyticFactory.createForEvent(event.token, AnalyticsAction.SESSION_EXPIRED_MESSAGE_CLICKED, {
        surface: 'session_expired',
        sessionId,
      });
      await analyticFactory.createForEvent(event.token, AnalyticsAction.SESSION_EXPIRED_RECOVERY_REQUESTED, {
        surface: 'session_expired',
        sessionId,
      });

      // Act
      const result = await service.getExpired(event.token);

      // Assert
      expect(result.surfaces).toHaveLength(1);
      expect(result.surfaces[0]).toEqual({
        surface: 'session_expired',
        lateArrivals: 1,
        messaged: 1,
        recoveryRequested: 1,
      });
    });

    it('should separate session_expired and fiesta_expired surfaces', async () => {
      // Arrange
      const event = await eventFactory.create();
      const sessionId = faker.string.uuid();

      await analyticFactory.createForEvent(event.token, AnalyticsAction.SESSION_EXPIRED_VIEWED, {
        surface: 'session_expired',
        sessionId,
      });
      await analyticFactory.createForEvent(event.token, AnalyticsAction.FIESTA_EXPIRED_VIEWED, {
        surface: 'fiesta_expired',
        sessionId: null,
      });

      // Act
      const result = await service.getExpired(event.token);

      // Assert
      expect(result.surfaces).toHaveLength(2);
      const sessionSurface = result.surfaces.find((s) => s.surface === 'session_expired');
      const fiestaSurface = result.surfaces.find((s) => s.surface === 'fiesta_expired');
      expect(sessionSurface?.lateArrivals).toBe(1);
      expect(fiestaSurface?.lateArrivals).toBe(1);
    });

    it('should not include events from other events in the count', async () => {
      // Arrange
      const event1 = await eventFactory.create();
      const event2 = await eventFactory.create();

      await analyticFactory.createForEvent(event1.token, AnalyticsAction.SESSION_EXPIRED_VIEWED, {
        surface: 'session_expired',
      });
      await analyticFactory.createForEvent(event2.token, AnalyticsAction.SESSION_EXPIRED_VIEWED, {
        surface: 'session_expired',
      });

      // Act
      const result = await service.getExpired(event1.token);

      // Assert
      expect(result.surfaces).toHaveLength(1);
      expect(result.surfaces[0].lateArrivals).toBe(1);
    });
  });

  describe('trackForContract', () => {
    it('should persist a row owned by the contract with source reservation', async () => {
      // Arrange
      const contract = await contractFactory.create();
      const sessionId = faker.string.uuid();

      // Act
      await service.trackForContract(
        contract.token,
        {
          action: ReservationAnalyticsAction.SECTION_VIEWED,
          sessionId,
          surface: 'terms',
          metadata: { trigger: 'click' },
        },
        'Mozilla/5.0 Test',
      );

      // Assert
      const rows = await TestDataSource.getRepository(EventAnalytic).find({
        where: { contractId: contract.id },
      });
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        eventToken: null,
        action: 'reservation_section_viewed',
        source: 'reservation',
        sessionId,
        surface: 'terms',
        metadata: { trigger: 'click' },
        userAgent: 'Mozilla/5.0 Test',
      });
    });

    it('should reject an unknown contract token and store nothing', async () => {
      // Arrange
      const unknownToken = faker.string.uuid();

      // Act
      const act = service.trackForContract(
        unknownToken,
        { action: ReservationAnalyticsAction.VIEWED },
        'Mozilla/5.0 Test',
      );

      // Assert
      await expect(act).rejects.toThrow(NotFoundException);
      expect(await TestDataSource.getRepository(EventAnalytic).count()).toBe(0);
    });

    it('should not count contract rows in any event summary', async () => {
      // Arrange
      const event = await eventFactory.create();
      const contract = await contractFactory.create();
      await service.trackForContract(
        contract.token,
        { action: ReservationAnalyticsAction.VIEWED },
        'Mozilla/5.0 Test',
      );

      // Act
      const summary = await service.getSummary(event.token);

      // Assert
      expect(summary.totalActions).toBe(0);
    });
  });
});
