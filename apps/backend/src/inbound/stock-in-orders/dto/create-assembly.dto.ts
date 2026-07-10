import { IsString, IsInt, IsOptional, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class AssemblyComponentDto {
  @IsString()
  detailId: string;

  @IsInt()
  @Type(() => Number)
  usedQty: number;
}

export class CreateAssemblyDto {
  @IsString()
  assembledProductId: string;

  @IsInt()
  @Type(() => Number)
  assembledQty: number;

  @IsString()
  @IsOptional()
  barcode?: string;

  @IsString()
  warehouseCode: string;

  @IsString()
  @IsOptional()
  note?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AssemblyComponentDto)
  components: AssemblyComponentDto[];
}
