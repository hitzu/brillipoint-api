import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

import type { PrepProfileAssetsMode } from './prep-profile-public.query.dto';

export class PrepProfileStaffQueryDto {
  /** Same meaning as in the public query; staff normally asks for `signed`. */
  @IsOptional()
  @IsIn(['none', 'public', 'signed'])
  assets?: PrepProfileAssetsMode;

  /** Signed URL TTL in seconds (only used when assets=signed). */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(10)
  @Max(60 * 60)
  expiresIn?: number;
}
