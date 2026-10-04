import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { EventTheme } from './entities/event-themes.entity';
import { PinoLogger } from 'nestjs-pino';
import { EventThemeDto } from './dto/event-theme/event-theme.dto';
import { plainToInstance } from 'class-transformer';
import { createHash } from 'node:crypto';
import { EXCEPTION_RESPONSE } from '../config/errors/exception-response.config';
import { Event } from './entities/event.entity';
import {
  PublicEventThemeDto,
  PublicEventThemeResponseDto,
} from './dto/event-theme/public-event-theme.dto';
import { CreateEventThemeDto } from './dto/event-theme/create-event-theme.dto';
import { UpdateEventThemeDto } from './dto/event-theme/update-event-theme.dto';
import type { PreviewThemeDto } from './dto/event-theme/preview-theme.dto';
import { resolveTheme } from './theme/resolve-theme';
import type { ThemeOverrides, ThemeTemplateParams } from './theme/theme.types';
import { SYSTEM_DEFAULT_THEME_VERSION } from './theme/system-default.theme';
import { resolveSocialCta } from './theme/resolve-social-cta';
import {
  applyTemplateFallback,
  applyTemplateFallbacksToCopy,
  applyTemplateFallbacksToSocialCta,
} from './theme/apply-template-fallback';
import { validatePublicThemeTokens } from './theme/validate-theme-overrides';
import { EVENT_THEME_CACHE_CONTROL } from './theme/public-theme-cache';
import { withThemeWriteLock } from './theme/theme-write-lock';
import { BRILLIPOINT_DEFAULT_OVERRIDES } from './theme/brillipoint-default';

@Injectable()
export class EventThemeService {
  constructor(
    @InjectRepository(EventTheme)
    private readonly eventThemeRepository: Repository<EventTheme>,
    @InjectRepository(Event)
    private readonly eventRepository: Repository<Event>,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(EventThemeService.name);
  }

  async listEventThemes(): Promise<EventThemeDto[]> {
    try {
      const eventThemes = await this.eventThemeRepository.find();
      return eventThemes.map((eventThemes) =>
        plainToInstance(EventThemeDto, eventThemes, {
          excludeExtraneousValues: true,
        }),
      );
    } catch (error) {
      this.logger.error(error, 'Error listing event types');
      throw error;
    }
  }

  async createEventTheme(dto: CreateEventThemeDto): Promise<EventThemeDto> {
    const existing = await this.eventThemeRepository.findOne({
      where: { key: dto.key },
    });

    if (existing) {
      throw new ConflictException('Event theme key already exists');
    }

    const eventTheme = this.eventThemeRepository.create({
      key: dto.key,
      name: dto.name,
      tokens: dto.tokens ?? null,
      images: dto.images ?? null,
    });
    const saved = await this.eventThemeRepository.save(eventTheme);

    return plainToInstance(EventThemeDto, saved, {
      excludeExtraneousValues: true,
    });
  }

  /**
   * `key` is immutable (not present on `UpdateEventThemeDto`). `tokens`/
   * `images`, when sent, REPLACE the stored value entirely — same
   * replace-not-merge semantics.
   */
  async updateEventTheme(
    id: number,
    dto: UpdateEventThemeDto,
  ): Promise<EventThemeDto> {
    return withThemeWriteLock(this.eventThemeRepository.manager, async (manager) => {
      const eventThemes = manager.getRepository(EventTheme);
      const eventTheme = await eventThemes.findOne({ where: { id } });
      if (!eventTheme) {
        throw new NotFoundException(EXCEPTION_RESPONSE.EVENT_THEME_NOT_FOUND);
      }

      if (dto.name !== undefined) eventTheme.name = dto.name;
      if (dto.tokens !== undefined) eventTheme.tokens = dto.tokens;
      if (dto.images !== undefined) eventTheme.images = dto.images;

      if (dto.tokens !== undefined || dto.images !== undefined) {
        await this.validatePresetUpdate(eventTheme, manager);
      }
      const saved = await eventThemes.save(eventTheme);

      return plainToInstance(EventThemeDto, saved, {
        excludeExtraneousValues: true,
      });
    });
  }

