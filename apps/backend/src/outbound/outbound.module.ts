import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OutboundController } from './outbound.controller';
import { OutboundService } from './outbound.service';
import { OutboundOrder } from './entities/outbound-order.entity';
import { OutboundDetail } from './entities/outbound-detail.entity';
import { PickingTask } from './entities/picking-task.entity';
import { Customer } from '../entities/customer.entity';
import { Product } from '../entities/product.entity';
import { StockBalance } from '../inventory/entities/stock-balance.entity';
import { ErpIntegrationModule } from '../erp-integration/erp-integration.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([OutboundOrder, OutboundDetail, PickingTask, Customer, Product, StockBalance]),
    ErpIntegrationModule,
  ],
  controllers: [OutboundController],
  providers: [OutboundService],
  exports: [OutboundService],
})
export class OutboundModule {}
