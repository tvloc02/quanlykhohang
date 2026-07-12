import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { BarcodeMappingService } from './barcode-mapping.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@Controller('inbound/barcode-mappings')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BarcodeMappingController {
  constructor(private readonly service: BarcodeMappingService) {}

  @Post()
  @Roles('admin', 'manager', 'staff')
  async create(@Body() body: { barcode: string; productId: string }) {
    return this.service.create(body.barcode, body.productId);
  }
}
