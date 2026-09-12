import { IsNotEmpty, IsOptional, IsString, IsInt, IsBoolean } from 'class-validator';

export class CreateProductDto {
  @IsOptional()
  @IsString()
  internalSku?: string;

  @IsOptional()
  @IsString()
  supplierBarcode?: string;

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

  @IsOptional()
  weight?: number;

  @IsOptional()
  length?: number;

  @IsOptional()
  width?: number;

  @IsOptional()
  height?: number;

  @IsOptional()
  volume?: number;

  @IsOptional()
  volumetricWeight?: number;

  @IsOptional()
  @IsString()
  tempRequirement?: string;

  @IsOptional()
  @IsString()
  turnoverClass?: string;
}
