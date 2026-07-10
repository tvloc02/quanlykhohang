import { IsString, IsInt, IsOptional, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class ReceiveItemDto {
  @IsString()
  detailId: string;

  @IsInt()
  qty: number;
}

export class ReceiveDto {
  @IsString()
  @IsOptional()
  detailId?: string;

  @IsInt()
  @IsOptional()
  qty?: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReceiveItemDto)
  @IsOptional()
  items?: ReceiveItemDto[];
}
