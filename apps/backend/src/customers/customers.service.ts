import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Customer } from '../entities/customer.entity';

@Injectable()
export class CustomersService {
  constructor(
    @InjectRepository(Customer) private readonly repo: Repository<Customer>,
  ) {}

  async findAll() {
    return this.repo.find({ order: { id: 'DESC' } });
  }

  async findOne(id: string) {
    const customer = await this.repo.findOne({ where: { id } });
    if (!customer) throw new NotFoundException('Customer not found');
    return customer;
  }

  async create(dto: Partial<Customer>) {
    let customerCode = dto.customerCode?.trim();
    if (!customerCode) {
      customerCode = 'KH' + Date.now().toString().slice(-6) + Math.floor(Math.random() * 90 + 10);
    } else {
      customerCode = customerCode.toUpperCase();
    }

    if (!dto.name?.trim()) {
      throw new BadRequestException('Tên khách hàng là bắt buộc');
    }

    const existing = await this.repo.findOne({ where: { customerCode } });
    if (existing) throw new BadRequestException('Mã khách hàng đã tồn tại');

    const customer = this.repo.create({
      ...dto,
      customerCode,
      name: dto.name.trim(),
    });
    return this.repo.save(customer);
  }

  async update(id: string, dto: Partial<Customer>) {
    const customer = await this.findOne(id);

    if (dto.customerCode && dto.customerCode !== customer.customerCode) {
      const normalizedCode = dto.customerCode.trim().toUpperCase();
      const existing = await this.repo.findOne({ where: { customerCode: normalizedCode } });
      if (existing && existing.id !== id) throw new BadRequestException('Customer code already exists');
      customer.customerCode = normalizedCode;
    }

    if (dto.name !== undefined) customer.name = (dto.name || '').trim();
    if (dto.phone !== undefined) customer.phone = (dto.phone || '').trim();
    if (dto.email !== undefined) customer.email = (dto.email || '').trim();
    if (dto.address !== undefined) customer.address = (dto.address || '').trim();
    if (dto.type !== undefined) customer.type = dto.type;
    if (dto.status !== undefined) customer.status = dto.status;
    if (dto.contactPerson !== undefined) customer.contactPerson = (dto.contactPerson || '').trim();

    return this.repo.save(customer);
  }

  async remove(id: string) {
    const customer = await this.findOne(id);
    await this.repo.remove(customer);
    return { deleted: true };
  }
}
