import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  ParseIntPipe,
  Query,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiOkResponse,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';

import { AuthUser } from '../auth/decorators/auth-user.decorator';
import { DecodedTokenDto } from '../tokens/dto/decode-token.dto';
import { ContractsService } from './contracts.service';
import { AddItemDto } from './dto/add-item.dto';
import { ContractDetailDto } from './dto/contract-detail.dto';
import { CreateContractFromSlotsDto } from './dto/create-contract-from-slots.dto';
import { UpdateItemDto } from './dto/update-item.dto';
import { UpdateTransportDto } from './dto/update-transport.dto';
import { ContractDto } from './dto/contract.dto';
import { ListContractsQueryDto } from './dto/list-contracts-query.dto';
import { Public } from '../auth/decorators/public.decorator';
import { CreatePaymentDto } from '../payments/dto/create-payment.dto';
import { PaymentDto } from '../payments/dto/payment.dto';
import { PaymentResponseDto } from '../payments/dto/payment-response.dto';
import { AddContractSlotDto } from './dto/add-contract-slot.dto';
import { PatchPrepProfileAnswerDto } from './preparation-profile/dto/patch-prep-profile-answer.dto';
import { PatchPrepProfileAnswersBulkDto } from './preparation-profile/dto/patch-prep-profile-answers-bulk.dto';
import { PrepProfileDto } from './preparation-profile/dto/prep-profile.dto';
import { PrepProfilePublicQueryDto } from './preparation-profile/dto/prep-profile-public.query.dto';
import { UnlockPrepProfileQuestionDto } from './preparation-profile/dto/unlock-prep-profile-question.dto';
import { ContractsPreparationProfileService } from './preparation-profile/contracts-preparation-profile.service';
import { CreatePrepProfileUploadUrlDto } from './preparation-profile/dto/create-prep-profile-upload-url.dto';
import { PrepProfileUploadUrlDto } from './preparation-profile/dto/prep-profile-upload-url.dto';
import { PrepProfileUploadsService } from './preparation-profile/prep-profile-uploads.service';

@Controller('contracts')
@ApiTags('contracts')
@ApiBearerAuth('access-token')
export class ContractsController {
  constructor(
    private readonly contractsService: ContractsService,
    private readonly contractsPreparationProfileService: ContractsPreparationProfileService,
    private readonly prepProfileUploadsService: PrepProfileUploadsService,
  ) { }

  @Post()
  @ApiBody({ type: CreateContractFromSlotsDto })
  @ApiOkResponse({ type: ContractDetailDto })
  async create(
    @Body(new ValidationPipe({ transform: true, whitelist: true }))
    dto: CreateContractFromSlotsDto,
  ): Promise<ContractDto> {
    return await this.contractsService.createContract(dto);
  }

  @Get()
  @ApiOkResponse({ type: ContractDto, isArray: true })
  @ApiQuery({ name: 'includeFinalized', type: Boolean, required: false })
  async list(
    @Query(new ValidationPipe({ transform: true, whitelist: true }))
    query: ListContractsQueryDto,
  ): Promise<ContractDto[]> {
    return await this.contractsService.list(query);
  }

  @Get(':id')
  @ApiParam({ name: 'id', type: Number })
  @ApiOkResponse({ type: ContractDetailDto })
  async get(@Param('id') id: string): Promise<ContractDetailDto> {
    return await this.contractsService.getDetail(Number(id));
  }

  @Get('/get-by-token/:token')
  @ApiParam({ name: 'token', type: String })
  @ApiOkResponse({ type: ContractDetailDto })
  @Public()
  async getDetailByToken(
    @Param('token') token: string,
  ): Promise<ContractDetailDto> {
    return await this.contractsService.getDetailByToken(token);
  }

