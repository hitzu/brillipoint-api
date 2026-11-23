import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventAnalytic } from '../entities/event-analytic.entity';
import { TrackActionDto } from './dto/track-action.dto';
import { TrackContractActionDto } from './dto/track-contract-action.dto';
import { Contract } from '../../contracts/entities/contract.entity';
import { AnalyticsAction } from './enums/analytics-action.enum';
import { AnalyticsSource } from './enums/analytics-source.enum';
import { RESERVATION_ANALYTICS_SOURCE } from './enums/reservation-analytics-action.enum';
import { EXCEPTION_RESPONSE } from '../../config/errors/exception-response.config';

type AnalyticsSummaryRow = {
  action: string;
  count: string;
};

type AnalyticsSourceSummaryRow = {
  action: AnalyticsAction;
  source: AnalyticsSource;
  count: string;
};

type SourceActionBreakdown = Record<AnalyticsSource, number> & {
  total: number;
};

const SOURCE_SUMMARY_ACTIONS = [
  AnalyticsAction.GALLERY_OPENED,
  AnalyticsAction.SESSION_OPENED,
];

const TRACKED_SOURCES = [
  AnalyticsSource.QR_FIESTA,
  AnalyticsSource.SESSION_TO_FIESTA,
  AnalyticsSource.QR_SESSION,
  AnalyticsSource.QR_PRINTED,
  AnalyticsSource.FIESTA_TO_SESSION,
];

@Injectable()
export class EventAnalyticsService {
  constructor(
    @InjectRepository(EventAnalytic)
    private readonly repo: Repository<EventAnalytic>,
  ) { }

  async track(dto: TrackActionDto, userAgent: string): Promise<void> {
    this.assertTrackRequirements(dto);

    const track = this.repo.create({
      eventToken: dto.eventToken,
      sessionId: dto.sessionId ?? null,
      action: dto.action,
      source: dto.source ?? null,
      surface: dto.surface ?? null,
      itemType: dto.itemType ?? null,
      variant: dto.variant ?? null,
      itemIndex: dto.itemIndex ?? null,
      itemCount: dto.itemCount ?? null,
      photoCount: dto.photoCount ?? null,
      personCount: dto.personCount ?? null,
      metadata: dto.metadata ?? null,
      userAgent: userAgent ?? null,
    });

    await this.repo.save(track)
  }

  async trackForContract(
    token: string,
    dto: TrackContractActionDto,
    userAgent: string,
  ): Promise<void> {
    const contract = await this.repo.manager.findOne(Contract, {
      where: { token },
      select: { id: true },
    });
    if (!contract) {
      throw new NotFoundException('Contract not found');
    }

    await this.repo.save(
      this.repo.create({
        contractId: contract.id,
        sessionId: dto.sessionId ?? null,
        action: dto.action,
        source: RESERVATION_ANALYTICS_SOURCE,
        surface: dto.surface ?? null,
        metadata: dto.metadata ?? null,
        userAgent: userAgent ?? null,
      }),
    );
  }

  async getSummary(eventToken: string) {
    const rows = await this.repo
      .createQueryBuilder('ea')
      .select('ea.action', 'action')
      .addSelect('COUNT(*)', 'count')
      .where('ea.event_token = :eventToken', { eventToken })
      .groupBy('ea.action')
      .getRawMany<AnalyticsSummaryRow>();

    const byAction: Record<string, number> = Object.fromEntries(
      rows.map((r) => [r.action, parseInt(r.count, 10)]),
    );

    const downloads = byAction['download'] || 0;
    const pct = (n: number, d: number) =>
      d ? `${Math.round((n / d) * 100)}%` : '0%';

    return {
      eventToken,
      totalActions: rows.reduce((acc, r) => acc + parseInt(r.count, 10), 0),
      byAction,
      conversionRates: {
        download_to_cta_modal: pct(
          byAction['cta_whatsapp_modal'] || 0,
          downloads,
        ),
        download_to_cta_post_download: pct(
          byAction['cta_whatsapp_post_download'] || 0,
          downloads,
        ),
        share_open_to_executed: pct(
          byAction['share_confirm_executed'] || 0,
          byAction['share_confirm_open'] || 0,
        ),
      },
    };
  }

