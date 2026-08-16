import { IsOptional, IsString, IsInt, IsBoolean } from 'class-validator';

export class UpdateProductDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  supplierBarcode?: string;

  @IsOptional()
  @IsString()
  unit?: string;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsInt()
  minimumStock?: number;

  @IsOptional()
  price?: number;

  @IsOptional()
  importPrice?: number;

  @IsOptional()
  wholesalePrice?: number;

  @IsOptional()
  images?: string[];

  @IsOptional()
  @IsBoolean()
  isVisible?: boolean;
}
