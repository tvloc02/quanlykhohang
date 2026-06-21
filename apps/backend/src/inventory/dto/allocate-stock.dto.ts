import { IsNotEmpty, IsInt, Min } from 'class-validator';

export class AllocateStockDto {
  @IsNotEmpty()
  @IsInt()
  @Min(1)
  qty: number;
}
