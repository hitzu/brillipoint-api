import type { Repository } from 'typeorm';

import {
  BadRequestException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import { AppDataSource as TestDataSource } from '../config/database/data-source';
import { ContractFactory } from '../../test/factories/contracts/contract.factory';
import { PaymentFactory } from '../../test/factories/contracts/payment.factory';
import { StorageService } from '../common/storage/storage.service';
import { PAYMENT_METHOD } from '../contracts/types/payment-method.types';
import type { CreatePaymentDto } from './dto/create-payment.dto';
import { Payment } from './entities/payment.entity';
import { PaymentsService } from './payments.service';

describe('PaymentsService', () => {
  let service: PaymentsService;
  let paymentsRepository: Repository<Payment>;
  let contractFactory: ContractFactory;
  let paymentFactory: PaymentFactory;
  const storage = {
    privateBucket: 'local-priv',
    sanitizeFileName: (n: string) => n.replace(/[^\w.-]+/g, '_'),
    createSignedUploadUrl: jest.fn(),
    createSignedReadUrl: jest.fn(),
  };

  beforeEach(async () => {
    storage.createSignedUploadUrl.mockReset().mockResolvedValue({
      signedUrl: 'https://s/upload',
      token: 'tok',
    });
    storage.createSignedReadUrl
      .mockReset()
      .mockImplementation(({ path }: { path: string }) =>
        Promise.resolve(`https://s/sign/${path}`),
      );
    const module = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: StorageService, useValue: storage },
        { provide: DataSource, useValue: TestDataSource },
        {
          provide: getRepositoryToken(Payment),
          useValue: TestDataSource.getRepository(Payment),
        },
      ],
    }).compile();

    service = module.get(PaymentsService);
    paymentsRepository = module.get<Repository<Payment>>(
      getRepositoryToken(Payment),
    );

    contractFactory = new ContractFactory(TestDataSource);
    paymentFactory = new PaymentFactory(TestDataSource);
  });

  it('creates and persists a valid payment (including note/reference)', async () => {
    const contract = await contractFactory.create();
    const dto: CreatePaymentDto = {
      amount: 100,
      method: PAYMENT_METHOD.CASH,
      receivedAt: new Date('2030-01-01T10:00:00.000Z'),
      note: 'ok',
      reference: 'ref-1',
    };

    const created = await service.createPayment(contract.id, dto);

    expect(created.id).toBeDefined();
    expect(created.contractId).toBe(contract.id);
    expect(created.amount).toBe(dto.amount);
    expect(created.method).toBe(dto.method);
    expect(created.receivedAt).toEqual(dto.receivedAt);
    expect(created.note).toBe(dto.note);
    expect(created.reference).toBe(dto.reference);

    const persisted = await paymentsRepository.findOneByOrFail({
      id: created.id,
    });
    expect(persisted.contractId).toBe(contract.id);
    expect(persisted.amount).toBe(dto.amount);
    expect(persisted.method).toBe(dto.method);
    expect(persisted.receivedAt).toEqual(dto.receivedAt);
    expect(persisted.note).toBe(dto.note);
    expect(persisted.reference).toBe(dto.reference);
  });

  it('defaults note and reference to null when omitted', async () => {
    const contract = await contractFactory.create();
    const dto: CreatePaymentDto = {
      amount: 55.5,
      method: PAYMENT_METHOD.TRANSFER,
      receivedAt: new Date('2030-02-01T12:00:00.000Z'),
    };

    const created = await service.createPayment(contract.id, dto);
    expect(created.note).toBeNull();
    expect(created.reference).toBeNull();
  });

  it('lists payments by contract', async () => {
    const contractA = await contractFactory.create();
    const contractB = await contractFactory.create();

    await paymentFactory.createForContract(contractB);
    const p1 = await paymentFactory.createForContract(contractA);
    const p2 = await paymentFactory.createForContract(contractA);

    const results = await service.listPaymentsByContract(contractA.id);

    expect(results).toHaveLength(2);
    expect(results.map((p) => p.id).sort((a, b) => a - b)).toEqual(
      [p1.id, p2.id].sort((a, b) => a - b),
    );
    expect(results.every((p) => p.contractId === contractA.id)).toBe(true);
    expect(results[0].createdAt.getTime()).toBeLessThanOrEqual(
      results[1].createdAt.getTime(),
    );
  });

  describe('receipts', () => {
    const base = {
      amount: 100,
      method: PAYMENT_METHOD.TRANSFER,
      receivedAt: new Date('2030-01-01T10:00:00.000Z'),
    };

    it('issues a signed upload URL in the private bucket for a PDF', async () => {
      const contract = await contractFactory.create();

      const result = await service.createReceiptUploadUrl(contract.id, {
        fileName: 'comprobante 1.pdf',
        mime: 'application/pdf',
        size: 1024,
      });

      expect(result.path).toMatch(
        new RegExp(
          `^payments/${contract.id}/[0-9a-f-]{36}_comprobante_1\\.pdf$`,
        ),
      );
      expect(result.signedUrl).toBe('https://s/upload');
      expect(result.token).toBe('tok');
      expect(storage.createSignedUploadUrl).toHaveBeenCalledWith(
        result.path,
        'local-priv',
      );
    });

    it('rejects non-PDF and oversized receipts', async () => {
      const contract = await contractFactory.create();

      await expect(
        service.createReceiptUploadUrl(contract.id, {
          fileName: 'a.png',
          mime: 'image/png',
          size: 10,
        }),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
      await expect(
        service.createReceiptUploadUrl(contract.id, {
          fileName: 'a.pdf',
          mime: 'application/pdf',
          size: 10 * 1024 * 1024 + 1,
        }),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
      expect(storage.createSignedUploadUrl).not.toHaveBeenCalled();
    });

    it('creates a payment with a receipt and returns a signed URL, never the path', async () => {
      const contract = await contractFactory.create();
      const receiptPath = `payments/${contract.id}/x_a.pdf`;

      const created = await service.createPayment(contract.id, {
        ...base,
        receiptPath,
      });

      expect(created.receiptUrl).toBe(`https://s/sign/${receiptPath}`);
      expect(created).not.toHaveProperty('receiptPath');
      expect(storage.createSignedReadUrl).toHaveBeenCalledWith({
        path: receiptPath,
        expiresIn: 3600,
        bucket: 'local-priv',
      });
      const persisted = await paymentsRepository.findOneByOrFail({
        id: created.id,
      });
      expect(persisted.receiptPath).toBe(receiptPath);
    });

    it('creates with only reference, only receipt, both or neither', async () => {
      const contract = await contractFactory.create();
      const receiptPath = `payments/${contract.id}/x_a.pdf`;

      const onlyRef = await service.createPayment(contract.id, {
        ...base,
        reference: 'folio 1',
      });
      const onlyPdf = await service.createPayment(contract.id, {
        ...base,
        method: PAYMENT_METHOD.CARD,
        receiptPath,
      });
      const both = await service.createPayment(contract.id, {
        ...base,
        reference: 'folio 2',
        receiptPath,
      });
      const neither = await service.createPayment(contract.id, base);

      expect(onlyRef.receiptUrl).toBeNull();
      expect(onlyPdf.receiptUrl).not.toBeNull();
      expect(both.reference).toBe('folio 2');
      expect(both.receiptUrl).not.toBeNull();
      expect(neither.receiptUrl).toBeNull();
      expect(neither.reference).toBeNull();
    });

    it('rejects a receipt path from another contract on create and update', async () => {
      const contract = await contractFactory.create();
      const other = await contractFactory.create();
      const foreign = `payments/${other.id}/x_a.pdf`;

      await expect(
        service.createPayment(contract.id, { ...base, receiptPath: foreign }),
      ).rejects.toBeInstanceOf(BadRequestException);

      const payment = await service.createPayment(contract.id, base);
      await expect(
        service.updatePayment(contract.id, payment.id, {
          receiptPath: foreign,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('does not keep a receipt on cash payments', async () => {
      const contract = await contractFactory.create();

      const created = await service.createPayment(contract.id, {
        ...base,
        method: PAYMENT_METHOD.CASH,
        receiptPath: `payments/${contract.id}/x_a.pdf`,
      });

      expect(created.receiptUrl).toBeNull();
    });
  });

  describe('updatePayment', () => {
    it('changes amount, method, date, note and reference', async () => {
      const contract = await contractFactory.create();
      const payment = await paymentFactory.createForContract(contract, {
        amount: 10,
        method: PAYMENT_METHOD.CASH,
      });

      const updated = await service.updatePayment(contract.id, payment.id, {
        amount: 99,
        method: PAYMENT_METHOD.TRANSFER,
        receivedAt: new Date('2031-05-05T10:00:00.000Z'),
        note: 'n',
        reference: 'r',
      });

      expect(updated.amount).toBe(99);
      expect(updated.method).toBe(PAYMENT_METHOD.TRANSFER);
      expect(updated.receivedAt).toEqual(new Date('2031-05-05T10:00:00.000Z'));
      expect(updated.note).toBe('n');
      expect(updated.reference).toBe('r');
    });

    it('attaches, keeps and removes a receipt', async () => {
      const contract = await contractFactory.create();
      const payment = await paymentFactory.createForContract(contract, {
        method: PAYMENT_METHOD.TRANSFER,
      });
      const receiptPath = `payments/${contract.id}/x_a.pdf`;

      const attached = await service.updatePayment(contract.id, payment.id, {
        receiptPath,
      });
      expect(attached.receiptUrl).toBe(`https://s/sign/${receiptPath}`);

      const kept = await service.updatePayment(contract.id, payment.id, {
        amount: 5,
      });
      expect(kept.receiptUrl).toBe(`https://s/sign/${receiptPath}`);

      const removed = await service.updatePayment(contract.id, payment.id, {
        receiptPath: null,
      });
      expect(removed.receiptUrl).toBeNull();
    });

    it('clears the receipt when the method becomes cash', async () => {
      const contract = await contractFactory.create();
      const payment = await paymentFactory.createForContract(contract, {
        method: PAYMENT_METHOD.CARD,
        receiptPath: `payments/${contract.id}/x_a.pdf`,
      });

      const updated = await service.updatePayment(contract.id, payment.id, {
        method: PAYMENT_METHOD.CASH,
      });

      expect(updated.receiptUrl).toBeNull();
      const persisted = await paymentsRepository.findOneByOrFail({
        id: payment.id,
      });
      expect(persisted.receiptPath).toBeNull();
    });

    it('404s for a payment of another contract', async () => {
      const contract = await contractFactory.create();
      const other = await contractFactory.create();
      const payment = await paymentFactory.createForContract(other);

      await expect(
        service.updatePayment(contract.id, payment.id, { amount: 1 }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('deletePayment', () => {
    it('soft-deletes the payment and hides it from listings', async () => {
      const contract = await contractFactory.create();
      const payment = await paymentFactory.createForContract(contract);

      await service.deletePayment(contract.id, payment.id);

      expect(await service.listPaymentsByContract(contract.id)).toHaveLength(0);
      const row = await paymentsRepository.findOne({
        where: { id: payment.id },
        withDeleted: true,
      });
      expect(row?.deletedAt).not.toBeNull();
    });

    it('404s for a payment of another contract', async () => {
      const contract = await contractFactory.create();
      const other = await contractFactory.create();
      const payment = await paymentFactory.createForContract(other);

      await expect(
        service.deletePayment(contract.id, payment.id),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
