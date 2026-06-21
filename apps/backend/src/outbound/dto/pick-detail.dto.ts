import { IsNotEmpty, IsString, IsInt, Min } from 'class-validator';

export class PickDetailDto {
  @IsNotEmpty()
  @IsString()
  detailId: string;

  @IsNotEmpty()
  @IsInt()
  @Min(1)
  qty: number;
}
