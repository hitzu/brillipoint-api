import {
  BadRequestException,
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
import { Contract } from '../contracts/entities/contract.entity';
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
import { BrandKit } from '../brand-kits/entities/brand-kit.entity';
import { BrandKitsService } from '../brand-kits/brand-kits.service';
import {
  BRILLIPOINT_BRAND_KIT_KEY,
  BRILLIPOINT_BRAND_KIT_NAME,
  BRILLIPOINT_BRAND_KIT_OVERRIDES,
} from '../brand-kits/brillipoint-kit.seed';
import {
  resolveSocialCta,
  type SocialCtaKitCandidate,
} from './theme/resolve-social-cta';
import {
  applyTemplateFallback,
  applyTemplateFallbacksToCopy,
  applyTemplateFallbacksToSocialCta,
} from './theme/apply-template-fallback';
import { validatePublicThemeTokens } from './theme/validate-theme-overrides';
import { EVENT_THEME_CACHE_CONTROL } from './theme/public-theme-cache';
import { withThemeWriteLock } from './theme/theme-write-lock';
import { toVisualKitLayer } from './theme/visual-kit-layer';

/** A soft-deleted kit must never be treated as an applied layer (R3/T5). */
function usableKit(kit: BrandKit | null | undefined): BrandKit | null {
  return kit && kit.deletedAt == null ? kit : null;
}

function toSocialCtaKitCandidate(
  kit: BrandKit | null,
): SocialCtaKitCandidate | null {
  return kit
    ? { key: kit.key, name: kit.name, overrides: kit.overrides }
    : null;
}

const BRILLIPOINT_SOCIAL_CTA_SAFETY_NET: SocialCtaKitCandidate = {
  key: BRILLIPOINT_BRAND_KIT_KEY,
  name: BRILLIPOINT_BRAND_KIT_NAME,
  overrides: BRILLIPOINT_BRAND_KIT_OVERRIDES,
};

@Injectable()
export class EventThemeService {
  constructor(
    @InjectRepository(EventTheme)
    private readonly eventThemeRepository: Repository<EventTheme>,
    @InjectRepository(Event)
    private readonly eventRepository: Repository<Event>,
    @InjectRepository(Contract)
    private readonly contractRepository: Repository<Contract>,
    private readonly brandKitsService: BrandKitsService,
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
   * replace-not-merge semantics as `BrandKitsService.update` (T1).
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
   * (SystemDefault -> preset -> kit -> overrides) but never persists
   * anything. `brandKitId` and `brandKit` (inline, unsaved) are mutually
   * exclusive. With neither, the socialCta chain falls straight to the
   * Brillipoint default kit — there is no contract context in a preview.
   *
   * Additionally checks contrast on the RESOLVED tokens (unlike
   * `IsTokenContrastValid`/`IsThemeOverrides`, which only check a pair when
   * the SAME layer sets both sides, so a kit that sets only `primary` is
   * never checked against an inherited `onPrimary`). Resolved-contrast
   * failures are returned as non-blocking `warnings`, since the preview's
   * purpose is feedback, not another 400.
   */
  async previewTheme(
    dto: PreviewThemeDto,
  ): Promise<{ eventTheme: PublicEventThemeDto; warnings: string[] }> {
    if (dto.brandKitId !== undefined && dto.brandKit !== undefined) {
      throw new BadRequestException(
        'brandKitId and brandKit are mutually exclusive',
      );
    }
    if (dto.brandKitName !== undefined && dto.brandKit === undefined) {
      throw new BadRequestException('brandKitName requires an inline brandKit');
    }

    let preset: EventTheme | null = null;
    if (dto.eventThemeId !== undefined) {
      preset = await this.eventThemeRepository.findOne({
        where: { id: dto.eventThemeId },
      });
      if (!preset) {
        throw new NotFoundException(EXCEPTION_RESPONSE.EVENT_THEME_NOT_FOUND);
      }
    }

    let kitLayer: ThemeOverrides | undefined;
    let kitCandidate: SocialCtaKitCandidate | null = null;

    if (dto.brandKitId !== undefined) {
      const kit = usableKit(
        await this.brandKitsService.findById(dto.brandKitId),
      );
      if (!kit) {
        throw new NotFoundException(EXCEPTION_RESPONSE.BRAND_KIT_NOT_FOUND);
      }
      kitLayer = kit.overrides;
      kitCandidate = { key: kit.key, name: kit.name, overrides: kit.overrides };
    } else if (dto.brandKit !== undefined) {
      kitLayer = dto.brandKit;
      // An inline kit has no saved identity: `brandKitName` stands in for its
      // name; when absent, the empty name keeps `brandName` out of the
      // response params (falsy check in buildPublicTheme).
      kitCandidate = {
        key: 'preview-brand-kit',
        name: dto.brandKitName?.trim() ?? '',
        overrides: dto.brandKit,
      };
    }

    const brillipointKit = await this.getDefaultKitOrNull();

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
      kitLayer,
      themeOverridesLayer: dto.themeOverrides,
      socialCandidates: [kitCandidate, toSocialCtaKitCandidate(brillipointKit)],
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
      relations: {
        eventTheme: true,
        brandKit: true,
        contract: { brand: { brandKit: true } },
      },
    });

    if (!event) {
      throw new NotFoundException(EXCEPTION_RESPONSE.EVENT_NOT_FOUND);
    }

    // R4: an event without a theme resolves to the system default instead of
    // 404 — every layer below is optional.
    const clientKit = usableKit(event.brandKit);
    const businessKit = usableKit(event.contract?.brand?.brandKit);
    // Fetched eagerly: the socialCta chain (T6) may need the Brillipoint
    // fallback even when a client/business kit exists but its own socialCta
    // block is absent or unusable — a different chain than the visual layer.
    const brillipointKit = await this.getDefaultKitOrNull();
    const visualKit = clientKit ?? businessKit ?? brillipointKit;

    const eventTheme = this.toPublicTheme(event, visualKit, {
      clientKit,
      businessKit,
      brillipointKit,
    });
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
      relations: {
        eventTheme: true,
        brandKit: true,
        contract: { brand: { brandKit: true } },
      },
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
    const clientKit =
      proposedEvent.brandKitId === currentEvent.brandKitId
        ? usableKit(currentEvent.brandKit)
        : proposedEvent.brandKitId == null
          ? null
          : usableKit(
              await (manager
                ? manager.getRepository(BrandKit).findOne({
                    where: { id: proposedEvent.brandKitId },
                  })
                : this.brandKitsService.findById(proposedEvent.brandKitId)),
            );

    const event = Object.assign(currentEvent, {
      eventThemeId: proposedEvent.eventThemeId,
      eventTheme: preset,
      brandKitId: proposedEvent.brandKitId,
      brandKit: clientKit,
      themeOverrides: proposedEvent.themeOverrides,
      honoreesNames: proposedEvent.honoreesNames,
    });
    const businessKit = usableKit(event.contract?.brand?.brandKit);
    const brillipointKit = await this.getDefaultKitOrNull(manager);

    this.toPublicTheme(event, clientKit ?? businessKit ?? brillipointKit, {
      clientKit,
      businessKit,
      brillipointKit,
    });
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

    const contract = await (manager?.getRepository(Contract) ?? this.contractRepository).findOne({
      where: { id: proposedEvent.contractId },
      relations: { brand: { brandKit: true } },
    });
    const businessKit = usableKit(contract?.brand?.brandKit);
    const brillipointKit = await this.getDefaultKitOrNull(manager);
    const visualKit = businessKit ?? brillipointKit;
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
      kitLayer: toVisualKitLayer(visualKit),
      themeOverridesLayer: proposedEvent.themeOverrides ?? undefined,
      socialCandidates: [
        toSocialCtaKitCandidate(businessKit),
        toSocialCtaKitCandidate(brillipointKit),
      ],
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

  /**
   * Brillipoint default kit (decision R3), used both as the last visual
   * layer and as the last socialCta fallback. A missing default kit is not
   * an error — the layer is simply skipped, never a 500.
   */
  private async getDefaultKitOrNull(manager?: EntityManager): Promise<BrandKit | null> {
    try {
      return manager
        ? await manager.getRepository(BrandKit).findOne({
            where: { key: BRILLIPOINT_BRAND_KIT_KEY },
          })
        : await this.brandKitsService.getDefaultKit();
    } catch {
      return null;
    }
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
      .leftJoinAndSelect('event.brandKit', 'clientKit')
      .leftJoinAndSelect('event.contract', 'contract')
      .leftJoinAndSelect('contract.brand', 'business')
      .leftJoinAndSelect('business.brandKit', 'businessKit')
      .where('event.eventThemeId = :presetId', { presetId: proposedPreset.id })
      .getMany();

    if (events.length === 0) return;

    const brillipointKit = usableKit(await this.getDefaultKitOrNull(manager));
    for (const event of events) {
      const clientKit = usableKit(event.brandKit);
      const businessKit = usableKit(event.contract?.brand?.brandKit);
      event.eventTheme = proposedPreset;
      this.toPublicTheme(event, clientKit ?? businessKit ?? brillipointKit, {
        clientKit,
        businessKit,
        brillipointKit,
      });
    }
  }

  private toPublicTheme(
    event: Event,
    visualKit: BrandKit | null,
    socialKits: {
      clientKit: BrandKit | null;
      businessKit: BrandKit | null;
      brillipointKit: BrandKit | null;
    },
  ): PublicEventThemeDto {
    const preset = event.eventTheme ?? null;

    const presetLayer: ThemeOverrides | undefined = preset
      ? {
          tokens: preset.tokens ?? undefined,
          images: preset.images ?? undefined,
        }
      : undefined;

    const version = `${SYSTEM_DEFAULT_THEME_VERSION}:${this.maxUpdatedAtIso(event, preset, visualKit)}`;

    const publicTheme = this.buildPublicTheme({
      presetId: preset?.id ?? null,
      presetKey: preset?.key ?? 'system-default',
      presetName: preset?.name ?? 'System Default',
      presetLayer,
      kitLayer: toVisualKitLayer(visualKit),
      themeOverridesLayer: event.themeOverrides ?? undefined,
      socialCandidates: [
        toSocialCtaKitCandidate(socialKits.clientKit),
        toSocialCtaKitCandidate(socialKits.businessKit),
        toSocialCtaKitCandidate(socialKits.brillipointKit),
      ],
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
   * tokens/images/decorations/copy via `resolveTheme`, resolves the
   * whole-block socialCta fallback chain independently (T6), and applies
   * `{{key}}` template fallbacks. Used by both the public endpoint and the
   * staff-only preview dry-run — the only difference between callers is
   * which layers/candidates they pass in.
   */
  private buildPublicTheme(input: {
    presetId: number | null;
    presetKey: string;
    presetName: string;
    presetLayer: ThemeOverrides | undefined;
    kitLayer: ThemeOverrides | undefined;
    themeOverridesLayer: ThemeOverrides | undefined;
    socialCandidates: Array<SocialCtaKitCandidate | null | undefined>;
    honoreesName: string | null | undefined;
    version: string;
  }): PublicEventThemeDto {
    const resolved = resolveTheme(
      input.presetLayer,
      input.kitLayer,
      input.themeOverridesLayer,
    );

    // T6: socialCta uses its own whole-block fallback chain, independent
    // from the visual layer — a kit may win the visual layer but have no
    // usable socialCta of its own, in which case the chain keeps looking.
    // Hardcoded Brillipoint block as the very last candidate: if the DB row
    // is missing or was edited into an unusable block, the CTA (our main
    // acquisition point) still never disappears.
    const socialCtaResolution = resolveSocialCta(
      input.themeOverridesLayer?.socialCta,
      [...input.socialCandidates, BRILLIPOINT_SOCIAL_CTA_SAFETY_NET],
    );

    const params: ThemeTemplateParams = {};
    const honoreesName = input.honoreesName?.trim();
    if (honoreesName) {
      params.honoreesName = honoreesName;
    }
    if (socialCtaResolution.brandName) {
      params.brandName = socialCtaResolution.brandName;
    }

    const socialCta = applyTemplateFallbacksToSocialCta(
      socialCtaResolution.socialCta,
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
   * applied — the preset (when present), the resolved kit (when present),
   * and the event row itself (the source of `theme_overrides`).
   */
  private maxUpdatedAtIso(
    event: Event,
    preset: EventTheme | null,
    kit: BrandKit | null,
  ): string {
    const dates = [preset?.updatedAt, kit?.updatedAt, event.updatedAt].filter(
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
