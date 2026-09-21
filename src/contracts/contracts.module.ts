import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ContractsController } from './contracts.controller';
import { ContractsService } from './contracts.service';
import { Contract } from './entities/contract.entity';
import { ContractExtra } from './entities/contract-extra.entity';
import { ContractPackage } from './entities/contract-package.entity';
import { Extra } from '../extras/entities/extra.entity';
import { Package } from '../packages/entities/package.entity';
import { Slot } from '../slots/entities/slot.entity';
import { PaymentsModule } from '../payments/payments.module';
import { ContractSlot } from './entities/contract-slot.entity';
import { ContractPreparationProfile } from './entities/contract-preparation-profile.entity';
import { ContractsPreparationProfileService } from './preparation-profile/contracts-preparation-profile.service';
import { PrepProfileUploadsService } from './preparation-profile/prep-profile-uploads.service';
import { Event } from '../events/entities/event.entity';
import { PromotionsModule } from '../promotions/promotions.module';

@Module({
  imports: [
    PaymentsModule,
    PromotionsModule,
    TypeOrmModule.forFeature([
      Contract,
      ContractExtra,
      ContractPackage,
      Extra,
      Slot,
      Package,
      ContractSlot,
      ContractPreparationProfile,
      Event,
    ]),
  ],
  controllers: [ContractsController],
  providers: [
    ContractsService,
    ContractsPreparationProfileService,
    PrepProfileUploadsService,
  ],
})
export class ContractsModule {}
