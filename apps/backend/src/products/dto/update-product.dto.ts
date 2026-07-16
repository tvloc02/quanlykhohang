import { IsOptional, IsString, IsInt } from 'class-validator';

export class UpdateProductDto {
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

  @IsOptional()
  price?: number;

  @IsOptional()
  images?: string[];
}
