import { IsArray, IsOptional, IsString, IsNotEmpty } from 'class-validator';

export class CreateProjectTeamDto {
  @IsString() @IsNotEmpty() warehouseId: string;
  @IsOptional() @IsString() warehouseCode?: string;
  @IsString() @IsNotEmpty() name: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsArray() storekeeperIds?: string[];
  @IsOptional() @IsArray() inventoryCheckerIds?: string[];
}
