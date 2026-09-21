import { ApiProperty } from '@nestjs/swagger';
import { Matches } from 'class-validator';

/**
 * `GET /bookings/calendar` query (endpoint #8, public). `month` is
 * ONE-BASED (1-12), matching how the frontend and the rest of the codebase
 * (see `src/slots/dto/get-slots-calendar-query.dto.ts`) speak of months.
 * Only the shape is checked here; the "sane 4-digit year" and 1-12 month
 * range business rules live in `BookingsAgendaService.getCalendarByMonth`
 * (see `odd/tasks/booking-agenda.md`), matching the split already used by
 * `ScheduleAgendaQueryDto`.
 */
export class BookingCalendarQueryDto {
  @ApiProperty({
    type: Number,
    required: true,
    example: 2026,
    description: 'Year in YYYY format.',
  })
  @Matches(/^\d{4}$/, {
    message: 'year must be in YYYY format',
  })
  year!: string;

  @ApiProperty({
    type: Number,
    required: true,
    example: 9,
    description: 'One-based month number (1-12).',
  })
  @Matches(/^(0?[1-9]|1[0-2])$/, {
    message: 'month must be between 1 and 12',
  })
  month!: string;
}
