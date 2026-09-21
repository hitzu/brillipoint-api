import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

import { BOOKING_PURPOSE } from '../constants/booking_purpose.enum';
import { BOOKING_STATUS } from '../constants/booking_status.enum';
import { BOOKING_TYPE } from '../constants/booking_type.enum';

/**
 * One calendar day's slice of a booking. A booking that crosses local
 * midnight emits one entry per touched day, all sharing the same `id` and
 * the same uncut `startsAt` / `endsAt`, so a summary view and an hour-scaled
 * view can both be painted from this single payload. There are no holds or
 * blocks in this slice (see `odd/tasks/booking-agenda.md`), so `blocks`,
 * `approximateStartsAt` and `approximateEndsAt` are intentionally absent.
 */
export class ScheduleAgendaEntryDto {
  @ApiProperty({ description: 'Booking id, repeated on every segment of it' })
  id!: number;

  @ApiProperty({ description: 'Calendar day this segment belongs to' })
  date!: string;

  @ApiProperty({ enum: BOOKING_STATUS })
  status!: BOOKING_STATUS;

  @ApiProperty({ enum: BOOKING_TYPE })
  type!: BOOKING_TYPE;

  @ApiPropertyOptional({ enum: BOOKING_PURPOSE, nullable: true })
  purpose!: BOOKING_PURPOSE | null;

  @ApiProperty({ description: 'Uncut interval start, identical on every segment' })
  startsAt!: Date;

  @ApiProperty({ description: 'Uncut interval end, identical on every segment' })
  endsAt!: Date;

  @ApiProperty({ description: 'Agreed service start instant' })
  serviceStartsAt!: Date;

  @ApiProperty({ description: 'Agreed service end instant' })
  serviceEndsAt!: Date;

  @ApiProperty({ description: 'Civil date the booking is displayed under' })
  eventDate!: string;

  @ApiProperty({ description: "This day's clipped slice of the interval" })
  segmentStartsAt!: Date;

  @ApiProperty({ description: "This day's clipped slice of the interval" })
  segmentEndsAt!: Date;

  @ApiProperty()
  continuesFromPreviousDay!: boolean;

  @ApiProperty()
  continuesNextDay!: boolean;

  @ApiPropertyOptional({ nullable: true })
  contractId!: number | null;

  @ApiPropertyOptional({ nullable: true, description: "The linked contract's sku" })
  sku!: string | null;

  @ApiPropertyOptional({ nullable: true })
  title!: string | null;

  @ApiPropertyOptional({
    nullable: true,
    description: "The linked contract's client name",
  })
  clientName!: string | null;

  @ApiPropertyOptional({ nullable: true })
  venueName!: string | null;
}

export class ScheduleAgendaDayDto {
  @ApiProperty({ description: 'Calendar day in YYYY-MM-DD format' })
  date!: string;

  @ApiProperty({ type: ScheduleAgendaEntryDto, isArray: true })
  @Type(() => ScheduleAgendaEntryDto)
  entries!: ScheduleAgendaEntryDto[];
}

export class ScheduleAgendaResponseDto {
  @ApiProperty({
    type: ScheduleAgendaDayDto,
    isArray: true,
    description:
      'Every day in the queried [from, to] range, including days with no entries.',
  })
  @Type(() => ScheduleAgendaDayDto)
  days!: ScheduleAgendaDayDto[];
}
