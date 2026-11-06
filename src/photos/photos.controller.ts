import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  Query,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { ApiBearerAuth } from '@nestjs/swagger';
import { BulkSeedPhotosDto } from './dto/bulk-seed-photos.dto';
import { CreatePersonalizedUploadUrlDto } from './dto/create-personalized-upload-url.dto';
import { CreatePhotoDto } from './dto/create-photo.dto';
import { ListPhotosQueryDto } from './dto/list-photos.dto';
import { ListPhotosResponseDto } from './dto/list-photos-response.dto';
import { PhotoResponseDto } from './dto/photo-response.dto';
import { PresignResponseDto } from './dto/presign-response.dto';
import { PhotosService } from './photos.service';
import { Photobooth } from '../auth/decorators/photobooth.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { EXCEPTION_RESPONSE } from '../config/errors/exception-response.config';

@Controller('photos')
@ApiTags('photos')
@ApiBearerAuth('access-token')
export class PhotosController {
  constructor(private readonly photosService: PhotosService) { }

  @Get('event/:token')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List photos for an event' })
  @ApiParam({ name: 'token', type: String, description: 'Event token (UUID)' })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Maximum number of photos to return',
    example: 20,
  })
  @ApiQuery({
    name: 'cursor',
    required: false,
    type: String,
    description: 'Pagination cursor from previous response',
  })
  @ApiOkResponse({
    description: 'Paginated photos for the event (ordered by createdAt DESC, id DESC)',
    type: ListPhotosResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Event not found' })
  listByEventToken(
    @Param('token') token: string,
    @Query(new ValidationPipe({ transform: true, whitelist: true }))
    query: ListPhotosQueryDto,
  ) {
    return this.photosService.listByEventToken(token, query);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register photo metadata after upload' })
  @ApiBody({ type: CreatePhotoDto })
  @ApiCreatedResponse({
    description: 'Photo registered successfully',
    type: PhotoResponseDto,
  })
  @ApiOkResponse({
    description: 'Photo already exists (idempotent)',
    type: PhotoResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Invalid request body' })
  @ApiNotFoundResponse({ description: 'Event not found' })
  create(@Body(new ValidationPipe()) dto: CreatePhotoDto) {
    return this.photosService.create({
      eventToken: dto.eventToken,
      storagePath: dto.storagePath,
      publicUrl: dto.publicUrl,
    });
  }

  @Post('bulk-seed')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: '[TEST ONLY] Seed 1.jpg to N.jpg for an event',
    description:
      'Inserts N photo records (1.jpg through N.jpg). For testing without Bruno Run with Parameters. Remove manually when done.',
  })
  @ApiBody({ type: BulkSeedPhotosDto })
  @ApiCreatedResponse({
    description: 'Photos seeded',
    type: PhotoResponseDto,
    isArray: true,
  })
  @ApiNotFoundResponse({ description: 'Event not found' })
  bulkSeed(
    @Body(new ValidationPipe({ transform: true, whitelist: true }))
    dto: BulkSeedPhotosDto,
  ) {
    if (process.env.NODE_ENV !== 'development' && process.env.NODE_ENV !== 'local') {
      throw new NotFoundException(EXCEPTION_RESPONSE.ENDPOINT_NOT_FOUND);
    }
    return this.photosService.bulkSeed({
      eventToken: dto.eventToken,
      storageBase: dto.storageBase,
      count: dto.count,
    });
  }

  @Delete('/photobooth/:id')
  @Public()
  @Photobooth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Permanently remove a photo by ID (DB row and Supabase files)' })
  @ApiParam({ name: 'id', type: Number, description: 'Photo ID' })
  @ApiNoContentResponse({ description: 'Photo deleted' })
  @ApiNotFoundResponse({ description: 'Photo not found' })
  async publicRemove(@Param('id') id: string) {
    await this.photosService.remove(+id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Permanently remove a photo by ID (DB row and Supabase files)' })
  @ApiParam({ name: 'id', type: Number, description: 'Photo ID' })
  @ApiNoContentResponse({ description: 'Photo deleted' })
  @ApiNotFoundResponse({ description: 'Photo not found' })
  async remove(@Param('id') id: string) {
    await this.photosService.remove(+id);
  }

  @Post('event/:eventToken/personalized/upload-url')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Generate a signed upload URL for a personalized event photo',
  })
  @ApiParam({
    name: 'eventToken',
    type: String,
    description: 'Event token (UUID)',
  })
  @ApiBody({ type: CreatePersonalizedUploadUrlDto })
  @ApiOkResponse({
    description: 'Signed upload URL generated successfully',
    type: PresignResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Invalid request body' })
  @ApiNotFoundResponse({ description: 'Event not found' })
  presignPersonalizedUpload(
    @Param('eventToken') eventToken: string,
    @Body(new ValidationPipe({ transform: true, whitelist: true }))
    dto: CreatePersonalizedUploadUrlDto,
  ) {
    return this.photosService.createPersonalizedUploadUrl({
      eventToken,
      fileName: dto.fileName,
      mime: dto.mime,
      storageEnv: dto.storageEnv,
    });
  }

  @Post('event/:eventToken/devoted/upload-url')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Generate a signed upload URL for a devoted (dedicated) event photo',
  })
  @ApiParam({
    name: 'eventToken',
    type: String,
    description: 'Event token (UUID)',
  })
  @ApiBody({ type: CreatePersonalizedUploadUrlDto })
  @ApiOkResponse({
    description: 'Signed upload URL generated successfully',
    type: PresignResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Invalid request body' })
  @ApiNotFoundResponse({ description: 'Event not found' })
  presignDevotedUpload(
    @Param('eventToken') eventToken: string,
    @Body(new ValidationPipe({ transform: true, whitelist: true }))
    dto: CreatePersonalizedUploadUrlDto,
  ) {
    return this.photosService.createDevotedUploadUrl({
      eventToken,
      fileName: dto.fileName,
      mime: dto.mime,
      storageEnv: dto.storageEnv,
    });
  }
}
