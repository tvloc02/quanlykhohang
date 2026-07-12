import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScanController } from './scan.controller';
import { ScanService } from './scan.service';
import { Product } from '../entities/product.entity';
import { StockBalance } from '../inventory/entities/stock-balance.entity';
import { SupplierProduct } from '../entities/supplier-product.entity';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { InboundModule } from '../inbound/inbound.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Product, StockBalance, SupplierProduct]),
    AuditLogModule,
    InboundModule,
  ],
  controllers: [ScanController],
  providers: [ScanService],
})
export class ScanModule {}
