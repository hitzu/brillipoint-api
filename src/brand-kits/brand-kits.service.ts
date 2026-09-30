import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';

import { EXCEPTION_RESPONSE } from '../config/errors/exception-response.config';
import { Event } from '../events/entities/event.entity';
import { withThemeWriteLock } from '../events/theme/theme-write-lock';
import { assertResolvedThemeTokensValid } from '../events/theme/validate-resolved-theme';
import { BrandKit } from './entities/brand-kit.entity';
import { BRILLIPOINT_BRAND_KIT_KEY } from './brillipoint-kit.seed';
import { CreateBrandKitDto } from './dto/create-brand-kit.dto';
import { UpdateBrandKitDto } from './dto/update-brand-kit.dto';

@Injectable()
export class BrandKitsService {
  constructor(
    @InjectRepository(BrandKit)
    private readonly brandKitsRepository: Repository<BrandKit>,
  ) {}

  async findByKey(key: string): Promise<BrandKit | null> {
    return this.brandKitsRepository.findOne({ where: { key } });
  }

  async findById(id: number): Promise<BrandKit | null> {
    return this.brandKitsRepository.findOne({ where: { id } });
  }

  /** UNIQUE(key) also blocks a soft-deleted kit's key, so the pre-check includes them. */
  async create(dto: CreateBrandKitDto): Promise<BrandKit> {
    if (dto.key === BRILLIPOINT_BRAND_KIT_KEY) {
      return withThemeWriteLock(
        this.brandKitsRepository.manager,
        async (manager) => {
          await this.assertKeyAvailable(dto.key, manager);
          const kit = manager.getRepository(BrandKit).create({
            key: dto.key,
            name: dto.name,
            overrides: dto.overrides ?? {},
          });
          await this.validateDefaultKitMutation(kit, manager);
          return manager.getRepository(BrandKit).save(kit);
        },
      );
    }

    await this.assertKeyAvailable(dto.key);
    const kit = this.brandKitsRepository.create({
      key: dto.key,
      name: dto.name,
      overrides: dto.overrides ?? {},
    });
    return this.brandKitsRepository.save(kit);
  }

  private async assertKeyAvailable(
    key: string,
    manager?: EntityManager,
  ): Promise<void> {
    const repository = manager?.getRepository(BrandKit) ?? this.brandKitsRepository;
    const existing = await repository.findOne({
      where: { key },
      withDeleted: true,
    });
    if (existing) {
      throw new ConflictException(
        EXCEPTION_RESPONSE.BRAND_KIT_KEY_ALREADY_EXISTS,
      );
    }
  }

  private async validateDefaultKitMutation(
    proposedKit: BrandKit | null,
    manager: EntityManager,
  ): Promise<void> {
    const affectedEvents = await this.queryDefaultKitEvents(
      proposedKit?.id,
      manager,
    );
    if (affectedEvents.length === 0) return;

    for (const event of affectedEvents) {
      this.validateEventLayers(event, proposedKit);
    }
  }

  private queryDefaultKitEvents(
    kitId: number | undefined,
    manager: EntityManager,
  ): Promise<Event[]> {
    const query = this.createAffectedEventsQuery(manager);
    if (kitId === undefined) {
      return query
        .where('clientKit.id IS NULL')
        .andWhere('businessKit.id IS NULL')
        .getMany();
    }

    return query
      .where(
        '(clientKit.id = :kitId OR (clientKit.id IS NULL AND businessKit.id = :kitId) OR (clientKit.id IS NULL AND businessKit.id IS NULL))',
        { kitId },
      )
      .getMany();
  }

  private createAffectedEventsQuery(manager: EntityManager) {
    return manager
      .getRepository(Event)
      .createQueryBuilder('event')
      .leftJoinAndSelect('event.eventTheme', 'eventTheme')
      .leftJoinAndSelect('event.brandKit', 'clientKit')
      .leftJoinAndSelect('event.contract', 'contract')
      .leftJoinAndSelect('contract.brand', 'business')
      .leftJoinAndSelect('business.brandKit', 'businessKit');
  }

  private async queryKitFallbackEvents(
    kitId: number,
    manager: EntityManager,
  ): Promise<Event[]> {
    return this.createAffectedEventsQuery(manager)
      .where(
        '(clientKit.id = :kitId OR (clientKit.id IS NULL AND businessKit.id = :kitId))',
        { kitId },
      )
      .getMany();
  }

