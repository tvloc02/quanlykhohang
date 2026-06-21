import { Body, Controller, Get, Headers, Param, Post } from '@nestjs/common';
import { OutboundService } from './outbound.service';
import { CreateOutboundOrderDto } from './dto/create-outbound-order.dto';
import { AddOutboundDetailDto } from './dto/add-outbound-detail.dto';
import { PickDetailDto } from './dto/pick-detail.dto';
import { AssignTaskDto } from './dto/assign-task.dto';
import { ConfirmPickingDto } from './dto/confirm-picking.dto';

@Controller('outbound')
export class OutboundController {
  constructor(private service: OutboundService) {}

  @Post('orders')
  createOrder(@Body() dto: CreateOutboundOrderDto) {
    return this.service.createOrder(dto);
  }

  @Post('orders/:id/details')
  addDetail(@Param('id') id: string, @Body() dto: AddOutboundDetailDto) {
    return this.service.addDetail(id, dto);
  }

  @Post('details/:detailId/pick')
  pickDetail(@Param('detailId') detailId: string, @Body() dto: PickDetailDto) {
    return this.service.pickDetail(detailId, dto.qty);
  }

  @Post('orders/:id/confirm')
  confirmOrder(@Param('id') id: string, @Headers('idempotency-key') idempotencyKey?: string) {
    return this.service.confirmOrder(id, idempotencyKey);
  }

  @Post('tasks')
  assignTask(@Body() dto: AssignTaskDto) {
    return this.service.assignTask(dto);
  }

  @Post('tasks/:taskId/confirm')
  confirmTask(@Param('taskId') taskId: string, @Body() dto: ConfirmPickingDto) {
    return this.service.confirmTask(taskId, dto.taskId);
  }

  @Get('orders')
  findAllOrders() {
    return this.service.findAllOrders();
  }

  @Get('orders/:id')
  findOrder(@Param('id') id: string) {
    return this.service.findOrder(id);
  }

  @Get('tasks')
  findTasks() {
    return this.service.findTasks();
  }
}
