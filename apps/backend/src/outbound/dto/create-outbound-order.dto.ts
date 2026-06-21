import { IsOptional, IsString, IsDateString } from 'class-validator';

export class CreateOutboundOrderDto {
  @IsOptional()
  @IsString()
  customerId?: string;

  @IsOptional()
  @IsDateString()
  expectedDate?: string;

  @IsOptional()
  @IsString()
  status?: string;
}
