import { IsNotEmpty, IsString, IsInt, Min } from 'class-validator';

export class AddOutboundDetailDto {
  @IsNotEmpty()
  @IsString()
  productId: string;

  @IsNotEmpty()
  @IsInt()
  @Min(1)
  requiredQty: number;
}
