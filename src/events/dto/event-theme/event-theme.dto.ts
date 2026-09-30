import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import {
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { PresetThemeTokensDto } from './public-event-theme.dto';
import type { ThemeImageMap } from './theme-images.dto';

export class EventThemeDto {
  @Expose()
  @ApiProperty({ type: Number, description: 'Phrase id' })
  @IsNumber()
  id!: number;

  @Expose()
  @ApiProperty({ type: String, description: 'key' })
  @IsString()
  key!: string;

  @Expose()
  @ApiProperty({ type: String, description: 'name' })
  @IsString()
  name!: string;

  @Expose()
  @ApiPropertyOptional({
    type: PresetThemeTokensDto,
    description:
      'Preset tokens (partial; missing tokens inherit the system default)',
    nullable: true,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => PresetThemeTokensDto)
  tokens?: PresetThemeTokensDto | null;

  @Expose()
  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    description: 'Typed image slots persisted on this preset.',
    nullable: true,
  })
  @IsOptional()
  images?: ThemeImageMap | null;
}
