import { IsNotEmpty, IsString } from 'class-validator';

export class AddStocktakeDetailDto {
  @IsNotEmpty()
  @IsString()
  productId: string;
}
