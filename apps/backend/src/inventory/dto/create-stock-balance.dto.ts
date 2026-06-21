import { IsNotEmpty, IsString, IsInt, Min } from 'class-validator';

export class CreateStockBalanceDto {
  @IsNotEmpty()
  @IsString()
  productId: string;

  @IsNotEmpty()
  @IsString()
  locationCode: string;

  @IsNotEmpty()
  @IsInt()
  @Min(0)
  totalPhysical: number;

  @IsInt()
  @Min(0)
  allocated?: number;
}
