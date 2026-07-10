import { IsString, IsOptional, IsInt, IsNumber, IsIn, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export type StockInReceiptType = 'PURCHASE_GOODS' | 'FINISHED_GOODS' | 'RETURNED_GOODS' | 'OTHER';

export class CreateStockInReceiptItemDto {
  @IsString()
  productId: string;

  @IsString()
  @IsOptional()
  warehouseCode?: string;

  @IsInt()
  @Type(() => Number)
  quantity: number;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  unitPrice?: number;

  @IsString()
  @IsOptional()
  note?: string;
}

export class CreateStockInReceiptDto {
  @IsString()
  @IsOptional()
  receiptCode?: string;

  @IsIn(['PURCHASE_GOODS', 'FINISHED_GOODS', 'RETURNED_GOODS', 'OTHER'])
  receiptType: StockInReceiptType;

  @IsString()
  warehouseCode: string;

  @IsString()
  @IsOptional()
  supplierId?: string;

  @IsString()
  @IsOptional()
  sourceStockInOrderId?: string;

  @IsString()
  @IsOptional()
  sourceReferenceNo?: string;

  @IsString()
  @IsOptional()
  receiptDate?: string;

  @IsIn(['DRAFT', 'POSTED'])
  @IsOptional()
  status?: 'DRAFT' | 'POSTED';

  @IsString()
  @IsOptional()
  description?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateStockInReceiptItemDto)
  @IsOptional()
  items?: CreateStockInReceiptItemDto[];
}
