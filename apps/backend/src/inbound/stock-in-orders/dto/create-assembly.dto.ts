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

export class StandaloneAssemblyComponentDto {
  @IsString()
  productId: string;

  @IsString()
  warehouseCode: string;

  @IsInt()
  @Type(() => Number)
  usedQty: number;
}

export class CreateStandaloneAssemblyDto {
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
  @Type(() => StandaloneAssemblyComponentDto)
  components: StandaloneAssemblyComponentDto[];
}

