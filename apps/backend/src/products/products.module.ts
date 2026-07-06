import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';
import { BarcodeLookupController } from './barcode-lookup.controller';
import { Product } from '../entities/product.entity';
import { Category } from '../entities/category.entity';
import { Supplier } from '../entities/supplier.entity';
import { StockBalance } from '../inventory/entities/stock-balance.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Product, Category, Supplier, StockBalance])],
  providers: [ProductsService],
  controllers: [ProductsController, BarcodeLookupController],
  exports: [ProductsService],
})
export class ProductsModule {}

