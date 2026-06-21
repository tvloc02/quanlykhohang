import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from './entities/audit-log.entity';

type AppendAuditLogInput = {
  actorId?: string;
  actorEmail?: string;
  action: string;
  resource: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
};

@Injectable()
export class AuditLogService {
  constructor(@InjectRepository(AuditLog) private readonly repo: Repository<AuditLog>) {}

  append(input: AppendAuditLogInput) {
    const log = this.repo.create(input);
    return this.repo.save(log);
  }

  findByResource(resource: string, resourceId?: string) {
    return this.repo.find({
      where: resourceId ? { resource, resourceId } : { resource },
      order: { createdAt: 'ASC' },
      take: 200,
    });
  }

  findRecent(limit = 100) {
    return this.repo.find({
      order: { createdAt: 'DESC' },
      take: Math.min(Math.max(limit, 1), 500),
    });
  }
}
