import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDate,
  IsEnum,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  Min,
} from 'class-validator';
import type { JsonValue } from './json-value';
import type { ThemeOverrides } from '../theme/theme.types';
import { GALLERY_STATUS } from '../constants/gallery_status.enum';
import { IsThemeOverrides } from '../theme/validate-theme-overrides';

export class UpdateEventDto {
  @ApiPropertyOptional({
    type: Number,
    description: 'Event type id',
  })
  @IsNumber()
  @IsOptional()
  eventTypeId?: number;

  /** @deprecated Use booking (v2 events) instead. Removed in phase 2. */
  @ApiPropertyOptional({
    type: Number,
    description: 'Service type id',
    nullable: true,
    deprecated: true,
  })
  @IsNumber()
  @IsOptional()
  serviceTypeId?: number | null;

  @ApiPropertyOptional({
    type: String,
    description: 'Nombre de los festejados',
  })
  @IsString()
  @IsOptional()
  honoreesNames?: string;

  @ApiPropertyOptional({
    type: String,
    description: 'Frase para el álbum',
  })
  @IsString()
  @IsOptional()
  albumPhrase?: string;

  /** @deprecated Use booking (v2 events) instead. Removed in phase 2. */
  @ApiPropertyOptional({
    type: String,
    description: 'Nombre del salón',
    deprecated: true,
  })
  @IsString()
  @IsOptional()
  venueName?: string;

  /** @deprecated Use booking (v2 events) instead. Removed in phase 2. */
  @ApiPropertyOptional({
    type: String,
    description: 'Link de ubicación para el servicio',
    deprecated: true,
  })
  @IsUrl({ require_protocol: true })
  @IsOptional()
  serviceLocationUrl?: string;

  /** @deprecated Use the contract's EVENT booking (v2 events) instead. Removed in phase 2. */
  @ApiPropertyOptional({
    type: String,
    format: 'date-time',
    description: 'Hora de inicio del servicio (ISO 8601)',
    deprecated: true,
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  serviceStartsAt?: Date;

  /** @deprecated Use booking (v2 events) instead. Removed in phase 2. */
  @ApiPropertyOptional({
    type: String,
    format: 'date-time',
    description: 'Hora de fin del servicio (ISO 8601)',
    deprecated: true,
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  serviceEndsAt?: Date;

  @ApiPropertyOptional({
    type: String,
    description: 'Persona delegada',
  })
  @IsString()
  @IsOptional()
  delegateName?: string;

  @ApiPropertyOptional({
    type: Number,
    description: 'Número de fotos por sesión (1-10)',
  })
  @IsInt()
  @Min(1)
  @Max(10)
  @IsOptional()
  photoCount?: number;

  /** @deprecated Use booking (v2 events) instead. Removed in phase 2. */
  @ApiPropertyOptional({
    type: String,
    description: 'Plantilla de impresión (polaroid_2 | keychain_2)',
    deprecated: true,
  })
  @IsString()
  @IsOptional()
  printTemplate?: string;

  @ApiPropertyOptional({
    type: Number,
    description:
      'Theme preset (event_themes) id. Must reference an existing preset; `null` removes the preset so the event renders on the system default theme.',
    nullable: true,
  })
  @IsInt()
  @IsOptional()
  eventThemeId?: number | null;

  @ApiPropertyOptional({
    type: Object,
    description: 'Per-event theme overrides (partial ThemeOverrides shape).',
    nullable: true,
  })
  @IsObject()
  @IsThemeOverrides()
  @IsOptional()
  themeOverrides?: ThemeOverrides | null;

  @ApiPropertyOptional({
    enum: GALLERY_STATUS,
    description:
      "Manual override of the public gallery status. 'auto' derives it from the event date; 'demo' keeps the gallery active past its 30-day expiration (e.g. for sales demos). Does not reopen photo uploads.",
  })
  @IsEnum(GALLERY_STATUS)
  @IsOptional()
  galleryStatus?: GALLERY_STATUS;

  /** @deprecated Use booking (v2 events) instead. Removed in phase 2. */
  @ApiPropertyOptional({
    type: Object,
    description: 'Any valid JSON payload for print templates.',
    nullable: true,
    example: [{ template_id: 'polaroid' }, { template_id: 'polaroid' }],
    deprecated: true,
  })
  @IsOptional()
  printTemplates?: JsonValue;
}
