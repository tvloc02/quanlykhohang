import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ReturnRequest } from '../entities/return-request.entity';
import { ReturnRequestDetail } from '../entities/return-request-detail.entity';
import { Product } from '../../entities/product.entity';
import { Customer } from '../../entities/customer.entity';

type ItemDto = {
  productId: string;
  warehouseCode?: string;
  expectedQty: number;
  receivedQty?: number;
  unitPrice?: number;
};

type CreateReturnRequestDto = {
  requestNumber?: string;
  customerId?: string;
  requestDate?: string;
  expectedDate?: string;
  status?: string;
  description?: string;
  creatorName?: string;
  creatorPhone?: string;
  warehouseCode?: string;
  approverId?: string;
  items?: ItemDto[];
};

@Injectable()
export class ReturnRequestsService {
  constructor(
    @InjectRepository(ReturnRequest) private readonly requestRepo: Repository<ReturnRequest>,
    @InjectRepository(ReturnRequestDetail) private readonly detailRepo: Repository<ReturnRequestDetail>,
    @InjectRepository(Product) private readonly productRepo: Repository<Product>,
    @InjectRepository(Customer) private readonly customerRepo: Repository<Customer>,
  ) {}

  async findAll() {
    const requests = await this.requestRepo.find({
      relations: ['customer', 'details', 'details.product'],
      order: { id: 'DESC' },
    });
    return requests.map((r) => this.serialize(r));
  }

  async findOne(id: string) {
    const request = await this.requestRepo.findOne({
      where: { id },
      relations: ['customer', 'details', 'details.product'],
    });
    if (!request) throw new NotFoundException('Return request not found');
    return this.serialize(request);
  }

  async create(dto: CreateReturnRequestDto) {
    const requestNumber = dto.requestNumber?.trim() || await this.generateRequestNumber();

    const request = this.requestRepo.create({
      requestNumber,
      requestDate: dto.requestDate ? new Date(dto.requestDate) : new Date(),
      expectedDate: dto.expectedDate ? new Date(dto.expectedDate) : undefined,
      status: dto.status || 'CREATED',
      description: dto.description?.trim(),
      creatorName: dto.creatorName?.trim(),
      creatorPhone: dto.creatorPhone?.trim(),
      warehouseCode: dto.warehouseCode?.trim(),
      approverId: dto.approverId?.trim(),
    });

    if (dto.customerId) {
      const customer = await this.customerRepo.findOne({ where: { id: dto.customerId } });
      if (customer) request.customer = customer;
    }

    const saved = await this.requestRepo.save(request);

    if (dto.items && dto.items.length > 0) {
      const details = await this.buildDetails(saved, dto.items);
      await this.detailRepo.save(details);
      saved.totalAmount = String(details.reduce((sum, d) => sum + Number(d.totalLineAmount), 0));
      await this.requestRepo.save(saved);
    }

    return this.findOne(saved.id);
  }

  async update(id: string, dto: CreateReturnRequestDto) {
    const request = await this.requestRepo.findOne({
      where: { id },
      relations: ['details'],
    });
    if (!request) throw new NotFoundException('Return request not found');

    if (dto.requestNumber) request.requestNumber = dto.requestNumber.trim();
    if (dto.requestDate) request.requestDate = new Date(dto.requestDate);
    if (dto.expectedDate) request.expectedDate = new Date(dto.expectedDate);
    if (dto.status) request.status = dto.status;
    if (dto.description !== undefined) request.description = dto.description?.trim();
    if (dto.creatorName !== undefined) request.creatorName = dto.creatorName?.trim();
    if (dto.creatorPhone !== undefined) request.creatorPhone = dto.creatorPhone?.trim();
    if (dto.warehouseCode !== undefined) request.warehouseCode = dto.warehouseCode?.trim();
    if (dto.approverId !== undefined) request.approverId = dto.approverId?.trim();

    if (dto.customerId) {
      const customer = await this.customerRepo.findOne({ where: { id: dto.customerId } });
      if (customer) request.customer = customer;
    }

    if (dto.items) {
      // Remove old details
      if (request.details?.length > 0) {
        await this.detailRepo.remove(request.details);
      }

      const details = await this.buildDetails(request, dto.items);
      await this.detailRepo.save(details);
      request.totalAmount = String(details.reduce((sum, d) => sum + Number(d.totalLineAmount), 0));
    }

    await this.requestRepo.save(request);
    return this.findOne(id);
  }

