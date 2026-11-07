import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';

import { BaseTimeEntity } from '../../common/entities/base-time.entity';
import { Session } from './session.entity';

/**
 * A guest's boomerang / slow-motion clip. Deliberately separate from `photos`:
 * it never counts toward `photoCount` and removing this table leaves photos untouched.
 * A session has at most one live video.
 */
@Entity('session_videos')
@Index('UQ_session_videos_session_id', ['sessionId'], {
  unique: true,
  where: 'deleted_at IS NULL',
})
export class SessionVideo extends BaseTimeEntity {
  @Column('integer', { name: 'session_id' })
  sessionId!: number;

  @Column('varchar', { name: 'storage_path', length: 512 })
  storagePath!: string;

  @Column('varchar', { name: 'poster_storage_path', length: 512 })
  posterStoragePath!: string;

  @Column('varchar', { name: 'mime', length: 100, default: 'video/mp4' })
  mime!: string;

  @Column('integer', { name: 'duration_ms', nullable: true })
  durationMs!: number | null;

  @ManyToOne(() => Session, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'session_id' })
  session?: Session | null;
}
