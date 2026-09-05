import { Module } from '@nestjs/common';
import { ReSlottingProducer } from './re-slotting.producer';
import { ReSlottingProcessor } from './re-slotting.processor';
import { ReSlottingScheduler } from './re-slotting.scheduler';
import { AiEngineClient } from '../ai-engine.client';


/**
 * ReSlotting Module – Dynamic Re-slotting Queue (BullMQ / Redis)
 *
 * Chạy tác vụ tái bố trí kho trong giờ thấp điểm (2:00 AM).
 * Redis là optional: nếu không có Redis, module sẽ skip gracefully.
 *
 * Architecture:
 *   Producer → Redis Queue → Processor (Worker) → AI Engine → Relocation Orders
 */
@Module({
  providers: [
    ReSlottingProducer,
    ReSlottingProcessor,
    ReSlottingScheduler,
    AiEngineClient,
  ],
  exports: [ReSlottingProducer, AiEngineClient],
})
export class ReSlottingModule { }
