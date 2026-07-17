import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InventoryService } from './inventory.service';
import { InventoryController } from './inventory.controller';
import { StockBalance } from './entities/stock-balance.entity';
import { Product } from '../entities/product.entity';
import { Stocktake } from './stocktake/entities/stocktake.entity';
import { StocktakeDetail } from './stocktake/entities/stocktake-detail.entity';
import { StocktakeService } from './stocktake/stocktake.service';
import { StocktakeController } from './stocktake/stocktake.controller';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([StockBalance, Product, Stocktake, StocktakeDetail]),
    NotificationsModule,
  ],
  controllers: [InventoryController, StocktakeController],
  providers: [InventoryService, StocktakeService],
  exports: [InventoryService, StocktakeService],
})
export class InventoryModule {}