  /**
   * Dry-run preview (T3): resolves exactly like the public endpoint
   * (SystemDefault -> Brillipoint default -> preset -> overrides) but never
   * persists anything.
   *
   * Additionally checks contrast on the RESOLVED tokens (unlike
   * `IsTokenContrastValid`/`IsThemeOverrides`, which only check a pair when
   * the SAME layer sets both sides, so a layer that sets only `primary` is
   * never checked against an inherited `onPrimary`). Resolved-contrast
   * failures are returned as non-blocking `warnings`, since the preview's
   * purpose is feedback, not another 400.
   */
  async previewTheme(
    dto: PreviewThemeDto,
  ): Promise<{ eventTheme: PublicEventThemeDto; warnings: string[] }> {
    let preset: EventTheme | null = null;
    if (dto.eventThemeId !== undefined) {
      preset = await this.eventThemeRepository.findOne({
        where: { id: dto.eventThemeId },
      });
      if (!preset) {
        throw new NotFoundException(EXCEPTION_RESPONSE.EVENT_THEME_NOT_FOUND);
      }
    }

    const presetLayer: ThemeOverrides | undefined = preset
      ? {
          tokens: preset.tokens ?? undefined,
          images: preset.images ?? undefined,
        }
      : undefined;

    const eventTheme = this.buildPublicTheme({
      presetId: preset?.id ?? null,
      presetKey: preset?.key ?? 'system-default',
      presetName: preset?.name ?? 'System Default',
      presetLayer,
      themeOverridesLayer: dto.themeOverrides,
      honoreesName: dto.honoreesName,
      version: `${SYSTEM_DEFAULT_THEME_VERSION}:preview`,
    });

    const warnings = validatePublicThemeTokens(eventTheme.tokens, 'tokens');

    return { eventTheme, warnings };
  }

  async getPublicThemeByEventToken(token: string): Promise<{
    body: PublicEventThemeResponseDto;
    etag: string;
    cacheControl: string;
  }> {
    const event = await this.eventRepository.findOne({
      where: { token },
      relations: { eventTheme: true },
    });

    if (!event) {
      throw new NotFoundException(EXCEPTION_RESPONSE.EVENT_NOT_FOUND);
    }

    // R4: an event without a theme resolves to the system default instead of
    // 404 — every layer below is optional.
    const eventTheme = this.toPublicTheme(event);
    const body = { eventTheme };

    return {
      body,
      etag: this.createEtag(body),
      cacheControl: EVENT_THEME_CACHE_CONTROL,
    };
  }

  /** Validate an event-local theme change with the exact public-read resolver. */
  async validateEventThemeUpdate(
    proposedEvent: Event,
    manager?: EntityManager,
  ): Promise<void> {
    const events = manager?.getRepository(Event) ?? this.eventRepository;
    const eventThemes = manager?.getRepository(EventTheme) ?? this.eventThemeRepository;
    const currentEvent = await events.findOne({
      where: { id: proposedEvent.id },
      relations: { eventTheme: true },
    });

    if (!currentEvent) {
      throw new NotFoundException(EXCEPTION_RESPONSE.EVENT_NOT_FOUND);
    }

    const preset =
      proposedEvent.eventThemeId === currentEvent.eventThemeId
        ? currentEvent.eventTheme ?? null
        : proposedEvent.eventThemeId == null
          ? null
          : await eventThemes.findOne({
              where: { id: proposedEvent.eventThemeId },
            });

    const event = Object.assign(currentEvent, {
      eventThemeId: proposedEvent.eventThemeId,
      eventTheme: preset,
      themeOverrides: proposedEvent.themeOverrides,
      honoreesNames: proposedEvent.honoreesNames,
    });

    this.toPublicTheme(event);
  }

  /** Validate the public theme for a not-yet-persisted event. */
  async validateEventThemeCreate(
    proposedEvent: Event,
    manager?: EntityManager,
  ): Promise<void> {
    const eventThemes = manager?.getRepository(EventTheme) ?? this.eventThemeRepository;
    const preset = proposedEvent.eventThemeId
      ? await eventThemes.findOne({
          where: { id: proposedEvent.eventThemeId },
        })
      : null;
    if (proposedEvent.eventThemeId != null && !preset) {
      throw new NotFoundException(EXCEPTION_RESPONSE.EVENT_THEME_NOT_FOUND);
    }

    const presetLayer: ThemeOverrides | undefined = preset
      ? {
          tokens: preset.tokens ?? undefined,
          images: preset.images ?? undefined,
        }
      : undefined;

    const publicTheme = this.buildPublicTheme({
      presetId: preset?.id ?? null,
      presetKey: preset?.key ?? 'system-default',
      presetName: preset?.name ?? 'System Default',
      presetLayer,
      themeOverridesLayer: proposedEvent.themeOverrides ?? undefined,
      honoreesName: proposedEvent.honoreesNames,
      version: `${SYSTEM_DEFAULT_THEME_VERSION}:validation`,
    });

    this.assertPublicThemeValid(publicTheme);
  }

  isMatchingEtag(ifNoneMatch: string | undefined, etag: string): boolean {
    if (!ifNoneMatch) return false;

    return ifNoneMatch
      .split(',')
      .map((value) => value.trim())
      .some((value) => value === etag || value === `W/${etag}`);
  }

