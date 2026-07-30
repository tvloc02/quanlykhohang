import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { DocumentsService } from './documents.service';

@Controller('documents')
@UseGuards(JwtAuthGuard)
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Get('sales-invoices')
  getSalesInvoices() {
    return this.documentsService.getSalesInvoices();
  }

  @Get('stock-in-notes')
  getStockInNotes() {
    return this.documentsService.getStockInNotes();
  }

  @Get('stock-out-notes')
  getStockOutNotes() {
    return this.documentsService.getStockOutNotes();
  }

  @Get('transfer-notes')
  getTransferNotes() {
    return this.documentsService.getTransferNotes();
  }

  @Get('stats')
  getStats() {
    return this.documentsService.getStats();
  }
}