  @Get('/public/:token/prep-profile')
  @ApiParam({ name: 'token', type: String })
  @ApiQuery({ name: 'phone', type: String, required: true })
  @ApiOkResponse({ type: PrepProfileDto })
  @Public()
  async getPreparationProfileByToken(
    @Param('token') token: string,
    @Query(new ValidationPipe({ transform: true, whitelist: true }))
    query: PrepProfilePublicQueryDto,
  ): Promise<PrepProfileDto> {
    return await this.contractsPreparationProfileService.getByToken({
      token,
      phone: query.phone,
      assets: query.assets,
      expiresIn: query.expiresIn,
    });
  }

  @Patch('/public/:token/prep-profile/answer')
  @ApiParam({ name: 'token', type: String })
  @ApiQuery({ name: 'phone', type: String, required: true })
  @ApiBody({ type: PatchPrepProfileAnswerDto })
  @ApiOkResponse({ type: PrepProfileDto })
  @Public()
  async savePreparationProfileAnswer(
    @Param('token') token: string,
    @Query(new ValidationPipe({ transform: true, whitelist: true }))
    query: PrepProfilePublicQueryDto,
    @Body(new ValidationPipe({ transform: true, whitelist: true }))
    dto: PatchPrepProfileAnswerDto,
  ): Promise<PrepProfileDto> {
    return await this.contractsPreparationProfileService.saveAnswerByPhone({
      token,
      phone: query.phone,
      questionId: dto.questionId,
      value: dto.value,
      assets: query.assets,
      expiresIn: query.expiresIn,
    });
  }

  @Patch('/public/:token/prep-profile/answers')
  @ApiParam({ name: 'token', type: String })
  @ApiQuery({ name: 'phone', type: String, required: true })
  @ApiBody({ type: PatchPrepProfileAnswersBulkDto })
  @ApiOkResponse({ type: PrepProfileDto })
  @Public()
  async savePreparationProfileAnswersBulk(
    @Param('token') token: string,
    @Query(new ValidationPipe({ transform: true, whitelist: true }))
    query: PrepProfilePublicQueryDto,
    @Body(new ValidationPipe({ transform: true, whitelist: true }))
    dto: PatchPrepProfileAnswersBulkDto,
  ): Promise<PrepProfileDto> {
    return await this.contractsPreparationProfileService.saveAnswersBulkByToken({
      token,
      phone: query.phone,
      answers: dto.answers,
      assets: query.assets,
      expiresIn: query.expiresIn,
    });
  }

  @Post('/public/:token/prep-profile/upload-url')
  @ApiParam({ name: 'token', type: String })
  @ApiQuery({ name: 'phone', type: String, required: true })
  @ApiBody({ type: CreatePrepProfileUploadUrlDto })
  @ApiOkResponse({ type: PrepProfileUploadUrlDto })
  @Public()
  async createPrepProfileUploadUrl(
    @Param('token') token: string,
    @Query(new ValidationPipe({ transform: true, whitelist: true }))
    query: PrepProfilePublicQueryDto,
    @Body(new ValidationPipe({ transform: true, whitelist: true }))
    dto: CreatePrepProfileUploadUrlDto,
  ): Promise<PrepProfileUploadUrlDto> {
    return await this.prepProfileUploadsService.createSignedUploadUrl({
      token,
      phone: query.phone,
      questionId: dto.questionId,
      fileName: dto.fileName,
      mime: dto.mime,
    });
  }

