import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { plainToInstance } from 'class-transformer';
import { EntityManager, FindOptionsWhere, In, Repository } from 'typeorm';

import { EXCEPTION_RESPONSE } from '../config/errors/exception-response.config';
import { Product } from '../products/entities/product.entity';
import { CreateExtraDto } from './dto/create-extra.dto';
import { ExtraProductInputDto } from './dto/extra-product-input.dto';
import { ExtraResponseDto } from './dto/extra-response.dto';
import { FindExtrasQueryDto } from './dto/find-extras-query.dto';
import { UpdateExtraDto } from './dto/update-extra.dto';
import { Extra } from './entities/extra.entity';
import { ExtraProduct } from './entities/extra-product.entity';
import { EXTRA_STATUS } from './types/extras-status.types';

@Injectable()
export class ExtrasService {
  private readonly logger = new Logger(ExtrasService.name);

  constructor(
    @InjectRepository(Extra)
    private readonly extrasRepository: Repository<Extra>,
  ) {}

  async create(createExtraDto: CreateExtraDto) {
    try {
      this.logger.log({ createExtraDto }, 'Creating extra');
      const { products, ...extraFields } = createExtraDto;
      return await this.extrasRepository.manager.transaction(
        async (manager) => {
          const extraToSave = manager.create(Extra, {
            ...extraFields,
            description: extraFields.description ?? null,
            price: extraFields.price ?? null,
            status: extraFields.status ?? EXTRA_STATUS.ACTIVE,
          });
          const savedExtra = await manager.save(extraToSave);
          if (products) {
            await this.replaceProducts(
              manager,
              savedExtra.id,
              savedExtra.brandId,
              products,
            );
          }
          return savedExtra;
        },
      );
    } catch (error) {
      this.logger.error(error, 'Error creating extra');
      throw error;
    }
  }

  async findAll(): Promise<ExtraResponseDto[]> {
    try {
      const extras = await this.extrasRepository.find({
        relations: ['brand', 'extraProducts', 'extraProducts.product'],
      });
      return plainToInstance(ExtraResponseDto, extras, {
        excludeExtraneousValues: true,
      });
    } catch (error) {
      this.logger.error(error, 'Error finding all extras');
      throw new BadRequestException(EXCEPTION_RESPONSE.EXTRA_NOT_FOUND);
    }
  }

  async findWithFilters(
    filters: FindExtrasQueryDto,
  ): Promise<ExtraResponseDto[]> {
    try {
      const where: FindOptionsWhere<Extra> = {
        status: EXTRA_STATUS.ACTIVE,
      };
      if (filters.brandId) {
        where.brandId = Number(filters.brandId);
      }

      const extras = await this.extrasRepository.find({
        where,
        relations: ['brand', 'extraProducts', 'extraProducts.product'],
      });
      return plainToInstance(ExtraResponseDto, extras, {
        excludeExtraneousValues: true,
      });
    } catch (error) {
      this.logger.error(error, 'Error finding extras with filters');
      throw new BadRequestException(EXCEPTION_RESPONSE.EXTRA_NOT_FOUND);
    }
  }

  async findOne(id: number): Promise<ExtraResponseDto> {
    try {
      const foundExtra = await this.extrasRepository.findOne({
        where: { id },
        relations: ['brand', 'extraProducts', 'extraProducts.product'],
      });
      if (!foundExtra) {
        throw new NotFoundException(EXCEPTION_RESPONSE.EXTRA_NOT_FOUND);
      }

      return plainToInstance(ExtraResponseDto, foundExtra, {
        excludeExtraneousValues: true,
      });
    } catch (error) {
      this.logger.error(error, 'Error finding extra');
      throw error;
    }
  }

  async update(id: number, updateExtraDto: UpdateExtraDto) {
    try {
      const existing = await this.assertExists(id);
      const { products, ...extraFields } = updateExtraDto;
      await this.extrasRepository.manager.transaction(async (manager) => {
        if (Object.keys(extraFields).length > 0) {
          await manager.update(Extra, id, extraFields);
        }
        if (products) {
          await this.replaceProducts(
            manager,
            id,
            extraFields.brandId ?? existing.brandId,
            products,
          );
        }
      });
      return this.findOne(id);
    } catch (error) {
      this.logger.error(error, 'Error updating extra');
      throw error;
    }
  }

  async remove(id: number) {
    try {
      await this.assertExists(id);
      return this.extrasRepository.softDelete(id);
    } catch (error) {
      this.logger.error(error, 'Error removing extra');
      throw error;
    }
  }

  findExtrasStatus() {
    return Object.values(EXTRA_STATUS);
  }

  private async replaceProducts(
    manager: EntityManager,
    extraId: number,
    brandId: number,
    products: ExtraProductInputDto[],
  ): Promise<void> {
    const productIds = Array.from(new Set(products.map((p) => p.productId)));
    if (productIds.length > 0) {
      const found = await manager.count(Product, {
        where: { id: In(productIds), brandId },
      });
      if (found !== productIds.length) {
        throw new BadRequestException(EXCEPTION_RESPONSE.EXTRA_PRODUCT_INVALID);
      }
    }

    await manager.delete(ExtraProduct, { extraId });
    if (products.length === 0) {
      return;
    }
    await manager.save(
      products.map((product) =>
        manager.create(ExtraProduct, {
          extraId,
          productId: product.productId,
          quantity: product.quantity ?? 1,
          action: product.action,
        }),
      ),
    );
  }

  private async assertExists(id: number): Promise<Extra> {
    const foundExtra = await this.extrasRepository.findOne({
      where: { id },
    });

    if (!foundExtra) {
      throw new NotFoundException(EXCEPTION_RESPONSE.EXTRA_NOT_FOUND);
    }
    return foundExtra;
  }
}
