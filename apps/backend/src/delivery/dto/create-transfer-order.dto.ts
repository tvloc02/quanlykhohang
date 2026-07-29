import type { TransferOrderStatus } from '../entities/delivery-order.entity';

export type TransferOrderItemDto = {
  id: string;
  productCode: string;
  productName: string;
  unit: string;
  quantity: number;
};

export class CreateTransferOrderDto {
  transferNo?: string;
  requestId?: string;
  requestNumber?: string;
  sourceWarehouse: string;
  destinationWarehouse: string;
  scheduledDate?: string;
  status?: TransferOrderStatus;
  note?: string;
  createdBy?: string;
  items?: TransferOrderItemDto[];
}

export class UpdateTransferOrderDto extends CreateTransferOrderDto {}
