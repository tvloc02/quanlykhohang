export type StockInReceiptType = 'PURCHASE_GOODS' | 'FINISHED_GOODS' | 'RETURNED_GOODS' | 'OTHER';

export class CreateStockInReceiptItemDto {
  productId: string;
  warehouseCode?: string;
  quantity: number;
  unitPrice?: number;
  note?: string;
}

export class CreateStockInReceiptDto {
  receiptCode?: string;
  receiptType: StockInReceiptType;
  warehouseCode: string;
  supplierId?: string;
  sourceStockInOrderId?: string;
  sourceReferenceNo?: string;
  receiptDate?: string;
  status?: 'DRAFT' | 'POSTED';
  description?: string;
  items?: CreateStockInReceiptItemDto[];
}
