import { IsOptional, IsString } from 'class-validator';

export class TransitionStockInOrderDto {
  @IsString()
  @IsOptional()
  nextStepUserEmail?: string;

  @IsString()
  @IsOptional()
  note?: string;
}
