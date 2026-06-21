import { IsNotEmpty, IsOptional, IsString, IsInt } from 'class-validator';

export class CreateProductDto {
  @IsNotEmpty()
  @IsString()
  internalSku: string;

  @IsOptional()
  @IsString()
  supplierBarcode?: string;

  @IsOptional()
  @IsString()
  supplierId?: string;

  @IsNotEmpty()
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  unit?: string;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsInt()
  minimumStock?: number;
}
