import { Expose, Type } from 'class-transformer';
import { IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';
import { BOOKING_PURPOSE } from '../constants/booking_purpose.enum';
import { BOOKING_STATUS } from '../constants/booking_status.enum';

/** The only contract fields the agenda frontend needs (Engram #2176). */
export class BookingContractSummaryDto {
  @Expose()
  @IsString()
  sku!: string;

  @Expose()
  @IsString()
  token!: string;
}

export class BookingDetailDto {
  @Expose()
  @IsNumber()
  id!: number;

  @Expose()
  @IsEnum(BOOKING_STATUS)
  status!: BOOKING_STATUS;

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
  @IsEnum(BOOKING_PURPOSE)
  @IsOptional()
  purpose!: BOOKING_PURPOSE | null;

  @Expose()
  @IsString()
  @IsOptional()
  venueName!: string | null;

  @Expose()
  @IsString()
  @IsOptional()
  mapsUrl!: string | null;

  @Expose()
  @Type(() => BookingContractSummaryDto)
  contract!: BookingContractSummaryDto | null;
}
