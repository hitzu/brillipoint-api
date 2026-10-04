import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Headers,
  Param,
  Query,
  ParseIntPipe,
  Patch,
  Post,
  Res,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ApiBearerAuth } from '@nestjs/swagger';
import type { Response } from 'express';
import { Public } from '../auth/decorators/public.decorator';
import { CreateEventDto } from './dto/create-event.dto';
import { BulkPhrasesDto } from './dto/event-phases/bulk-phrases.dto';
import { PhraseByEventTokenDto } from './dto/event-phases/phrase-by-event-token.dto';
import { CreateEventThemeDto } from './dto/event-theme/create-event-theme.dto';
import { UpdateEventThemeDto } from './dto/event-theme/update-event-theme.dto';
import { EventThemeDto } from './dto/event-theme/event-theme.dto';
import {
  PreviewThemeDto,
  PreviewThemeResponseDto,
} from './dto/event-theme/preview-theme.dto';
import { PublicEventThemeResponseDto } from './dto/event-theme/public-event-theme.dto';
import { resolvePublicThemeCache } from './theme/public-theme-cache';
import { EventResponseDto } from './dto/event-response.dto';
import { EventTypeDto } from './dto/event-types/event-types.dto';
import { ServiceTypeDto } from './dto/service-types/service-types.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { EventPhrasesService } from './event-phrases.service';
import { EventThemeService } from './event-theme.service';
import { EventTypeService } from './event-type.service';
import { EventsService } from './events.service';
import { ServiceTypeService } from './service-type.service';

