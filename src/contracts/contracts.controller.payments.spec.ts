import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { PAYMENT_METHOD } from './types/payment-method.types';
import type { PaymentResponseDto } from '../payments/dto/payment-response.dto';
import { ContractsController } from './contracts.controller';
import { ContractsService } from './contracts.service';
import { ContractsPreparationProfileService } from './preparation-profile/contracts-preparation-profile.service';
import { PrepProfileUploadsService } from './preparation-profile/prep-profile-uploads.service';

describe('ContractsController (payments)', () => {
  it('allows registering a payment on an existing contract', async () => {
    const response: PaymentResponseDto = {
      id: 1,
      contractId: 10,
      amount: 50,
      method: PAYMENT_METHOD.CASH,
      receivedAt: new Date('2030-01-01T10:00:00.000Z'),
      note: null,
      reference: null,
      createdAt: new Date('2030-01-01T10:00:00.000Z'),
    };

    const contractsService = {
      createPayment: jest.fn().mockResolvedValue(response),
      listPayments: jest.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [ContractsController],
      providers: [
        { provide: ContractsService, useValue: contractsService },
        { provide: ContractsPreparationProfileService, useValue: {} },
        { provide: PrepProfileUploadsService, useValue: {} },
      ],
    }).compile();

    const app = moduleRef.createNestApplication();
    await app.init();

    await request(app.getHttpServer())
      .post('/contracts/10/payments')
      .send({
        amount: 50,
        method: 'cash',
        receivedAt: '2030-01-01T10:00:00.000Z',
      })
      .expect(201)
      .expect(() => {
        expect(contractsService.createPayment).toHaveBeenCalledWith(10, {
          amount: 50,
          method: 'cash',
          receivedAt: new Date('2030-01-01T10:00:00.000Z'),
        });
      });

    await app.close();
  });

  it('fails if the contract does not exist', async () => {
    const contractsService = {
      createPayment: jest
        .fn()
        .mockRejectedValue(new NotFoundException('Contract not found')),
      listPayments: jest.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [ContractsController],
      providers: [
        { provide: ContractsService, useValue: contractsService },
        { provide: ContractsPreparationProfileService, useValue: {} },
        { provide: PrepProfileUploadsService, useValue: {} },
      ],
    }).compile();

    const app = moduleRef.createNestApplication();
    await app.init();

    await request(app.getHttpServer())
      .post('/contracts/999999/payments')
      .send({
        amount: 50,
        method: 'cash',
        receivedAt: '2030-01-01T10:00:00.000Z',
      })
      .expect(404);

    await app.close();
  });

  it('fails if contractId is invalid', async () => {
    const contractsService = {
      createPayment: jest.fn(),
      listPayments: jest.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [ContractsController],
      providers: [
        { provide: ContractsService, useValue: contractsService },
        { provide: ContractsPreparationProfileService, useValue: {} },
        { provide: PrepProfileUploadsService, useValue: {} },
      ],
    }).compile();

    const app = moduleRef.createNestApplication();
    await app.init();

    await request(app.getHttpServer())
      .post('/contracts/abc/payments')
      .send({
        amount: 50,
        method: 'cash',
        receivedAt: '2030-01-01T10:00:00.000Z',
      })
      .expect(400);

    expect(contractsService.createPayment).not.toHaveBeenCalled();
    await app.close();
  });

  it('routes PATCH, DELETE and receipt-upload-url for payments', async () => {
    const contractsService = {
      createPayment: jest.fn(),
      listPayments: jest.fn(),
      updatePayment: jest.fn().mockResolvedValue({ id: 5 }),
      deletePayment: jest.fn().mockResolvedValue(undefined),
      createPaymentReceiptUploadUrl: jest
        .fn()
        .mockResolvedValue({ path: 'p', signedUrl: 's', token: 't' }),
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [ContractsController],
      providers: [
        { provide: ContractsService, useValue: contractsService },
        { provide: ContractsPreparationProfileService, useValue: {} },
        { provide: PrepProfileUploadsService, useValue: {} },
      ],
    }).compile();

    const app = moduleRef.createNestApplication();
    await app.init();
    const http = request(app.getHttpServer());

    await http
      .patch('/contracts/10/payments/5')
      .send({ amount: 70, receiptPath: null })
      .expect(200);
    expect(contractsService.updatePayment).toHaveBeenCalledWith(10, 5, {
      amount: 70,
      receiptPath: null,
    });

    await http.delete('/contracts/10/payments/5').expect(204);
    expect(contractsService.deletePayment).toHaveBeenCalledWith(10, 5);

    await http
      .post('/contracts/10/payments/receipt-upload-url')
      .send({ fileName: 'a.pdf', mime: 'application/pdf', size: 100 })
      .expect(201);
    await http
      .post('/contracts/10/payments/receipt-upload-url')
      .send({ fileName: 'a.pdf', mime: 'application/pdf', size: 11534336 })
      .expect(400);
    await http.patch('/contracts/10/payments/abc').send({}).expect(400);

    await app.close();
  });
});
