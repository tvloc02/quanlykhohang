import { IsOptional, IsString, IsDateString, IsArray, ValidateNested, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class OutboundItemDto {
  @IsString()
  productId: string;

  @IsInt()
  @Min(1)
  requiredQty: number;

  @IsOptional()
  @IsString()
  warehouseCode?: string;

  @IsOptional()
  unitPrice?: number;
}

export class CreateOutboundOrderDto {
  @IsOptional()
  @IsString()
  orderNo?: string;

  @IsOptional()
  @IsString()
  customerId?: string;

  @IsOptional()
  @IsString()
  customer?: string;

  @IsOptional()
  @IsDateString()
  expectedDate?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  items?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OutboundItemDto)
  details?: OutboundItemDto[];
}
