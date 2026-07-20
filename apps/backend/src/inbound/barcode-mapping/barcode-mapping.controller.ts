import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { BarcodeMappingService } from './barcode-mapping.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@Controller('inbound/barcode-mappings')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BarcodeMappingController {
  constructor(private readonly service: BarcodeMappingService) {}

  @Get()
  @Roles('admin', 'manager', 'staff')
  async findAll() {
    return this.service.findAll();
  }

  @Post()
  @Roles('admin', 'manager', 'staff')
  async create(@Body() body: { barcode: string; productId: string }) {
    return this.service.create(body.barcode, body.productId);
  }

  @Delete(':id')
  @Roles('admin', 'manager')
  async remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
