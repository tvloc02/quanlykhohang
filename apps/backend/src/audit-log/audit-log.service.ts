import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, FindOptionsWhere } from 'typeorm';
import { AuditLog } from './entities/audit-log.entity';
import { computeAuditHash, verifyHashChain, AuditHashInput } from './utils/hash-chain.util';

export type AppendAuditLogInput = {
  // WHO
  actorId?: string;
  actorEmail?: string;
  actorRole?: string;
  // WHAT & WHERE
  action: string;
  resource: string;
  resourceId?: string;
  // HOW
  ipAddress?: string;
  userAgent?: string;
  httpMethod?: string;
  traceId?: string;
  // DIFF
  oldState?: Record<string, unknown>;
  newState?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  // STATUS
  statusCode?: number;
  latencyMs?: number;
};

@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);

  constructor(@InjectRepository(AuditLog) private readonly repo: Repository<AuditLog>) {}

  /**
   * Ghi một bản ghi Audit Log mới kèm Hash Chaining.
   * Fire-and-forget: Không block luồng nghiệp vụ chính.
   */
  async append(input: AppendAuditLogInput): Promise<AuditLog> {
    // ─── Hash Chaining: Query previous hash ──────────
    let previousHash = '0'; // Genesis
    try {
      const lastRecord = await this.repo.findOne({
        where: {},
        order: { id: 'DESC' },
        select: ['hashChecksum'],
      });
      if (lastRecord?.hashChecksum) {
        previousHash = lastRecord.hashChecksum;
      }
    } catch {
      // Nếu query lỗi, vẫn tiếp tục ghi log với genesis hash
    }

    const now = new Date();
    const hashInput: AuditHashInput = {
      action: input.action,
      resource: input.resource,
      resourceId: input.resourceId,
      actorId: input.actorId,
      actorEmail: input.actorEmail,
      ipAddress: input.ipAddress,
      statusCode: input.statusCode,
      createdAt: now.toISOString(),
      metadata: input.metadata,
    };

    const hashChecksum = computeAuditHash(hashInput, previousHash);

    const log = this.repo.create({
      ...input,
      hashChecksum,
      createdAt: now,
    });

    return this.repo.save(log);
  }

  /**
   * Tìm bản ghi theo resource cụ thể.
   */
  findByResource(resource: string, resourceId?: string) {
    return this.repo.find({
      where: resourceId ? { resource, resourceId } : { resource },
      order: { createdAt: 'ASC' },
      take: 200,
    });
  }

  /**
   * Tìm bản ghi gần đây nhất.
   */
  findRecent(limit = 100) {
    return this.repo.find({
      order: { createdAt: 'DESC' },
      take: Math.min(Math.max(limit, 1), 500),
    });
  }

  /**
   * Lọc đa chiều Audit Log: theo actor, resource, action, khoảng thời gian.
   */
  async findFiltered(filters: {
    actorId?: string;
    resource?: string;
    action?: string;
    from?: string; // ISO 8601
    to?: string;   // ISO 8601
    limit?: number;
  }) {
    const where: FindOptionsWhere<AuditLog> = {};

    if (filters.actorId) where.actorId = filters.actorId;
    if (filters.resource) where.resource = filters.resource;
    if (filters.action) where.action = filters.action;
    if (filters.from && filters.to) {
      where.createdAt = Between(new Date(filters.from), new Date(filters.to));
    }

    const limit = Math.min(Math.max(filters.limit || 100, 1), 500);

    return this.repo.find({
      where,
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  /**
   * Kiểm tra tính toàn vẹn của chuỗi Hash Chain.
   * Dùng cho admin/kiểm toán viên xác minh dữ liệu chưa bị can thiệp.
   */
  async verifyIntegrity(limit = 1000): Promise<{
    valid: boolean;
    totalChecked: number;
    brokenAtIndex?: number;
    brokenRecord?: unknown;
  }> {
    const records = await this.repo.find({
      order: { id: 'ASC' },
      take: limit,
    });

    const hashRecords = records.map(r => ({
      action: r.action,
      resource: r.resource,
      resourceId: r.resourceId,
      actorId: r.actorId,
      actorEmail: r.actorEmail,
      ipAddress: r.ipAddress,
      statusCode: r.statusCode,
      createdAt: r.createdAt.toISOString(),
      metadata: r.metadata,
      hashChecksum: r.hashChecksum || null,
    }));

    return verifyHashChain(hashRecords);
  }
}
