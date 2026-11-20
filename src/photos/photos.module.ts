import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventsModule } from '../events/events.module';
import { Photo } from './entities/photo.entity';
import { SessionVideo } from './entities/session-video.entity';
import { Session } from './entities/session.entity';
import { PhotosController } from './photos.controller';
import { PhotosService } from './photos.service';
import { SessionVideosController } from './session-videos.controller';
import { SessionVideosService } from './session-videos.service';
import { SessionsCache } from './sessions.cache';
import { SessionsController } from './sessions.controller';
import { SessionsService } from './sessions.service';

@Module({
  imports: [TypeOrmModule.forFeature([Photo, Session, SessionVideo]), EventsModule],
  controllers: [PhotosController, SessionsController, SessionVideosController],
  providers: [PhotosService, SessionsService, SessionVideosService, SessionsCache],
  exports: [PhotosService, SessionsService, SessionsCache],
})
export class PhotosModule {}
