import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';

import { BaseTimeEntity } from '../../common/entities/base-time.entity';
import { Contract } from '../../contracts/entities/contract.entity';
import { PAYMENT_METHOD } from '../../contracts/types/payment-method.types';
import { PaymentDto } from '../dto/payment.dto';
import { UseDto } from '../../common/dto/use-dto.decorator';

@Entity('payments')
@UseDto(PaymentDto)
export class Payment extends BaseTimeEntity {
  @Column('integer', { name: 'contract_id' })
  contractId!: number;

  @Column('decimal', {
    transformer: {
      to: (value: number) => value,
      from: (value: string) => Number(value),
    },
  })
  amount!: number;

  @Column('enum', { enum: PAYMENT_METHOD })
  method!: PAYMENT_METHOD;

  @Column('timestamptz', { name: 'received_at' })
  receivedAt!: Date;

  @Column('text', { nullable: true })
  note: string | null = null;

  @Column('text', { nullable: true })
  reference: string | null = null;

  @Column('text', { name: 'receipt_path', nullable: true })
  receiptPath: string | null = null;

  @ManyToOne(() => Contract, (contract) => contract.payments, {
    nullable: false,
  })
  @JoinColumn({ name: 'contract_id' })
  contract!: Contract;
}
