import { IsNotEmpty, IsString, IsInt } from 'class-validator';

export class AdjustStockDto {
  @IsNotEmpty()
  @IsString()
  reason: string;

  @IsNotEmpty()
  @IsInt()
  quantity: number;
}
