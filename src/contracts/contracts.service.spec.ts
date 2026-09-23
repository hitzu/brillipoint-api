import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { DataSource } from 'typeorm';

import { AppDataSource as TestDataSource } from '../config/database/data-source';
import { BrandFactory } from '../../test/factories/brands/brands.factories';
import { PackageFactory } from '../../test/factories/packages/package.factory';
import { SlotFactory } from '../../test/factories/slots/slot.factory';
import { UserFactory } from '../../test/factories/user/user.factory';
import { ExtraFactory } from '../../test/factories/extras/extra.factory';
import { PromotionFactory } from '../../test/factories/promotions/promotion.factory';
import { PromotionPackageFactory } from '../../test/factories/promotions/promotion-package.factory';
import { PaymentsService } from '../payments/payments.service';
import { PromotionsService } from '../promotions/promotions.service';
import { ContractsService } from './contracts.service';
import { AddExtraDto } from './dto/add-extra.dto';
import { AddItemDto } from './dto/add-item.dto';
import { CreateContractFromSlotsDto } from './dto/create-contract-from-slots.dto';
import { Contract } from './entities/contract.entity';
import { ContractExtra } from './entities/contract-extra.entity';
import { ContractPackage } from './entities/contract-package.entity';
import { Extra } from '../extras/entities/extra.entity';
import { Payment } from '../payments/entities/payment.entity';
import { CONTRACT_STATUS } from './types/contract-status.types';
import { PAYMENT_METHOD } from './types/payment-method.types';
import { Package } from '../packages/entities/package.entity';
import { Promotion } from '../promotions/entities/promotion.entity';
import { PromotionPackage } from '../promotions/entities/promotion-package.entity';
import {
  PROMOTION_STATUS,
  PROMOTION_TYPE,
} from '../promotions/entities/promotion.entity';
import { ContractPromotion } from './entities/contract-promotion.entity';
import { Slot } from '../slots/entities/slot.entity';
import { SLOT_PERIOD } from '../slots/types/slot-period.types';
import { SLOT_STATUS } from '../slots/types/slot-status.types';
import { User } from '../users/entities/user.entity';
import { ContractSlot } from './entities/contract-slot.entity';
import { Event } from '../events/entities/event.entity';
import { EventFactory } from '../../test/factories/events/event.factory';
import { EXTRA_STATUS } from '../extras/types/extras-status.types';
import { Booking } from '../bookings/entities/booking.entity';
import { BOOKING_STATUS } from '../bookings/constants/booking_status.enum';
import { BookingFactory } from '../../test/factories/bookings/booking.factory';

