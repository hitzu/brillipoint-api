import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { SessionVideoItemDto } from './session-video.dto';

// ── Existing DTOs (legacy endpoints) ─────────────────────────────────────────

export class CreateSessionResponseDto {
  @ApiProperty()
  id_session!: string;

  @ApiProperty()
  event_token!: string;

  @ApiProperty()
  created_at!: Date;
}

export class SessionListItemDto {
  @ApiProperty()
  id_session!: string;

  @ApiProperty()
  created_at!: Date;

  @ApiProperty({ type: String, nullable: true })
  cover_url!: string | null;

  @ApiProperty()
  photo_count!: number;
}

export class ListSessionsResponseDto {
  @ApiProperty()
  event_token!: string;

  @ApiProperty()
  session_count!: number;

  @ApiProperty({ type: [SessionListItemDto] })
  sessions!: SessionListItemDto[];
}

export class SessionPhotoDto {
  @ApiProperty()
  photo_id!: number;

  @ApiProperty({ enum: ['processing', 'ready', 'error'] })
  status!: 'processing' | 'ready' | 'error';

  @ApiProperty({ type: String, nullable: true })
  url!: string | null;

  @ApiProperty()
  created_at!: Date;
}

export class SessionDetailResponseDto {
  @ApiProperty()
  id_session!: string;

  @ApiProperty()
  event_token!: string;

  @ApiProperty()
  allReady!: boolean;

  @ApiProperty({ type: [SessionPhotoDto] })
  photos!: SessionPhotoDto[];
}

// ── New DTOs (v2.1 endpoints) ─────────────────────────────────────────────────

export class SessionEventDto {
  @ApiProperty()
  eventToken!: string;

  @ApiProperty()
  honoreesNames!: string;

  @ApiProperty()
  date!: string;

  @ApiProperty()
  albumPhase!: string

  @ApiPropertyOptional({ enum: ['finished', 'active'] })
  status?: 'finished' | 'active';
}

export class SessionPhotoItemDto {
  @ApiProperty()
  url!: string;

  @ApiProperty()
  minimizedUrl!: string;

  @ApiProperty()
  position!: number;
}

export class SessionResponseDto {
  @ApiProperty()
  sessionToken!: string;

  @ApiProperty({ enum: ['active', 'complete'] })
  status!: 'active' | 'complete';

  @ApiProperty({ type: [SessionPhotoItemDto] })
  photos!: SessionPhotoItemDto[];

  @ApiProperty({ type: SessionEventDto })
  event!: SessionEventDto;

  @ApiPropertyOptional({
    type: [SessionVideoItemDto],
    description: 'Present only when the session has a video',
  })
  videos?: SessionVideoItemDto[];
}

export class GallerySessionItemDto {
  @ApiProperty()
  sessionToken!: string;

  @ApiProperty()
  coverPhoto!: string;

  @ApiProperty()
  photoCount!: number;

  @ApiPropertyOptional({
    type: [SessionVideoItemDto],
    description: 'Present only when the session has a video',
  })
  videos?: SessionVideoItemDto[];
}

export class GalleryResponseDto {
  @ApiProperty({ type: SessionEventDto })
  event!: SessionEventDto;

  @ApiProperty({ type: [GallerySessionItemDto] })
  sessions!: GallerySessionItemDto[];
}

export class ClearedSessionsCacheDto {
  @ApiProperty()
  sessions!: number;

  @ApiProperty()
  galleries!: number;
}

export class ClearSessionsCacheResponseDto {
  @ApiProperty()
  ok!: boolean;

  @ApiProperty({ type: ClearedSessionsCacheDto })
  cleared!: ClearedSessionsCacheDto;
}
