import { IsOptional, IsString, IsInt } from 'class-validator';

export class UpdateProductDto {
  @IsOptional()
  @IsString()
  supplierBarcode?: string;

  @IsOptional()
  @IsString()
  supplierId?: string;

  @IsOptional()
  @IsString()
  name?: string;

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
