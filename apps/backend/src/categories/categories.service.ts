import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Category } from '../entities/category.entity';
import { CreateCategoryDto } from './dto/create-category.dto';

@Injectable()
export class CategoriesService {
  constructor(@InjectRepository(Category) private repo: Repository<Category>) {}

  create(dto: CreateCategoryDto) {
    const c = this.repo.create(this.normalizeCategory(dto));
    return this.repo.save(c);
  }

  findAll() {
    return this.repo.find({ order: { type: 'ASC', createdAt: 'DESC' } });
  }

  async findOne(id: string) {
    const c = await this.repo.findOneBy({ id });
    if (!c) throw new NotFoundException('Category not found');
    return c;
  }

  async syncAll(dtos: CreateCategoryDto[]) {
    const existing = await this.repo.find();
    const existingById = new Map(existing.map((category) => [String(category.id), category]));
    const existingByKey = new Map(existing.map((category) => [this.getCategoryKey(category.type, category.code), category]));
    const keptIds = new Set<string>();

    for (const dto of dtos || []) {
      const normalized = this.normalizeCategory(dto);
      if (!normalized.name) continue;

      const candidateKey = this.getCategoryKey(normalized.type, normalized.code);
      const byId = normalized.id ? existingById.get(String(normalized.id)) : undefined;
      const byKey = existingByKey.get(candidateKey);
      const entity = byId || byKey || this.repo.create();

      entity.type = normalized.type;
      entity.name = normalized.name;
      entity.code = normalized.code;
      entity.description = normalized.description;
      entity.status = normalized.status;

      const saved = await this.repo.save(entity);
      keptIds.add(String(saved.id));
      existingById.set(String(saved.id), saved);
      existingByKey.set(this.getCategoryKey(saved.type, saved.code), saved);
    }

    await Promise.all(
      existing
        .filter((category) => !keptIds.has(String(category.id)))
        .map((category) => this.repo.delete(category.id)),
    );

    return this.findAll();
  }

  async remove(id: string) {
    await this.repo.delete(id);
    return { deleted: true };
  }

  private normalizeCategory(dto: CreateCategoryDto & { id?: string }) {
    const name = dto.name.trim();
    const code = (dto.code?.trim() || name.toUpperCase().replace(/\s+/g, '-')).toUpperCase();
    return {
      id: dto.id,
      type: dto.type || 'item-group',
      name,
      code,
      description: dto.description?.trim() || '',
      status: dto.status || 'active',
    } as const;
  }

  private getCategoryKey(type: string, code: string) {
    return `${type}:${code}`.toLowerCase();
  }
}