describe('ContractsService', () => {
  let service: ContractsService;
  let contractsRepo: Repository<Contract>;
  let contractExtrasRepo: Repository<ContractExtra>;
  let contractPackagesRepo: Repository<ContractPackage>;
  let paymentsRepo: Repository<Payment>;
  let contractSlotsRepo: Repository<ContractSlot>;
  let slotsRepo: Repository<Slot>;
  let bookingsRepo: Repository<Booking>;
  let packageFactory: PackageFactory;
  let extraFactory: ExtraFactory;
  let brandFactory: BrandFactory;
  let slotFactory: SlotFactory;
  let userFactory: UserFactory;
  let eventFactory: EventFactory;
  let promotionFactory: PromotionFactory;
  let promotionPackageFactory: PromotionPackageFactory;
  let bookingFactory: BookingFactory;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContractsService,
        PaymentsService,
        PromotionsService,
        { provide: DataSource, useValue: TestDataSource },
        {
          provide: getRepositoryToken(Promotion),
          useValue: TestDataSource.getRepository(Promotion),
        },
        {
          provide: getRepositoryToken(PromotionPackage),
          useValue: TestDataSource.getRepository(PromotionPackage),
        },
        {
          provide: getRepositoryToken(Contract),
          useValue: TestDataSource.getRepository(Contract),
        },
        {
          provide: getRepositoryToken(Slot),
          useValue: TestDataSource.getRepository(Slot),
        },
        {
          provide: getRepositoryToken(ContractPackage),
          useValue: TestDataSource.getRepository(ContractPackage),
        },
        {
          provide: getRepositoryToken(ContractExtra),
          useValue: TestDataSource.getRepository(ContractExtra),
        },
        {
          provide: getRepositoryToken(ContractSlot),
          useValue: TestDataSource.getRepository(ContractSlot),
        },
        {
          provide: getRepositoryToken(Payment),
          useValue: TestDataSource.getRepository(Payment),
        },
        {
          provide: getRepositoryToken(Package),
          useValue: TestDataSource.getRepository(Package),
        },
        {
          provide: getRepositoryToken(Extra),
          useValue: TestDataSource.getRepository(Extra),
        },
        {
          provide: getRepositoryToken(User),
          useValue: TestDataSource.getRepository(User),
        },
        {
          provide: getRepositoryToken(Event),
          useValue: TestDataSource.getRepository(Event),
        },
        {
          provide: getRepositoryToken(Booking),
          useValue: TestDataSource.getRepository(Booking),
        },
      ],
    }).compile();

    service = module.get<ContractsService>(ContractsService);
    contractsRepo = module.get<Repository<Contract>>(
      getRepositoryToken(Contract),
    );
    slotsRepo = module.get<Repository<Slot>>(getRepositoryToken(Slot));
    contractPackagesRepo = module.get<Repository<ContractPackage>>(
      getRepositoryToken(ContractPackage),
    );
    contractExtrasRepo = module.get<Repository<ContractExtra>>(
      getRepositoryToken(ContractExtra),
    );
    contractSlotsRepo = module.get<Repository<ContractSlot>>(
      getRepositoryToken(ContractSlot),
    );
    paymentsRepo = module.get<Repository<Payment>>(getRepositoryToken(Payment));
    bookingsRepo = module.get<Repository<Booking>>(getRepositoryToken(Booking));

    packageFactory = new PackageFactory(TestDataSource);
    extraFactory = new ExtraFactory(TestDataSource);
    brandFactory = new BrandFactory(TestDataSource);
    slotFactory = new SlotFactory(TestDataSource);
    userFactory = new UserFactory(TestDataSource);
    eventFactory = new EventFactory(TestDataSource);
    promotionFactory = new PromotionFactory(TestDataSource);
    promotionPackageFactory = new PromotionPackageFactory(TestDataSource);
    bookingFactory = new BookingFactory(TestDataSource);
  });

  describe('list', () => {
    it('should return contracts with eventToken when contract has an event', async () => {
      const user = await userFactory.create();
      const slot = await slotFactory.create({
        status: SLOT_STATUS.RESERVED,
        period: SLOT_PERIOD.AM_BLOCK,
      });

      const contract = await contractsRepo.save(
        contractsRepo.create({
          userId: user.id,
          sku: 'SKU-LIST-001',
          token: 'list-token-001',
          status: CONTRACT_STATUS.CONFIRMED,
          slot,
        }),
      );

      const eventToken = 'a1b2c3d4-e5f6-4789-a012-345678901234';
      const event = await eventFactory.create({
        contractId: contract.id,
        token: eventToken,
        name: 'Test Event',
        key: 'list-test-key-001',
      });

      const list = await service.list();

      const found = list.find((c) => c.id === contract.id);
      expect(found).toBeDefined();
      expect(found?.eventToken).toBe(eventToken);
    });

    it('should return eventToken as null when contract has no event', async () => {
      const user = await userFactory.create();
      const slot = await slotFactory.create({
        status: SLOT_STATUS.RESERVED,
        period: SLOT_PERIOD.AM_BLOCK,
      });

      const contract = await contractsRepo.save(
        contractsRepo.create({
          userId: user.id,
          sku: 'SKU-LIST-002',
          token: 'list-token-002',
          status: CONTRACT_STATUS.CONFIRMED,
          slot,
        }),
      );

      const list = await service.list();

      const found = list.find((c) => c.id === contract.id);
      expect(found).toBeDefined();
      expect(found?.eventToken).toBeNull();
    });

    it('should exclude finalized contracts by default', async () => {
      const user = await userFactory.create();
      const slot = await slotFactory.create({
        status: SLOT_STATUS.RESERVED,
        period: SLOT_PERIOD.AM_BLOCK,
      });

      const finalizedContract = await contractsRepo.save(
        contractsRepo.create({
          userId: user.id,
          sku: 'SKU-LIST-FINALIZED',
          token: 'list-token-finalized',
          status: CONTRACT_STATUS.FINALIZED,
          slot,
        }),
      );

      const list = await service.list();
      const found = list.find((c) => c.id === finalizedContract.id);
      expect(found).toBeUndefined();
    });

    it('should include finalized contracts when includeFinalized is true', async () => {
      const user = await userFactory.create();
      const slot = await slotFactory.create({
        status: SLOT_STATUS.RESERVED,
        period: SLOT_PERIOD.AM_BLOCK,
      });

      const finalizedContract = await contractsRepo.save(
        contractsRepo.create({
          userId: user.id,
          sku: 'SKU-LIST-FINALIZED-INCLUDE',
          token: 'list-token-finalized-include',
          status: CONTRACT_STATUS.FINALIZED,
          slot,
        }),
      );

      const list = await service.list({ includeFinalized: true });
      const found = list.find((c) => c.id === finalizedContract.id);
      expect(found).toBeDefined();
      expect(found?.status).toBe(CONTRACT_STATUS.FINALIZED);
    });

    it('should group bookings per contract when multiple contracts have different bookings', async () => {
      const user = await userFactory.create();
      const slotA = await slotFactory.create({
        status: SLOT_STATUS.RESERVED,
        period: SLOT_PERIOD.AM_BLOCK,
      });
      const slotB = await slotFactory.create({
        status: SLOT_STATUS.RESERVED,
        period: SLOT_PERIOD.PM_BLOCK,
      });

      const contractA = await contractsRepo.save(
        contractsRepo.create({
          userId: user.id,
          sku: 'SKU-LIST-BOOKINGS-A',
          token: 'list-token-bookings-a',
          status: CONTRACT_STATUS.CONFIRMED,
          slot: slotA,
        }),
      );
      const contractB = await contractsRepo.save(
        contractsRepo.create({
          userId: user.id,
          sku: 'SKU-LIST-BOOKINGS-B',
          token: 'list-token-bookings-b',
          status: CONTRACT_STATUS.CONFIRMED,
          slot: slotB,
        }),
      );

      const bookingA = await bookingFactory.create({
        contractId: contractA.id,
        eventDate: '2030-04-01',
      });
      const bookingB1 = await bookingFactory.create({
        contractId: contractB.id,
        eventDate: '2030-04-02',
        serviceStartsAt: new Date('2030-04-02T09:00:00.000Z'),
        serviceEndsAt: new Date('2030-04-02T12:00:00.000Z'),
      });
      const bookingB2 = await bookingFactory.create({
        contractId: contractB.id,
        eventDate: '2030-04-03',
        serviceStartsAt: new Date('2030-04-03T09:00:00.000Z'),
        serviceEndsAt: new Date('2030-04-03T12:00:00.000Z'),
      });

      const list = await service.list();

      const foundA = list.find((c) => c.id === contractA.id);
      const foundB = list.find((c) => c.id === contractB.id);

      expect(foundA?.bookings.map((b) => b.id)).toEqual([bookingA.id]);
      expect(foundB?.bookings.map((b) => b.id).sort()).toEqual(
        [bookingB1.id, bookingB2.id].sort(),
      );
    });
  });

  describe('createContract', () => {
    it('should create a confirmed contract, attach the legacy slot relation, create contract_slots link, and persist item snapshots/totals', async () => {
      const user = await userFactory.create();
      const brand = await brandFactory.create();
      const pkg = await packageFactory.createForBrand(brand, {
        basePrice: 100,
      });
      const slot = await slotFactory.create({
        status: SLOT_STATUS.RESERVED,
        period: SLOT_PERIOD.AM_BLOCK,
      });

      const packages: AddItemDto[] = [{ packageId: pkg.id, quantity: 2 }];
      const dto: CreateContractFromSlotsDto = {
        userId: user.id,
        slotId: slot.id,
        sku: 'SKU-TEST-001',
        clientName: 'Ana',
        clientPhone: null,
        clientEmail: null,
        subtotal: 0,
        discountTotal: 0,
        total: 200,
        packages,
      };

      const result = await service.createContract(dto);

      expect(result.id).toBeDefined();
      expect(result.status).toBe(CONTRACT_STATUS.CONFIRMED);
      expect(result.sku).toBe('SKU-TEST-001');
      expect(typeof result.token).toBe('string');
      expect(result.token.length).toBeGreaterThan(0);

      const savedContract = await contractsRepo.findOne({
        where: { id: result.id },
        relations: ['slot'],
      });
      expect(savedContract).not.toBeNull();
      expect(savedContract?.slot?.id).toBe(slot.id);

      const savedItems = await contractPackagesRepo.find({
        where: { contractId: result.id },
      });
      expect(savedItems).toHaveLength(1);
      expect(savedItems[0]?.packageId).toBe(pkg.id);
      expect(savedItems[0]?.quantity).toBe(2);
      expect(savedItems[0]?.basePriceSnapshot).toBe(100);

      const updatedContract = await contractsRepo.findOne({
        where: { id: result.id },
      });
      expect(updatedContract?.total).toBe(200);

      const link = await contractSlotsRepo.findOne({
        where: { contractId: result.id, slotId: slot.id },
      });
      expect(link).toBeDefined();
    });

    it('should return an empty bookings array on creation', async () => {
      const user = await userFactory.create();
      const brand = await brandFactory.create();
      const pkg = await packageFactory.createForBrand(brand, {
        basePrice: 100,
      });
      const slot = await slotFactory.create({
        status: SLOT_STATUS.RESERVED,
        period: SLOT_PERIOD.AM_BLOCK,
      });

      const packages: AddItemDto[] = [{ packageId: pkg.id, quantity: 1 }];
      const dto: CreateContractFromSlotsDto = {
        userId: user.id,
        slotId: slot.id,
        sku: 'SKU-TEST-BOOKINGS',
        clientName: 'Ana',
        clientPhone: null,
        clientEmail: null,
        subtotal: 0,
        discountTotal: 0,
        total: 100,
        packages,
      };

      const result = await service.createContract(dto);

      expect(result.bookings).toEqual([]);
    });

    it('should throw NotFoundException if slot is not found', async () => {
      const user = await userFactory.create();
      const dto: CreateContractFromSlotsDto = {
        userId: user.id,
        slotId: 999999,
        sku: 'SKU-TEST-002',
        clientName: 'Ana',
        clientPhone: null,
        clientEmail: null,
        subtotal: 0,
        discountTotal: 0,
        total: 0,
        packages: [],
      };
      await expect(service.createContract(dto)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('should throw ConflictException if slot is available (not held/reserved)', async () => {
      const user = await userFactory.create();
      const slot = await slotFactory.create({
        status: SLOT_STATUS.AVAILABLE,
        period: SLOT_PERIOD.AM_BLOCK,
      });
      const dto: CreateContractFromSlotsDto = {
        userId: user.id,
        slotId: slot.id,
        sku: 'SKU-TEST-003',
        clientName: 'Ana',
        clientPhone: null,
        clientEmail: null,
        subtotal: 0,
        discountTotal: 0,
        total: 0,
        packages: [],
      };
      await expect(service.createContract(dto)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('should throw ConflictException if slot is already used by another contract', async () => {
      const user = await userFactory.create();
      const slot = await slotFactory.create({
        status: SLOT_STATUS.RESERVED,
        period: SLOT_PERIOD.AM_BLOCK,
      });

      const first = await service.createContract({
        userId: user.id,
        slotId: slot.id,
        sku: 'SKU-TEST-004',
        clientName: 'Ana',
        clientPhone: null,
        clientEmail: null,
        subtotal: 0,
        discountTotal: 0,
        total: 0,
        packages: [],
      });

      expect(first.id).toBeDefined();

      await expect(
        service.createContract({
          userId: user.id,
          slotId: slot.id,
          sku: 'SKU-TEST-005',
          clientName: 'Ana',
          clientPhone: null,
          clientEmail: null,
          subtotal: 0,
          discountTotal: 0,
          total: 0,
          packages: [],
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('should persist brandId when provided', async () => {
      // Arrange
      const user = await userFactory.create();
      const brand = await brandFactory.create();
      const slot = await slotFactory.create({
        status: SLOT_STATUS.RESERVED,
        period: SLOT_PERIOD.AM_BLOCK,
      });
      const dto: CreateContractFromSlotsDto = {
        userId: user.id,
        slotId: slot.id,
        brandId: brand.id,
        sku: 'SKU-BRAND-001',
        clientName: 'Cliente Expo',
        clientPhone: null,
        clientEmail: null,
        subtotal: 4500,
        discountTotal: 0,
        total: 4500,
        packages: [],
      };

      // Act
      const result = await service.createContract(dto);

      // Assert
      const saved = await contractsRepo.findOne({ where: { id: result.id } });
      expect(saved?.brandId).toBe(brand.id);
    });

    it('should persist extra snapshots when contract includes extras', async () => {
      const user = await userFactory.create();
      const brand = await brandFactory.create();
      const pkg = await packageFactory.createForBrand(brand, {
        basePrice: 2500,
      });
      const extra = await extraFactory.createForBrand(brand, {
        name: 'Upgrade back',
        price: 500,
        status: EXTRA_STATUS.ACTIVE,
      });
      const slot = await slotFactory.create({
        status: SLOT_STATUS.RESERVED,
        period: SLOT_PERIOD.AM_BLOCK,
      });

      const packages: AddItemDto[] = [{ packageId: pkg.id, quantity: 1 }];
      const extras: AddExtraDto[] = [{ extraId: extra.id, quantity: 2 }];
      const dto: CreateContractFromSlotsDto = {
        userId: user.id,
        slotId: slot.id,
        brandId: brand.id,
        sku: 'SKU-EXTRAS-001',
        clientName: 'Ana',
        clientPhone: null,
        clientEmail: null,
        subtotal: 0,
        discountTotal: 0,
        total: 3500,
        packages,
        extras,
      };

      const result = await service.createContract(dto);

      const savedExtras = await contractExtrasRepo.find({
        where: { contractId: result.id },
      });
      expect(savedExtras).toHaveLength(1);
      expect(savedExtras[0]?.extraId).toBe(extra.id);
      expect(savedExtras[0]?.quantity).toBe(2);
      expect(savedExtras[0]?.nameSnapshot).toBe('Upgrade back');
      expect(savedExtras[0]?.basePriceSnapshot).toBe(500);
    });

    it('should require brandId when contract includes extras', async () => {
      const user = await userFactory.create();
      const brand = await brandFactory.create();
      const extra = await extraFactory.createForBrand(brand, {
        status: EXTRA_STATUS.ACTIVE,
      });
      const slot = await slotFactory.create({
        status: SLOT_STATUS.RESERVED,
        period: SLOT_PERIOD.AM_BLOCK,
      });

      const dto: CreateContractFromSlotsDto = {
        userId: user.id,
        slotId: slot.id,
        sku: 'SKU-EXTRAS-NO-BRAND',
        clientName: 'Ana',
        clientPhone: null,
        clientEmail: null,
        subtotal: 0,
        discountTotal: 0,
        total: 500,
        packages: [],
        extras: [{ extraId: extra.id, quantity: 1 }],
      };

      await expect(service.createContract(dto)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('should reject inactive extras', async () => {
      const user = await userFactory.create();
      const brand = await brandFactory.create();
      const extra = await extraFactory.createForBrand(brand, {
        status: EXTRA_STATUS.INACTIVE,
      });
      const slot = await slotFactory.create({
        status: SLOT_STATUS.RESERVED,
        period: SLOT_PERIOD.AM_BLOCK,
      });

      const dto: CreateContractFromSlotsDto = {
        userId: user.id,
        slotId: slot.id,
        brandId: brand.id,
        sku: 'SKU-EXTRAS-INACTIVE',
        clientName: 'Ana',
        clientPhone: null,
        clientEmail: null,
        subtotal: 0,
        discountTotal: 0,
        total: 500,
        packages: [],
        extras: [{ extraId: extra.id, quantity: 1 }],
      };

      await expect(service.createContract(dto)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('should reject extras from another brand', async () => {
      const user = await userFactory.create();
      const contractBrand = await brandFactory.create();
      const extraBrand = await brandFactory.create();
      const extra = await extraFactory.createForBrand(extraBrand, {
        status: EXTRA_STATUS.ACTIVE,
      });
      const slot = await slotFactory.create({
        status: SLOT_STATUS.RESERVED,
        period: SLOT_PERIOD.AM_BLOCK,
      });

      const dto: CreateContractFromSlotsDto = {
        userId: user.id,
        slotId: slot.id,
        brandId: contractBrand.id,
        sku: 'SKU-EXTRAS-WRONG-BRAND',
        clientName: 'Ana',
        clientPhone: null,
        clientEmail: null,
        subtotal: 0,
        discountTotal: 0,
        total: 500,
        packages: [],
        extras: [{ extraId: extra.id, quantity: 1 }],
      };

      await expect(service.createContract(dto)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('should leave no contract behind when extra validation aborts the creation', async () => {
      // Arrange
      const user = await userFactory.create();
      const contractBrand = await brandFactory.create();
      const extraBrand = await brandFactory.create();
      const extra = await extraFactory.createForBrand(extraBrand, {
        status: EXTRA_STATUS.ACTIVE,
      });
      const dto: CreateContractFromSlotsDto = {
        userId: user.id,
        brandId: contractBrand.id,
        sku: 'SKU-EXTRAS-ABORT-NO-CONTRACT',
        clientName: 'Ana',
        clientPhone: null,
        clientEmail: null,
        subtotal: 0,
        discountTotal: 0,
        total: 0,
        packages: [],
        extras: [{ extraId: extra.id, quantity: 1 }],
      };

      // Act
      await expect(service.createContract(dto)).rejects.toBeInstanceOf(
        BadRequestException,
      );

      // Assert
      const contract = await contractsRepo.findOne({
        where: { sku: 'SKU-EXTRAS-ABORT-NO-CONTRACT' },
      });
      expect(contract).toBeNull();
    });
  });

  describe('createContract (optional slotId, no schedule)', () => {
    it('should keep legacy slot behavior and create no booking when the payload has slotId', async () => {
      // Arrange
      const user = await userFactory.create();
      const slot = await slotFactory.create({
        status: SLOT_STATUS.RESERVED,
        period: SLOT_PERIOD.AM_BLOCK,
      });
      const dto: CreateContractFromSlotsDto = {
        userId: user.id,
        slotId: slot.id,
        sku: 'SKU-BOOKING-LEGACY',
        clientName: 'Ana',
        clientPhone: null,
        clientEmail: null,
        subtotal: 0,
        discountTotal: 0,
        total: 0,
        packages: [],
      };

      // Act
      const result = await service.createContract(dto);

      // Assert
      const link = await contractSlotsRepo.findOne({
        where: { contractId: result.id, slotId: slot.id },
      });
      expect(link).toBeDefined();

      const savedContract = await contractsRepo.findOne({
        where: { id: result.id },
        relations: ['slot'],
      });
      expect(savedContract?.slot?.id).toBe(slot.id);

      const bookings = await bookingsRepo.find({
        where: { contractId: result.id },
      });
      expect(bookings).toHaveLength(0);
    });

    it('should create and persist a contract when neither slotId nor any schedule is provided', async () => {
      // Arrange
      const user = await userFactory.create();
      const dto: CreateContractFromSlotsDto = {
        userId: user.id,
        sku: 'SKU-NO-SLOT-NO-SCHEDULE',
        clientName: 'Ana',
        clientPhone: null,
        clientEmail: null,
        subtotal: 0,
        discountTotal: 0,
        total: 0,
        packages: [],
      };

      // Act
      const result = await service.createContract(dto);

      // Assert
      const savedContract = await contractsRepo.findOne({
        where: { id: result.id },
      });
      expect(savedContract).not.toBeNull();
    });
  });

  describe('createContract with tiered promotions', () => {
    it('should apply tiers in request order and fall back to full price once tiers run out', async () => {
      // Arrange
      const user = await userFactory.create();
      const brand = await brandFactory.create();
      const pkg = await packageFactory.createForBrand(brand, {
        basePrice: 1000,
      });
      const extra = await extraFactory.createForBrand(brand, {
        price: 200,
        status: EXTRA_STATUS.ACTIVE,
      });
      const promotion = await promotionFactory.createForBrand(brand, {
        status: PROMOTION_STATUS.ACTIVE,
        type: PROMOTION_TYPE.BONUS,
        value: 1,
      });
      await promotionPackageFactory.createTier(promotion, pkg, 1, 100);
      await promotionPackageFactory.createTier(promotion, pkg, 2, 50);
      const slot = await slotFactory.create({
        status: SLOT_STATUS.RESERVED,
        period: SLOT_PERIOD.AM_BLOCK,
      });

      const dto: CreateContractFromSlotsDto = {
        userId: user.id,
        slotId: slot.id,
        brandId: brand.id,
        sku: 'SKU-TIERS-001',
        clientName: 'Ana',
        clientPhone: null,
        clientEmail: null,
        packages: [{ packageId: pkg.id, quantity: 1, clientRef: 'pkg-1' }],
        extras: [
          { extraId: extra.id, quantity: 1, packageClientRef: 'pkg-1' },
          { extraId: extra.id, quantity: 1, packageClientRef: 'pkg-1' },
          { extraId: extra.id, quantity: 1, packageClientRef: 'pkg-1' },
        ],
      };

      // Act
      const result = await service.createContract(dto);

      // Assert
      const savedExtras = await contractExtrasRepo.find({
        where: { contractId: result.id },
        order: { id: 'ASC' },
      });
      expect(savedExtras).toHaveLength(3);
      expect(savedExtras[0]?.discountPercentageSnapshot).toBe(100);
      expect(savedExtras[0]?.finalPriceSnapshot).toBe(0);
      expect(savedExtras[1]?.discountPercentageSnapshot).toBe(50);
      expect(savedExtras[1]?.finalPriceSnapshot).toBe(100);
      expect(savedExtras[2]?.discountPercentageSnapshot).toBe(0);
      expect(savedExtras[2]?.finalPriceSnapshot).toBe(200);
      expect(savedExtras[0]?.promotionId).toBe(promotion.id);
      expect(savedExtras[1]?.promotionId).toBe(promotion.id);
      expect(savedExtras[2]?.promotionId).toBeNull();

      const updatedContract = await contractsRepo.findOne({
        where: { id: result.id },
      });
      // itemsSubtotal(1000) + extrasGross(200*3=600) = 1600
      // discount amounts: 200 (100%) + 100 (50%) + 0 (0%) = 300
      expect(updatedContract?.subtotal).toBe(1600);
      expect(updatedContract?.discountTotal).toBe(300);
      expect(updatedContract?.total).toBe(1300);
    });

    it('should not link an extra to a package and apply no discount when packageClientRef is missing', async () => {
      // Arrange
      const user = await userFactory.create();
      const brand = await brandFactory.create();
      const pkg = await packageFactory.createForBrand(brand, {
        basePrice: 1000,
      });
      const extra = await extraFactory.createForBrand(brand, {
        price: 200,
        status: EXTRA_STATUS.ACTIVE,
      });
      const promotion = await promotionFactory.createForBrand(brand, {
        status: PROMOTION_STATUS.ACTIVE,
        type: PROMOTION_TYPE.BONUS,
        value: 1,
      });
      await promotionPackageFactory.createTier(promotion, pkg, 1, 100);
      const slot = await slotFactory.create({
        status: SLOT_STATUS.RESERVED,
        period: SLOT_PERIOD.AM_BLOCK,
      });

      const dto: CreateContractFromSlotsDto = {
        userId: user.id,
        slotId: slot.id,
        brandId: brand.id,
        sku: 'SKU-TIERS-002',
        clientName: 'Ana',
        clientPhone: null,
        clientEmail: null,
        packages: [{ packageId: pkg.id, quantity: 1, clientRef: 'pkg-1' }],
        extras: [{ extraId: extra.id, quantity: 1 }],
      };

      // Act
      const result = await service.createContract(dto);

      // Assert
      const savedExtras = await contractExtrasRepo.find({
        where: { contractId: result.id },
      });
      expect(savedExtras[0]?.contractPackageId).toBeNull();
      expect(savedExtras[0]?.discountPercentageSnapshot).toBe(0);
      expect(savedExtras[0]?.finalPriceSnapshot).toBe(200);
    });

    it('should keep tier counters independent per package within the same contract', async () => {
      // Arrange
      const user = await userFactory.create();
      const brand = await brandFactory.create();
      const basico = await packageFactory.createForBrand(brand, {
        basePrice: 500,
      });
      const plus = await packageFactory.createForBrand(brand, {
        basePrice: 1500,
      });
      const extra = await extraFactory.createForBrand(brand, {
        price: 300,
        status: EXTRA_STATUS.ACTIVE,
      });
      const promotion = await promotionFactory.createForBrand(brand, {
        status: PROMOTION_STATUS.ACTIVE,
        type: PROMOTION_TYPE.BONUS,
        value: 1,
      });
      await promotionPackageFactory.createTier(promotion, basico, 1, 100);
      await promotionPackageFactory.createTier(promotion, plus, 1, 100);
      const slot = await slotFactory.create({
        status: SLOT_STATUS.RESERVED,
        period: SLOT_PERIOD.AM_BLOCK,
      });

      const dto: CreateContractFromSlotsDto = {
        userId: user.id,
        slotId: slot.id,
        brandId: brand.id,
        sku: 'SKU-TIERS-003',
        clientName: 'Ana',
        clientPhone: null,
        clientEmail: null,
        packages: [
          { packageId: basico.id, quantity: 1, clientRef: 'basico' },
          { packageId: plus.id, quantity: 1, clientRef: 'plus' },
        ],
        extras: [
          { extraId: extra.id, quantity: 1, packageClientRef: 'basico' },
          { extraId: extra.id, quantity: 1, packageClientRef: 'plus' },
        ],
      };

      // Act
      const result = await service.createContract(dto);

      // Assert
      const savedExtras = await contractExtrasRepo.find({
        where: { contractId: result.id },
        order: { id: 'ASC' },
      });
      expect(savedExtras[0]?.discountPercentageSnapshot).toBe(100);
      expect(savedExtras[1]?.discountPercentageSnapshot).toBe(100);
    });

    it('should ignore client-supplied subtotal/discountTotal/total and persist server-computed totals', async () => {
      // Arrange
      const user = await userFactory.create();
      const brand = await brandFactory.create();
      const pkg = await packageFactory.createForBrand(brand, {
        basePrice: 1000,
      });
      const slot = await slotFactory.create({
        status: SLOT_STATUS.RESERVED,
        period: SLOT_PERIOD.AM_BLOCK,
      });

      const dto: CreateContractFromSlotsDto = {
        userId: user.id,
        slotId: slot.id,
        brandId: brand.id,
        sku: 'SKU-TIERS-004',
        clientName: 'Ana',
        clientPhone: null,
        clientEmail: null,
        subtotal: 1,
        discountTotal: 999,
        total: 1,
        packages: [{ packageId: pkg.id, quantity: 1, clientRef: 'pkg-1' }],
      };

      // Act
      const result = await service.createContract(dto);

      // Assert
      const updatedContract = await contractsRepo.findOne({
        where: { id: result.id },
      });
      expect(updatedContract?.subtotal).toBe(1000);
      expect(updatedContract?.discountTotal).toBe(0);
      expect(updatedContract?.total).toBe(1000);
    });
  });

  describe('createContract with brand-level package discount', () => {
    it('should apply a percentage discount to the package base price', async () => {
      // Arrange
      const user = await userFactory.create();
      const brand = await brandFactory.create();
      const pkg = await packageFactory.createForBrand(brand, {
        basePrice: 1000,
      });
      await promotionFactory.createForBrand(brand, {
        status: PROMOTION_STATUS.ACTIVE,
        type: PROMOTION_TYPE.PERCENTAGE,
        value: 10,
      });
      const slot = await slotFactory.create({
        status: SLOT_STATUS.RESERVED,
        period: SLOT_PERIOD.AM_BLOCK,
      });

      const dto: CreateContractFromSlotsDto = {
        userId: user.id,
        slotId: slot.id,
        brandId: brand.id,
        sku: 'SKU-PKG-DISCOUNT-001',
        clientName: 'Ana',
        clientPhone: null,
        clientEmail: null,
        packages: [{ packageId: pkg.id, quantity: 1 }],
      };

      // Act
      const result = await service.createContract(dto);

      // Assert
      const savedItems = await contractPackagesRepo.find({
        where: { contractId: result.id },
      });
      expect(savedItems[0]?.discountPercentageSnapshot).toBe(10);
      expect(savedItems[0]?.finalPriceSnapshot).toBe(900);

      const updatedContract = await contractsRepo.findOne({
        where: { id: result.id },
      });
      expect(updatedContract?.subtotal).toBe(1000);
      expect(updatedContract?.discountTotal).toBe(100);
      expect(updatedContract?.total).toBe(900);
    });

    it('should apply a fixed discount per unit, capped at the gross amount', async () => {
      // Arrange
      const user = await userFactory.create();
      const brand = await brandFactory.create();
      const pkg = await packageFactory.createForBrand(brand, {
        basePrice: 1000,
      });
      await promotionFactory.createForBrand(brand, {
        status: PROMOTION_STATUS.ACTIVE,
        type: PROMOTION_TYPE.FIXED,
        value: 100,
      });
      const slot = await slotFactory.create({
        status: SLOT_STATUS.RESERVED,
        period: SLOT_PERIOD.AM_BLOCK,
      });

      const dto: CreateContractFromSlotsDto = {
        userId: user.id,
        slotId: slot.id,
        brandId: brand.id,
        sku: 'SKU-PKG-DISCOUNT-002',
        clientName: 'Ana',
        clientPhone: null,
        clientEmail: null,
        packages: [{ packageId: pkg.id, quantity: 2 }],
      };

      // Act
      const result = await service.createContract(dto);

      // Assert
      const savedItems = await contractPackagesRepo.find({
        where: { contractId: result.id },
      });
      // 100 off per unit * 2 units = 200 off a 2000 gross
      expect(savedItems[0]?.finalPriceSnapshot).toBe(1800);
      expect(savedItems[0]?.discountPercentageSnapshot).toBe(10);
    });

    it('should not apply any package discount when the active promotion is type BONUS', async () => {
      // Arrange
      const user = await userFactory.create();
      const brand = await brandFactory.create();
      const pkg = await packageFactory.createForBrand(brand, {
        basePrice: 1000,
      });
      await promotionFactory.createForBrand(brand, {
        status: PROMOTION_STATUS.ACTIVE,
        type: PROMOTION_TYPE.BONUS,
        value: 1,
      });
      const slot = await slotFactory.create({
        status: SLOT_STATUS.RESERVED,
        period: SLOT_PERIOD.AM_BLOCK,
      });

      const dto: CreateContractFromSlotsDto = {
        userId: user.id,
        slotId: slot.id,
        brandId: brand.id,
        sku: 'SKU-PKG-DISCOUNT-003',
        clientName: 'Ana',
        clientPhone: null,
        clientEmail: null,
        packages: [{ packageId: pkg.id, quantity: 1 }],
      };

      // Act
      const result = await service.createContract(dto);

      // Assert
      const savedItems = await contractPackagesRepo.find({
        where: { contractId: result.id },
      });
      expect(savedItems[0]?.discountPercentageSnapshot).toBe(0);
      expect(savedItems[0]?.finalPriceSnapshot).toBe(1000);
    });

    it('should combine the package discount and the extra tier discount into a single contract total and a single ContractPromotion row', async () => {
      // Arrange
      const user = await userFactory.create();
      const brand = await brandFactory.create();
      const pkg = await packageFactory.createForBrand(brand, {
        basePrice: 1000,
      });
      const extra = await extraFactory.createForBrand(brand, {
        price: 200,
        status: EXTRA_STATUS.ACTIVE,
      });
      const promotion = await promotionFactory.createForBrand(brand, {
        status: PROMOTION_STATUS.ACTIVE,
        type: PROMOTION_TYPE.PERCENTAGE,
        value: 10,
      });
      await promotionPackageFactory.createTier(promotion, pkg, 1, 100);
      const slot = await slotFactory.create({
        status: SLOT_STATUS.RESERVED,
        period: SLOT_PERIOD.AM_BLOCK,
      });

      const dto: CreateContractFromSlotsDto = {
        userId: user.id,
        slotId: slot.id,
        brandId: brand.id,
        sku: 'SKU-PKG-DISCOUNT-004',
        clientName: 'Ana',
        clientPhone: null,
        clientEmail: null,
        packages: [{ packageId: pkg.id, quantity: 1, clientRef: 'pkg-1' }],
        extras: [{ extraId: extra.id, quantity: 1, packageClientRef: 'pkg-1' }],
      };

      // Act
      const result = await service.createContract(dto);

      // Assert: package 10% off (1000 -> 900), extra 100% off (200 -> 0)
      const updatedContract = await contractsRepo.findOne({
        where: { id: result.id },
      });
      expect(updatedContract?.subtotal).toBe(1200);
      expect(updatedContract?.discountTotal).toBe(300);
      expect(updatedContract?.total).toBe(900);

      const contractPromotionsRepo =
        TestDataSource.getRepository(ContractPromotion);
      const promotions = await contractPromotionsRepo.find({
        where: { contractId: result.id },
      });
      expect(promotions).toHaveLength(1);
      expect(promotions[0]?.promotionId).toBe(promotion.id);
      expect(promotions[0]?.appliedAmount).toBe(300);
    });
  });

  describe('getDetail', () => {
    it('should throw if contract is not found', async () => {
      await expect(service.getDetail(999999)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('should return contract, legacy slot, packages, payments, and paidAmount', async () => {
      const user = await userFactory.create();
      const slot = await slotFactory.create({
        eventDate: '2030-01-01',
        period: SLOT_PERIOD.AM_BLOCK,
        status: SLOT_STATUS.RESERVED,
      });

      const contract = await contractsRepo.save(
        contractsRepo.create({
          userId: user.id,
          sku: 'SKU-DETAIL-001',
          token: 'test-token',
          status: CONTRACT_STATUS.CONFIRMED,
          slot,
        }),
      );

      const brand = await brandFactory.create();
      const pkg = await packageFactory.createForBrand(brand, { basePrice: 50 });
      await contractPackagesRepo.save(
        contractPackagesRepo.create({
          contractId: contract.id,
          packageId: pkg.id,
          quantity: 3,
          nameSnapshot: pkg.name,
          basePriceSnapshot: 50,
        }),
      );

      const payment1 = await paymentsRepo.save(
        paymentsRepo.create({
          contractId: contract.id,
          amount: 40,
          receivedAt: new Date('2030-01-01T10:00:00.000Z'),
          note: null,
          reference: null,
          method: PAYMENT_METHOD.CASH,
        }),
      );
      const payment2 = await paymentsRepo.save(
        paymentsRepo.create({
          contractId: contract.id,
          amount: 60,
          receivedAt: new Date('2030-01-01T11:00:00.000Z'),
          note: 'partial',
          reference: 'ref',
          method: PAYMENT_METHOD.CARD,
        }),
      );
      const extra = await extraFactory.createForBrand(brand, {
        name: 'Upgrade back',
        price: 500,
        status: EXTRA_STATUS.ACTIVE,
      });
      await contractExtrasRepo.save(
        contractExtrasRepo.create({
          contractId: contract.id,
          extraId: extra.id,
          quantity: 1,
          nameSnapshot: extra.name,
          basePriceSnapshot: 500,
        }),
      );

      const detail = await service.getDetail(contract.id);

      expect(detail.contract.id).toBe(contract.id);
      expect(detail.contract.status).toBe(CONTRACT_STATUS.CONFIRMED);
      expect(detail.contract.token).toBe('test-token');

      expect(detail.slot.id).toBe(slot.id);
      expect(detail.extras).toHaveLength(1);
      expect(detail.extras[0]?.extraId).toBe(extra.id);
      expect(detail.extras[0]?.nameSnapshot).toBe('Upgrade back');

      const paymentIds = detail.payments.map((p) => p.id).sort((a, b) => a - b);
      expect(paymentIds).toEqual(
        [payment1.id, payment2.id].sort((a, b) => a - b),
      );
      expect(detail.paidAmount).toBeCloseTo(100);
    });

    it('should return an empty bookings array when the contract has none', async () => {
      const user = await userFactory.create();
      const slot = await slotFactory.create({
        eventDate: '2030-02-01',
        period: SLOT_PERIOD.AM_BLOCK,
        status: SLOT_STATUS.RESERVED,
      });
      const contract = await contractsRepo.save(
        contractsRepo.create({
          userId: user.id,
          sku: 'SKU-DETAIL-NOBOOKING',
          token: 'test-token-nobooking',
          status: CONTRACT_STATUS.CONFIRMED,
          slot,
        }),
      );

      const detail = await service.getDetail(contract.id);

      expect(detail.bookings).toEqual([]);
    });

    it('should include the contract bookings ordered by serviceStartsAt and exclude soft-deleted ones', async () => {
      const user = await userFactory.create();
      const slot = await slotFactory.create({
        eventDate: '2030-02-01',
        period: SLOT_PERIOD.AM_BLOCK,
        status: SLOT_STATUS.RESERVED,
      });
      const contract = await contractsRepo.save(
        contractsRepo.create({
          userId: user.id,
          sku: 'SKU-DETAIL-BOOKINGS',
          token: 'test-token-bookings',
          status: CONTRACT_STATUS.CONFIRMED,
          slot,
        }),
      );

      const later = await bookingFactory.create({
        contractId: contract.id,
        eventDate: '2030-03-02',
        serviceStartsAt: new Date('2030-03-02T10:00:00.000Z'),
        serviceEndsAt: new Date('2030-03-02T18:00:00.000Z'),
        status: BOOKING_STATUS.CONFIRMED,
      });
      const earlier = await bookingFactory.create({
        contractId: contract.id,
        eventDate: '2030-03-01',
        serviceStartsAt: new Date('2030-03-01T10:00:00.000Z'),
        serviceEndsAt: new Date('2030-03-01T18:00:00.000Z'),
        status: BOOKING_STATUS.CONFIRMED,
      });
      const deletedBooking = await bookingFactory.create({
        contractId: contract.id,
        eventDate: '2030-03-03',
        serviceStartsAt: new Date('2030-03-03T10:00:00.000Z'),
        serviceEndsAt: new Date('2030-03-03T18:00:00.000Z'),
        status: BOOKING_STATUS.CONFIRMED,
      });
      await bookingsRepo.softDelete(deletedBooking.id);

      const detail = await service.getDetail(contract.id);

      expect(detail.bookings.map((b) => b.id)).toEqual([
        earlier.id,
        later.id,
      ]);
      expect(detail.bookings.find((b) => b.id === deletedBooking.id)).toBeUndefined();
    });
  });

  describe('getDetailByToken', () => {
    it('should return masked client data and include extra snapshots', async () => {
      const user = await userFactory.create();
      const brand = await brandFactory.create();
      const slot = await slotFactory.create({
        eventDate: '2030-01-01',
        period: SLOT_PERIOD.AM_BLOCK,
        status: SLOT_STATUS.RESERVED,
      });

      const contract = await contractsRepo.save(
        contractsRepo.create({
          userId: user.id,
          brandId: brand.id,
          sku: 'SKU-PUBLIC-001',
          token: 'public-token-001',
          status: CONTRACT_STATUS.CONFIRMED,
          clientName: 'Ana',
          clientPhone: '5551234567',
          clientEmail: 'ana@example.com',
          slot,
        }),
      );

      const pkg = await packageFactory.createForBrand(brand, {
        basePrice: 250,
      });
      await contractPackagesRepo.save(
        contractPackagesRepo.create({
          contractId: contract.id,
          packageId: pkg.id,
          quantity: 1,
          nameSnapshot: pkg.name,
          basePriceSnapshot: 250,
        }),
      );

      const extra = await extraFactory.createForBrand(brand, {
        name: 'Upgrade back',
        price: 500,
        status: EXTRA_STATUS.ACTIVE,
      });
      await contractExtrasRepo.save(
        contractExtrasRepo.create({
          contractId: contract.id,
          extraId: extra.id,
          quantity: 2,
          nameSnapshot: extra.name,
          basePriceSnapshot: 500,
        }),
      );

      const detail = await service.getDetailByToken(contract.token);

      expect(detail.contract.id).toBe(contract.id);
      expect(detail.contract.clientPhone).toBe('***4567');
      expect(detail.contract.clientEmail).toBe('a****@example.com');
      expect(detail.packages).toHaveLength(1);
      expect(detail.extras).toHaveLength(1);
      expect(detail.extras[0]?.extraId).toBe(extra.id);
      expect(detail.extras[0]?.quantity).toBe(2);
      expect(detail.extras[0]?.nameSnapshot).toBe('Upgrade back');
    });

    it('should throw if token does not exist', async () => {
      await expect(
        service.getDetailByToken('missing-public-token'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('should include the contract bookings', async () => {
      const user = await userFactory.create();
      const slot = await slotFactory.create({
        eventDate: '2030-01-01',
        period: SLOT_PERIOD.AM_BLOCK,
        status: SLOT_STATUS.RESERVED,
      });
      const contract = await contractsRepo.save(
        contractsRepo.create({
          userId: user.id,
          sku: 'SKU-PUBLIC-BOOKINGS',
          token: 'public-token-bookings',
          status: CONTRACT_STATUS.CONFIRMED,
          slot,
        }),
      );
      const booking = await bookingFactory.create({
        contractId: contract.id,
        eventDate: '2030-01-01',
      });

      const detail = await service.getDetailByToken(contract.token);

      expect(detail.bookings).toHaveLength(1);
      expect(detail.bookings[0]?.id).toBe(booking.id);
    });
  });

  describe('updateItemQuantity', () => {
    it('should recalculate contract totals including extras', async () => {
      const user = await userFactory.create();
      const brand = await brandFactory.create();
      const slot = await slotFactory.create({
        status: SLOT_STATUS.RESERVED,
        period: SLOT_PERIOD.AM_BLOCK,
      });

      const contract = await contractsRepo.save(
        contractsRepo.create({
          userId: user.id,
          brandId: brand.id,
          sku: 'SKU-RECALC-001',
          token: 'recalc-token-001',
          status: CONTRACT_STATUS.CONFIRMED,
          subtotal: 700,
          discountTotal: 0,
          total: 700,
          slot,
        }),
      );

      const pkg = await packageFactory.createForBrand(brand, {
        basePrice: 100,
      });
      const item = await contractPackagesRepo.save(
        contractPackagesRepo.create({
          contractId: contract.id,
          packageId: pkg.id,
          quantity: 2,
          nameSnapshot: pkg.name,
          basePriceSnapshot: 100,
        }),
      );

      const extra = await extraFactory.createForBrand(brand, {
        price: 500,
        status: EXTRA_STATUS.ACTIVE,
      });
      await contractExtrasRepo.save(
        contractExtrasRepo.create({
          contractId: contract.id,
          extraId: extra.id,
          quantity: 1,
          nameSnapshot: extra.name,
          basePriceSnapshot: 500,
        }),
      );

      const detail = await service.updateItemQuantity(
        contract.id,
        item.id,
        { quantity: 1 },
        user.id,
      );

      expect(detail.contract.subtotal).toBe(600);
      expect(detail.contract.total).toBe(600);
      expect(detail.extras).toHaveLength(1);
      expect(detail.items[0]?.quantity).toBe(1);

      const updated = await contractsRepo.findOne({
        where: { id: contract.id },
      });
      expect(updated?.subtotal).toBe(600);
      expect(updated?.total).toBe(600);
    });
  });

  describe('finalize', () => {
    it('should finalize a confirmed contract and return status FINALIZED', async () => {
      const user = await userFactory.create();
      const slot = await slotFactory.create({
        status: SLOT_STATUS.RESERVED,
        period: SLOT_PERIOD.AM_BLOCK,
      });

      const contract = await contractsRepo.save(
        contractsRepo.create({
          userId: user.id,
          sku: 'SKU-FINALIZE-001',
          token: 'finalize-token-001',
          status: CONTRACT_STATUS.CONFIRMED,
          slot,
        }),
      );

      const result = await service.finalize(contract.id, user.id);

      expect(result.contract.status).toBe(CONTRACT_STATUS.FINALIZED);

      const updated = await contractsRepo.findOne({
        where: { id: contract.id },
      });
      expect(updated?.status).toBe(CONTRACT_STATUS.FINALIZED);
    });

    it('should throw NotFoundException if contract is not found', async () => {
      const user = await userFactory.create();
      await expect(service.finalize(999999, user.id)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('should throw ConflictException if contract is cancelled', async () => {
      const user = await userFactory.create();
      const slot = await slotFactory.create({
        status: SLOT_STATUS.RESERVED,
        period: SLOT_PERIOD.AM_BLOCK,
      });

      const contract = await contractsRepo.save(
        contractsRepo.create({
          userId: user.id,
          sku: 'SKU-FINALIZE-CANCELLED',
          token: 'finalize-token-cancelled',
          status: CONTRACT_STATUS.CANCELLED,
          slot,
        }),
      );

      await expect(
        service.finalize(contract.id, user.id),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('should return detail without changes if contract is already finalized', async () => {
      const user = await userFactory.create();
      const slot = await slotFactory.create({
        status: SLOT_STATUS.RESERVED,
        period: SLOT_PERIOD.AM_BLOCK,
      });

      const contract = await contractsRepo.save(
        contractsRepo.create({
          userId: user.id,
          sku: 'SKU-FINALIZE-ALREADY',
          token: 'finalize-token-already',
          status: CONTRACT_STATUS.FINALIZED,
          slot,
        }),
      );

      const result = await service.finalize(contract.id, user.id);

      expect(result.contract.status).toBe(CONTRACT_STATUS.FINALIZED);
      expect(result.contract.id).toBe(contract.id);
    });
  });

  describe('removeContract', () => {
    it('should soft-delete contract, contract slots, item snapshots, extra snapshots, payments, and associated slots', async () => {
      const user = await userFactory.create();
      const brand = await brandFactory.create();
      const pkg = await packageFactory.createForBrand(brand, {
        basePrice: 120,
      });
      const extra = await extraFactory.createForBrand(brand, {
        name: 'Upgrade back',
        price: 500,
        status: EXTRA_STATUS.ACTIVE,
      });
      const slot = await slotFactory.create({
        status: SLOT_STATUS.RESERVED,
        period: SLOT_PERIOD.AM_BLOCK,
      });

      const created = await service.createContract({
        userId: user.id,
        slotId: slot.id,
        brandId: brand.id,
        sku: 'SKU-REMOVE-001',
        clientName: 'Ana',
        clientPhone: null,
        clientEmail: null,
        subtotal: 0,
        discountTotal: 0,
        total: 740,
        packages: [{ packageId: pkg.id, quantity: 2 }],
        extras: [{ extraId: extra.id, quantity: 1 }],
      });

      const payment = await paymentsRepo.save(
        paymentsRepo.create({
          contractId: created.id,
          amount: 50,
          receivedAt: new Date('2030-01-01T10:00:00.000Z'),
          note: 'deposit',
          reference: null,
          method: PAYMENT_METHOD.CASH,
        }),
      );

      await service.removeContract(created.id);

      const visibleContract = await contractsRepo.findOne({
        where: { id: created.id },
      });
      expect(visibleContract).toBeNull();

      const deletedContract = await contractsRepo.findOne({
        where: { id: created.id },
        withDeleted: true,
      });
      expect(deletedContract).not.toBeNull();
      expect(deletedContract?.deletedAt).not.toBeNull();

      const deletedLink = await contractSlotsRepo.findOne({
        where: { contractId: created.id, slotId: slot.id },
        withDeleted: true,
      });
      expect(deletedLink).not.toBeNull();
      expect(deletedLink?.deletedAt).not.toBeNull();

      const deletedItem = await contractPackagesRepo.findOne({
        where: { contractId: created.id },
        withDeleted: true,
      });
      expect(deletedItem).not.toBeNull();
      expect(deletedItem?.deletedAt).not.toBeNull();

      const deletedExtra = await contractExtrasRepo.findOne({
        where: { contractId: created.id },
        withDeleted: true,
      });
      expect(deletedExtra).not.toBeNull();
      expect(deletedExtra?.deletedAt).not.toBeNull();

      const visiblePayments = await paymentsRepo.find({
        where: { contractId: created.id },
      });
      expect(visiblePayments).toHaveLength(0);

      const deletedPayment = await paymentsRepo.findOne({
        where: { id: payment.id },
        withDeleted: true,
      });
      expect(deletedPayment).not.toBeNull();
      expect(deletedPayment?.deletedAt).not.toBeNull();

      const visibleSlot = await slotsRepo.findOne({ where: { id: slot.id } });
      expect(visibleSlot).toBeNull();

      const deletedSlot = await slotsRepo.findOne({
        where: { id: slot.id },
        withDeleted: true,
      });
      expect(deletedSlot).not.toBeNull();
      expect(deletedSlot?.deletedAt).not.toBeNull();
    });

    it('should throw NotFoundException if contract is not found', async () => {
      await expect(service.removeContract(999999)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
