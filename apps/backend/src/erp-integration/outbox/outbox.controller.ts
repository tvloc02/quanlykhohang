import { Controller, Get, Param, Post, Query } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OutboxEvent } from './entities/outbox-event.entity';
import { ErpSyncWorker } from '../workers/erp-sync.worker';

/**
 * US 7.4 – API giám sát & retry OutboxEvents (ERP Sync Status)
 */
@Controller('erp/events')
export class OutboxController {
  constructor(
    @InjectRepository(OutboxEvent) private readonly eventRepo: Repository<OutboxEvent>,
    private readonly worker: ErpSyncWorker,
  ) {}

  /** Danh sách OutboxEvents với filter status + pagination */
  @Get()
  async findAll(
    @Query('status') status?: string,
    @Query('eventType') eventType?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const take = Math.min(Number(pageSize) || 20, 100);
    const skip = (Math.max(Number(page) || 1, 1) - 1) * take;

    const qb = this.eventRepo.createQueryBuilder('e').orderBy('e.createdAt', 'DESC');

    if (status) qb.andWhere('e.status = :status', { status });
    if (eventType) qb.andWhere('e.eventType = :eventType', { eventType });

    const [items, total] = await qb.skip(skip).take(take).getManyAndCount();

    return {
      total,
      page: Number(page) || 1,
      pageSize: take,
      items: items.map((e) => ({
        id: e.id,
        eventType: e.eventType,
        status: e.status,
        retryCount: e.retryCount,
        lastError: e.lastError,
        idempotencyKey: e.idempotencyKey,
        createdAt: e.createdAt,
        updatedAt: e.updatedAt,
        payloadSummary: JSON.stringify(e.payload).substring(0, 120),
      })),
      summary: {
        pending: await this.eventRepo.countBy({ status: 'PENDING' }),
        processing: await this.eventRepo.countBy({ status: 'PROCESSING' }),
        sent: await this.eventRepo.countBy({ status: 'SENT' }),
        failed: await this.eventRepo.countBy({ status: 'FAILED' }),
      },
    };
  }

  /** Retry thủ công một OutboxEvent đã FAILED */
  @Post(':id/retry')
  async retry(@Param('id') id: string) {
    return this.worker.retryEvent(id);
  }
}
