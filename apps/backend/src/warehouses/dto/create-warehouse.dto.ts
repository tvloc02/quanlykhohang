import { IsString, IsOptional, IsArray, IsIn, IsNotEmpty } from 'class-validator';

export class CreateWarehouseDto {
  @IsString()
  @IsOptional()
  id?: string;

  @IsString()
  @IsNotEmpty()
  code: string;

  @IsString()
  @IsNotEmpty()
  name: string;

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
