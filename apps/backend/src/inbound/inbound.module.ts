import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InboundService } from './inbound.service';
import { InboundController } from './inbound.controller';
import { InboundReceipt } from './entities/inbound-receipt.entity';
import { InboundDetail } from './entities/inbound-detail.entity';
import { Product } from '../entities/product.entity';
import { Supplier } from '../entities/supplier.entity';
import { SupplierProduct } from '../entities/supplier-product.entity';
import { StockBalance } from '../inventory/entities/stock-balance.entity';
import { StockInOrdersModule } from './stock-in-orders/stock-in-orders.module';
import { StockInReceiptsModule } from './stock-in-receipts/stock-in-receipts.module';
import { ReturnRequestsModule } from './return-requests/return-requests.module';
import { BarcodeMapping } from './barcode-mapping/entities/barcode-mapping.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { BarcodeMappingService } from './barcode-mapping/barcode-mapping.service';
import { BarcodeMappingController } from './barcode-mapping/barcode-mapping.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      InboundReceipt,
      InboundDetail,
      Product,
      Supplier,
      SupplierProduct,
      StockBalance,
      BarcodeMapping,
    ]),
    StockInOrdersModule,
    StockInReceiptsModule,
    ReturnRequestsModule,
    NotificationsModule,
  ],
  providers: [InboundService, BarcodeMappingService],
  controllers: [InboundController, BarcodeMappingController],
  exports: [InboundService, BarcodeMappingService],
})
export class InboundModule { }
