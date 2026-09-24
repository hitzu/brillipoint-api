import { Controller, Get, HttpCode, HttpStatus, Param, ParseIntPipe } from '@nestjs/common';
import { ApiBearerAuth, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { Public } from '../../auth/decorators/public.decorator';
import { EventV2ResponseDto } from '../dto/v2/event-v2-response.dto';
import { EventsService } from '../events.service';

/**
 * v2 event read model: schedule/venue come ONLY from the contract's EVENT
 * booking (null when there is none) — no fallback to the legacy `Event`
 * columns. See `odd/tasks/event-fields-deprecation.md`, "Phase 1b". Write
 * endpoints (create/update) stay on v1.
 */
@Controller({ path: 'events', version: '2' })
@ApiTags('events')
@ApiBearerAuth('access-token')
export class EventsV2Controller {
  constructor(private readonly eventsService: EventsService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List all events (v2, resolved schedule)' })
  @ApiOkResponse({ description: 'Events list', type: [EventV2ResponseDto] })
  list() {
    return this.eventsService.listV2();
  }

  @Get('by-key/:key')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get event by key (v2, resolved schedule)' })
  @ApiParam({ name: 'key', type: String, description: 'Event key (unique identifier)' })
  @ApiOkResponse({ description: 'Event found', type: EventV2ResponseDto })
  @ApiNotFoundResponse({ description: 'Event not found' })
  getByKey(@Param('key') key: string) {
    return this.eventsService.getByKeyV2(key);
  }

  @Get('id/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get event by id (v2, resolved schedule)' })
  @ApiParam({ name: 'id', type: Number, description: 'Event id' })
  @ApiOkResponse({ description: 'Event found', type: EventV2ResponseDto })
  @ApiNotFoundResponse({ description: 'Event not found' })
  getById(@Param('id', ParseIntPipe) id: number) {
    return this.eventsService.getByIdV2(id);
  }

  @Get(':token')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get event by token (v2, resolved schedule)' })
  @ApiParam({ name: 'token', type: String, description: 'Event token (UUID)' })
  @ApiOkResponse({ description: 'Event found', type: EventV2ResponseDto })
  @ApiNotFoundResponse({ description: 'Event not found' })
  getByToken(@Param('token') token: string) {
    return this.eventsService.getByTokenV2(token);
  }
}
