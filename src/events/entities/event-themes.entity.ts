import { Column, Entity, OneToMany } from 'typeorm';
import { BaseTimeEntity } from '../../common/entities/base-time.entity';
import type { PresetThemeTokensDto } from '../dto/event-theme/public-event-theme.dto';
import type { ThemeOverrides } from '../theme/theme.types';
import { Event } from './event.entity';

@Entity('event_themes')
export class EventTheme extends BaseTimeEntity {
  @Column('text')
  key!: string;

  @Column('text')
  name!: string;

  @Column('jsonb', { nullable: true })
  tokens: PresetThemeTokensDto | null = null;

  /** Typed image slots (decision R2); replaces the legacy free-form map. */
  @Column('jsonb', { nullable: true })
  images: ThemeOverrides['images'] | null = null;

  @OneToMany(() => Event, (event) => event.eventTheme)
  events?: Event[];
}
