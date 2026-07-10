import { IsInt } from 'class-validator';
import { Type } from 'class-transformer';

export class RecountAssemblyDto {
  @IsInt()
  @Type(() => Number)
  countedQty: number;
}
