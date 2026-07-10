import { IsString, IsOptional, IsIn, IsArray, ValidateNested, IsInt, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

class UpdateStockInOrderDetailDto {
  @IsString()
  id: string;

  @IsString()
  @IsOptional()
  warehouseCode?: string;

  @IsInt()
  @IsOptional()
  @Type(() => Number)
  requestedQty?: number;

  @IsInt()
  @IsOptional()
  @Type(() => Number)
  actualQty?: number;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  unitPrice?: number;
}

export class UpdateStockInOrderDto {
  @IsString()
  @IsOptional()
  currentStepUserEmail?: string;

  @IsString()
  @IsOptional()
  nextStepUserEmail?: string;

  @IsString()
  @IsOptional()
  note?: string;

  @IsIn(['DRAFT', 'IN_PROGRESS', 'READY', 'COMPLETED', 'CANCELLED'])
  @IsOptional()
  status?: 'DRAFT' | 'IN_PROGRESS' | 'READY' | 'COMPLETED' | 'CANCELLED';

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateStockInOrderDetailDto)
  @IsOptional()
  details?: UpdateStockInOrderDetailDto[];
}
