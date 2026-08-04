import { IsArray, IsOptional, IsString, IsNotEmpty, IsObject } from 'class-validator';

export class CreateProjectTeamDto {
  @IsOptional() @IsString() warehouseId?: string;
  @IsOptional() @IsString() warehouseCode?: string;
  @IsString() @IsNotEmpty() name: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsArray() storekeeperIds?: string[];
  @IsOptional() @IsArray() inventoryCheckerIds?: string[];
  @IsOptional() @IsArray() memberIds?: string[];
  @IsOptional() @IsObject() generalPermissions?: any;
  @IsOptional() @IsObject() menuPermissions?: any;
}
