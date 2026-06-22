import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLogModule } from '../../audit-log/audit-log.module';
import { Product } from '../../entities/product.entity';
import { StockBalance } from '../../inventory/entities/stock-balance.entity';
import { InboundDetail } from '../entities/inbound-detail.entity';
import { InboundReceipt } from '../entities/inbound-receipt.entity';
import { StockInReceiptsModule } from '../stock-in-receipts/stock-in-receipts.module';
import { StockInOrderDetail } from './entities/stock-in-order-detail.entity';
import { StockInOrder } from './entities/stock-in-order.entity';
import { Assembly } from './entities/assembly.entity';
import { AssemblyDetail } from './entities/assembly-detail.entity';
import { StockInOrdersController } from './stock-in-orders.controller';
import { StockInOrderAssembliesController } from './stock-in-order-assemblies.controller';
import { StockInOrdersService } from './stock-in-orders.service';
import { StockInOrderAssembliesService } from './stock-in-order-assemblies.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([StockInOrder, StockInOrderDetail, InboundReceipt, InboundDetail, Product, StockBalance, Assembly, AssemblyDetail]),
    AuditLogModule,
    StockInReceiptsModule,
  ],
  controllers: [StockInOrdersController, StockInOrderAssembliesController],
  providers: [StockInOrdersService, StockInOrderAssembliesService],
  exports: [StockInOrdersService, StockInOrderAssembliesService],
})
export class StockInOrdersModule {}
