import { IsArray, IsOptional, IsString } from 'class-validator';
import type { TransferOrderStatus } from '../entities/delivery-order.entity';

export type TransferOrderItemDto = {
  id: string;
  productCode: string;
  productName: string;
  unit: string;
  quantity: number;
  price?: number;
  locationBin?: string;
  assignedBins?: string[];
  note?: string;
};

export class CreateTransferOrderDto {
  @IsOptional()
  @IsString()
  transferNo?: string;

  @IsOptional()
  @IsString()
  requestId?: string;

  @IsOptional()
  @IsString()
  requestNumber?: string;

  @IsOptional()
  @IsString()
  sourceWarehouse?: string;

  @IsOptional()
  @IsString()
  destinationWarehouse?: string;

  @IsOptional()
  @IsString()
  scheduledDate?: string;

  @IsOptional()
  @IsString()
  orderDate?: string;

  @IsOptional()
  @IsString()
  createdAt?: string;

  @IsOptional()
  @IsString()
  dispatchDate?: string;

  @IsOptional()
  @IsString()
  receiveDate?: string;

  @IsOptional()
  @IsString()
  driverName?: string;

  @IsOptional()
  @IsString()
  driverPhone?: string;

  @IsOptional()
  @IsString()
  vehiclePlate?: string;

  @IsOptional()
  @IsString()
  status?: TransferOrderStatus;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsString()
  createdBy?: string;

  @IsOptional()
  @IsArray()
  items?: TransferOrderItemDto[];
}

export class UpdateTransferOrderDto extends CreateTransferOrderDto {}