@Controller('events')
@ApiTags('events')
@ApiBearerAuth('access-token')
export class EventsController {
  constructor(
    private readonly eventsService: EventsService,
    private readonly eventTypeService: EventTypeService,
    private readonly serviceTypeService: ServiceTypeService,
    private readonly eventPhraseService: EventPhrasesService,
    private readonly eventTheme: EventThemeService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create an event' })
  @ApiBody({ type: CreateEventDto })
  @ApiCreatedResponse({
    description: 'Event created successfully',
    type: EventResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Invalid request body' })
  @ApiConflictResponse({ description: 'Event key already exists' })
  create(@Body(new ValidationPipe()) dto: CreateEventDto) {
    return this.eventsService.create(dto);
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update an event by id' })
  @ApiParam({ name: 'id', type: Number, description: 'Event id' })
  @ApiBody({ type: UpdateEventDto })
  @ApiOkResponse({
    description: 'Event updated successfully',
    type: EventResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Invalid request body' })
  @ApiNotFoundResponse({ description: 'Event not found' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ValidationPipe()) dto: UpdateEventDto,
  ) {
    return this.eventsService.update(id, dto);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List all events' })
  @ApiOkResponse({
    description: 'Events list',
    type: [EventResponseDto],
  })
  list() {
    return this.eventsService.list();
  }

  @Get('themes')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get themes events' })
  @ApiOkResponse({
    description: 'Event themes list',
    type: [EventThemeDto],
  })
  getEventThemes() {
    return this.eventTheme.listEventThemes();
  }

  @Post('themes')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create an event theme' })
  @ApiBody({ type: CreateEventThemeDto })
  @ApiCreatedResponse({
    description: 'Event theme created successfully',
    type: EventThemeDto,
  })
  @ApiBadRequestResponse({ description: 'Invalid request body' })
  @ApiConflictResponse({ description: 'Event theme key already exists' })
  createEventTheme(
    @Body(new ValidationPipe({ transform: true, whitelist: true }))
    dto: CreateEventThemeDto,
  ) {
    return this.eventTheme.createEventTheme(dto);
  }

  @Post('themes/preview')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Preview a resolved event theme without persisting anything',
  })
  @ApiBody({ type: PreviewThemeDto })
  @ApiOkResponse({
    description: 'Resolved theme preview',
    type: PreviewThemeResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Invalid request body' })
  @ApiNotFoundResponse({ description: 'Unknown eventThemeId' })
  previewEventTheme(
    @Body(new ValidationPipe({ transform: true, whitelist: true }))
    dto: PreviewThemeDto,
  ) {
    return this.eventTheme.previewTheme(dto);
  }

  @Patch('themes/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update an event theme preset' })
  @ApiParam({ name: 'id', type: Number, description: 'Event theme id' })
  @ApiBody({ type: UpdateEventThemeDto })
  @ApiOkResponse({
    description: 'Event theme updated successfully',
    type: EventThemeDto,
  })
  @ApiBadRequestResponse({ description: 'Invalid request body' })
  @ApiNotFoundResponse({ description: 'Event theme not found' })
  updateEventTheme(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ValidationPipe({ transform: true, whitelist: true }))
    dto: UpdateEventThemeDto,
  ) {
    return this.eventTheme.updateEventTheme(id, dto);
  }

  @Get('by-key/:key')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get event by key' })
  @ApiParam({
    name: 'key',
    type: String,
    description: 'Event key (unique identifier)',
  })
  @ApiOkResponse({
    description: 'Event found',
    type: EventResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Event not found' })
  getByKey(@Param('key') key: string) {
    return this.eventsService.getByKey(key);
  }

  @Get('id/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get event by id' })
  @ApiParam({ name: 'id', type: Number, description: 'Event id' })
  @ApiOkResponse({
    description: 'Event found',
    type: EventResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Event not found' })
  getById(@Param('id', ParseIntPipe) id: number) {
    return this.eventsService.getById(id);
  }

  @Get('types')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List all event types' })
  @ApiOkResponse({
    description: 'Event types list',
    type: [EventTypeDto],
  })
  listEventTypes() {
    return this.eventTypeService.listEventTypes();
  }

  @Get('service-types')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List all service types' })
  @ApiOkResponse({
    description: 'Service types list',
    type: [ServiceTypeDto],
  })
  listServiceTypes() {
    return this.serviceTypeService.listServiceTypes();
  }

  @Get('phrases/:token')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List all phrases by event token' })
  @ApiOkResponse({
    description: 'Phrases list',
    type: [PhraseByEventTokenDto],
  })
  @ApiParam({ name: 'token', type: String, description: 'Event token (UUID)' })
  listPhrasesByEventToken(@Param('token') token: string) {
    return this.eventPhraseService.listPhrasesByEventToken(token);
  }

  @Get(':token/theme')
  @Public()
  @ApiQuery({
    name: 'cache',
    required: false,
    enum: ['off'],
    description:
      'Use cache=off to bypass HTTP caching for a fresh theme response during visual testing.',
  })
  @ApiOperation({ summary: 'Get public event theme by event token' })
  @ApiParam({ name: 'token', type: String, description: 'Event token (UUID)' })
  @ApiHeader({
    name: 'If-None-Match',
    required: false,
    description: 'Previously received event theme ETag',
  })
  @ApiOkResponse({
    description: 'Event theme found',
    type: PublicEventThemeResponseDto,
  })
  @ApiResponse({ status: 304, description: 'Event theme not modified' })
  @ApiNotFoundResponse({ description: 'Event not found' })
  async getPublicThemeByEventToken(
    @Param('token') token: string,
    @Headers('if-none-match') ifNoneMatch: string | undefined,
    @Query('cache') cache: string | undefined,
    @Res() response: Response,
  ): Promise<void> {
    const result = await this.eventTheme.getPublicThemeByEventToken(token);
    const cacheDecision = resolvePublicThemeCache(cache, () =>
      this.eventTheme.isMatchingEtag(ifNoneMatch, result.etag),
    );

    response.setHeader('Cache-Control', cacheDecision.cacheControl);
    response.setHeader('ETag', result.etag);

    if (cacheDecision.notModified) {
      response.status(HttpStatus.NOT_MODIFIED).send();
      return;
    }

    response.status(HttpStatus.OK).json(result.body);
  }

  @Get(':token')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get event by token' })
  @ApiParam({ name: 'token', type: String, description: 'Event token (UUID)' })
  @ApiOkResponse({
    description: 'Event found',
    type: EventResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Event not found' })
  getByToken(@Param('token') token: string) {
    return this.eventsService.getByToken(token);
  }

  @Post('phrases/bulk')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Upload phrases by event type' })
  @ApiNotFoundResponse({ description: 'Event type not found' })
  bulkPhrasesByEventType(
    @Body(new ValidationPipe({ transform: true, whitelist: true }))
    dto: BulkPhrasesDto,
  ) {
    return this.eventPhraseService.bulkSeedPhrases(dto);
  }
}
