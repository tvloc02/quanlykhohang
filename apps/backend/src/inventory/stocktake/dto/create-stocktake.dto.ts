import { IsArray, IsBoolean, IsDateString, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateStocktakeDto {
  @IsNotEmpty()
  @IsString()
  locationCode: string;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsDateString()
  plannedDate?: string;

  @IsOptional()
  @IsString()
  assignee?: string;

  @IsOptional()
  @IsString()
  createdBy?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  productIds?: string[];

  @IsOptional()
  @IsBoolean()
  isRequest?: boolean;

  @IsOptional()
  @IsString()
  branch?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsString()
  purpose?: string;

  @IsOptional()
  @IsString()
  reference?: string;

  @IsOptional()
  @IsString()
  checkBy?: string;

  @IsOptional()
  @IsString()
  detailBy?: string;
}
