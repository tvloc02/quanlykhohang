import { Controller, Get, Post, Query, Param, Body, UseGuards } from '@nestjs/common';
import { SmartInventoryService } from './smart-inventory.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { ReSlottingProducer } from './re-slotting/re-slotting.producer';

@Controller('inventory')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SmartInventoryController {
  constructor(
    private readonly service: SmartInventoryService,
    private readonly reSlottingProducer: ReSlottingProducer,
  ) {}

  // ─── ABC Analysis ──────────────────────────────────

  @Get('smart-slotting/abc-analysis')
  @Roles('admin', 'manager', 'staff')
  async getAbcAnalysis() {
    return this.service.getAbcAnalysis();
  }

  // ─── AI Slotting (Realtime Inbound) ────────────────

  @Get('smart-slotting/suggest')
  @Roles('admin', 'manager', 'staff')
  async suggestSlotting(
    @Query('productId') productId: string,
    @Query('qty') qty?: string,
  ) {
    const requiredQty = Number(qty) || 10;
    return this.service.suggestSlotting(productId, requiredQty);
  }

  // ─── AI Engine Health Check ────────────────────────

  @Get('smart-slotting/ai-engine-health')
  @Roles('admin', 'manager')
  async getAiEngineHealth() {
    return this.service.getAiEngineHealth();
  }

  // ─── Dynamic Re-slotting (BullMQ Queue) ────────────

  @Post('smart-slotting/trigger-reslotting')
  @Roles('admin', 'manager')
  async triggerReSlotting(
    @Body() body: { warehouseId?: string; triggeredBy?: string },
  ) {
    const job = await this.reSlottingProducer.enqueueReSlotting(
      body.warehouseId || 'default',
      body.triggeredBy || 'manual',
      3,
    );
    return {
      message: 'Re-slotting job enqueued successfully',
      job: { id: job.id, status: job.status, warehouseId: job.warehouseId },
    };
  }

  @Get('smart-slotting/reslotting-status')
  @Roles('admin', 'manager')
  async getReSlottingStatus() {
    const stats = this.reSlottingProducer.getQueueStats();
    const jobs = this.reSlottingProducer.getAllJobs().slice(0, 20); // Last 20
    return { stats, recentJobs: jobs };
  }

  // ─── Digital Twin & Heatmap ────────────────────────

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

  // ─── Smart Stocktake ──────────────────────────────

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
