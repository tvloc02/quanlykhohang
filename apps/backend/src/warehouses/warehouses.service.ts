import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Warehouse } from '../entities/warehouse.entity';
import { CreateWarehouseDto } from './dto/create-warehouse.dto';
import { UpdateWarehouseDto } from './dto/update-warehouse.dto';
import { AuditLogService } from '../audit-log/audit-log.service';

@Injectable()
export class WarehousesService {
  constructor(
    @InjectRepository(Warehouse) private repo: Repository<Warehouse>,
    private readonly auditLogService: AuditLogService,
  ) {}

  async findAll(): Promise<Warehouse[]> {
    return this.repo.find({
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<Warehouse> {
    const warehouse = await this.repo.findOne({ where: { id } });
    if (!warehouse) {
      throw new NotFoundException(`Warehouse with ID ${id} not found`);
    }
    return warehouse;
  }

  async findByCode(code: string): Promise<Warehouse | null> {
    return this.repo.findOne({ where: { code } });
  }

  async create(
    createWarehouseDto: CreateWarehouseDto,
    actor?: { id?: string; email?: string },
  ): Promise<Warehouse> {
    const normalizedCode = createWarehouseDto.code.trim().toUpperCase();
    const existingCode = await this.findByCode(normalizedCode);
    if (existingCode) {
      throw new BadRequestException('Warehouse code already exists');
    }

    const warehouse = this.repo.create({
      id: createWarehouseDto.id?.trim() || this.generateId(),
      code: normalizedCode,
      name: createWarehouseDto.name.trim(),
      address: createWarehouseDto.address?.trim() || '',
      status: createWarehouseDto.status || 'active',
      managerIds: createWarehouseDto.managerIds || [],
      staffIds: createWarehouseDto.staffIds || [],
    });

    const saved = await this.repo.save(warehouse);

    await this.auditLogService.append({
      actorId: actor?.id,
      actorEmail: actor?.email,
      action: 'WAREHOUSE_CREATED',
      resource: 'warehouses',
      resourceId: saved.id,
      metadata: { code: saved.code, name: saved.name },
    });

    return saved;
  }

  async update(
    id: string,
    updateWarehouseDto: UpdateWarehouseDto,
    actor?: { id?: string; email?: string },
  ): Promise<Warehouse> {
    const warehouse = await this.findOne(id);

    if (updateWarehouseDto.code && updateWarehouseDto.code !== warehouse.code) {
      const normalizedCode = updateWarehouseDto.code.trim().toUpperCase();
      const existingCode = await this.findByCode(normalizedCode);
      if (existingCode) {
        throw new BadRequestException('Warehouse code already exists');
      }
      warehouse.code = normalizedCode;
    }

    if (updateWarehouseDto.name !== undefined) {
      warehouse.name = updateWarehouseDto.name.trim();
    }

    if (updateWarehouseDto.address !== undefined) {
      warehouse.address = updateWarehouseDto.address.trim();
    }

    if (updateWarehouseDto.status !== undefined) {
      warehouse.status = updateWarehouseDto.status;
    }

    if (updateWarehouseDto.managerIds !== undefined) {
      warehouse.managerIds = updateWarehouseDto.managerIds || [];
    }

    if (updateWarehouseDto.staffIds !== undefined) {
      warehouse.staffIds = updateWarehouseDto.staffIds || [];
    }

    const updated = await this.repo.save(warehouse);

    await this.auditLogService.append({
      actorId: actor?.id,
      actorEmail: actor?.email,
      action: 'WAREHOUSE_UPDATED',
      resource: 'warehouses',
      resourceId: id,
      metadata: { code: updated.code, name: updated.name },
    });

    return updated;
  }

  async remove(id: string, actor?: { id?: string; email?: string }): Promise<void> {
    const warehouse = await this.findOne(id);
    await this.repo.remove(warehouse);

    await this.auditLogService.append({
      actorId: actor?.id,
      actorEmail: actor?.email,
      action: 'WAREHOUSE_DELETED',
      resource: 'warehouses',
      resourceId: id,
      metadata: { code: warehouse.code, name: warehouse.name },
    });
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
