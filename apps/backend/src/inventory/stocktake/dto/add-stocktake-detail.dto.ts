import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class AddStocktakeDetailDto {
  @IsNotEmpty()
  @IsString()
  productId: string;

  @IsOptional()
  @IsNumber()
  countedQty?: number;

  @IsOptional()
  @IsString()
  note?: string;
}
