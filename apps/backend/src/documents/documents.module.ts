import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StockInOrder } from '../inbound/stock-in-orders/entities/stock-in-order.entity';
import { OutboundOrder } from '../outbound/entities/outbound-order.entity';
import { TransferOrder } from '../delivery/entities/delivery-order.entity';
import { Customer } from '../entities/customer.entity';
import { DocumentsService } from './documents.service';
import { DocumentsController } from './documents.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      StockInOrder,
      OutboundOrder,
      TransferOrder,
      Customer,
    ]),
  ],
  controllers: [DocumentsController],
  providers: [DocumentsService],
  exports: [DocumentsService],
})
export class DocumentsModule {}
