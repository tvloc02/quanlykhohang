import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IdempotencyService } from './idempotency/idempotency.service';
import { OutboxEvent } from './outbox/entities/outbox-event.entity';
import { OutboxService } from './outbox/outbox.service';
import { OutboxController } from './outbox/outbox.controller';
import { ErpSyncWorker } from './workers/erp-sync.worker';

@Module({
  imports: [TypeOrmModule.forFeature([OutboxEvent])],
  controllers: [OutboxController],
  providers: [OutboxService, IdempotencyService, ErpSyncWorker],
  exports: [OutboxService, IdempotencyService],
})
export class ErpIntegrationModule {}
