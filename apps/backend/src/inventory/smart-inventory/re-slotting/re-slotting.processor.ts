import { Injectable, Logger } from '@nestjs/common';
import { ReSlottingProducer } from './re-slotting.producer';
import { AiEngineClient } from '../ai-engine.client';

/**
 * ReSlotting Processor – Consumer xử lý job tái bố trí
 *
 * Consume job từ queue → Thu thập inventory data → Gọi AI Engine → Lưu kết quả
 *
 * TODO: Khi có Redis + BullMQ, chuyển sang:
 *   @Processor('re-slotting-queue')
 *   @Process('reslot')
 *   async handleReSlotting(job: Job) { ... }
 */
@Injectable()
export class ReSlottingProcessor {
  private readonly logger = new Logger(ReSlottingProcessor.name);
  private isProcessing = false;

  constructor(
    private readonly producer: ReSlottingProducer,
    private readonly aiEngine: AiEngineClient,
  ) {}

  /**
   * Xử lý job pending tiếp theo.
   * Gọi bởi scheduler hoặc trigger thủ công.
   */
  async processNextJob(): Promise<any> {
    if (this.isProcessing) {
      this.logger.warn('Processor is already handling a job, skipping');
      return { skipped: true };
    }

    const job = this.producer.getNextPendingJob();
    if (!job) {
      this.logger.debug('No pending re-slotting jobs');
      return { noPendingJobs: true };
    }

    this.isProcessing = true;
    this.producer.updateJobStatus(job.id, 'PROCESSING');
    this.logger.log(`🔄 Processing re-slotting job ${job.id} for warehouse ${job.warehouseId}`);

    try {
      // 1. Kiểm tra AI Engine health
      const health = await this.aiEngine.healthCheck();
      if (!health) {
        throw new Error('AI Engine is not available');
      }

      // 2. Gọi AI Engine cho re-slotting
      // Trong thực tế, cần thu thập inventory data từ DB ở đây
      // Hiện tại sử dụng placeholder request
      const payload = {
        warehouse_id: job.warehouseId,
        inventory_items: [],
        available_bins: [],
        scoring_weights: { w_abc: 0.35, w_ergo: 0.25, w_fill: 0.20, w_affinity: 0.20 },
        affinity_pairs: {},
      };

      const result = await this.aiEngine.requestReSlotting(payload);

      if (result) {
        this.producer.updateJobStatus(job.id, 'COMPLETED', result);
        this.logger.log(
          `✅ Re-slotting job ${job.id} completed: ${result.items_to_relocate || 0} items to relocate`,
        );
      } else {
        this.producer.updateJobStatus(job.id, 'FAILED', null, 'AI Engine returned null');
        this.logger.warn(`⚠️ Re-slotting job ${job.id}: AI Engine returned no result`);
      }

      return result;
    } catch (error: any) {
      this.producer.updateJobStatus(job.id, 'FAILED', null, error.message);
      this.logger.error(`❌ Re-slotting job ${job.id} failed: ${error.message}`);
      return { error: error.message };
    } finally {
      this.isProcessing = false;
    }
  }
}
