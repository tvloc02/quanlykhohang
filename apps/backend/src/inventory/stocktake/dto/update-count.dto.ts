import { IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class UpdateCountDto {
  @IsNotEmpty()
  @IsInt()
  countedQty: number;

  @IsOptional()
  @IsString()
  note?: string;
}
