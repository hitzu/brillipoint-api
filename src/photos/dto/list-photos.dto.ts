import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class ListPhotosQueryDto {
  @ApiPropertyOptional({
    type: Number,
    default: 20,
    minimum: 1,
    maximum: 500,
    description: 'Maximum number of photos to return',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({
    type: String,
    description: 'Pagination cursor from previous response',
    example: 'eyJjcmVhdGVkQXQiOiIyMDI2LTAyLTI0VDE2OjAwOjAwLjAwMFoiLCJpZCI6MTIzfQ',
  })
  @IsOptional()
  @IsString()
  cursor?: string;
}
