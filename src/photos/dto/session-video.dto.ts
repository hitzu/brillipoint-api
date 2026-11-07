import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

export class ConfirmSessionVideoDto {
  @ApiProperty({
    description: 'File id returned by POST /sessions/:sessionToken/videos/presigned',
    example: 'b5f4a6e2-3c1d-4f8a-9b1e-1a2b3c4d5e6f',
  })
  @IsUUID('4')
  fileId!: string;

  @ApiPropertyOptional({ description: 'Clip duration in milliseconds', example: 3000 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(600_000)
  durationMs?: number;
}

export class SessionVideoUploadTargetDto {
  @ApiProperty({ description: 'Signed URL to PUT the file directly to Supabase' })
  presignedUrl!: string;

  @ApiProperty({ description: 'Storage path (for reference)' })
  photoPath!: string;
}

export class SessionVideoPresignedResponseDto {
  @ApiProperty({ description: 'Use this in POST /sessions/:sessionToken/videos/confirm' })
  fileId!: string;

  @ApiProperty({ type: SessionVideoUploadTargetDto, description: 'The .mp4 clip' })
  video!: SessionVideoUploadTargetDto;

  @ApiProperty({ type: SessionVideoUploadTargetDto, description: 'The .jpg poster' })
  poster!: SessionVideoUploadTargetDto;
}
