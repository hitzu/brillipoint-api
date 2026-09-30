import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { BrandKit } from './entities/brand-kit.entity';
import { BrandKitsService } from './brand-kits.service';
import { BrandKitsController } from './brand-kits.controller';

@Module({
  imports: [TypeOrmModule.forFeature([BrandKit])],
  controllers: [BrandKitsController],
  providers: [BrandKitsService],
  exports: [TypeOrmModule, BrandKitsService],
})
export class BrandKitsModule {}
