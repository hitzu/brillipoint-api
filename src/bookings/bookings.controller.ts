import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Query,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';

import { Public } from '../auth/decorators/public.decorator';
import { EXCEPTION_RESPONSE } from '../config/errors/exception-response.config';
import { BookingsAgendaService } from './bookings-agenda.service';
import { BookingsService } from './bookings.service';
import { BookingCalendarQueryDto } from './dto/booking-calendar-query.dto';
import { BookingCalendarResponseDto } from './dto/booking-calendar.dto';
import { BookingDetailDto } from './dto/booking-detail.dto';
import { CreateBookingDto } from './dto/create-booking.dto';
import { RescheduleBookingDto } from './dto/reschedule-booking.dto';
import { ScheduleAgendaQueryDto } from './dto/schedule-agenda-query.dto';
import { ScheduleAgendaResponseDto } from './dto/schedule-agenda.dto';

@Controller('bookings')
@ApiTags('bookings')
@ApiBearerAuth('access-token')
export class BookingsController {
  constructor(
    private readonly bookingsService: BookingsService,
    private readonly bookingsAgendaService: BookingsAgendaService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a booking' })
  @ApiBody({ type: CreateBookingDto })
  @ApiCreatedResponse({
    description: 'Booking created successfully',
    type: BookingDetailDto,
  })
  @ApiBadRequestResponse({ description: 'Invalid request body' })
  @ApiNotFoundResponse({
    description: EXCEPTION_RESPONSE.CONTRACT_NOT_FOUND.message,
  })
  create(
    @Body(new ValidationPipe({ transform: true, whitelist: true }))
    createBookingDto: CreateBookingDto,
  ) {
    return this.bookingsService.create(createBookingDto);
  }

  // Declared before `@Get(':id')`: Nest matches routes in declaration
  // order, so `agenda` must come first or ParseIntPipe would reject it.
  @Get('agenda')
  @ApiOperation({ summary: "Get staff's booking agenda for a date range" })
  @ApiOkResponse({
    description: 'Agenda days, inclusive of both endpoints',
    type: ScheduleAgendaResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Invalid from/to range' })
  getAgenda(
    @Query(new ValidationPipe({ transform: true, whitelist: true }))
    scheduleAgendaQueryDto: ScheduleAgendaQueryDto,
  ) {
    return this.bookingsAgendaService.getAgenda(scheduleAgendaQueryDto);
  }

  // Declared before `@Get(':id')`, same reason as `agenda` above: public
  // route, so it must not fall through to ParseIntPipe.
  @Get('calendar')
  @Public()
  @ApiOperation({
    summary: 'Get the public occupancy calendar for a month (expo page)',
  })
  @ApiQuery({
    name: 'year',
    required: true,
    description: 'Year in YYYY format',
    type: Number,
    example: 2026,
  })
  @ApiQuery({
    name: 'month',
    required: true,
    description: 'One-based month number (1-12)',
    type: Number,
    example: 9,
  })
  @ApiOkResponse({
    description:
      'Every civil day of the month with timing/occupancy entries only',
    type: BookingCalendarResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Invalid year/month' })
  getCalendar(
    @Query(new ValidationPipe({ transform: true, whitelist: true }))
    bookingCalendarQueryDto: BookingCalendarQueryDto,
  ) {
    return this.bookingsAgendaService.getCalendarByMonth(
      +bookingCalendarQueryDto.year,
      +bookingCalendarQueryDto.month,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a booking by id' })
  @ApiParam({ name: 'id', type: Number, description: 'Booking id' })
  @ApiOkResponse({
    description: 'Booking detail',
    type: BookingDetailDto,
  })
  @ApiNotFoundResponse({
    description: EXCEPTION_RESPONSE.BOOKING_NOT_FOUND.message,
  })
  findById(@Param('id', ParseIntPipe) id: number) {
    return this.bookingsService.findDetailById(id);
  }

  @Post(':id/reschedule')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reschedule a booking' })
  @ApiParam({ name: 'id', type: Number, description: 'Booking id' })
  @ApiBody({ type: RescheduleBookingDto })
  @ApiOkResponse({
    description: 'Booking rescheduled successfully',
    type: BookingDetailDto,
  })
  @ApiBadRequestResponse({ description: 'Invalid request body' })
  @ApiNotFoundResponse({
    description: EXCEPTION_RESPONSE.BOOKING_NOT_FOUND.message,
  })
  reschedule(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ValidationPipe({ transform: true, whitelist: true }))
    rescheduleBookingDto: RescheduleBookingDto,
  ) {
    return this.bookingsService.reschedule(id, rescheduleBookingDto);
  }
}
