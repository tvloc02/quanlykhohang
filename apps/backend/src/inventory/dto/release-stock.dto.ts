import { IsNotEmpty, IsInt, Min } from 'class-validator';

export class ReleaseStockDto {
  @IsNotEmpty()
  @IsInt()
  @Min(1)
  qty: number;
}
