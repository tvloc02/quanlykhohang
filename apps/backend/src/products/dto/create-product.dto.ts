import { IsNotEmpty, IsOptional, IsString, IsInt, IsBoolean } from 'class-validator';

export class CreateProductDto {
  @IsOptional()
  @IsString()
  internalSku?: string;

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

  @IsOptional()
  price?: number;

  @IsOptional()
  images?: string[];

  @IsOptional()
  @IsBoolean()
  isVisible?: boolean;
}
