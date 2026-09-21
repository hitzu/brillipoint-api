import { OmitType } from '@nestjs/swagger';

import { CreateBookingDto } from './create-booking.dto';

/**
 * `POST /bookings/:id/reschedule` accepts the same payload as
 * `POST /bookings` (see `odd/tasks/booking-agenda.md`, endpoint #5) minus
 * `contractId`: a reschedule replaces the booking's schedule and metadata,
 * never its `status` or its contract. `contractId` is omitted rather than
 * inherited-and-ignored so the type and the Swagger contract both state that
 * a reschedule cannot move a booking between contracts.
 */
export class RescheduleBookingDto extends OmitType(CreateBookingDto, [
  'contractId',
] as const) {}
