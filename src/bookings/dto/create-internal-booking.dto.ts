import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  Equals,
  IsDate,
  IsEnum,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
} from 'class-validator';
import { BOOKING_PURPOSE } from '../constants/booking_purpose.enum';

export class CreateInternalBookingDto {
  @ApiProperty({ type: String, enum: ['exact'], required: true })
  @Equals('exact', { message: 'scheduleType must be "exact"' })
  scheduleType!: 'exact';

  @ApiProperty({
    type: String,
    description: 'Civil date the booking is displayed under (YYYY-MM-DD)',
  })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'eventDate must be a YYYY-MM-DD date',
  })
  eventDate!: string;

  @ApiProperty({
    type: String,
    format: 'date-time',
    description: 'Service start instant (ISO 8601)',
  })
  @Type(() => Date)
  @IsDate()
  serviceStartsAt!: Date;

  @ApiProperty({
    type: String,
    format: 'date-time',
    description:
      'Service end instant (ISO 8601). May fall on the next civil day.',
  })
  @Type(() => Date)
  @IsDate()
  serviceEndsAt!: Date;

  @ApiPropertyOptional({ type: String })
  @IsString()
  @IsOptional()
  title?: string;

  @ApiPropertyOptional({ type: String, enum: BOOKING_PURPOSE })
  @IsEnum(BOOKING_PURPOSE)
  @IsOptional()
  purpose?: BOOKING_PURPOSE;

  @ApiPropertyOptional({ type: String })
  @IsString()
  @IsOptional()
  venueName?: string;

  @ApiPropertyOptional({
    type: String,
    description: 'http/https URL only',
  })
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @IsOptional()
  mapsUrl?: string;
}
