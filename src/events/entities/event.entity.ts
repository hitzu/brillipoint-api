import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToOne,
} from 'typeorm';

import { BaseTimeEntity } from '../../common/entities/base-time.entity';
import { UseDto } from '../../common/dto/use-dto.decorator';
import { BrandKit } from '../../brand-kits/entities/brand-kit.entity';
import { Contract } from '../../contracts/entities/contract.entity';
import { EventResponseDto } from '../dto/event-response.dto';
import type { JsonValue } from '../dto/json-value';
import type { ThemeOverrides } from '../theme/theme.types';
import { EventTheme } from './event-themes.entity';
import { EventType } from './event-type.entity';
import { ServiceType } from './service-type.entity';

@Entity('events')
@UseDto(EventResponseDto)
@Index('UQ_events_token', ['token'], { unique: true })
@Index('UQ_events_key', ['key'], { unique: true })
export class Event extends BaseTimeEntity {
  @Column('varchar', { length: 255, unique: true })
  key!: string;

  @Column('uuid', { unique: true })
  token!: string;

  @Column('integer', { name: 'contract_id' })
  contractId!: number;

  @Column('number', { name: 'event_type_id', nullable: true })
  eventTypeId!: number | null;

  /** @deprecated Use booking (v2 events) instead. Removed in phase 2. */
  @Column('integer', { name: 'service_type_id', nullable: true })
  serviceTypeId!: number | null;

  @Column('text', { name: 'honorees_names', nullable: true })
  honoreesNames!: string | null;

  @Column('text', { name: 'album_phrase', nullable: true })
  albumPhrase!: string | null;

  /** @deprecated Use booking (v2 events) instead. Removed in phase 2. */
  @Column('varchar', { name: 'venue_name', length: 255, nullable: true })
  venueName!: string | null;

  /** @deprecated Use booking (v2 events) instead. Removed in phase 2. */
  @Column('text', { name: 'service_location_url', nullable: true })
  serviceLocationUrl!: string | null;

  /** @deprecated Use the contract's EVENT booking (v2 events) instead. Removed in phase 2. */
  @Column('timestamptz', { name: 'service_starts_at', nullable: true })
  serviceStartsAt!: Date | null;

  /** @deprecated Use booking (v2 events) instead. Removed in phase 2. */
  @Column('timestamptz', { name: 'service_ends_at', nullable: true })
  serviceEndsAt!: Date | null;

  @Column('varchar', { name: 'delegate_name', length: 255, nullable: true })
  delegateName!: string | null;

  @Column('integer', { name: 'photo_count', default: 2 })
  photoCount!: number;

  @Column('number', { name: 'event_theme_id', nullable: true })
  eventThemeId!: number | null;

  /** @deprecated Use booking (v2 events) instead. Removed in phase 2. */
  @Column('varchar', {
    name: 'print_template',
    length: 50,
    default: 'polaroid_2',
  })
  printTemplate!: string;

  /** @deprecated Use booking (v2 events) instead. Removed in phase 2. */
  @Column('jsonb', { name: 'print_templates', nullable: true })
  printTemplates!: JsonValue;

  @Column('integer', { name: 'brand_kit_id', nullable: true })
  brandKitId!: number | null;

  /**
   * Per-event theme tweaks (see `ThemeOverrides` /
   * odd/tasks/theme-brand-kits.md). Merged last in the layered theme
   * resolution chain.
   */
  @Column('jsonb', { name: 'theme_overrides', nullable: true })
  themeOverrides!: ThemeOverrides | null;

  @ManyToOne(() => EventType, (eventType) => eventType.events)
  @JoinColumn({ name: 'event_type_id' })
  eventType?: EventType | null;

  /** Client theme kit (nullable: losing it falls back to the preset/default). */
  @ManyToOne(() => BrandKit, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'brand_kit_id' })
  brandKit?: BrandKit | null;

  /** @deprecated Use booking (v2 events) instead. Removed in phase 2. */
  @ManyToOne(() => ServiceType, (serviceType) => serviceType.events)
  @JoinColumn({ name: 'service_type_id' })
  serviceType?: ServiceType | null;

  @OneToOne(() => Contract, (contract) => contract.event, { nullable: true })
  @JoinColumn({ name: 'contract_id' })
  contract?: Contract | null;

  @ManyToOne(() => EventTheme, (eventTheme) => eventTheme.events)
  @JoinColumn({ name: 'event_theme_id' })
  eventTheme?: EventTheme | null;
}
