import { Controller, Get, Query } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { ReportFilterDto } from './dto/report-filter.dto';

@Controller('reports')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('dashboard')
  getDashboardOverview() {
    return this.dashboardService.getDashboardOverview();
  }

  @Get('stock')
  getStockReport(@Query() query: ReportFilterDto) {
    return this.dashboardService.getStockReport(query.locationCode);
  }

  @Get('low-stock')
  getLowStockReport() {
    return this.dashboardService.getLowStockReport();
  }

  @Get('inbound-history')
  getInboundHistory(@Query() query: ReportFilterDto) {
    return this.dashboardService.getInboundHistory(query.startDate, query.endDate);
  }

  @Get('outbound-history')
  getOutboundHistory(@Query() query: ReportFilterDto) {
    return this.dashboardService.getOutboundHistory(query.startDate, query.endDate);
  }

  /** US 6.3 – Trend xuất nhập kho theo tuần/tháng */
  @Get('trend')
  getStockTrend(@Query('period') period?: string) {
    const p = period === 'month' ? 'month' : 'week';
    return this.dashboardService.getStockTrend(p);
  }

  /** US 6.4 – Cảnh báo tồn kho thấp */
  @Get('alerts')
  getLowStockAlerts() {
    return this.dashboardService.getLowStockAlerts();
  }

  @Get('sales-summary')
  getSalesReport(@Query() query: ReportFilterDto & { groupBy?: string }) {
    return this.dashboardService.getSalesReport(query.startDate, query.endDate, query.groupBy);
  }

  @Get('revenue-summary')
  getRevenueReport(@Query() query: ReportFilterDto & { branch?: string }) {
    return this.dashboardService.getRevenueReport(query.startDate, query.endDate, query.branch);
  }

  @Get('cashflow-summary')
  getCashflowReport(@Query() query: ReportFilterDto & { branch?: string }) {
    return this.dashboardService.getCashflowReport(query.startDate, query.endDate, query.branch);
  }

  @Get('inventory-summary-report')
  getInventorySummaryReport(@Query() query: ReportFilterDto & { categoryId?: string; groupBy?: string }) {
    return this.dashboardService.getInventorySummaryReport(query.startDate, query.endDate, query.categoryId, query.groupBy);
  }
}
