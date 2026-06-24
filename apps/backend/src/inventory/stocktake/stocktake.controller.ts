import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { StocktakeService } from './stocktake.service';
import { CreateStocktakeDto } from './dto/create-stocktake.dto';
import { AddStocktakeDetailDto } from './dto/add-stocktake-detail.dto';
import { UpdateCountDto } from './dto/update-count.dto';

@Controller('inventory/stocktakes')
export class StocktakeController {
  constructor(private readonly service: StocktakeService) {}

  @Post()
  create(@Body() dto: CreateStocktakeDto) {
    return this.service.create(dto);
  }

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  @Post(':id/details')
  addDetail(@Param('id') id: string, @Body() dto: AddStocktakeDetailDto) {
    return this.service.addDetail(id, dto);
  }

  @Delete('details/:detailId')
  removeDetail(@Param('detailId') detailId: string) {
    return this.service.removeDetail(detailId);
  }

  @Patch('details/:detailId/count')
  updateCount(@Param('detailId') detailId: string, @Body() dto: UpdateCountDto) {
    return this.service.updateCount(detailId, dto);
  }

  @Post(':id/finish-counting')
  finishCounting(@Param('id') id: string) {
    return this.service.finishCounting(id);
  }

  @Post(':id/approve')
  approve(@Param('id') id: string, @Body() body: { approvedBy?: string }) {
    return this.service.approve(id, body?.approvedBy);
  }

  @Post(':id/reject')
  reject(@Param('id') id: string) {
    return this.service.reject(id);
  }
}
