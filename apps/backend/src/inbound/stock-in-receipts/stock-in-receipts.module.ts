import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLogModule } from '../../audit-log/audit-log.module';
import { Product } from '../../entities/product.entity';
import { Supplier } from '../../entities/supplier.entity';
import { StockBalance } from '../../inventory/entities/stock-balance.entity';
import { StockInOrder } from '../stock-in-orders/entities/stock-in-order.entity';
import { StockInReceiptDetail } from './entities/stock-in-receipt-detail.entity';
import { StockInReceipt } from './entities/stock-in-receipt.entity';
import { StockInReceiptsController } from './stock-in-receipts.controller';
import { StockInReceiptsService } from './stock-in-receipts.service';

@Module({
  imports: [TypeOrmModule.forFeature([StockInReceipt, StockInReceiptDetail, Supplier, Product, StockBalance, StockInOrder]), AuditLogModule],
  controllers: [StockInReceiptsController],
  providers: [StockInReceiptsService],
  exports: [StockInReceiptsService],
})
export class StockInReceiptsModule {}
