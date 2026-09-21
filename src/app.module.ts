import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { BrandsModule } from './brands/brands.module';
import { getTypeOrmConfig } from './config/database';
import { LoggerModule } from 'nestjs-pino';
import { getLoggerConfigs } from './config/logger/logger.config';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './users/user.module';
import { TokenModule } from './tokens/token.module';
import { AuthGuard } from './auth/auth.guard';
import { PhotoboothGuard } from './auth/photobooth.guard';
import { ProductsModule } from './products/products.module';
import { PackagesModule } from './packages/packages.module';
import { TermsModule } from './terms/terms.module';
import { SlotsModule } from './slots/slots.module';
import { NotesModule } from './notes/notes.module';
import { ContractsModule } from './contracts/contracts.module';
import { PromotionsModule } from './promotions/promotions.module';
import { EventsModule } from './events/events.module';
import { PhotosModule } from './photos/photos.module';
import { ReconciliationModule } from './reconciliation/reconciliation.module';
import { CarouselsModule } from './carousels/carousels.module';
import { ExtrasModule } from './extras/extras.module';
import { BookingsModule } from './bookings/bookings.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        `.env.${process.env.NODE_ENV || 'local'}`,
        '.env.test',
        '.env',
      ],
    }),
    LoggerModule.forRoot(getLoggerConfigs()),
    TypeOrmModule.forRootAsync({
      useFactory: () => getTypeOrmConfig(),
    }),
    BrandsModule,
    AuthModule,
    UserModule,
    TokenModule,
    ProductsModule,
    PackagesModule,
    TermsModule,
    SlotsModule,
    NotesModule,
    ContractsModule,
    PromotionsModule,
    EventsModule,
    PhotosModule,
    ReconciliationModule,
    CarouselsModule,
    ExtrasModule,
    BookingsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: PhotoboothGuard,
    },
  ],
})
export class AppModule { }
