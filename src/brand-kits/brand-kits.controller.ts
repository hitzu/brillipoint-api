import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { plainToInstance } from 'class-transformer';

import { BrandKitsService } from './brand-kits.service';
import { CreateBrandKitDto } from './dto/create-brand-kit.dto';
import { UpdateBrandKitDto } from './dto/update-brand-kit.dto';
import { BrandKitDto } from './dto/brand-kit.dto';

/** Staff-only: guarded by the global APP_GUARD (no `@Public`). */
@ApiTags('brand-kits')
@Controller('brand-kits')
export class BrandKitsController {
  constructor(private readonly brandKitsService: BrandKitsService) {}

  @Post()
  async create(@Body() dto: CreateBrandKitDto): Promise<BrandKitDto> {
    const kit = await this.brandKitsService.create(dto);
    return plainToInstance(BrandKitDto, kit, {
      excludeExtraneousValues: true,
    });
  }

  @Get()
  async findAll(): Promise<BrandKitDto[]> {
    const kits = await this.brandKitsService.findAll();
    return plainToInstance(BrandKitDto, kits, {
      excludeExtraneousValues: true,
    });
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number): Promise<BrandKitDto> {
    const kit = await this.brandKitsService.findOne(id);
    return plainToInstance(BrandKitDto, kit, {
      excludeExtraneousValues: true,
    });
  }

  @Patch(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateBrandKitDto,
  ): Promise<BrandKitDto> {
    const kit = await this.brandKitsService.update(id, dto);
    return plainToInstance(BrandKitDto, kit, {
      excludeExtraneousValues: true,
    });
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    await this.brandKitsService.delete(id);
  }
}
