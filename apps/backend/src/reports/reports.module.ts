import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { StockBalance } from '../inventory/entities/stock-balance.entity';
import { Product } from '../entities/product.entity';
import { Category } from '../entities/category.entity';
import { InboundReceipt } from '../inbound/entities/inbound-receipt.entity';
import { InboundDetail } from '../inbound/entities/inbound-detail.entity';
import { OutboundOrder } from '../outbound/entities/outbound-order.entity';
import { OutboundDetail } from '../outbound/entities/outbound-detail.entity';
import { PickingTask } from '../outbound/entities/picking-task.entity';
import { Customer } from '../entities/customer.entity';
import { Supplier } from '../entities/supplier.entity';
import { Role } from '../entities/role.entity';
import { User } from '../entities/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      StockBalance,
      Product,
      Category,
      InboundReceipt,
      InboundDetail,
      OutboundOrder,
      OutboundDetail,
      PickingTask,
      Customer,
      Supplier,
      Role,
      User,
    ]),
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class ReportsModule {}
