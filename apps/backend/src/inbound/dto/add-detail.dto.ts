import { IsNotEmpty, IsString, IsInt } from 'class-validator';

export class AddDetailDto {
  @IsNotEmpty()
  @IsString()
  productId: string;

  @IsNotEmpty()
  @IsInt()
  expectedQty: number;

  warehouseCode?: string;
  unitPrice?: number;
  receivedQty?: number;
  supplierProductId?: string;
}
