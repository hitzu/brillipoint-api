import type { Repository } from 'typeorm';

import { randomUUID } from 'crypto';

import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { plainToInstance } from 'class-transformer';

import { StorageService } from '../common/storage/storage.service';
import { PAYMENT_METHOD } from '../contracts/types/payment-method.types';
import type { CreatePaymentDto } from './dto/create-payment.dto';
import {
  PAYMENT_RECEIPT_MAX_BYTES,
  PAYMENT_RECEIPT_MIME,
} from './dto/create-payment-receipt-upload-url.dto';
import type { CreatePaymentReceiptUploadUrlDto } from './dto/create-payment-receipt-upload-url.dto';
import { PaymentDto } from './dto/payment.dto';
import { PaymentReceiptUploadUrlDto } from './dto/payment-receipt-upload-url.dto';
import type { UpdatePaymentDto } from './dto/update-payment.dto';
import { Payment } from './entities/payment.entity';

/** Signed read URLs for receipts are valid for one hour. */
export const PAYMENT_RECEIPT_URL_TTL_SECONDS = 60 * 60;

export type PaymentWithReceiptUrl = Payment & {
  receiptUrl: string | null;
};

@Injectable()
export class PaymentsService {
  constructor(
    @InjectRepository(Payment)
    private readonly paymentsRepository: Repository<Payment>,
    private readonly storageService: StorageService,
  ) {}

  private receiptPrefix(contractId: number): string {
    return `payments/${contractId}/`;
  }

  /**
   * A receipt belongs to a payment only when it is a path under the contract's
   * own folder, and only card/transfer payments carry one.
   */
  private resolveReceiptPath(
    contractId: number,
    method: PAYMENT_METHOD,
    receiptPath: string | null | undefined,
  ): string | null {
    if (receiptPath == null || method === PAYMENT_METHOD.CASH) {
      return null;
    }
    const valid =
      receiptPath.startsWith(this.receiptPrefix(contractId)) &&
      !receiptPath.includes('..');
    if (!valid) {
      throw new BadRequestException(
        'receiptPath does not belong to this contract',
      );
    }
    return receiptPath;
  }

  async createReceiptUploadUrl(
    contractId: number,
    dto: CreatePaymentReceiptUploadUrlDto,
  ): Promise<PaymentReceiptUploadUrlDto> {
    if (dto.mime !== PAYMENT_RECEIPT_MIME) {
      throw new UnprocessableEntityException('Receipt must be a PDF');
    }
    if (dto.size > PAYMENT_RECEIPT_MAX_BYTES) {
      throw new UnprocessableEntityException('Receipt exceeds 10 MB');
    }
    const name = this.storageService
      .sanitizeFileName(dto.fileName)
      .replace(/\.pdf$/i, '');
    const path = `${this.receiptPrefix(contractId)}${randomUUID()}_${name}.pdf`;
    const { signedUrl, token } =
      await this.storageService.createSignedUploadUrl(
        path,
        this.storageService.privateBucket,
      );
    return plainToInstance(
      PaymentReceiptUploadUrlDto,
      { path, signedUrl, token },
      { excludeExtraneousValues: true },
    );
  }

  async withReceiptUrl(payment: Payment): Promise<PaymentWithReceiptUrl> {
    const receiptUrl = payment.receiptPath
      ? await this.storageService.createSignedReadUrl({
          path: payment.receiptPath,
          expiresIn: PAYMENT_RECEIPT_URL_TTL_SECONDS,
          bucket: this.storageService.privateBucket,
        })
      : null;
    return Object.assign(payment, { receiptUrl });
  }

  async withReceiptUrls(payments: Payment[]): Promise<PaymentWithReceiptUrl[]> {
    return await Promise.all(payments.map((p) => this.withReceiptUrl(p)));
  }

  private async toDto(payment: Payment): Promise<PaymentDto> {
    return plainToInstance(PaymentDto, await this.withReceiptUrl(payment), {
      excludeExtraneousValues: true,
    });
  }

  async createPayment(
    contractId: number,
    dto: CreatePaymentDto,
  ): Promise<PaymentDto> {
    const payment = this.paymentsRepository.create({
      contractId,
      amount: dto.amount,
      method: dto.method,
      receivedAt: dto.receivedAt,
      note: dto.note ?? null,
      reference: dto.reference ?? null,
      receiptPath: this.resolveReceiptPath(
        contractId,
        dto.method,
        dto.receiptPath,
      ),
    });
    const saved = await this.paymentsRepository.save(payment);
    return await this.toDto(saved);
  }

  async updatePayment(
    contractId: number,
    paymentId: number,
    dto: UpdatePaymentDto,
  ): Promise<PaymentDto> {
    const payment = await this.paymentsRepository.findOne({
      where: { id: paymentId, contractId },
    });
    if (!payment) {
      throw new NotFoundException('Payment not found');
    }
    const method = dto.method ?? payment.method;
    const requested =
      dto.receiptPath === undefined ? payment.receiptPath : dto.receiptPath;
    // The path is only re-validated when the caller sends one; an existing
    // receipt just follows the (possibly new) method.
    payment.receiptPath =
      dto.receiptPath === undefined
        ? method === PAYMENT_METHOD.CASH
          ? null
          : requested
        : this.resolveReceiptPath(contractId, method, requested);
    if (dto.amount !== undefined) payment.amount = dto.amount;
    payment.method = method;
    if (dto.receivedAt !== undefined) payment.receivedAt = dto.receivedAt;
    if (dto.note !== undefined) payment.note = dto.note ?? null;
    if (dto.reference !== undefined) payment.reference = dto.reference ?? null;
    const saved = await this.paymentsRepository.save(payment);
    return await this.toDto(saved);
  }

  async deletePayment(contractId: number, paymentId: number): Promise<void> {
    const payment = await this.paymentsRepository.findOne({
      where: { id: paymentId, contractId },
    });
    if (!payment) {
      throw new NotFoundException('Payment not found');
    }
    await this.paymentsRepository.softDelete(paymentId);
  }

  async listPaymentsByContract(contractId: number): Promise<Payment[]> {
    return await this.paymentsRepository.find({
      where: { contractId },
      order: { createdAt: 'ASC' },
    });
  }
}
