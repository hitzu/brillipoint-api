import { Body, Controller, Post, ValidationPipe } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';

import { CreateThemeAssetUploadUrlDto } from './dto/create-theme-asset-upload-url.dto';
import { ThemeAssetUploadUrlDto } from './dto/theme-asset-upload-url.dto';
import { ThemeAssetUploadsService } from './theme-asset-uploads.service';

@ApiTags('theme-assets')
@ApiBearerAuth()
@Controller('theme-assets')
export class ThemeAssetsController {
  constructor(
    private readonly themeAssetUploadsService: ThemeAssetUploadsService,
  ) {}

  @Post('upload-url')
  @ApiOperation({
    summary: 'Create a signed upload URL for a theme image asset',
    description:
      'Flow: create the owner first (a brand kit via POST /brand-kits, a ' +
      'preset via POST /events/themes, or reference an existing event), ' +
      'then call this endpoint to get a signed upload URL, upload the file ' +
      'directly to `signedUrl`, and finally PATCH the owner overrides with ' +
      '`{ path, url: publicUrl }` in the matching image slot (`images.<slot>`). ' +
      'Staff-only; the `cover` slot 4:5 aspect ratio is validated client-side.',
  })
  @ApiBody({ type: CreateThemeAssetUploadUrlDto })
  @ApiOkResponse({ type: ThemeAssetUploadUrlDto })
  @ApiNotFoundResponse({
    description:
      'Owner not found: EVENT_THEME_NOT_FOUND, BRAND_KIT_NOT_FOUND or EVENT_NOT_FOUND',
  })
  @ApiUnprocessableEntityResponse({
    description: 'Mime type not allowed for the given slot',
  })
  async createUploadUrl(
    @Body(new ValidationPipe({ transform: true, whitelist: true }))
    dto: CreateThemeAssetUploadUrlDto,
  ): Promise<ThemeAssetUploadUrlDto> {
    return await this.themeAssetUploadsService.createSignedUploadUrl(dto);
  }
}
