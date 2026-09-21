import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { plainToInstance } from 'class-transformer';
import { DataSource, EntityManager, In, Repository } from 'typeorm';

import { Package } from '../packages/entities/package.entity';
import { CreatePaymentDto } from '../payments/dto/create-payment.dto';
import { PaymentsService } from '../payments/payments.service';
import { Payment } from '../payments/entities/payment.entity';
import { Contract } from './entities/contract.entity';
import { AddExtraDto } from './dto/add-extra.dto';
import { AddItemDto } from './dto/add-item.dto';
import { ContractDetailDto } from './dto/contract-detail.dto';
import { CreateContractFromSlotsDto } from './dto/create-contract-from-slots.dto';
import { UpdateItemDto } from './dto/update-item.dto';
import { CONTRACT_STATUS } from './types/contract-status.types';
import { ContractExtra } from './entities/contract-extra.entity';
import { ContractPackage } from './entities/contract-package.entity';
import { Slot } from '../slots/entities/slot.entity';
import { SLOT_STATUS } from '../slots/types/slot-status.types';
import { randomUUID } from 'crypto';
import { ContractDto } from './dto/contract.dto';
import { PaymentDto } from 'src/payments/dto/payment.dto';
import { ContractSlot } from './entities/contract-slot.entity';
import { EXCEPTION_RESPONSE } from '../config/errors/exception-response.config';
import { CONTRACT_SLOT_PURPOSE } from './constants/slot_purpose.enum';
import { AddContractSlotDto } from './dto/add-contract-slot.dto';
import { ListContractsQueryDto } from './dto/list-contracts-query.dto';
import { ContractPromotion } from './entities/contract-promotion.entity';
import { Event } from '../events/entities/event.entity';
import { Extra } from '../extras/entities/extra.entity';
import { EXTRA_STATUS } from '../extras/types/extras-status.types';
import {
  ActiveTierInfo,
  PromotionsService,
} from '../promotions/promotions.service';
import {
  Promotion,
  PROMOTION_TYPE,
} from '../promotions/entities/promotion.entity';

interface RecalculateTotalsRepos {
  contractPackagesRepo: Repository<ContractPackage>;
  contractExtrasRepo: Repository<ContractExtra>;
  contractsRepo: Repository<Contract>;
}

