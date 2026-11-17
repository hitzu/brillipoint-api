import {
  ConflictException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { BookingFactory } from '@factories/bookings/booking.factory';
import { ContractFactory } from '@factories/contracts/contract.factory';
import { ContractPackageFactory } from '@factories/contracts/contract-package.factory';
import { PackageFactory } from '@factories/packages/package.factory';
import { BOOKING_PURPOSE } from '../../bookings/constants/booking_purpose.enum';
import { Carousel } from '../../carousels/entities/carousel.entity';
import { AppDataSource as TestDataSource } from '../../config/database/data-source';
import { Contract } from '../entities/contract.entity';
import { ContractPreparationProfile } from '../entities/contract-preparation-profile.entity';
import { ContractsPreparationProfileService } from './contracts-preparation-profile.service';
import { PrepProfileUploadsService } from './prep-profile-uploads.service';
import {
  TATTOO_CATALOG_PAGE,
  TATTOO_CATALOG_QUESTION_ID,
  TATTOO_CATALOG_SECTION,
  TATTOO_DESIGNS_QUESTION_ID,
} from './tattoo-designs.policy';

const PHONE = '+52 (220) 175-2767';
const TRIGGER_NAME = 'Tatuajes personalizados';

function daysFromToday(days: number): string {
  const d = new Date(Date.now() - 6 * 60 * 60 * 1000); // Mexico City civil date
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

describe('ContractsPreparationProfileService (tattoo catalog designs)', () => {
  let service: ContractsPreparationProfileService;
  let contractFactory: ContractFactory;
  let packageFactory: PackageFactory;
  let contractPackageFactory: ContractPackageFactory;
  let bookingFactory: BookingFactory;

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
  });

  async function createContract(options: {
    token: string;
    productName?: string;
    eventDate?: string;
  }): Promise<Contract> {
    const contract = await contractFactory.create({
      token: options.token,
      clientPhone: PHONE,
    });
    const pkg = await packageFactory.createActive();
    await contractPackageFactory.createForContractAndPackage(contract, pkg, {
      nameSnapshot: pkg.name,
      basePriceSnapshot: pkg.basePrice,
      itemsSnapshot: [
        {
          productId: 1,
          name: options.productName ?? TRIGGER_NAME,
          quantity: 1,
        },
      ],
    });
    await bookingFactory.create({
      contractId: contract.id,
      purpose: BOOKING_PURPOSE.EVENT,
      eventDate: options.eventDate ?? daysFromToday(30),
    });
    return contract;
  }

  async function createCatalogRow(
    overrides: Partial<Carousel> = {},
  ): Promise<Carousel> {
    const repo = TestDataSource.getRepository(Carousel);
    return repo.save(
      repo.create({
        page: TATTOO_CATALOG_PAGE,
        section: TATTOO_CATALOG_SECTION,
        title: 'Mariposa',
        imageUrl: 'https://cdn.example/mariposa.png',
        status: 'active',
        ...overrides,
      }),
    );
  }

  const uploads = (contractId: number, count: number) =>
    Array.from({ length: count }, (_, i) => ({
      path: `${contractId}/${TATTOO_DESIGNS_QUESTION_ID}/uuid-${i}_design.png`,
      mime: 'image/png',
    }));

  it('should save the chosen catalog designs as a frozen copy next to the uploads', async () => {
    const contract = await createContract({ token: 'cat-ok' });
    const butterfly = await createCatalogRow({ title: 'Mariposa' });
    const star = await createCatalogRow({
      title: 'Estrella',
      imageUrl: 'https://cdn.example/estrella.png',
    });

    const res = await service.setTattooDesigns({
      token: 'cat-ok',
      phone: PHONE,
      assets: uploads(contract.id, 1),
      catalogDesignIds: [butterfly.id, star.id],
    });

    expect(res.answers[TATTOO_DESIGNS_QUESTION_ID]).toHaveLength(1);
    expect(res.answers[TATTOO_CATALOG_QUESTION_ID]).toEqual([
      {
        carouselId: butterfly.id,
        title: 'Mariposa',
        imageUrl: 'https://cdn.example/mariposa.png',
      },
      {
        carouselId: star.id,
        title: 'Estrella',
        imageUrl: 'https://cdn.example/estrella.png',
      },
    ]);
  });

  it('should allow exactly 10 between uploads and chosen designs and reject an 11th', async () => {
    const contract = await createContract({ token: 'cat-cap' });
    const rows = await Promise.all(
      [1, 2, 3].map((n) => createCatalogRow({ title: `Diseño ${n}` })),
    );
    const ids = rows.map((r) => r.id);

    await expect(
      service.setTattooDesigns({
        token: 'cat-cap',
        phone: PHONE,
        assets: uploads(contract.id, 7),
        catalogDesignIds: ids,
      }),
    ).resolves.toBeDefined();

    await expect(
      service.setTattooDesigns({
        token: 'cat-cap',
        phone: PHONE,
        assets: uploads(contract.id, 8),
        catalogDesignIds: ids,
      }),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);

    const after = await service.getByToken({ token: 'cat-cap', phone: PHONE });
    expect(after.answers[TATTOO_DESIGNS_QUESTION_ID]).toHaveLength(7);
    expect(after.answers[TATTOO_CATALOG_QUESTION_ID]).toHaveLength(3);
  });

  it('should reject the same design chosen twice', async () => {
    await createContract({ token: 'cat-dup' });
    const row = await createCatalogRow();

    await expect(
      service.setTattooDesigns({
        token: 'cat-dup',
        phone: PHONE,
        assets: [],
        catalogDesignIds: [row.id, row.id],
      }),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('should reject ids that are not active rows of the tattoo catalog', async () => {
    await createContract({ token: 'cat-bad' });
    const inactive = await createCatalogRow({ status: 'inactive' });
    const otherPage = await createCatalogRow({ page: 'expo-bebe' });
    const otherSection = await createCatalogRow({ section: 'services' });

    for (const id of [inactive.id, otherPage.id, otherSection.id, 999999]) {
      await expect(
        service.setTattooDesigns({
          token: 'cat-bad',
          phone: PHONE,
          assets: [],
          catalogDesignIds: [id],
        }),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
    }
  });

  it('should keep the frozen copy of an already chosen design after the catalog row changes', async () => {
    const contract = await createContract({ token: 'cat-frozen' });
    const row = await createCatalogRow({ title: 'Mariposa' });
    await service.setTattooDesigns({
      token: 'cat-frozen',
      phone: PHONE,
      assets: [],
      catalogDesignIds: [row.id],
    });

    await TestDataSource.getRepository(Carousel).update(row.id, {
      title: 'Mariposa v2',
      status: 'inactive',
    });
    const res = await service.setTattooDesigns({
      token: 'cat-frozen',
      phone: PHONE,
      assets: uploads(contract.id, 1),
      catalogDesignIds: [row.id],
    });

    expect(res.answers[TATTOO_CATALOG_QUESTION_ID]).toEqual([
      expect.objectContaining({ carouselId: row.id, title: 'Mariposa' }),
    ]);
  });

  it('should keep the current choice when catalogDesignIds is omitted, and count it in the total', async () => {
    const contract = await createContract({ token: 'cat-omit' });
    const rows = await Promise.all(
      [1, 2, 3, 4].map((n) => createCatalogRow({ title: `Diseño ${n}` })),
    );
    await service.setTattooDesigns({
      token: 'cat-omit',
      phone: PHONE,
      assets: [],
      catalogDesignIds: rows.map((r) => r.id),
    });

    const kept = await service.setTattooDesigns({
      token: 'cat-omit',
      phone: PHONE,
      assets: uploads(contract.id, 1),
    });
    expect(kept.answers[TATTOO_CATALOG_QUESTION_ID]).toHaveLength(4);

    await expect(
      service.setTattooDesigns({
        token: 'cat-omit',
        phone: PHONE,
        assets: uploads(contract.id, 7),
      }),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('should clear the chosen designs with an empty list', async () => {
    await createContract({ token: 'cat-clear' });
    const row = await createCatalogRow();
    await service.setTattooDesigns({
      token: 'cat-clear',
      phone: PHONE,
      assets: [],
      catalogDesignIds: [row.id],
    });

    const res = await service.setTattooDesigns({
      token: 'cat-clear',
      phone: PHONE,
      assets: [],
      catalogDesignIds: [],
    });

    expect(res.answers[TATTOO_CATALOG_QUESTION_ID]).toEqual([]);
  });

  it('should reject choosing 7 days or less before the event', async () => {
    await createContract({ token: 'cat-closed', eventDate: daysFromToday(7) });
    const row = await createCatalogRow();

    await expect(
      service.setTattooDesigns({
        token: 'cat-closed',
        phone: PHONE,
        assets: [],
        catalogDesignIds: [row.id],
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('should reject a contract without a tattoo designs product', async () => {
    await createContract({
      token: 'cat-noproduct',
      productName: 'Maquillista',
    });
    const row = await createCatalogRow();

    await expect(
      service.setTattooDesigns({
        token: 'cat-noproduct',
        phone: PHONE,
        assets: [],
        catalogDesignIds: [row.id],
      }),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('should refuse the catalog answer through the generic answer endpoints', async () => {
    await createContract({ token: 'cat-generic' });

    await expect(
      service.saveAnswerByPhone({
        token: 'cat-generic',
        phone: PHONE,
        questionId: TATTOO_CATALOG_QUESTION_ID,
        value: [{ carouselId: 1, title: 'x', imageUrl: 'https://x/y.png' }],
      }),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });
});
