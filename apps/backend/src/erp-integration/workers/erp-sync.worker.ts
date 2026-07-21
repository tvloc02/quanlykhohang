import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OutboxEvent } from '../outbox/entities/outbox-event.entity';

/**
 * US 7.3 – ERP Outbox Worker
 * Cron job chạy mỗi 30 giây, lấy các OutboxEvent PENDING và dispatch đến mock ERP.
 * Tối đa 3 lần retry; sau đó đánh dấu FAILED.
 */
@Injectable()
export class ErpSyncWorker {
  private readonly logger = new Logger(ErpSyncWorker.name);
  private readonly MAX_RETRY = 3;
  /** Mock ERP endpoint – có thể thay bằng biến môi trường thực tế */
  private readonly ERP_ENDPOINT = process.env.ERP_WEBHOOK_URL || 'https://mock-erp.example.com/webhook';

  constructor(
    @InjectRepository(OutboxEvent) private readonly eventRepo: Repository<OutboxEvent>,
  ) {}

  @Cron('*/30 * * * * *', { name: 'erp_sync_worker' })
  async dispatchPendingEvents() {
    const pending = await this.eventRepo.find({
      where: { status: 'PENDING' },
      order: { createdAt: 'ASC' },
      take: 20,
    });

    if (pending.length === 0) return;

    this.logger.log(`[ERP Worker] Dispatching ${pending.length} pending event(s)...`);

    for (const event of pending) {
      // Mark PROCESSING to prevent double-dispatch
      event.status = 'PROCESSING';
      await this.eventRepo.save(event);

      try {
        await this.sendToErp(event);
        event.status = 'SENT';
        event.lastError = undefined;
        this.logger.log(`[ERP Worker] Event #${event.id} (${event.eventType}) → SENT`);
      } catch (err: any) {
        event.retryCount = (event.retryCount || 0) + 1;
        event.lastError = err?.message || String(err);

        if (event.retryCount >= this.MAX_RETRY) {
          event.status = 'FAILED';
          this.logger.error(`[ERP Worker] Event #${event.id} FAILED after ${this.MAX_RETRY} retries: ${event.lastError}`);
        } else {
          event.status = 'PENDING';
          this.logger.warn(`[ERP Worker] Event #${event.id} retry ${event.retryCount}/${this.MAX_RETRY}: ${event.lastError}`);
        }
      }

      await this.eventRepo.save(event);
    }
  }

  private async sendToErp(event: OutboxEvent): Promise<void> {
    // In production replace with real HTTP call to ERP system.
    // For demo we simulate 80% success rate, 20% transient failure.
    const roll = Math.random();
    if (roll < 0.2) {
      throw new Error('Simulated transient ERP timeout');
    }

    this.logger.debug(
      `[ERP Worker] Mock POST → ${this.ERP_ENDPOINT} | type=${event.eventType} | key=${event.idempotencyKey || 'n/a'}`,
    );
    // Simulate 50ms network delay
    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  /** Retry thủ công một event đã FAILED */
  async retryEvent(id: string) {
    const event = await this.eventRepo.findOneBy({ id });
    if (!event) throw new Error(`Event ${id} not found`);
    event.status = 'PENDING';
    event.retryCount = 0;
    event.lastError = undefined;
    return this.eventRepo.save(event);
  }
}
