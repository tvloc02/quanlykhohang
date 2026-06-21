import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IdempotencyService } from './idempotency/idempotency.service';
import { OutboxEvent } from './outbox/entities/outbox-event.entity';
import { OutboxService } from './outbox/outbox.service';

@Module({
  imports: [TypeOrmModule.forFeature([OutboxEvent])],
  providers: [OutboxService, IdempotencyService],
  exports: [OutboxService, IdempotencyService],
})
export class ErpIntegrationModule {}
