import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventPhrase } from './entities/event-phrases.entity';
import { EventTheme } from './entities/event-themes.entity';
import { EventType } from './entities/event-type.entity';
import { Event } from './entities/event.entity';
import { ServiceType } from './entities/service-type.entity';
import { EventAnalytic } from './entities/event-analytic.entity';
import { EventPhrasesService } from './event-phrases.service';
import { EventThemeService } from './event-theme.service';
import { EventTypeService } from './event-type.service';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';
import { ServiceTypeService } from './service-type.service';
import { EventAnalyticsController } from './analytics/event-analytics.controller';
import { EventAnalyticsService } from './analytics/event-analytics.service';
import { EventsV2Controller } from './v2/events-v2.controller';
import { Booking } from '../bookings/entities/booking.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Event, EventType, ServiceType, EventPhrase, EventTheme, EventAnalytic, Booking]),
  ],
  controllers: [EventsController, EventsV2Controller, EventAnalyticsController],
  providers: [EventsService, EventTypeService, ServiceTypeService, EventPhrasesService, EventThemeService, EventAnalyticsService],
  exports: [EventsService, EventAnalyticsService],
})
export class EventsModule {}
