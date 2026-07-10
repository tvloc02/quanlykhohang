import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class CompleteStockInOrderDto {
  @IsBoolean()
  @IsOptional()
  confirmDifference?: boolean;

  @IsString()
  @IsOptional()
  nextStepUserEmail?: string;

  @IsString()
  @IsOptional()
  note?: string;
}
