import { Controller, Get, Post, Query, Param, Body, UseGuards } from '@nestjs/common';
import { SmartInventoryService } from './smart-inventory.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@Controller('inventory')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SmartInventoryController {
  constructor(private readonly service: SmartInventoryService) {}

  @Get('smart-slotting/abc-analysis')
  @Roles('admin', 'manager', 'staff')
  async getAbcAnalysis() {
    return this.service.getAbcAnalysis();
  }

  @Get('smart-slotting/suggest')
  @Roles('admin', 'manager', 'staff')
  async suggestSlotting(
    @Query('productId') productId: string,
    @Query('qty') qty?: string,
  ) {
    const requiredQty = Number(qty) || 10;
    return this.service.suggestSlotting(productId, requiredQty);
  }

  @Get('visualizer/digital-twin')
  @Roles('admin', 'manager', 'staff')
  async getDigitalTwinTopology(@Query('days') days?: string) {
    const numDays = Number(days) || 30;
    return this.service.getDigitalTwinTopology(numDays);
  }

  @Get('visualizer/heatmap')
  @Roles('admin', 'manager', 'staff')
  async getHeatmapData(@Query('days') days?: string) {
    const numDays = Number(days) || 30;
    return this.service.getDigitalTwinTopology(numDays);
  }

  @Get('visualizer/location-detail/:locationCode')
  @Roles('admin', 'manager', 'staff')
  async getLocationDetails(@Param('locationCode') locationCode: string) {
    return this.service.getLocationDetails(locationCode);
  }

  @Get('smart-stocktake/risk-analysis')
  @Roles('admin', 'manager')
  async getRiskAnalysis() {
    return this.service.getRiskAnalysis();
  }

  @Post('smart-stocktake/generate-recommended')
  @Roles('admin', 'manager')
  async generateRecommendedStocktake(@Body() body: { assignee?: string; createdBy?: string }) {
    return this.service.generateRecommendedStocktake(body.assignee, body.createdBy);
  }
}
