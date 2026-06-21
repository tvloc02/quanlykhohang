import { Injectable } from '@nestjs/common';
import { OutboxService } from '../outbox/outbox.service';

@Injectable()
export class IdempotencyService {
  constructor(private readonly outboxService: OutboxService) {}

  async isReplay(idempotencyKey?: string) {
    if (!idempotencyKey) return false;
    return Boolean(await this.outboxService.findByIdempotencyKey(idempotencyKey));
  }
}
