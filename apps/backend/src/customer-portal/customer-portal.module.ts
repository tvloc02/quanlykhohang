import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CustomerPortalController } from './customer-portal.controller';
import { CustomerPortalService } from './customer-portal.service';
import { Customer } from '../entities/customer.entity';
import { OutboundOrder } from '../outbound/entities/outbound-order.entity';
import { StockBalance } from '../inventory/entities/stock-balance.entity';
import { OutboundModule } from '../outbound/outbound.module';
import { Product } from '../entities/product.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Customer, OutboundOrder, StockBalance, Product]),
    OutboundModule,
  ],
  controllers: [CustomerPortalController],
  providers: [CustomerPortalService],
})
export class CustomerPortalModule {}
