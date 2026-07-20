import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SmartInventoryController } from './smart-inventory.controller';
import { SmartInventoryService } from './smart-inventory.service';
import { StockBalance } from '../entities/stock-balance.entity';
import { Product } from '../../entities/product.entity';
import { Warehouse } from '../../entities/warehouse.entity';
import { Stocktake } from '../stocktake/entities/stocktake.entity';
import { StocktakeDetail } from '../stocktake/entities/stocktake-detail.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      StockBalance,
      Product,
      Warehouse,
      Stocktake,
      StocktakeDetail,
    ]),
  ],
  controllers: [SmartInventoryController],
  providers: [SmartInventoryService],
  exports: [SmartInventoryService],
})
export class SmartInventoryModule {}
