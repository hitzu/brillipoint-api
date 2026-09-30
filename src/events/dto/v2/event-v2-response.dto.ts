import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import {
  IsDate,
  IsIn,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';
import { EventThemeDto } from '../event-theme/event-theme.dto';
import type { ThemeOverrides } from '../../theme/theme.types';

export class EventV2ResponseDto {
  @Expose()
  @ApiProperty()
  @IsNumber()
  id!: number;

  @Expose()
  @ApiProperty()
  @IsString()
  key!: string;

  @Expose()
  @ApiProperty()
  @IsString()
  token!: string;

  @Expose()
  @ApiProperty()
  @IsNumber()
  contractId!: number;

  @Expose()
  @ApiPropertyOptional({
    type: Number,
    description: 'Event type id',
    nullable: true,
  })
  @IsNumber()
  @IsOptional()
  eventTypeId?: number | null;

  @Expose()
  @ApiPropertyOptional({ nullable: true })
  @IsString()
  @IsOptional()
  honoreesNames?: string | null;

  @Expose()
  @ApiPropertyOptional({ nullable: true })
  @IsString()
  @IsOptional()
  albumPhrase?: string | null;

  @Expose()
  @ApiPropertyOptional({
    nullable: true,
    description:
      "From the contract's EVENT booking; null when there is no EVENT booking",
  })
  @IsString()
  @IsOptional()
  venueName?: string | null;

  @Expose()
  @ApiPropertyOptional({
    nullable: true,
    description: 'From booking.mapsUrl; null when there is no EVENT booking',
  })
  @IsString()
  @IsOptional()
  mapsUrl?: string | null;

  @Expose()
  @ApiPropertyOptional({
    nullable: true,
    description:
      "From the contract's EVENT booking; null when there is no EVENT booking",
  })
  @IsDate()
  @IsOptional()
  serviceStartsAt?: Date | null;

  @Expose()
  @ApiPropertyOptional({
    nullable: true,
    description:
      "From the contract's EVENT booking; null when there is no EVENT booking",
  })
  @IsDate()
  @IsOptional()
  serviceEndsAt?: Date | null;

  @Expose()
  @ApiPropertyOptional({
    type: Number,
    nullable: true,
    description: 'Id of the contract EVENT booking, or null when there is none',
  })
  @IsNumber()
  @IsOptional()
  bookingId!: number | null;

  @Expose()
  @ApiProperty({
    enum: ['active', 'finished'],
    description:
      "Computed from the EVENT booking's serviceStartsAt; 'finished' when there is no EVENT booking",
  })
  @IsIn(['active', 'finished'])
  status!: 'active' | 'finished';

  @Expose()
  @ApiPropertyOptional({ nullable: true })
  @IsString()
  @IsOptional()
  delegateName?: string | null;

  @Expose()
  @ApiProperty({ type: Number, description: 'Fotos por sesión', default: 2 })
  @IsNumber()
  photoCount!: number;

  @Expose()
  @ApiPropertyOptional({
    type: Number,
    description: 'Event theme id',
    nullable: true,
  })
  @IsNumber()
  @IsOptional()
  eventThemeId?: number | null;

  @Expose()
  @ApiProperty()
  createdAt!: Date;

  @Expose()
  @ApiProperty()
  updatedAt!: Date;

  @Expose()
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => EventThemeDto)
  eventTheme?: EventThemeDto;

  @Expose()
  @ApiPropertyOptional({
    type: Number,
    description: 'Brand kit id (client theme kit)',
    nullable: true,
  })
  @IsNumber()
  @IsOptional()
  brandKitId?: number | null;

  @Expose()
  @ApiPropertyOptional({
    type: Object,
    description: 'Per-event theme overrides',
    nullable: true,
  })
  @IsObject()
  @IsOptional()
  themeOverrides?: ThemeOverrides | null;
}
