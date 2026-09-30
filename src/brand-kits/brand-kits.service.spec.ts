import {
  ConflictException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { AppDataSource as TestDataSource } from '../config/database/data-source';
import { BrandKit } from './entities/brand-kit.entity';
import { BrandKitsService } from './brand-kits.service';
import { BrandKitFactory } from '../../test/factories/brand-kits/brand-kit.factory';
import { BrandFactory } from '../../test/factories/brands/brands.factories';
import { ContractFactory } from '../../test/factories/contracts/contract.factory';
import { EventFactory } from '../../test/factories/events/event.factory';
import { Event } from '../events/entities/event.entity';
import {
  BRILLIPOINT_BRAND_KIT_KEY,
  BRILLIPOINT_BRAND_KIT_NAME,
  BRILLIPOINT_BRAND_KIT_OVERRIDES,
} from './brillipoint-kit.seed';

describe('BrandKitsService', () => {
  let service: BrandKitsService;
  let factory: BrandKitFactory;
  let events: EventFactory;
  let brands: BrandFactory;
  let contracts: ContractFactory;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BrandKitsService,
        {
          provide: getRepositoryToken(BrandKit),
          useValue: TestDataSource.getRepository(BrandKit),
        },
      ],
    }).compile();

    service = module.get<BrandKitsService>(BrandKitsService);
    factory = new BrandKitFactory(TestDataSource);
    events = new EventFactory(TestDataSource);
    brands = new BrandFactory(TestDataSource);
    contracts = new ContractFactory(TestDataSource);
  });

  // ─── findByKey ─────────────────────────────────────────────────────────

  describe('findByKey', () => {
    it('returns the kit when a kit with that key exists', async () => {
      // Arrange
      const kit = await factory.create({ key: 'acme' });

      // Act
      const result = await service.findByKey('acme');

      // Assert
      expect(result?.id).toBe(kit.id);
    });

    it('returns null when no kit has that key', async () => {
      // Arrange — no kit created

      // Act
      const result = await service.findByKey('unknown-key');

      // Assert
      expect(result).toBeNull();
    });
  });

  // ─── getDefaultKit ─────────────────────────────────────────────────────

  describe('getDefaultKit', () => {
    it('returns the seeded Brillipoint kit with whatsapp primary action and 3 socials', async () => {
      // Arrange
      await factory.create({
        key: BRILLIPOINT_BRAND_KIT_KEY,
        name: BRILLIPOINT_BRAND_KIT_NAME,
        overrides: BRILLIPOINT_BRAND_KIT_OVERRIDES,
      });

      // Act
      const result = await service.getDefaultKit();

      // Assert
      expect(result.key).toBe(BRILLIPOINT_BRAND_KIT_KEY);
      expect(result.overrides.socialCta?.primaryAction?.channel).toBe(
        'whatsapp',
      );
      expect(
        Object.keys(result.overrides.socialCta?.socials ?? {}),
      ).toHaveLength(3);
    });
  });

  // ─── create ────────────────────────────────────────────────────────────

  describe('create', () => {
    it('creates a kit with the given key, name and overrides', async () => {
      // Arrange
      const dto = {
        key: 'acme-corp',
        name: 'Acme Corp',
        overrides: { tokens: { primary: '#000000' } },
      };

      // Act
      const result = await service.create(dto);

      // Assert
      expect(result).toMatchObject({
        key: 'acme-corp',
        name: 'Acme Corp',
        overrides: { tokens: { primary: '#000000' } },
      });
    });

    it('defaults overrides to an empty object when omitted', async () => {
      // Arrange
      const dto = { key: 'no-overrides', name: 'No Overrides' };

      // Act
      const result = await service.create(dto);

      // Assert
      expect(result.overrides).toEqual({});
    });

    it('rejects a duplicate key', async () => {
      // Arrange
      await factory.create({ key: 'acme-corp' });

      // Act + Assert
      await expect(
        service.create({ key: 'acme-corp', name: 'Another Acme' }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('rejects a key already used by a soft-deleted kit', async () => {
      // Arrange
      const kit = await factory.create({ key: 'acme-corp' });
      await service.delete(kit.id);

      // Act + Assert
      await expect(
        service.create({ key: 'acme-corp', name: 'Reused Key' }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('rejects an invalid new Brillipoint default when fallback events exist', async () => {
      // Arrange
      const contract = await contracts.create();
      await events.create({ contractId: contract.id });

      // Act
      const createDefault = service.create({
        key: BRILLIPOINT_BRAND_KIT_KEY,
        name: BRILLIPOINT_BRAND_KIT_NAME,
        overrides: { tokens: { primary: '#FFFFFF' } },
      });

      // Assert
      await expect(createDefault).rejects.toBeInstanceOf(
        UnprocessableEntityException,
      );
      await expect(service.findByKey(BRILLIPOINT_BRAND_KIT_KEY)).resolves.toBeNull();
    });

    it('rejects an invalid Brillipoint default for events with a soft-deleted client kit', async () => {
      // Arrange
      const client = await factory.create({ key: 'deleted-client-before-default' });
      const contract = await contracts.create();
      await events.create({ contractId: contract.id, brandKitId: client.id });
      await service.delete(client.id);

      // Act
      const createDefault = service.create({
        key: BRILLIPOINT_BRAND_KIT_KEY,
        name: BRILLIPOINT_BRAND_KIT_NAME,
        overrides: { tokens: { primary: '#FFFFFF' } },
      });

      // Assert
      await expect(createDefault).rejects.toBeInstanceOf(
        UnprocessableEntityException,
      );
    });
  });

  // ─── findAll ───────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('returns non-deleted kits ordered by name', async () => {
      // Arrange
      await factory.create({ key: 'zeta', name: 'Zeta Co' });
      await factory.create({ key: 'alpha', name: 'Alpha Co' });
      const deleted = await factory.create({ key: 'gone', name: 'Gone Co' });
      await service.delete(deleted.id);

      // Act
      const result = await service.findAll();

      // Assert
      expect(result.map((kit) => kit.name)).toEqual(['Alpha Co', 'Zeta Co']);
    });

    it('returns an empty array when no kits exist', async () => {
      // Arrange — no kit created

      // Act
      const result = await service.findAll();

      // Assert
      expect(result).toEqual([]);
    });
  });

  // ─── findOne ───────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('returns the kit when it exists', async () => {
      // Arrange
      const kit = await factory.create({ key: 'acme' });

      // Act
      const result = await service.findOne(kit.id);

      // Assert
      expect(result.id).toBe(kit.id);
    });

    it('throws NotFoundException when the kit does not exist', async () => {
      // Arrange — no kit created

      // Act + Assert
      await expect(service.findOne(999999)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  // ─── update ────────────────────────────────────────────────────────────

  describe('update', () => {
    it('updates the name', async () => {
      // Arrange
      const kit = await factory.create({ key: 'acme', name: 'Old Name' });

      // Act
      const result = await service.update(kit.id, { name: 'New Name' });

      // Assert
      expect(result.name).toBe('New Name');
    });

    it('replaces overrides entirely instead of merging', async () => {
      // Arrange
      const kit = await factory.create({
        key: 'acme',
        overrides: {
          tokens: { primary: '#111111' },
          socialCta: { headline: { text: { es: 'Hola' } } },
        },
      });

      // Act
      const result = await service.update(kit.id, {
        overrides: { tokens: { primary: '#222222' } },
      });

      // Assert
      expect(result.overrides).toEqual({ tokens: { primary: '#222222' } });
    });

    it('rejects an invalid client kit palette without changing the kit', async () => {
      // Arrange
      const kit = await factory.create({ key: 'client-kit' });
      await events.create({ brandKitId: kit.id });

      // Act
      const update = service.update(kit.id, {
        overrides: { tokens: { primary: '#FFFFFF' } },
      });

      // Assert
      await expect(update).rejects.toBeInstanceOf(UnprocessableEntityException);
      await expect(service.findOne(kit.id)).resolves.toMatchObject({
        overrides: {},
      });
    });

    it('allows a dormant partial kit with no affected events', async () => {
      // Arrange
      const kit = await factory.create({ key: 'dormant-kit' });

      // Act
      const result = await service.update(kit.id, {
        overrides: { tokens: { primary: '#FFFFFF' } },
      });

      // Assert
      expect(result.overrides).toEqual({ tokens: { primary: '#FFFFFF' } });
    });

    it('rejects an invalid business-kit fallback used by an event', async () => {
      // Arrange
      const kit = await factory.create({ key: 'business-kit' });
      const brand = await brands.create({ brandKitId: kit.id });
      const contract = await contracts.create({ brandId: brand.id });
      await events.create({ contractId: contract.id });

      // Act
      const update = service.update(kit.id, {
        overrides: { tokens: { primary: '#FFFFFF' } },
      });

      // Assert
      await expect(update).rejects.toBeInstanceOf(UnprocessableEntityException);
      await expect(service.findOne(kit.id)).resolves.toMatchObject({
        overrides: {},
      });
    });

    it('rejects an invalid business kit when the client kit relation is soft-deleted', async () => {
      // Arrange
      const client = await factory.create({ key: 'deleted-client-before-business' });
      const kit = await factory.create({ key: 'business-after-deleted-client' });
      const brand = await brands.create({ brandKitId: kit.id });
      const contract = await contracts.create({ brandId: brand.id });
      await events.create({ contractId: contract.id, brandKitId: client.id });
      await service.delete(client.id);

      // Act
      const update = service.update(kit.id, {
        overrides: { tokens: { primary: '#FFFFFF' } },
      });

      // Assert
      await expect(update).rejects.toBeInstanceOf(UnprocessableEntityException);
      await expect(service.findOne(kit.id)).resolves.toMatchObject({
        overrides: {},
      });
    });

    it('uses event overrides after the proposed client kit when validating', async () => {
      // Arrange
      const kit = await factory.create({ key: 'repaired-client-kit' });
      const contract = await contracts.create();
      await events.create({
        contractId: contract.id,
        brandKitId: kit.id,
        themeOverrides: { tokens: { primary: '#000000' } },
      });

      // Act
      const result = await service.update(kit.id, {
        overrides: { tokens: { primary: '#FFFFFF' } },
      });

      // Assert
      expect(result.overrides).toEqual({ tokens: { primary: '#FFFFFF' } });
    });

    it('rejects an invalid Brillipoint update for events using the default fallback', async () => {
      // Arrange
      const kit = await factory.create({
        key: BRILLIPOINT_BRAND_KIT_KEY,
        name: BRILLIPOINT_BRAND_KIT_NAME,
        overrides: BRILLIPOINT_BRAND_KIT_OVERRIDES,
      });
      const contract = await contracts.create();
      await events.create({ contractId: contract.id });

      // Act
      const update = service.update(kit.id, {
        overrides: { tokens: { primary: '#FFFFFF' } },
      });

      // Assert
      await expect(update).rejects.toBeInstanceOf(UnprocessableEntityException);
      await expect(service.findOne(kit.id)).resolves.toMatchObject({
        overrides: BRILLIPOINT_BRAND_KIT_OVERRIDES,
      });
    });

    it('rejects an invalid Brillipoint update when directly assigned to an event', async () => {
      // Arrange
      const kit = await factory.create({
        key: BRILLIPOINT_BRAND_KIT_KEY,
        name: BRILLIPOINT_BRAND_KIT_NAME,
        overrides: BRILLIPOINT_BRAND_KIT_OVERRIDES,
      });
      await events.create({ brandKitId: kit.id });

      // Act
      const update = service.update(kit.id, {
        overrides: { tokens: { primary: '#FFFFFF' } },
      });

      // Assert
      await expect(update).rejects.toBeInstanceOf(UnprocessableEntityException);
      await expect(service.findOne(kit.id)).resolves.toMatchObject({
        overrides: BRILLIPOINT_BRAND_KIT_OVERRIDES,
      });
    });

    it('rejects an invalid Brillipoint update when used as a business fallback', async () => {
      // Arrange
      const kit = await factory.create({
        key: BRILLIPOINT_BRAND_KIT_KEY,
        name: BRILLIPOINT_BRAND_KIT_NAME,
        overrides: BRILLIPOINT_BRAND_KIT_OVERRIDES,
      });
      const brand = await brands.create({ brandKitId: kit.id });
      const contract = await contracts.create({ brandId: brand.id });
      await events.create({ contractId: contract.id });

      // Act
      const update = service.update(kit.id, {
        overrides: { tokens: { primary: '#FFFFFF' } },
      });

      // Assert
      await expect(update).rejects.toBeInstanceOf(UnprocessableEntityException);
      await expect(service.findOne(kit.id)).resolves.toMatchObject({
        overrides: BRILLIPOINT_BRAND_KIT_OVERRIDES,
      });
    });

    it('throws NotFoundException when the kit does not exist', async () => {
      // Arrange — no kit created

      // Act + Assert
      await expect(
        service.update(999999, { name: 'Ghost' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  // ─── delete ────────────────────────────────────────────────────────────

  describe('delete', () => {
    it('rejects deleting the Brillipoint kit', async () => {
      // Arrange
      const kit = await factory.create({ key: BRILLIPOINT_BRAND_KIT_KEY });

      // Act + Assert
      await expect(service.delete(kit.id)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('deletes another kit', async () => {
      // Arrange
      const kit = await factory.create({ key: 'acme' });

      // Act
      await service.delete(kit.id);

      // Assert
      const result = await service.findByKey('acme');
      expect(result).toBeNull();
    });

    it('rejects deleting a client kit when its business fallback is invalid', async () => {
      // Arrange
      const fallback = await factory.create({
        key: 'invalid-business-fallback',
        overrides: { tokens: { primary: '#FFFFFF' } },
      });
      const client = await factory.create({ key: 'client-before-fallback' });
      const brand = await brands.create({ brandKitId: fallback.id });
      const contract = await contracts.create({ brandId: brand.id });
      const event = await events.create({
        contractId: contract.id,
        brandKitId: client.id,
      });

      // Act
      const deletion = service.delete(client.id);

      // Assert
      await expect(deletion).rejects.toBeInstanceOf(UnprocessableEntityException);
      await expect(service.findOne(client.id)).resolves.toMatchObject({
        id: client.id,
      });
      await expect(
        TestDataSource.getRepository(Event).findOneByOrFail({ id: event.id }),
      ).resolves.toMatchObject({ brandKitId: client.id });
    });

    it('rejects deleting a business kit when the default fallback is invalid', async () => {
      // Arrange
      await factory.create({
        key: BRILLIPOINT_BRAND_KIT_KEY,
        name: BRILLIPOINT_BRAND_KIT_NAME,
        overrides: { tokens: { primary: '#FFFFFF' } },
      });
      const businessKit = await factory.create({ key: 'business-before-default' });
      const brand = await brands.create({ brandKitId: businessKit.id });
      const contract = await contracts.create({ brandId: brand.id });
      await events.create({ contractId: contract.id });

      // Act
      const deletion = service.delete(businessKit.id);

      // Assert
      await expect(deletion).rejects.toBeInstanceOf(UnprocessableEntityException);
      await expect(service.findOne(businessKit.id)).resolves.toMatchObject({
        id: businessKit.id,
      });
    });

    it('rejects deleting a business kit when a soft-deleted client FK exposes an invalid default', async () => {
      // Arrange
      await factory.create({
        key: BRILLIPOINT_BRAND_KIT_KEY,
        name: BRILLIPOINT_BRAND_KIT_NAME,
        overrides: { tokens: { primary: '#FFFFFF' } },
      });
      const client = await factory.create({ key: 'deleted-client-before-business-delete' });
      const businessKit = await factory.create({ key: 'business-before-deleted-client-default' });
      const brand = await brands.create({ brandKitId: businessKit.id });
      const contract = await contracts.create({ brandId: brand.id });
      await events.create({ contractId: contract.id, brandKitId: client.id });
      await service.delete(client.id);

      // Act
      const deletion = service.delete(businessKit.id);

      // Assert
      await expect(deletion).rejects.toBeInstanceOf(UnprocessableEntityException);
      await expect(service.findOne(businessKit.id)).resolves.toMatchObject({
        id: businessKit.id,
      });
    });
  });
});
