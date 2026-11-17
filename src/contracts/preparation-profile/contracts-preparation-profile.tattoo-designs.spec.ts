import {
  ConflictException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { BookingFactory } from '@factories/bookings/booking.factory';
import { BrandFactory } from '@factories/brands/brands.factories';
import { ExtraFactory } from '@factories/extras/extra.factory';
import { ContractFactory } from '@factories/contracts/contract.factory';
import { ContractPackageFactory } from '@factories/contracts/contract-package.factory';
import { PackageFactory } from '@factories/packages/package.factory';
import { BOOKING_PURPOSE } from '../../bookings/constants/booking_purpose.enum';
import { AppDataSource as TestDataSource } from '../../config/database/data-source';
import { Contract } from '../entities/contract.entity';
import { ContractExtra } from '../entities/contract-extra.entity';
import { ContractPreparationProfile } from '../entities/contract-preparation-profile.entity';
import { ContractsPreparationProfileService } from './contracts-preparation-profile.service';
import { PrepProfileUploadsService } from './prep-profile-uploads.service';
import { TATTOO_DESIGNS_QUESTION_ID } from './tattoo-designs.policy';

const PHONE = '+52 (220) 175-2767';
const TRIGGER_NAME = 'Tatuajes personalizados';
const NON_TRIGGER_NAME = 'Maquillista';

function daysFromToday(days: number): string {
  const d = new Date(Date.now() - 6 * 60 * 60 * 1000); // Mexico City civil date
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

describe('ContractsPreparationProfileService (Glitter bar tattoo designs)', () => {
  let service: ContractsPreparationProfileService;
  let contractFactory: ContractFactory;
  let packageFactory: PackageFactory;
  let contractPackageFactory: ContractPackageFactory;
  let bookingFactory: BookingFactory;
  let extraFactory: ExtraFactory;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContractsPreparationProfileService,
        {
          provide: getRepositoryToken(Contract),
          useValue: TestDataSource.getRepository(Contract),
        },
        {
          provide: getRepositoryToken(ContractPreparationProfile),
          useValue: TestDataSource.getRepository(ContractPreparationProfile),
        },
        {
          provide: PrepProfileUploadsService,
          useValue: {
            getPublicUrl: jest.fn((path: string) => path),
            createSignedReadUrl: jest.fn((input: { path: string }) =>
              Promise.resolve(input.path),
            ),
          },
        },
      ],
    }).compile();

    service = module.get(ContractsPreparationProfileService);
    contractFactory = new ContractFactory(TestDataSource);
    packageFactory = new PackageFactory(TestDataSource);
    contractPackageFactory = new ContractPackageFactory(TestDataSource);
    bookingFactory = new BookingFactory(TestDataSource);
    extraFactory = new ExtraFactory(TestDataSource);
  });

  async function createContract(options: {
    token: string;
    /** Name of the package product (snapshot). */
    productName: string;
    /** Name of a contracted extra. */
    extraName?: string;
    /** Name of a product delivered by that extra (snapshot). */
    extraProductName?: string;
    eventDate: string | null;
  }): Promise<Contract> {
    const contract = await contractFactory.create({
      token: options.token,
      clientPhone: PHONE,
    });
    const pkg = await packageFactory.createActive();
    await contractPackageFactory.createForContractAndPackage(contract, pkg, {
      nameSnapshot: pkg.name,
      basePriceSnapshot: pkg.basePrice,
      itemsSnapshot: [{ productId: 1, name: options.productName, quantity: 1 }],
    });
    if (options.extraName != null || options.extraProductName != null) {
      const extra = await extraFactory.createForBrand(
        await new BrandFactory(TestDataSource).create(),
      );
      await TestDataSource.getRepository(ContractExtra).save(
        TestDataSource.getRepository(ContractExtra).create({
          contractId: contract.id,
          extraId: extra.id,
          nameSnapshot: options.extraName ?? extra.name,
          basePriceSnapshot: 100,
          itemsSnapshot:
            options.extraProductName == null
              ? []
              : [
                  {
                    productId: 1,
                    name: options.extraProductName,
                    quantity: 1,
                  },
                ],
        }),
      );
    }
    if (options.eventDate) {
      await bookingFactory.create({
        contractId: contract.id,
        purpose: BOOKING_PURPOSE.EVENT,
        eventDate: options.eventDate,
      });
    }
    return contract;
  }

  const assets = (contractId: number, count: number) =>
    Array.from({ length: count }, (_, i) => ({
      path: `${contractId}/${TATTOO_DESIGNS_QUESTION_ID}/uuid-${i}_design.png`,
      mime: 'image/png',
    }));

  describe('setTattooDesigns', () => {
    it('should save up to 10 designs while the event is more than 7 days away', async () => {
      const contract = await createContract({
        token: 'tattoo-ok',
        productName: TRIGGER_NAME,
        eventDate: daysFromToday(30),
      });

      const res = await service.setTattooDesigns({
        token: 'tattoo-ok',
        phone: PHONE,
        assets: assets(contract.id, 10),
      });

      expect(res.contractId).toBe(contract.id);
      expect(res.answers[TATTOO_DESIGNS_QUESTION_ID]).toHaveLength(10);
      expect(res.locked[TATTOO_DESIGNS_QUESTION_ID]).not.toBe(true);
    });

    it('should accept a contract whose trigger product comes from a paid extra', async () => {
      const contract = await createContract({
        token: 'tattoo-extra',
        productName: NON_TRIGGER_NAME,
        extraProductName: TRIGGER_NAME,
        eventDate: daysFromToday(30),
      });

      const res = await service.setTattooDesigns({
        token: 'tattoo-extra',
        phone: PHONE,
        assets: assets(contract.id, 1),
      });

      expect(res.answers[TATTOO_DESIGNS_QUESTION_ID]).toHaveLength(1);
    });

    it('should accept a contract whose paid extra is named after the tattoo designs, even without products', async () => {
      const contract = await createContract({
        token: 'tattoo-photobooth',
        productName: NON_TRIGGER_NAME,
        extraName: 'Tatuajes personalizados (precio especial)',
        eventDate: daysFromToday(30),
      });

      const res = await service.setTattooDesigns({
        token: 'tattoo-photobooth',
        phone: PHONE,
        assets: assets(contract.id, 1),
      });

      expect(res.answers[TATTOO_DESIGNS_QUESTION_ID]).toHaveLength(1);
    });

    it('should reject a 6th design and persist nothing', async () => {
      const contract = await createContract({
        token: 'tattoo-six',
        productName: TRIGGER_NAME,
        eventDate: daysFromToday(30),
      });

      await expect(
        service.setTattooDesigns({
          token: 'tattoo-six',
          phone: PHONE,
          assets: assets(contract.id, 11),
        }),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);

      const after = await service.getByToken({
        token: 'tattoo-six',
        phone: PHONE,
      });
      expect(after.answers[TATTOO_DESIGNS_QUESTION_ID]).toBeUndefined();
    });

    it('should replace and delete designs before the closing date', async () => {
      const contract = await createContract({
        token: 'tattoo-replace',
        productName: TRIGGER_NAME,
        eventDate: daysFromToday(30),
      });
      await service.setTattooDesigns({
        token: 'tattoo-replace',
        phone: PHONE,
        assets: assets(contract.id, 3),
      });

      const replaced = await service.setTattooDesigns({
        token: 'tattoo-replace',
        phone: PHONE,
        assets: assets(contract.id, 1),
      });
      expect(replaced.answers[TATTOO_DESIGNS_QUESTION_ID]).toHaveLength(1);

      const deleted = await service.setTattooDesigns({
        token: 'tattoo-replace',
        phone: PHONE,
        assets: [],
      });
      expect(deleted.answers[TATTOO_DESIGNS_QUESTION_ID]).toEqual([]);
    });

    it('should reject uploads, replacements and deletes 7 days or less before the event', async () => {
      const contract = await createContract({
        token: 'tattoo-closed',
        productName: TRIGGER_NAME,
        eventDate: daysFromToday(7),
      });

      await expect(
        service.setTattooDesigns({
          token: 'tattoo-closed',
          phone: PHONE,
          assets: assets(contract.id, 2),
        }),
      ).rejects.toBeInstanceOf(ConflictException);
      await expect(
        service.setTattooDesigns({
          token: 'tattoo-closed',
          phone: PHONE,
          assets: [],
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('should reject a contract without a tattoo designs product', async () => {
      const contract = await createContract({
        token: 'tattoo-makeup',
        productName: NON_TRIGGER_NAME,
        eventDate: daysFromToday(30),
      });

      await expect(
        service.setTattooDesigns({
          token: 'tattoo-makeup',
          phone: PHONE,
          assets: assets(contract.id, 1),
        }),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
    });

    it('should reject assets that do not live under this contract tattoo folder', async () => {
      const contract = await createContract({
        token: 'tattoo-foreign',
        productName: TRIGGER_NAME,
        eventDate: daysFromToday(30),
      });

      await expect(
        service.setTattooDesigns({
          token: 'tattoo-foreign',
          phone: PHONE,
          assets: [
            {
              path: `${contract.id + 1}/${TATTOO_DESIGNS_QUESTION_ID}/x.png`,
              mime: 'image/png',
            },
          ],
        }),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
    });

    it('should reject non-image assets', async () => {
      const contract = await createContract({
        token: 'tattoo-mime',
        productName: TRIGGER_NAME,
        eventDate: daysFromToday(30),
      });

      await expect(
        service.setTattooDesigns({
          token: 'tattoo-mime',
          phone: PHONE,
          assets: [
            {
              path: `${contract.id}/${TATTOO_DESIGNS_QUESTION_ID}/x.pdf`,
              mime: 'application/pdf',
            },
          ],
        }),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
    });

    it('should require a valid token and phone', async () => {
      await createContract({
        token: 'tattoo-auth',
        productName: TRIGGER_NAME,
        eventDate: daysFromToday(30),
      });

      await expect(
        service.setTattooDesigns({
          token: 'tattoo-auth',
          phone: '000',
          assets: [],
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
      await expect(
        service.setTattooDesigns({ token: 'nope', phone: PHONE, assets: [] }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('getByToken', () => {
    it('should report tattoo_designs as locked (read-only) once the closing date has passed', async () => {
      const contract = await createContract({
        token: 'tattoo-read-only',
        productName: TRIGGER_NAME,
        eventDate: daysFromToday(30),
      });
      await service.setTattooDesigns({
        token: 'tattoo-read-only',
        phone: PHONE,
        assets: assets(contract.id, 2),
      });
      await TestDataSource.query(
        `UPDATE bookings SET event_date = $1 WHERE contract_id = $2`,
        [daysFromToday(3), contract.id],
      );

      const res = await service.getByToken({
        token: 'tattoo-read-only',
        phone: PHONE,
      });

      expect(res.answers[TATTOO_DESIGNS_QUESTION_ID]).toHaveLength(2);
      expect(res.locked[TATTOO_DESIGNS_QUESTION_ID]).toBe(true);
    });

    it('should not mark tattoo_designs locked for a Make up contract (unchanged behavior)', async () => {
      await createContract({
        token: 'tattoo-makeup-get',
        productName: NON_TRIGGER_NAME,
        eventDate: daysFromToday(3),
      });

      const res = await service.getByToken({
        token: 'tattoo-makeup-get',
        phone: PHONE,
      });

      expect(res.locked[TATTOO_DESIGNS_QUESTION_ID]).toBeUndefined();
    });
  });

  describe('generic answer paths', () => {
    it('should refuse tattoo_designs through the generic answer endpoints', async () => {
      const contract = await createContract({
        token: 'tattoo-generic',
        productName: TRIGGER_NAME,
        eventDate: daysFromToday(30),
      });

      await expect(
        service.saveAnswerByPhone({
          token: 'tattoo-generic',
          phone: PHONE,
          questionId: TATTOO_DESIGNS_QUESTION_ID,
          value: assets(contract.id, 1),
        }),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
    });
  });
});