  async getActions(eventToken: string, page: number, limit: number) {
    const [data, total] = await this.repo.findAndCount({
      where: { eventToken },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data, total, page, limit };
  }

  async getSourceSummary(eventToken: string) {
    const rows = await this.repo
      .createQueryBuilder('ea')
      .select('ea.action', 'action')
      .addSelect('ea.source', 'source')
      .addSelect('COUNT(*)', 'count')
      .where('ea.event_token = :eventToken', { eventToken })
      .andWhere('ea.action IN (:...actions)', { actions: SOURCE_SUMMARY_ACTIONS })
      .andWhere('ea.source IN (:...sources)', { sources: TRACKED_SOURCES })
      .groupBy('ea.action')
      .addGroupBy('ea.source')
      .getRawMany<AnalyticsSourceSummaryRow>();

    const actions = {
      [AnalyticsAction.GALLERY_OPENED]: this.buildEmptySourceBreakdown(),
      [AnalyticsAction.SESSION_OPENED]: this.buildEmptySourceBreakdown(),
    };

    for (const row of rows) {
      const action = actions[row.action];
      if (!action || !row.source) continue;

      const count = parseInt(row.count, 10);
      action[row.source] = count;
      action.total += count;
    }

    return { eventToken, actions };
  }

  async getExpired(eventToken: string) {
    const rows = await this.repo.manager.query<{
      surface: string;
      late_arrivals: string;
      messaged: string;
      recovery_requested: string;
    }[]>(`
      SELECT
        surface,
        COUNT(*) FILTER (WHERE action LIKE '%_expired_viewed') AS late_arrivals,
        COUNT(*) FILTER (WHERE action LIKE '%_expired_message_clicked') AS messaged,
        COUNT(*) FILTER (WHERE action LIKE '%_expired_recovery_requested') AS recovery_requested
      FROM event_analytics
      WHERE event_token = $1
        AND action LIKE '%_expired_%'
      GROUP BY surface
    `, [eventToken]);

    return {
      eventToken,
      surfaces: rows.map((r) => ({
        surface: r.surface,
        lateArrivals: parseInt(r.late_arrivals, 10),
        messaged: parseInt(r.messaged, 10),
        recoveryRequested: parseInt(r.recovery_requested, 10),
      })),
    };
  }

  private assertTrackRequirements(dto: TrackActionDto): void {
    const requiresSource =
      dto.action === AnalyticsAction.GALLERY_OPENED ||
      dto.action === AnalyticsAction.SESSION_OPENED;

    if (requiresSource && !dto.source) {
      throw new BadRequestException(EXCEPTION_RESPONSE.REQUIRED_SOURCE,);
    }

    if (dto.action === AnalyticsAction.SESSION_OPENED && !dto.sessionId) {
      throw new BadRequestException(EXCEPTION_RESPONSE.SESSION_ID_REQUIRED);
    }

    const requiresSessionId =
      dto.action === AnalyticsAction.SESSION_STARTED ||
      dto.action === AnalyticsAction.SESSION_COMPLETED;

    if (requiresSessionId && !dto.sessionId) {
      throw new BadRequestException(EXCEPTION_RESPONSE.SESSION_ID_REQUIRED);
    }

    const SESSION_EXPIRED_ACTIONS = [
      AnalyticsAction.SESSION_EXPIRED_VIEWED,
      AnalyticsAction.SESSION_EXPIRED_MESSAGE_CLICKED,
      AnalyticsAction.SESSION_EXPIRED_RECOVERY_REQUESTED,
    ];

    if (SESSION_EXPIRED_ACTIONS.includes(dto.action as AnalyticsAction) && !dto.sessionId) {
      throw new BadRequestException(EXCEPTION_RESPONSE.SESSION_ID_REQUIRED);
    }
  }

  private buildEmptySourceBreakdown(): SourceActionBreakdown {
    return {
      [AnalyticsSource.QR_FIESTA]: 0,
      [AnalyticsSource.QR_INSPIRACION]: 0,
      [AnalyticsSource.QR_SESSION]: 0,
      [AnalyticsSource.QR_PRINTED]: 0,
      [AnalyticsSource.FIESTA_TO_SESSION]: 0,
      [AnalyticsSource.SESSION_TO_FIESTA]: 0,
      [AnalyticsSource.PHOTOBOOTH]: 0,
      [AnalyticsSource.ADMIN_PAGE]: 0,
      total: 0,
    };
  }
}
