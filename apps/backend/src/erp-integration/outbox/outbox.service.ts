import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OutboxEvent } from './entities/outbox-event.entity';

type EnqueueOutboxInput = {
  eventType: string;
  payload: Record<string, unknown>;
  idempotencyKey?: string;
};

@Injectable()
export class OutboxService {
  constructor(@InjectRepository(OutboxEvent) private readonly repo: Repository<OutboxEvent>) {}

  async enqueue(input: EnqueueOutboxInput) {
    if (input.idempotencyKey) {
      const existing = await this.repo.findOne({ where: { idempotencyKey: input.idempotencyKey } });
      if (existing) return existing;
    }

    const event = this.repo.create({
      eventType: input.eventType,
      payload: input.payload,
      idempotencyKey: input.idempotencyKey,
      status: 'PENDING',
    });

    return this.repo.save(event);
  }

  findByIdempotencyKey(idempotencyKey: string) {
    return this.repo.findOne({ where: { idempotencyKey } });
  }

  findPending(limit = 50) {
    return this.repo.find({
      where: { status: 'PENDING' },
      order: { createdAt: 'ASC' },
      take: Math.min(Math.max(limit, 1), 200),
    });
  }
}
