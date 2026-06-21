export class CreateStockInOrderDto {
  sourcePurchaseOrderId: string;
  currentStepUserEmail?: string;
  nextStepUserEmail?: string;
  note?: string;
  orderCode?: string;
}
