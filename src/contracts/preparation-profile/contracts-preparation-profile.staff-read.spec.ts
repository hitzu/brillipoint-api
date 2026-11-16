import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { ContractFactory } from '@factories/contracts/contract.factory';
import { ContractPreparationProfileFactory } from '@factories/contracts/contract-preparation-profile.factory';
import { AppDataSource as TestDataSource } from '../../config/database/data-source';
import { Contract } from '../entities/contract.entity';
import { ContractPreparationProfile } from '../entities/contract-preparation-profile.entity';
import { ContractsPreparationProfileService } from './contracts-preparation-profile.service';
import { PrepProfileUploadsService } from './prep-profile-uploads.service';

describe('ContractsPreparationProfileService (staff read)', () => {
  let service: ContractsPreparationProfileService;
  let contractFactory: ContractFactory;
  let profileFactory: ContractPreparationProfileFactory;
  let uploadsService: {
    getPublicUrl: jest.Mock;
    createSignedReadUrl: jest.Mock;
  };

  beforeEach(async () => {
    uploadsService = {
      getPublicUrl: jest.fn((path: string) => `public/${path}`),
      createSignedReadUrl: jest.fn((input: { path: string }) =>
        Promise.resolve(`signed/${input.path}`),
      ),
    };
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
        { provide: PrepProfileUploadsService, useValue: uploadsService },
      ],
    }).compile();

    service = module.get(ContractsPreparationProfileService);
    contractFactory = new ContractFactory(TestDataSource);
    profileFactory = new ContractPreparationProfileFactory(TestDataSource);
  });

  it('should return answers with signed asset urls by contract id, without a phone', async () => {
    const contract = await contractFactory.create({
      clientPhone: '2222232323',
    });
    await profileFactory.create({
      contractId: contract.id,
      answers: {
        makeup_idea: 'natural',
        tattoo_designs: [
          { path: `${contract.id}/tattoo_designs/a.png`, mime: 'image/png' },
        ],
      },
      locked: { makeup_idea: true },
    });

    const res = await service.getByContractId({
      contractId: contract.id,
      assets: 'signed',
    });

    expect(res.contractId).toBe(contract.id);
    expect(res.answers.makeup_idea).toBe('natural');
    expect(res.answers.tattoo_designs).toEqual([
      expect.objectContaining({
        path: `${contract.id}/tattoo_designs/a.png`,
        url: `signed/${contract.id}/tattoo_designs/a.png`,
      }),
    ]);
  });

  it('should return empty answers when the contract has no profile yet', async () => {
    const contract = await contractFactory.create();

    const res = await service.getByContractId({
      contractId: contract.id,
      assets: 'none',
    });

    expect(res.answers).toEqual({});
  });

  it('should throw NotFoundException for an unknown contract', async () => {
    await expect(
      service.getByContractId({ contractId: 999999 }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
