import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateBrandDto } from './dto/create-brand.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Brand } from './entities/brand.entity';
import { Repository } from 'typeorm';
import { UpdateBrandDto } from './dto/update-brand.dto';
import { Logger } from '@nestjs/common';
import { EXCEPTION_RESPONSE } from 'src/config/errors/exception-response.config';
import { BrandDto } from './dto/brand.dto';
import { plainToInstance } from 'class-transformer';

@Injectable()
export class BrandsService {
  private readonly logger = new Logger(BrandsService.name);
  constructor(
    @InjectRepository(Brand)
    private brandsRepository: Repository<Brand>,
  ) {}

  async create(createBrandDto: CreateBrandDto): Promise<BrandDto> {
    try {
      this.logger.log({ name: createBrandDto.name }, 'Creating brand');
      const brand = this.brandsRepository.create(createBrandDto);
      const savedBrand = await this.brandsRepository.save(brand);
      return plainToInstance(BrandDto, savedBrand, {
        excludeExtraneousValues: true,
      });
    } catch (error) {
      this.logger.error(error, 'Error creating brand');
      throw new BadRequestException(EXCEPTION_RESPONSE.BRAND_NOT_FOUND);
    }
  }

  async findAll(): Promise<BrandDto[]> {
    const brands = await this.brandsRepository.find();
    return plainToInstance(BrandDto, brands, {
      excludeExtraneousValues: true,
    });
  }

  async findOne(id: number): Promise<BrandDto> {
    const brand = await this.brandsRepository.findOne({ where: { id } });
    if (!brand) {
      throw new NotFoundException(EXCEPTION_RESPONSE.BRAND_NOT_FOUND);
    }
    return plainToInstance(BrandDto, brand, { excludeExtraneousValues: true });
  }

  update(id: number, updateBrandDto: UpdateBrandDto) {
    try {
      this.logger.log({ id, updateBrandDto }, 'Updating brand');
      return this.brandsRepository.update(id, updateBrandDto);
    } catch (error) {
      this.logger.error(error, 'Error updating brand');
      throw error;
    }
  }

  remove(id: number) {
    try {
      this.logger.log({ id }, 'Removing brand');
      return this.brandsRepository.softDelete(id);
    } catch (error) {
      this.logger.error(error, 'Error removing brand');
      throw error;
    }
  }
}
