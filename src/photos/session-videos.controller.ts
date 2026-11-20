import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiBody,
  ApiConflictResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';

import { Public } from '../auth/decorators/public.decorator';
import {
  ConfirmSessionVideoDto,
  SessionVideoPresignedResponseDto,
} from './dto/session-video.dto';
import { SessionVideosService } from './session-videos.service';

@Controller('sessions/:sessionToken/videos')
@ApiTags('sessions')
@ApiParam({ name: 'sessionToken', type: String, description: 'Session UUID' })
export class SessionVideosController {
  constructor(private readonly sessionVideosService: SessionVideosService) {}

  @Post('presigned')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get presigned URLs to upload a session video (.mp4) and its poster (.jpg)' })
  @ApiOkResponse({ type: SessionVideoPresignedResponseDto })
  @ApiNotFoundResponse({ description: 'Session not found' })
  @ApiConflictResponse({ description: 'Session already has a video' })
  getPresignedUrls(
    @Param('sessionToken', new ParseUUIDPipe({ version: '4' })) sessionToken: string,
  ): Promise<SessionVideoPresignedResponseDto> {
    return this.sessionVideosService.createUploadUrls(sessionToken);
  }

  @Post('confirm')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Confirm the session video was uploaded to Supabase' })
  @ApiBody({ type: ConfirmSessionVideoDto })
  @ApiOkResponse({ schema: { example: { ok: true } } })
  @ApiNotFoundResponse({ description: 'Session not found' })
  @ApiConflictResponse({ description: 'Session already has a different video' })
  confirm(
    @Param('sessionToken', new ParseUUIDPipe({ version: '4' })) sessionToken: string,
    @Body(new ValidationPipe({ whitelist: true })) dto: ConfirmSessionVideoDto,
  ): Promise<{ ok: boolean }> {
    return this.sessionVideosService.confirm(sessionToken, dto);
  }
}
