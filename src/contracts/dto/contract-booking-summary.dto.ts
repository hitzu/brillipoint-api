import { Expose } from 'class-transformer';
import { IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';

import { BOOKING_PURPOSE } from '../../bookings/constants/booking_purpose.enum';
import { BOOKING_STATUS } from '../../bookings/constants/booking_status.enum';

/**
 * Booking summary embedded in contract responses (detail, token detail,
 * list, create). Deliberately narrower than `BookingDetailDto`: no
 * `mapsUrl` (internal logistics detail) and no `contract` back-reference
 * (we're already inside the contract).
 */
export class ContractBookingSummaryDto {
  @Expose()
  @IsNumber()
  id!: number;

  @Expose()
  @IsEnum(BOOKING_STATUS)
  status!: BOOKING_STATUS;

  @Expose()
  @IsEnum(BOOKING_PURPOSE)
  @IsOptional()
  purpose!: BOOKING_PURPOSE | null;

  @Expose()
  @IsString()
  eventDate!: string;

  @Expose()
  serviceStartsAt!: Date;

  @Expose()
  serviceEndsAt!: Date;

  @Expose()
  @IsString()
  @IsOptional()
  title!: string | null;

  @Expose()
  @IsString()
  @IsOptional()
  venueName!: string | null;
}
