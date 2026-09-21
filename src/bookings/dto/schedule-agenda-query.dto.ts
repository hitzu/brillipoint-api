import { ApiProperty } from '@nestjs/swagger';
import { Matches } from 'class-validator';

/**
 * `GET /bookings/agenda` query. Only the YYYY-MM-DD shape is checked here;
 * calendar validity (e.g. rejecting 2026-02-30), the `from <= to` ordering,
 * and the 366-day span cap are business rules and live in
 * `BookingsAgendaService` (see `odd/tasks/booking-agenda.md`).
 */
export class ScheduleAgendaQueryDto {
  @ApiProperty({
    type: String,
    required: true,
    example: '2026-09-14',
    description: 'First day of the range, inclusive, in YYYY-MM-DD format.',
  })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'from must be a YYYY-MM-DD date',
  })
  from!: string;

  @ApiProperty({
    type: String,
    required: true,
    example: '2026-09-20',
    description: 'Last day of the range, inclusive, in YYYY-MM-DD format.',
  })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'to must be a YYYY-MM-DD date',
  })
  to!: string;
}
