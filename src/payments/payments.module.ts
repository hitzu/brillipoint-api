import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { StorageModule } from '../common/storage/storage.module';
import { Payment } from './entities/payment.entity';
import { PaymentsService } from './payments.service';

@Module({
  imports: [TypeOrmModule.forFeature([Payment]), StorageModule],
  providers: [PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
