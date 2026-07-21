import { Body, Controller, Delete, Get, Headers, Param, Post, Put } from '@nestjs/common';
import { OutboundService } from './outbound.service';
import { CreateOutboundOrderDto } from './dto/create-outbound-order.dto';
import { AddOutboundDetailDto } from './dto/add-outbound-detail.dto';
import { PickDetailDto } from './dto/pick-detail.dto';
import { AssignTaskDto } from './dto/assign-task.dto';
import { ConfirmPickingDto } from './dto/confirm-picking.dto';

@Controller('outbounds')
export class OutboundController {
  constructor(private service: OutboundService) {}

  // ─── CRUD endpoints (used by frontend Outbound.tsx) ──────────

  @Post('shipping-notes')
  createShippingNote(@Body() dto: { orderIds: string[]; expectedDate?: string; description?: string; assignee?: string }) {
    return this.service.createShippingNote(dto);
  }

  @Get('shipping-notes/all')
  getShippingNotes() {
    return this.service.getShippingNotes();
  }

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateOutboundOrderDto) {
    return this.service.createOutbound(dto);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: CreateOutboundOrderDto) {
    return this.service.updateOutbound(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.removeOutbound(id);
  }

  @Post(':id/confirm')
  confirm(@Param('id') id: string, @Headers('idempotency-key') idempotencyKey?: string) {
    return this.service.confirmOutbound(id, idempotencyKey);
  }

  // ─── Detail / Picking endpoints ──────────────────────────────

  @Post(':id/details')
  addDetail(@Param('id') id: string, @Body() dto: AddOutboundDetailDto) {
    return this.service.addDetail(id, dto);
  }

  @Post('details/:detailId/pick')
  pickDetail(@Param('detailId') detailId: string, @Body() dto: PickDetailDto) {
    return this.service.pickDetail(detailId, dto.qty);
  }

  @Post('tasks')
  assignTask(@Body() dto: AssignTaskDto) {
    return this.service.assignTask(dto);
  }

  @Post('tasks/:taskId/confirm')
  confirmTask(@Param('taskId') taskId: string, @Body() dto: ConfirmPickingDto) {
    return this.service.confirmTask(taskId, dto.taskId);
  }

  @Get('tasks/all')
  findTasks() {
    return this.service.findTasks();
  }
}
