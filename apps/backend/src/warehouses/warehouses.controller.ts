import { Controller, Get, Post, Body, Param, Put, Delete, UseGuards, Request } from '@nestjs/common';
import { WarehousesService } from './warehouses.service';
import { CreateWarehouseDto } from './dto/create-warehouse.dto';
import { UpdateWarehouseDto } from './dto/update-warehouse.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@Controller('warehouses')
@UseGuards(JwtAuthGuard)
export class WarehousesController {
  constructor(private readonly warehousesService: WarehousesService) {}

  @Get()
  async findAll() {
    return this.warehousesService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.warehousesService.findOne(id);
  }

  @Post()
  async create(@Body() createWarehouseDto: CreateWarehouseDto, @Request() req: any) {
    const actor = req.user ? { id: req.user.id, email: req.user.email } : undefined;
    return this.warehousesService.create(createWarehouseDto, actor);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() updateWarehouseDto: UpdateWarehouseDto,
    @Request() req: any,
  ) {
    const actor = req.user ? { id: req.user.id, email: req.user.email } : undefined;
    return this.warehousesService.update(id, updateWarehouseDto, actor);
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @Request() req: any) {
    const actor = req.user ? { id: req.user.id, email: req.user.email } : undefined;
    await this.warehousesService.remove(id, actor);
    return { success: true };
  }
}
