export class UpdateStockInOrderDto {
  currentStepUserEmail?: string;
  nextStepUserEmail?: string;
  note?: string;
  status?: 'DRAFT' | 'IN_PROGRESS' | 'READY' | 'COMPLETED' | 'CANCELLED';
  details?: Array<{
    id: string;
    warehouseCode?: string;
    requestedQty?: number;
    actualQty?: number;
    unitPrice?: number;
  }>;
}
