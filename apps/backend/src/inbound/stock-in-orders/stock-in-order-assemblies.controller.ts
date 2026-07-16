import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CreateAssemblyDto, CreateStandaloneAssemblyDto } from './dto/create-assembly.dto';
import { RecountAssemblyDto } from './dto/recount-assembly.dto';
import { StockInOrderAssembliesService } from './stock-in-order-assemblies.service';

@Controller('inbound/stock-in-orders')
@UseGuards(JwtAuthGuard)
export class StockInOrderAssembliesController {
  constructor(private readonly service: StockInOrderAssembliesService) {}

  @Get(':id/assemblies')
  findByOrder(@Param('id') id: string) {
    return this.service.findByOrder(id);
  }

  @Get('assemblies/:id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post(':id/assemblies')
  create(@Param('id') id: string, @Body() dto: CreateAssemblyDto, @CurrentUser() user: { id?: string; email?: string }) {
    return this.service.create(id, dto, user);
  }

  @Post('assemblies/standalone')
  createStandalone(@Body() dto: CreateStandaloneAssemblyDto, @CurrentUser() user: { id?: string; email?: string }) {
    return this.service.createStandalone(dto, user);
  }

  @Post('assemblies/:id/recount')
  recount(@Param('id') id: string, @Body() dto: RecountAssemblyDto, @CurrentUser() user: { id?: string; email?: string }) {
    return this.service.recount(id, dto, user);
  }
}
