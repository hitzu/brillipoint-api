import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { StorageModule } from '../common/storage/storage.module';
import { EventTheme } from '../events/entities/event-themes.entity';
import { Event } from '../events/entities/event.entity';
import { ThemeAssetUploadsService } from './theme-asset-uploads.service';
import { ThemeAssetsController } from './theme-assets.controller';

/**
 * Small dedicated module (T4/theme-authoring): the upload-url endpoint
 * needs read access to presets (`event_themes`) and events — two owner
 * types — so it lives on its own instead of folding into `EventsModule`.
 */
@Module({
  imports: [TypeOrmModule.forFeature([EventTheme, Event]), StorageModule],
  controllers: [ThemeAssetsController],
  providers: [ThemeAssetUploadsService],
})
export class ThemeAssetsModule {}
