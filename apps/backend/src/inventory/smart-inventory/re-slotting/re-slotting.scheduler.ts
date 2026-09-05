import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ReSlottingProducer } from './re-slotting.producer';
import { ReSlottingProcessor } from './re-slotting.processor';

/**
 * ReSlotting Scheduler – Lên lịch chạy Re-slotting tự động
 *
 * - Cron: 2:00 AM hàng đêm (giờ thấp điểm)
 * - Tự động enqueue re-slotting cho tất cả warehouses active
 * - Xử lý job ngay sau khi enqueue
 */
@Injectable()
export class ReSlottingScheduler {
  private readonly logger = new Logger(ReSlottingScheduler.name);

  constructor(
    private readonly producer: ReSlottingProducer,
    private readonly processor: ReSlottingProcessor,
  ) {}

  /**
   * Cron job chạy lúc 2:00 AM hàng đêm.
   * Trong thực tế, sẽ query danh sách warehouses active từ DB.
   */
  @Cron('0 2 * * *', { name: 'dynamic-reslotting-nightly' })
  async handleNightlyReSlotting() {
    this.logger.log('🌙 [CRON] Starting nightly dynamic re-slotting...');

    try {
      // Enqueue cho warehouse mặc định
      // TODO: Query danh sách warehouses active từ DB
      const job = await this.producer.enqueueReSlotting('default', 'cron-nightly', 3);
      this.logger.log(`📦 Enqueued nightly re-slotting job: ${job.id}`);

      // Process immediately
      await this.processor.processNextJob();

      const stats = this.producer.getQueueStats();
      this.logger.log(`📊 Queue stats: ${JSON.stringify(stats)}`);
    } catch (error: any) {
      this.logger.error(`❌ Nightly re-slotting failed: ${error.message}`);
    }
  }

  /**
   * Cron job chạy mỗi 5 phút để xử lý job pending (nếu có).
   */
  @Cron(CronExpression.EVERY_5_MINUTES, { name: 'reslotting-queue-processor' })
  async processQueuedJobs() {
    const stats = this.producer.getQueueStats();
    if (stats.pending > 0) {
      this.logger.log(`🔄 Processing ${stats.pending} pending re-slotting jobs...`);
      await this.processor.processNextJob();
    }
  }
}
