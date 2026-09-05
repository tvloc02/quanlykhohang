import { Injectable, Logger } from '@nestjs/common';

/**
 * ReSlotting Producer – Đẩy job vào hàng đợi tái bố trí
 *
 * Sử dụng in-memory queue vì Redis chưa có.
 * Khi có Redis, chuyển sang BullMQ chính thức.
 *
 * Job data: { warehouseId, triggeredBy, priority }
 */

export interface ReSlottingJob {
  id: string;
  warehouseId: string;
  triggeredBy: string;
  priority: number;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  createdAt: Date;
  completedAt?: Date;
  result?: any;
  error?: string;
}

@Injectable()
export class ReSlottingProducer {
  private readonly logger = new Logger(ReSlottingProducer.name);
  private readonly jobs: ReSlottingJob[] = [];
  private jobCounter = 0;

  /**
   * Thêm job tái bố trí vào queue.
   *
   * TODO: Khi có Redis, thay thế bằng:
   *   @InjectQueue('re-slotting') private queue: Queue
   *   await this.queue.add('reslot', data, { priority, delay })
   */
  async enqueueReSlotting(
    warehouseId: string,
    triggeredBy: string = 'system',
    priority: number = 5,
  ): Promise<ReSlottingJob> {
    this.jobCounter++;
    const job: ReSlottingJob = {
      id: `reslot-${this.jobCounter}-${Date.now()}`,
      warehouseId,
      triggeredBy,
      priority,
      status: 'PENDING',
      createdAt: new Date(),
    };

    this.jobs.push(job);
    this.logger.log(
      `📦 Enqueued re-slotting job ${job.id} for warehouse ${warehouseId} (priority: ${priority})`,
    );

    return job;
  }

  /**
   * Lấy job pending tiếp theo để xử lý.
   */
  getNextPendingJob(): ReSlottingJob | null {
    return this.jobs.find((j) => j.status === 'PENDING') || null;
  }

  /**
   * Cập nhật trạng thái job.
   */
  updateJobStatus(jobId: string, status: ReSlottingJob['status'], result?: any, error?: string) {
    const job = this.jobs.find((j) => j.id === jobId);
    if (job) {
      job.status = status;
      if (result) job.result = result;
      if (error) job.error = error;
      if (status === 'COMPLETED' || status === 'FAILED') {
        job.completedAt = new Date();
      }
    }
  }

  /**
   * Lấy trạng thái tất cả jobs.
   */
  getAllJobs(): ReSlottingJob[] {
    return [...this.jobs].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /**
   * Lấy thống kê queue.
   */
  getQueueStats() {
    const pending = this.jobs.filter((j) => j.status === 'PENDING').length;
    const processing = this.jobs.filter((j) => j.status === 'PROCESSING').length;
    const completed = this.jobs.filter((j) => j.status === 'COMPLETED').length;
    const failed = this.jobs.filter((j) => j.status === 'FAILED').length;
    return { total: this.jobs.length, pending, processing, completed, failed };
  }
}
