import { Entity, Column, ManyToOne, JoinColumn, Index, Check } from 'typeorm';
import { Event } from './event.entity';
import { Contract } from '../../contracts/entities/contract.entity';
import { BaseTimeEntity } from '../../common/entities/base-time.entity';
import { AnalyticsSource } from '../analytics/enums/analytics-source.enum';
import { RESERVATION_ANALYTICS_SOURCE } from '../analytics/enums/reservation-analytics-action.enum';

@Entity('event_analytics')
@Index('idx_ea_event_action_source', ['eventToken', 'action', 'source'])
@Index('idx_ea_contract_action', ['contractId', 'action'])
@Check('chk_ea_event_or_contract', '"event_token" IS NOT NULL OR "contract_id" IS NOT NULL')
export class EventAnalytic extends BaseTimeEntity {
  @Column({ name: 'event_token', type: 'uuid', nullable: true })
  eventToken: string | null;

  @ManyToOne(() => Event, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'event_token', referencedColumnName: 'token' })
  event: Event | null;

  @Column({ name: 'contract_id', type: 'int', nullable: true })
  contractId: number | null;

  @ManyToOne(() => Contract, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'contract_id' })
  contract: Contract | null;

  @Column({ name: 'session_id', type: 'uuid', nullable: true })
  sessionId: string | null;

  @Column({ length: 64 })
  action: string;

  @Column({ type: 'varchar', length: 32, nullable: true })
  source: AnalyticsSource | typeof RESERVATION_ANALYTICS_SOURCE | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  surface: string | null;

  @Column({ name: 'item_type', type: 'varchar', length: 16, nullable: true })
  itemType: string | null;

  @Column({ type: 'varchar', length: 32, nullable: true })
  variant: string | null;

  @Column({ name: 'item_index', type: 'int', nullable: true })
  itemIndex: number | null;

  @Column({ name: 'item_count', type: 'int', nullable: true })
  itemCount: number | null;

  @Column({ name: 'photo_count', type: 'int', nullable: true })
  photoCount: number | null;

  @Column({ name: 'person_count', type: 'int', nullable: true })
  personCount: number | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  @Column({ name: 'user_agent', type: 'text', nullable: true })
  userAgent: string | null;
}
