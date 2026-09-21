import { CreateInternalBookingDto } from './create-internal-booking.dto';

/**
 * `POST /bookings/:id/reschedule` accepts the exact same payload as
 * `POST /bookings/internal` (see `odd/tasks/booking-agenda.md`, endpoint
 * #5): a reschedule replaces the booking's schedule and metadata, never
 * its `type`, `status` or `contractId`, so no extra fields are needed
 * beyond what `CreateInternalBookingDto` already validates.
 */
export class RescheduleBookingDto extends CreateInternalBookingDto {}