  /** Validate every event linked to a proposed preset in one transaction-bound join. */
  private async validatePresetUpdate(
    proposedPreset: EventTheme,
    manager: EntityManager,
  ): Promise<void> {
    const events = await manager
      .getRepository(Event)
      .createQueryBuilder('event')
      .leftJoinAndSelect('event.eventTheme', 'eventTheme')
      .where('event.eventThemeId = :presetId', { presetId: proposedPreset.id })
      .getMany();

    if (events.length === 0) return;

    for (const event of events) {
      event.eventTheme = proposedPreset;
      this.toPublicTheme(event);
    }
  }

  private toPublicTheme(event: Event): PublicEventThemeDto {
    const preset = event.eventTheme ?? null;

    const presetLayer: ThemeOverrides | undefined = preset
      ? {
          tokens: preset.tokens ?? undefined,
          images: preset.images ?? undefined,
        }
      : undefined;

    const version = `${SYSTEM_DEFAULT_THEME_VERSION}:${this.maxUpdatedAtIso(event, preset)}`;

    const publicTheme = this.buildPublicTheme({
      presetId: preset?.id ?? null,
      presetKey: preset?.key ?? 'system-default',
      presetName: preset?.name ?? 'System Default',
      presetLayer,
      themeOverridesLayer: event.themeOverrides ?? undefined,
      honoreesName: event.honoreesNames,
      version,
    });

    this.assertPublicThemeValid(publicTheme);

    return publicTheme;
  }

  private assertPublicThemeValid(publicTheme: PublicEventThemeDto): void {
    const errors = validatePublicThemeTokens(publicTheme.tokens);
    if (errors.length > 0) {
      throw new UnprocessableEntityException({
        message: 'Resolved public event theme is invalid',
        errors,
      });
    }
  }

  /**
   * Shared theme resolution, extracted from `toPublicTheme` (T3): merges
   * Brillipoint default -> preset -> event overrides via `resolveTheme`,
   * resolves the whole-block socialCta fallback independently (T6), and
   * applies `{{key}}` template fallbacks. Used by both the public endpoint
   * and the staff-only preview dry-run.
   */
  private buildPublicTheme(input: {
    presetId: number | null;
    presetKey: string;
    presetName: string;
    presetLayer: ThemeOverrides | undefined;
    themeOverridesLayer: ThemeOverrides | undefined;
    honoreesName: string | null | undefined;
    version: string;
  }): PublicEventThemeDto {
    const resolved = resolveTheme(
      BRILLIPOINT_DEFAULT_OVERRIDES,
      input.presetLayer,
      input.themeOverridesLayer,
    );

    // T6: socialCta uses its own whole-block fallback, independent from the
    // layer merge: an unusable event block falls back to the Brillipoint
    // default, so the CTA (our main acquisition point) never disappears.
    const resolvedSocialCta = resolveSocialCta(
      input.themeOverridesLayer?.socialCta,
      BRILLIPOINT_DEFAULT_OVERRIDES.socialCta,
    );

    const params: ThemeTemplateParams = {};
    const honoreesName = input.honoreesName?.trim();
    if (honoreesName) {
      params.honoreesName = honoreesName;
    }

    const socialCta = applyTemplateFallbacksToSocialCta(
      resolvedSocialCta,
      params,
    );
    const copy = applyTemplateFallbacksToCopy(resolved.copy, params);
    const rewardPromo = resolved.rewardPromo
      ? {
          ...resolved.rewardPromo,
          title: resolved.rewardPromo.title
            ? applyTemplateFallback(resolved.rewardPromo.title, params)
            : resolved.rewardPromo.title,
          disclaimer: resolved.rewardPromo.disclaimer
            ? applyTemplateFallback(resolved.rewardPromo.disclaimer, params)
            : resolved.rewardPromo.disclaimer,
        }
      : null;

    return {
      id: input.presetId,
      key: input.presetKey,
      name: input.presetName,
      version: input.version,
      tokens: resolved.tokens,
      images: resolved.images,
      decorations: resolved.decorations,
      socialCta,
      rewardPromo,
      copy,
      params,
    };
  }

  /**
   * Version (decision R5): the max `updatedAt` among the DB layers actually
   * applied — the preset (when present) and the event row itself (the
   * source of `theme_overrides`).
   */
  private maxUpdatedAtIso(event: Event, preset: EventTheme | null): string {
    const dates = [preset?.updatedAt, event.updatedAt].filter(
      (date): date is Date => date instanceof Date,
    );

    const maxTime = Math.max(...dates.map((date) => date.getTime()));
    return new Date(maxTime).toISOString();
  }

  private createEtag(body: PublicEventThemeResponseDto): string {
    const hash = createHash('sha256')
      .update(JSON.stringify(body))
      .digest('base64url');

    return `"event-theme-${hash}"`;
  }
}
