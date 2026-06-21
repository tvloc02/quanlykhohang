import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { SuppliersService } from './suppliers.service';
import { CreateSupplierDto, UpdateSupplierDto, UpsertSupplierProductDto } from './dto/create-supplier.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('suppliers')
export class SuppliersController {
  constructor(private svc: SuppliersService) {}

  @Post()
  create(@Body() dto: CreateSupplierDto) {
    return this.svc.create(dto);
  }

  @Get()
  findAll() {
    return this.svc.findAll();
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  findMine(@CurrentUser() user: any) {
    return this.svc.findMine(user);
  }

  @UseGuards(JwtAuthGuard)
  @Put('me')
  updateMine(@CurrentUser() user: any, @Body() dto: UpdateSupplierDto) {
    return this.svc.updateMine(user, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('me/products')
  addMyProduct(@CurrentUser() user: any, @Body() dto: UpsertSupplierProductDto) {
    return this.svc.addProduct(user.supplierId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Put('me/products/:linkId')
  updateMyProduct(
    @CurrentUser() user: any,
    @Param('linkId') linkId: string,
    @Body() dto: UpsertSupplierProductDto,
  ) {
    return this.svc.updateProduct(user.supplierId, linkId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('me/products/:linkId')
  removeMyProduct(@CurrentUser() user: any, @Param('linkId') linkId: string) {
    return this.svc.removeProduct(user.supplierId, linkId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.svc.findOne(id);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateSupplierDto) {
    return this.svc.update(id, dto);
  }

  @Post(':id/products')
  addProduct(@Param('id') id: string, @Body() dto: UpsertSupplierProductDto) {
    return this.svc.addProduct(id, dto);
  }

  @Put(':id/products/:linkId')
  updateProduct(@Param('id') id: string, @Param('linkId') linkId: string, @Body() dto: UpsertSupplierProductDto) {
    return this.svc.updateProduct(id, linkId, dto);
  }

  @Delete(':id/products/:linkId')
  removeProduct(@Param('id') id: string, @Param('linkId') linkId: string) {
    return this.svc.removeProduct(id, linkId);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.svc.remove(id);
  }
}