  private async validateKitMutation(
    kit: BrandKit,
    manager: EntityManager,
    deleting = false,
  ): Promise<void> {
    const events = await this.queryKitFallbackEvents(kit.id, manager);
    if (events.length === 0) return;

    const defaultKit =
      kit.key === BRILLIPOINT_BRAND_KIT_KEY
        ? null
        : await manager.getRepository(BrandKit).findOne({
            where: { key: BRILLIPOINT_BRAND_KIT_KEY },
          });

    for (const event of events) {
      const currentClientKit = this.usableKit(event.brandKit);
      const affectedAsClient = currentClientKit?.id === kit.id;
      const proposedClientKit = affectedAsClient
        ? deleting
          ? null
          : kit
        : currentClientKit;
      const currentBusinessKit = this.usableKit(
        event.contract?.brand?.brandKit,
      );
      const affectedAsBusiness = currentBusinessKit?.id === kit.id;
      const proposedBusinessKit = affectedAsBusiness
        ? deleting
          ? null
          : kit
        : currentBusinessKit;
      const visualKit =
        proposedClientKit ??
        proposedBusinessKit ??
        this.usableKit(
          kit.key === BRILLIPOINT_BRAND_KIT_KEY
            ? deleting
              ? null
              : kit
            : defaultKit,
        );
      this.validateEventLayers(event, visualKit);
    }
  }

  private usableKit(kit: BrandKit | null | undefined): BrandKit | null {
    return kit && kit.deletedAt == null ? kit : null;
  }

  private validateEventLayers(event: Event, kit: BrandKit | null): void {
    const presetLayer = event.eventTheme
      ? {
          tokens: event.eventTheme.tokens ?? undefined,
          images: event.eventTheme.images ?? undefined,
        }
      : undefined;
    assertResolvedThemeTokensValid(
      presetLayer,
      kit?.overrides,
      event.themeOverrides ?? undefined,
    );
  }

  private runWithThemeWriteLock<T>(
    write: (manager: EntityManager) => Promise<T>,
  ): Promise<T> {
    return withThemeWriteLock(this.brandKitsRepository.manager, write);
  }

  async findAll(): Promise<BrandKit[]> {
    return this.brandKitsRepository.find({ order: { name: 'ASC' } });
  }

  async findOne(id: number): Promise<BrandKit> {
    const kit = await this.brandKitsRepository.findOne({ where: { id } });
    if (!kit) {
      throw new NotFoundException(EXCEPTION_RESPONSE.BRAND_KIT_NOT_FOUND);
    }
    return kit;
  }

  /** `overrides`, when sent, REPLACES the stored value entirely (no deep merge). */
  async update(id: number, dto: UpdateBrandKitDto): Promise<BrandKit> {
    return this.runWithThemeWriteLock(async (manager) => {
      const kits = manager.getRepository(BrandKit);
      const kit = await kits.findOne({ where: { id } });
      if (!kit) {
        throw new NotFoundException(EXCEPTION_RESPONSE.BRAND_KIT_NOT_FOUND);
      }
      if (dto.name !== undefined) kit.name = dto.name;
      if (dto.overrides !== undefined) kit.overrides = dto.overrides;

      if (kit.key === BRILLIPOINT_BRAND_KIT_KEY) {
        await this.validateDefaultKitMutation(kit, manager);
      } else {
        await this.validateKitMutation(kit, manager);
      }
      return kits.save(kit);
    });
  }

  /**
   * Brillipoint is the global socialCta fallback (decision R3): looked up
   * by its fixed `key`, never assumed to be a specific row id.
   */
  async getDefaultKit(): Promise<BrandKit> {
    const kit = await this.findByKey(BRILLIPOINT_BRAND_KIT_KEY);
    if (!kit) {
      throw new NotFoundException(EXCEPTION_RESPONSE.BRAND_KIT_NOT_FOUND);
    }
    return kit;
  }

  async delete(id: number): Promise<void> {
    return this.runWithThemeWriteLock(async (manager) => {
      const kits = manager.getRepository(BrandKit);
      const kit = await kits.findOne({ where: { id } });
      if (!kit) {
        throw new NotFoundException(EXCEPTION_RESPONSE.BRAND_KIT_NOT_FOUND);
      }
      if (kit.key === BRILLIPOINT_BRAND_KIT_KEY) {
        throw new ConflictException(
          EXCEPTION_RESPONSE.BRAND_KIT_DELETE_PROTECTED,
        );
      }
      await this.validateKitMutation(kit, manager, true);
      await kits.softDelete(id);
    });
  }
}