  async remove(id: string) {
    const request = await this.requestRepo.findOne({ where: { id }, relations: ['details'] });
    if (!request) throw new NotFoundException('Return request not found');
    await this.requestRepo.remove(request);
    return { deleted: true };
  }

  async approve(id: string) {
    const request = await this.requestRepo.findOne({ where: { id } });
    if (!request) throw new NotFoundException('Return request not found');
    request.status = 'APPROVED';
    await this.requestRepo.save(request);
    return this.findOne(id);
  }

  async complete(id: string) {
    const request = await this.requestRepo.findOne({ where: { id } });
    if (!request) throw new NotFoundException('Return request not found');
    request.status = 'RECEIVED';
    await this.requestRepo.save(request);
    return this.findOne(id);
  }

  async receiveDetail(detailId: string, dto: { items?: Array<{ detailId: string; qty: number }> }) {
    if (dto.items && dto.items.length > 0) {
      for (const item of dto.items) {
        const detail = await this.detailRepo.findOne({ where: { id: item.detailId } });
        if (detail) {
          detail.receivedQty = (detail.receivedQty || 0) + item.qty;
          await this.detailRepo.save(detail);
        }
      }
      return { success: true };
    }

    const detail = await this.detailRepo.findOne({ where: { id: detailId } });
    if (!detail) throw new NotFoundException('Detail not found');
    detail.receivedQty = detail.expectedQty;
    await this.detailRepo.save(detail);
    return { success: true };
  }

  private async buildDetails(request: ReturnRequest, items: ItemDto[]) {
    const details: ReturnRequestDetail[] = [];
    for (const item of items) {
      const product = await this.productRepo.findOne({ where: { id: item.productId } });
      const unitPrice = Number(item.unitPrice || 0);
      const expectedQty = Number(item.expectedQty || 0);
      const detail = this.detailRepo.create({
        returnRequest: request,
        product: product || undefined,
        warehouseCode: item.warehouseCode?.trim(),
        expectedQty,
        receivedQty: Number(item.receivedQty || 0),
        unitPrice: String(unitPrice),
        totalLineAmount: String(unitPrice * expectedQty),
      });
      details.push(detail);
    }
    return details;
  }

  private async generateRequestNumber() {
    const count = await this.requestRepo.count();
    const index = count + 1;
    return `RTN${String(index).padStart(4, '0')}`;
  }

  private serialize(request: ReturnRequest) {
    return {
      id: request.id,
      requestNumber: request.requestNumber,
      receiptNo: request.requestNumber,
      requestDate: request.requestDate?.toISOString(),
      expectedDate: request.expectedDate?.toISOString(),
      status: request.status,
      description: request.description,
      totalAmount: Number(request.totalAmount || 0),
      creatorName: request.creatorName,
      creatorPhone: request.creatorPhone,
      warehouseCode: request.warehouseCode,
      approverId: request.approverId,
      customer: request.customer
        ? {
            id: request.customer.id,
            customerCode: request.customer.customerCode,
            name: request.customer.name,
          }
        : null,
      details: (request.details || []).map((d) => ({
        id: d.id,
        warehouseCode: d.warehouseCode,
        expectedQty: d.expectedQty,
        receivedQty: d.receivedQty,
        unitPrice: Number(d.unitPrice || 0),
        totalLineAmount: Number(d.totalLineAmount || 0),
        product: d.product
          ? {
              id: d.product.id,
              internalSku: d.product.internalSku,
              name: d.product.name,
              unit: d.product.unit,
            }
          : null,
      })),
      items: (request.details || []).length,
    };
  }
}
