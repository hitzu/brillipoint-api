import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Contract } from '../contracts/entities/contract.entity';
import { Booking } from './entities/booking.entity';
import { BookingsAgendaService } from './bookings-agenda.service';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';

@Module({
  imports: [TypeOrmModule.forFeature([Booking, Contract])],
  controllers: [BookingsController],
  providers: [BookingsService, BookingsAgendaService],
  exports: [TypeOrmModule, BookingsService, BookingsAgendaService],
})
export class BookingsModule {}