@Injectable()
export class ContractsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly paymentsService: PaymentsService,
    private readonly promotionsService: PromotionsService,
    @InjectRepository(Contract)
    private readonly contractsRepository: Repository<Contract>,
    @InjectRepository(Slot)
    private readonly slotsRepository: Repository<Slot>,
    @InjectRepository(ContractPackage)
    private readonly contractPackagesRepository: Repository<ContractPackage>,
    @InjectRepository(Package)
    private readonly packagesRepository: Repository<Package>,
    @InjectRepository(ContractExtra)
    private readonly contractExtrasRepository: Repository<ContractExtra>,
    @InjectRepository(Extra)
    private readonly extrasRepository: Repository<Extra>,
    @InjectRepository(ContractSlot)
    private readonly contractSlotsRepository: Repository<ContractSlot>,
    @InjectRepository(Event)
    private readonly eventsRepository: Repository<Event>,
  ) {}

  private async recalculateTotals(
    contractId: number,
    repos: RecalculateTotalsRepos = {
      contractPackagesRepo: this.contractPackagesRepository,
      contractExtrasRepo: this.contractExtrasRepository,
      contractsRepo: this.contractsRepository,
    },
  ): Promise<void> {
    const [items, extras] = await Promise.all([
      repos.contractPackagesRepo.find({ where: { contractId } }),
      repos.contractExtrasRepo.find({ where: { contractId } }),
    ]);
    const itemsGross = items.reduce(
      (sum, item) => sum + item.quantity * item.basePriceSnapshot,
      0,
    );
    const itemsFinal = items.reduce(
      (sum, item) =>
        sum +
        (item.finalPriceSnapshot ?? item.quantity * item.basePriceSnapshot),
      0,
    );
    const extrasGross = extras.reduce(
      (sum, extra) => sum + extra.quantity * extra.basePriceSnapshot,
      0,
    );
    const extrasFinal = extras.reduce(
      (sum, extra) =>
        sum +
        (extra.finalPriceSnapshot ?? extra.quantity * extra.basePriceSnapshot),
      0,
    );
    const subtotal = itemsGross + extrasGross;
    const discountTotal = itemsGross - itemsFinal + (extrasGross - extrasFinal);
    const total = subtotal - discountTotal;
    await repos.contractsRepo.update(contractId, {
      subtotal,
      discountTotal,
      total,
    });
  }

  async createContract(dto: CreateContractFromSlotsDto): Promise<ContractDto> {
    const hasSlotId = dto.slotId !== undefined && dto.slotId !== null;

    let slot: Slot | null = null;
    if (hasSlotId) {
      const contractSlotValidation = await this.contractSlotsRepository.findOne(
        {
          where: { slotId: dto.slotId },
        },
      );
      if (contractSlotValidation) {
        throw new ConflictException(EXCEPTION_RESPONSE.SLOT_ALREADY_USED);
      }

      slot = await this.slotsRepository.findOne({
        where: { id: dto.slotId },
      });
      if (!slot) {
        throw new NotFoundException(EXCEPTION_RESPONSE.SLOT_NOT_FOUND);
      }
      if (slot.status !== SLOT_STATUS.RESERVED) {
        throw new ConflictException(EXCEPTION_RESPONSE.SLOT_NOT_AVAILABLE);
      }
    }

    const brandId = dto.brandId ?? null;

    const contractId = await this.dataSource.transaction(
      async (manager: EntityManager) => {
        const contractsRepo = manager.getRepository(Contract);
        const contractPackagesRepo = manager.getRepository(ContractPackage);
        const contractExtrasRepo = manager.getRepository(ContractExtra);
        const contractSlotsRepo = manager.getRepository(ContractSlot);
        const contractPromotionsRepo = manager.getRepository(ContractPromotion);
        const packagesRepo = manager.getRepository(Package);
        const extrasRepo = manager.getRepository(Extra);

        const resolvedExtras = await this.resolveExtrasForContract(
          extrasRepo,
          dto.extras,
          brandId,
        );

        const activePromotion =
          brandId != null
            ? await this.promotionsService.getActivePromotionForBrand(brandId)
            : null;

        const contract = contractsRepo.create({
          userId: dto.userId,
          brandId,
          clientName: dto.clientName,
          clientPhone: dto.clientPhone,
          clientEmail: dto.clientEmail,
          sku: dto.sku,
          token: randomUUID(),
          status: CONTRACT_STATUS.CONFIRMED,
          slot,
        });
        const savedContract = await contractsRepo.save(contract);

        const {
          packagesByClientRef,
          appliedAmountByPromotionId: packageApplied,
        } = await this.setItems(
          contractPackagesRepo,
          packagesRepo,
          savedContract.id,
          dto.packages,
          activePromotion,
        );

        const extraApplied = await this.setExtras(
          contractExtrasRepo,
          savedContract.id,
          brandId,
          dto.extras,
          resolvedExtras,
          packagesByClientRef,
        );

        const mergedApplied = new Map<number, number>();
        for (const [promotionId, amount] of packageApplied) {
          mergedApplied.set(
            promotionId,
            (mergedApplied.get(promotionId) ?? 0) + amount,
          );
        }
        for (const [promotionId, amount] of extraApplied) {
          mergedApplied.set(
            promotionId,
            (mergedApplied.get(promotionId) ?? 0) + amount,
          );
        }
        await this.saveContractPromotions(
          contractPromotionsRepo,
          savedContract.id,
          mergedApplied,
        );

        if (hasSlotId) {
          const contractSlot = contractSlotsRepo.create({
            contractId: savedContract.id,
            slotId: dto.slotId,
            purpose: CONTRACT_SLOT_PURPOSE.EVENT,
          });
          await contractSlotsRepo.save(contractSlot);
        }

        await this.recalculateTotals(savedContract.id, {
          contractPackagesRepo,
          contractExtrasRepo,
          contractsRepo,
        });

        return savedContract.id;
      },
    );

    const savedContract = await this.contractsRepository.findOne({
      where: { id: contractId },
    });
    return plainToInstance(ContractDto, savedContract, {
      excludeExtraneousValues: true,
    });
  }

  private async setItems(
    contractPackagesRepo: Repository<ContractPackage>,
    packagesRepo: Repository<Package>,
    contractId: number,
    dto: AddItemDto[],
    activePromotion: Promotion | null,
  ): Promise<{
    packagesByClientRef: Map<string, ContractPackage>;
    appliedAmountByPromotionId: Map<number, number>;
  }> {
    const packagesByClientRef = new Map<string, ContractPackage>();
    const appliedAmountByPromotionId = new Map<number, number>();
    if (!dto.length) {
      return { packagesByClientRef, appliedAmountByPromotionId };
    }

    const packages = await packagesRepo.findBy({
      id: In(dto.map((p) => p.packageId)),
    });
    const packageById = new Map(packages.map((p) => [p.id, p]));

    for (const packageInfo of dto) {
      const pkg = packageById.get(packageInfo.packageId);
      if (!pkg) {
        throw new NotFoundException('Package not found');
      }
      const basePrice = pkg.basePrice || 0;
      const { promotionId, discountPercentage, finalPrice } =
        this.computeFlatPackageDiscount(
          activePromotion,
          basePrice,
          packageInfo.quantity,
        );

      const itemToSave = contractPackagesRepo.create({
        contractId,
        packageId: packageInfo.packageId,
        quantity: packageInfo.quantity,
        promotionId,
        nameSnapshot: pkg.name,
        basePriceSnapshot: basePrice,
        discountPercentageSnapshot: discountPercentage,
        finalPriceSnapshot: finalPrice,
      });
      const saved = await contractPackagesRepo.save(itemToSave);
      if (packageInfo.clientRef) {
        packagesByClientRef.set(packageInfo.clientRef, saved);
      }
      if (promotionId != null) {
        const appliedAmount = basePrice * packageInfo.quantity - finalPrice;
        appliedAmountByPromotionId.set(
          promotionId,
          (appliedAmountByPromotionId.get(promotionId) ?? 0) + appliedAmount,
        );
      }
    }
    return { packagesByClientRef, appliedAmountByPromotionId };
  }

  /**
   * Applies the brand's flat promotion (type PERCENTAGE or FIXED) to a
   * package row. BONUS promotions have no defined package-level discount
   * semantics yet, so they resolve to no discount here — they only drive the
   * per-extra tiers handled in setExtras.
   */
  private computeFlatPackageDiscount(
    promotion: Promotion | null,
    basePrice: number,
    quantity: number,
  ): {
    promotionId: number | null;
    discountPercentage: number;
    finalPrice: number;
  } {
    const gross = basePrice * quantity;
    if (!promotion) {
      return { promotionId: null, discountPercentage: 0, finalPrice: gross };
    }

    if (promotion.type === PROMOTION_TYPE.PERCENTAGE) {
      const discountPercentage = Math.min(Math.max(promotion.value, 0), 100);
      const finalPrice = gross * (1 - discountPercentage / 100);
      return { promotionId: promotion.id, discountPercentage, finalPrice };
    }

    if (promotion.type === PROMOTION_TYPE.FIXED) {
      const discountAmount = Math.min(
        Math.max(promotion.value, 0) * quantity,
        gross,
      );
      const finalPrice = gross - discountAmount;
      const discountPercentage = gross > 0 ? (discountAmount / gross) * 100 : 0;
      return { promotionId: promotion.id, discountPercentage, finalPrice };
    }

    return { promotionId: null, discountPercentage: 0, finalPrice: gross };
  }

  addItem(contractId: number, dto: AddItemDto): void {
    console.log('addItem', contractId, dto);
    //pending
  }

  /**
   * Persists each extra with a server-computed discount. The discount tier
   * consumed depends on (a) which ContractPackage the extra is tied to via
   * `packageClientRef`/`clientRef`, and (b) how many extras were already
   * assigned, in request order, to that same ContractPackage under the same
   * promotion. The client never supplies a discount or promotionId — both are
   * resolved here.
   */
  private async setExtras(
    contractExtrasRepo: Repository<ContractExtra>,
    contractId: number,
    brandId: number | null,
    dto: AddExtraDto[] | undefined,
    resolvedExtras: Map<number, Extra>,
    packagesByClientRef: Map<string, ContractPackage>,
  ): Promise<Map<number, number>> {
    const appliedAmountByPromotionId = new Map<number, number>();
    if (!dto?.length) {
      return appliedAmountByPromotionId;
    }

    const packageIds = Array.from(
      new Set(
        Array.from(packagesByClientRef.values()).map((pkg) => pkg.packageId),
      ),
    );
    const tierMapByPackageId: Map<number, ActiveTierInfo> =
      brandId != null
        ? await this.promotionsService.getActiveTierMapForBrand(
            brandId,
            packageIds,
          )
        : new Map<number, ActiveTierInfo>();

    const tierPositionByContractPackage = new Map<number, number>();

    for (const extraInfo of dto) {
      const extra = resolvedExtras.get(extraInfo.extraId);
      if (!extra) {
        throw new NotFoundException(EXCEPTION_RESPONSE.EXTRA_NOT_FOUND);
      }

      const contractPackage = extraInfo.packageClientRef
        ? packagesByClientRef.get(extraInfo.packageClientRef)
        : undefined;

      let promotionId: number | null = null;
      let discountPercentage = 0;

      const tierInfo = contractPackage
        ? tierMapByPackageId.get(contractPackage.packageId)
        : undefined;

      if (contractPackage && tierInfo) {
        const currentCount =
          tierPositionByContractPackage.get(contractPackage.id) ?? 0;
        const nextPosition = currentCount + 1;
        tierPositionByContractPackage.set(contractPackage.id, nextPosition);

        const tier = tierInfo.tiers.find((t) => t.order === nextPosition);
        if (tier) {
          promotionId = tierInfo.promotionId;
          discountPercentage = tier.discountPercentage;
        }
      }

      const basePrice = extra.price || 0;
      const finalPrice =
        basePrice * extraInfo.quantity * (1 - discountPercentage / 100);

      const extraToSave = contractExtrasRepo.create({
        contractId,
        extraId: extraInfo.extraId,
        contractPackageId: contractPackage?.id ?? null,
        promotionId,
        nameSnapshot: extra.name,
        basePriceSnapshot: basePrice,
        discountPercentageSnapshot: discountPercentage,
        finalPriceSnapshot: finalPrice,
        quantity: extraInfo.quantity,
      });
      await contractExtrasRepo.save(extraToSave);

      if (promotionId != null) {
        const grossAmount = basePrice * extraInfo.quantity;
        const appliedAmount = grossAmount - finalPrice;
        appliedAmountByPromotionId.set(
          promotionId,
          (appliedAmountByPromotionId.get(promotionId) ?? 0) + appliedAmount,
        );
      }
    }

    return appliedAmountByPromotionId;
  }

  /**
   * Writes one audit row per distinct promotion actually applied to this
   * contract (across both packages and extras), aggregating the total amount
   * discounted under that promotion.
   */
  private async saveContractPromotions(
    contractPromotionsRepo: Repository<ContractPromotion>,
    contractId: number,
    appliedAmountByPromotionId: Map<number, number>,
  ): Promise<void> {
    for (const [promotionId, appliedAmount] of appliedAmountByPromotionId) {
      const promotion = await this.promotionsService.findOne(promotionId);
      const contractPromotion = contractPromotionsRepo.create({
        contractId,
        promotionId,
        nameSnapshot: promotion.name,
        typeSnapshot: promotion.type,
        valueSnapshot: promotion.value,
        appliedAmount,
      });
      await contractPromotionsRepo.save(contractPromotion);
    }
  }

  async updateItemQuantity(
    contractId: number,
    itemId: number,
    dto: UpdateItemDto,
    actorUserId: number,
  ): Promise<ContractDetailDto> {
    void actorUserId;
    const contract = await this.contractsRepository.findOne({
      where: { id: contractId },
    });
    if (!contract) {
      throw new NotFoundException('Contract not found');
    }
    const item = await this.contractPackagesRepository.findOne({
      where: { id: itemId },
    });
    if (!item || item.contractId !== contractId) {
      throw new NotFoundException('Item not found');
    }
    if (dto.quantity != null) {
      if (dto.quantity < 1) {
        throw new UnprocessableEntityException('quantity must be >= 1');
      }
      await this.contractPackagesRepository.update(itemId, {
        quantity: dto.quantity,
      });
    }
    await this.recalculateTotals(contractId);
    return await this.getDetail(contractId);
  }

  async removeItem(
    contractId: number,
    itemId: number,
    actorUserId: number,
  ): Promise<ContractDetailDto> {
    void actorUserId;
    const contract = await this.contractsRepository.findOne({
      where: { id: contractId },
    });
    if (!contract) {
      throw new NotFoundException('Contract not found');
    }
    const item = await this.contractPackagesRepository.findOne({
      where: { id: itemId },
    });
    if (!item || item.contractId !== contractId) {
      throw new NotFoundException('Item not found');
    }
    await this.contractPackagesRepository.softDelete(itemId);
    await this.recalculateTotals(contractId);
    return await this.getDetail(contractId);
  }

  async createPayment(
    contractId: number,
    dto: CreatePaymentDto,
  ): Promise<PaymentDto> {
    const contract = await this.contractsRepository.findOne({
      where: { id: contractId },
    });
    if (!contract) {
      throw new NotFoundException('Contract not found');
    }
    if (contract.status === CONTRACT_STATUS.CANCELLED) {
      throw new ConflictException('Contract is cancelled');
    }
    const payment = await this.paymentsService.createPayment(contractId, dto);
    return plainToInstance(PaymentDto, payment, {
      excludeExtraneousValues: true,
    });
  }

  private async sumPayments(contractId: number): Promise<number> {
    const payments =
      await this.paymentsService.listPaymentsByContract(contractId);
    return payments.reduce((sum, payment) => sum + Number(payment.amount), 0);
  }

  async getDetail(contractId: number): Promise<ContractDetailDto> {
    const contract = await this.contractsRepository.findOne({
      where: { id: contractId },
      relations: ['slot', 'contractSlots', 'contractSlots.slot'],
    });
    if (!contract) {
      throw new NotFoundException('Contract not found');
    }
    const [items, extras, payments, paidAmount] = await Promise.all([
      this.contractPackagesRepository.find({
        where: { contractId },
      }),
      this.contractExtrasRepository.find({
        where: { contractId },
        relations: ['extra', 'extra.brand', 'promotion'],
      }),
      this.paymentsService.listPaymentsByContract(contractId),
      this.sumPayments(contractId),
    ]);
    return plainToInstance(
      ContractDetailDto,
      {
        contract,
        slot: contract.slot,
        contractSlots: contract.contractSlots,
        items,
        extras,
        payments,
        paidAmount,
      },
      { excludeExtraneousValues: true },
    );
  }

  async listPayments(contractId: number): Promise<PaymentDto[]> {
    await this.getDetail(contractId);
    const payments =
      await this.paymentsService.listPaymentsByContract(contractId);
    return plainToInstance(PaymentDto, payments, {
      excludeExtraneousValues: true,
    });
  }

  async cancel(contractId: number): Promise<ContractDetailDto> {
    const contract = await this.contractsRepository.findOne({
      where: { id: contractId },
    });
    if (!contract) {
      throw new NotFoundException('Contract not found');
    }
    if (contract.status === CONTRACT_STATUS.CANCELLED) {
      return await this.getDetail(contractId);
    }
    await this.dataSource.transaction(async (manager) => {
      await manager.getRepository(Contract).update(contractId, {
        status: CONTRACT_STATUS.CANCELLED,
      });
    });
    return await this.getDetail(contractId);
  }

  async reopen(
    contractId: number,
    actorUserId: number,
  ): Promise<ContractDetailDto> {
    void actorUserId;
    const contract = await this.contractsRepository.findOne({
      where: { id: contractId },
    });
    if (!contract) {
      throw new NotFoundException('Contract not found');
    }
    if (contract.status !== CONTRACT_STATUS.CANCELLED) {
      return await this.getDetail(contractId);
    }
    await this.contractsRepository.update(contractId, {
      status: CONTRACT_STATUS.CONFIRMED,
    });
    return await this.getDetail(contractId);
  }

  async finalize(
    contractId: number,
    actorUserId: number,
  ): Promise<ContractDetailDto> {
    void actorUserId;
    const contract = await this.contractsRepository.findOne({
      where: { id: contractId },
    });
    if (!contract) {
      throw new NotFoundException('Contract not found');
    }
    if (contract.status === CONTRACT_STATUS.CANCELLED) {
      throw new ConflictException('Cannot finalize a cancelled contract');
    }
    if (contract.status === CONTRACT_STATUS.FINALIZED) {
      return await this.getDetail(contractId);
    }
    await this.contractsRepository.update(contractId, {
      status: CONTRACT_STATUS.FINALIZED,
    });
    return await this.getDetail(contractId);
  }

  private maskEmail(email: string): string {
    const trimmed = email.trim();
    const at = trimmed.indexOf('@');
    if (at <= 0) return '****';
    const local = trimmed.slice(0, at);
    const domain = trimmed.slice(at + 1);
    const visibleCount = Math.min(local.length, local.length >= 4 ? 4 : 1);
    const visible = local.slice(0, visibleCount);
    if (!domain) return `${visible}****`;
    if (local.length <= visibleCount) return `${local}@${domain}`;
    return `${visible}****@${domain}`;
  }

  private maskPhone(phone: string): string {
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 4) return '***';
    return `***${digits.slice(-4)}`;
  }

  async getDetailByToken(token: string): Promise<ContractDetailDto> {
    const contract = await this.contractsRepository.findOne({
      where: { token },
      relations: ['slot', 'contractSlots', 'contractSlots.slot'],
    });
    if (!contract) {
      throw new NotFoundException('Contract not found');
    }

    const maskedContract = { ...contract };
    maskedContract.clientPhone = this.maskPhone(contract.clientPhone ?? '');
    maskedContract.clientEmail = this.maskEmail(contract.clientEmail ?? '');

    const contractId = contract.id;

    const [packages, extras, payments, paidAmount] = await Promise.all([
      this.contractPackagesRepository.find({
        where: { contractId },
        relations: [
          'package',
          'package.packageProducts',
          'package.packageProducts.product',
          'promotion',
        ],
      }),
      this.contractExtrasRepository.find({
        where: { contractId },
        relations: ['extra', 'extra.brand', 'promotion'],
      }),
      this.paymentsService.listPaymentsByContract(contractId),
      this.sumPayments(contractId),
    ]);

    return plainToInstance(
      ContractDetailDto,
      {
        contract: maskedContract,
        contractSlots: contract.contractSlots,
        packages,
        extras,
        payments,
        paidAmount,
      },
      { excludeExtraneousValues: true },
    );
  }

  async addContractSlot(
    contractId: number,
    dto: AddContractSlotDto,
  ): Promise<ContractDetailDto> {
    const contract = await this.contractsRepository.findOne({
      where: { id: contractId },
    });
    if (!contract) {
      throw new NotFoundException('Contract not found');
    }
    const contractSlot = this.contractSlotsRepository.create({
      contractId,
      slotId: dto.slotId,
      purpose: dto.purpose,
    });
    await this.contractSlotsRepository.save(contractSlot);
    return await this.getDetail(contractId);
  }

  async list(query?: ListContractsQueryDto): Promise<ContractDto[]> {
    const qb = this.contractsRepository
      .createQueryBuilder('contract')
      .leftJoinAndSelect('contract.slot', 'legacySlot')
      .leftJoinAndSelect('contract.contractSlots', 'cs')
      .leftJoinAndSelect('cs.slot', 'eventSlot')
      .leftJoinAndSelect('contract.event', 'event')
      .leftJoin(
        'contract_slots',
        'csEvent',
        `csEvent.contract_id = contract.id
         AND csEvent.purpose = :eventPurpose
         AND csEvent.deleted_at IS NULL`,
        { eventPurpose: CONTRACT_SLOT_PURPOSE.EVENT },
      )
      .leftJoin(
        'slots',
        'eventDateSlot',
        'eventDateSlot.id = csEvent.slot_id AND eventDateSlot.deleted_at IS NULL',
      );

    if (!query?.includeFinalized) {
      qb.andWhere('contract.status != :finalized', {
        finalized: CONTRACT_STATUS.FINALIZED,
      });
    }

    if (query?.excludeWithEvents) {
      qb.andWhere('event.id IS NULL');
    }

    const contracts = await qb
      .orderBy(
        "COALESCE(eventDateSlot.event_date, legacySlot.event_date, '9999-12-31')",
        'ASC',
      )
      .getMany();

    const contractsWithEventToken = contracts.map((c) => ({
      ...c,
      eventToken: c.event?.token ?? null,
    }));
    return plainToInstance(ContractDto, contractsWithEventToken, {
      excludeExtraneousValues: true,
    });
  }

  async removeContract(contractId: number): Promise<void> {
    const contract = await this.contractsRepository.findOne({
      where: { id: contractId },
      relations: ['slot'],
    });
    if (!contract) {
      throw new NotFoundException('Contract not found');
    }
    await this.dataSource.transaction(async (manager) => {
      const contractSlots = await manager.getRepository(ContractSlot).find({
        where: { contractId },
      });

      const slotIds = new Set<number>(contractSlots.map((s) => s.slotId));
      if (contract.slot?.id != null) {
        slotIds.add(contract.slot.id);
      }

      await manager.getRepository(ContractSlot).softDelete({ contractId });
      await manager.getRepository(ContractExtra).softDelete({ contractId });
      await manager.getRepository(ContractPackage).softDelete({ contractId });
      await manager.getRepository(ContractPromotion).softDelete({ contractId });
      await manager.getRepository(Payment).softDelete({ contractId });

      const slotIdsArray = Array.from(slotIds);
      if (slotIdsArray.length > 0) {
        await manager.getRepository(Slot).softDelete(slotIdsArray);
      }

      await manager.getRepository(Contract).softDelete(contractId);
    });
  }

  private async resolveExtrasForContract(
    extrasRepo: Repository<Extra>,
    dto: AddExtraDto[] | undefined,
    brandId: number | null,
  ): Promise<Map<number, Extra>> {
    if (!dto?.length) {
      return new Map<number, Extra>();
    }

    if (brandId == null) {
      throw new BadRequestException(
        'brandId is required when contract includes extras',
      );
    }

    const extras = await extrasRepo.findBy({
      id: In(dto.map((extra) => extra.extraId)),
    });
    const extraById = new Map(extras.map((extra) => [extra.id, extra]));

    dto.forEach((extraInfo) => {
      const extra = extraById.get(extraInfo.extraId);
      if (!extra) {
        throw new NotFoundException(EXCEPTION_RESPONSE.EXTRA_NOT_FOUND);
      }
      if (extra.status !== EXTRA_STATUS.ACTIVE) {
        throw new BadRequestException('Extra is inactive');
      }
      if (extra.brandId !== brandId) {
        throw new BadRequestException('Extra is not available for this brand');
      }
    });

    return extraById;
  }
}
