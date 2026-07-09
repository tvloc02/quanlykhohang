import { IsString, IsOptional, IsArray, IsIn } from 'class-validator';

export class UpdateWarehouseDto {
  @IsString()
  @IsOptional()
  code?: string;

  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsIn(['active', 'inactive'])
  @IsOptional()
  status?: 'active' | 'inactive';

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  managerIds?: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  staffIds?: string[];
}
