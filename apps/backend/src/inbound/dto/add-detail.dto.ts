import { IsNotEmpty, IsString, IsInt, IsOptional, IsNumber } from 'class-validator';

export class AddDetailDto {
  @IsNotEmpty()
  @IsString()
  productId: string;

  @IsNotEmpty()
  @IsInt()
  expectedQty: number;

  @IsString()
  @IsOptional()
  warehouseCode?: string;

  @IsNumber()
  @IsOptional()
  unitPrice?: number;

  @IsInt()
  @IsOptional()
  receivedQty?: number;

  @IsString()
  @IsOptional()
  supplierProductId?: string;
}
