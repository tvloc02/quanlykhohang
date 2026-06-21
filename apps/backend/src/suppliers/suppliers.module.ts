import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SuppliersService } from './suppliers.service';
import { SuppliersController } from './suppliers.controller';
import { Product } from '../entities/product.entity';
import { Role } from '../entities/role.entity';
import { SupplierProduct } from '../entities/supplier-product.entity';
import { Supplier } from '../entities/supplier.entity';
import { User } from '../entities/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Supplier, SupplierProduct, Product, User, Role])],
  providers: [SuppliersService],
  controllers: [SuppliersController],
  exports: [SuppliersService],
})
export class SuppliersModule {}
