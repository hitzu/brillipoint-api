import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient } from '@supabase/supabase-js';

import { EXCEPTION_RESPONSE } from '../../config/errors/exception-response.config';

/**
 * Shared Supabase storage boundary, extracted from
 * `PrepProfileUploadsService` (T4/theme-authoring) so theme assets can reuse
 * the same signed-upload/public-URL behavior without duplicating the
 * Supabase client setup.
 */
@Injectable()
export class StorageService {
  private _client: ReturnType<typeof createClient> | undefined;

  constructor(private readonly configService: ConfigService) {}

  private get client() {
    if (this._client) {
      return this._client;
    }

    const url = this.configService.get<string>('SUPABASE_URL');
    const serviceKey = this.configService.get<string>(
      'SUPABASE_SERVICE_ROLE_KEY',
    );
    if (!url || !serviceKey) {
      throw new InternalServerErrorException(
        'Supabase storage is not configured',
      );
    }

    this._client = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    return this._client;
  }

  get bucket(): string {
    const bucket = this.configService.get<string>('SUPABASE_STORAGE_BUCKET');
    return bucket || 'public';
  }

  /**
   * Private bucket for files that must never be reachable through a public
   * URL (payment receipts). Throws when it is not configured so a missing
   * variable never silently falls back to the public bucket.
   */
  get privateBucket(): string {
    const bucket = this.configService.get<string>(
      'STORAGE_PRIVATE_BUCKET',
    );
    if (!bucket) {
      throw new InternalServerErrorException(
        'Private storage bucket is not configured',
      );
    }
    return bucket;
  }

  getPublicUrl(path: string): string {
    const baseUrl = this.configService.get<string>('SUPABASE_URL');
    if (!baseUrl) {
      throw new InternalServerErrorException(
        EXCEPTION_RESPONSE.SUPABASE_STORAGE_NOT_CONFIGURED,
      );
    }
    return `${baseUrl.replace(/\/$/, '')}/storage/v1/object/public/${this.bucket}/${path}`;
  }

  async createSignedReadUrl(input: {
    path: string;
    expiresIn: number;
    bucket?: string;
  }): Promise<string> {
    const { data, error } = await this.client.storage
      .from(input.bucket ?? this.bucket)
      .createSignedUrl(input.path, input.expiresIn);

    if (error || !data?.signedUrl) {
      throw new InternalServerErrorException(
        'Failed to create signed read URL',
      );
    }

    return data.signedUrl;
  }

  async createSignedUploadUrl(
    path: string,
    bucket?: string,
  ): Promise<{ signedUrl: string; token: string }> {
    const { data, error } = await this.client.storage
      .from(bucket ?? this.bucket)
      .createSignedUploadUrl(path);

    if (error || !data?.signedUrl || !data?.token) {
      throw new InternalServerErrorException(
        'Failed to create signed upload URL',
      );
    }

    return { signedUrl: data.signedUrl, token: data.token };
  }

  sanitizeFileName(fileName: string): string {
    const trimmed = fileName.trim();
    const noPath = trimmed.replace(/[\\/]/g, '_');
    const safe = noPath.replace(/[^\w.-]+/g, '_');
    return safe.length > 120 ? safe.slice(-120) : safe;
  }
}
