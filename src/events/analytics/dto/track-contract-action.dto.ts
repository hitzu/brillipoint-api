import {
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { ReservationAnalyticsAction } from '../enums/reservation-analytics-action.enum';

export class TrackContractActionDto {
  @IsEnum(ReservationAnalyticsAction)
  action: ReservationAnalyticsAction;

  @IsUUID()
  @IsOptional()
  sessionId?: string;

  @IsString()
  @MaxLength(64)
  @IsOptional()
  surface?: string;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, unknown>;
}
