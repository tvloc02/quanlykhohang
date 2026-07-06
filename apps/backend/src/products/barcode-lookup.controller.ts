import { Controller, Get, Param } from '@nestjs/common';
import { ProductsService } from './products.service';

@Controller('products')
export class BarcodeLookupController {
  constructor(private readonly productsService: ProductsService) {}

  @Get('barcode-lookup/:code')
  async lookupByBarcode(@Param('code') code: string) {
    return this.productsService.findByBarcode(code);
  }
}