  @Post(':id/prep-profile/unlock')
  @ApiParam({ name: 'id', type: Number })
  @ApiBody({ type: UnlockPrepProfileQuestionDto })
  @ApiOkResponse({ type: PrepProfileDto })
  async unlockPreparationProfileQuestion(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ValidationPipe({ transform: true, whitelist: true }))
    dto: UnlockPrepProfileQuestionDto,
  ): Promise<PrepProfileDto> {
    return await this.contractsPreparationProfileService.unlockQuestion({
      contractId: id,
      questionId: dto.questionId,
      reason: dto.reason,
    });
  }

  @Post(':id/items')
  @ApiBody({ type: AddItemDto })
  @ApiOkResponse({ type: ContractDetailDto })
  addItem(
    @Param('id') id: string,
    @Body(new ValidationPipe({ transform: true, whitelist: true }))
    dto: AddItemDto,
  ): void {
    this.contractsService.addItem(Number(id), dto);
  }

  @Patch(':id/items/:itemId')
  @ApiBody({ type: UpdateItemDto })
  @ApiOkResponse({ type: ContractDetailDto })
  async updateItem(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body(new ValidationPipe({ transform: true, whitelist: true }))
    dto: UpdateItemDto,
    @AuthUser() user: DecodedTokenDto,
  ): Promise<ContractDetailDto> {
    return await this.contractsService.updateItemQuantity(
      Number(id),
      Number(itemId),
      dto,
      user.id,
    );
  }

  @Delete(':id/items/:itemId')
  @ApiOkResponse({ type: ContractDetailDto })
  async removeItem(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @AuthUser() user: DecodedTokenDto,
  ): Promise<ContractDetailDto> {
    return await this.contractsService.removeItem(
      Number(id),
      Number(itemId),
      user.id,
    );
  }

  @Post(':id/payments')
  @ApiBody({ type: CreatePaymentDto })
  @ApiOkResponse({ type: PaymentResponseDto })
  async createPayment(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ValidationPipe({ transform: true, whitelist: true }))
    dto: CreatePaymentDto,
  ): Promise<PaymentDto> {
    return await this.contractsService.createPayment(id, dto);
  }

  @Get(':id/payments')
  @ApiOkResponse({ type: PaymentResponseDto, isArray: true })
  async listPayments(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<PaymentDto[]> {
    return await this.contractsService.listPayments(id);
  }

  @Patch(':id/transport')
  @ApiParam({ name: 'id', type: Number })
  @ApiBody({ type: UpdateTransportDto })
  @ApiOkResponse({ type: ContractDetailDto })
  async updateTransport(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ValidationPipe({ transform: true, whitelist: true }))
    dto: UpdateTransportDto,
  ): Promise<ContractDetailDto> {
    return await this.contractsService.updateTransport(id, dto);
  }

  @Post(':id/cancel')
  @ApiOkResponse({ type: ContractDetailDto })
  async cancel(@Param('id') id: string): Promise<ContractDetailDto> {
    return await this.contractsService.cancel(Number(id));
  }

  @Post(':id/reopen')
  @ApiOkResponse({ type: ContractDetailDto })
  async reopen(
    @Param('id') id: string,
    @AuthUser() user: DecodedTokenDto,
  ): Promise<ContractDetailDto> {
    return await this.contractsService.reopen(Number(id), user.id);
  }

  @Post(':id/finalize')
  @ApiOkResponse({ type: ContractDetailDto })
  async finalize(
    @Param('id') id: string,
    @AuthUser() user: DecodedTokenDto,
  ): Promise<ContractDetailDto> {
    return await this.contractsService.finalize(Number(id), user.id);
  }

  @Post(':id/slots')
  @ApiBody({ type: AddContractSlotDto })
  @ApiOkResponse({ type: ContractDetailDto })
  async createContractSlot(
    @Param('id') id: string,
    @Body(new ValidationPipe({ transform: true, whitelist: true }))
    dto: AddContractSlotDto,
  ): Promise<ContractDetailDto> {
    return await this.contractsService.addContractSlot(Number(id), dto);
  }

  @Delete(':id')
  @ApiParam({ name: 'id', type: Number })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete a contract (soft delete) and free reserved slots',
    description:
      'Soft-deletes the contract and related snapshots/links, soft-deletes associated reserved slots to free availability, and soft-deletes payments to keep historical records (not returned by default queries).',
  })
  @ApiNoContentResponse({ description: 'Contract deleted (soft delete)' })
  @ApiNotFoundResponse({ description: 'Contract not found' })
  removeContract(@Param('id') id: string): Promise<void> {
    return this.contractsService.removeContract(Number(id));
  }

}
