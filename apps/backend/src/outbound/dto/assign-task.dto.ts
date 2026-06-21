import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class AssignTaskDto {
  @IsNotEmpty()
  @IsString()
  orderId: string;

  @IsOptional()
  @IsString()
  assignedTo?: string;
}
