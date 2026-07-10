import { IsString, IsOptional } from 'class-validator';

export class CreateStockInOrderDto {
  @IsString()
  sourcePurchaseOrderId: string;

  @IsString()
  @IsOptional()
  currentStepUserEmail?: string;

  @IsString()
  @IsOptional()
  nextStepUserEmail?: string;

  @IsString()
  @IsOptional()
  note?: string;

  @IsString()
  @IsOptional()
  orderCode?: string;
}
