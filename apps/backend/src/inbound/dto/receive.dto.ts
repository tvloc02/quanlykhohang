import { IsNotEmpty, IsString, IsInt } from 'class-validator';

export class ReceiveDto {
  @IsString()
  detailId?: string;

  @IsInt()
  qty?: number;

  items?: Array<{
    detailId: string;
    qty: number;
  }>;
}
