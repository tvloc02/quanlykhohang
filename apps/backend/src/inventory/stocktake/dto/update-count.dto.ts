import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class UpdateCountDto {
  @IsNotEmpty()
  @IsNumber()
  countedQty: number;

  @IsOptional()
  @IsString()
  note?: string;
}
