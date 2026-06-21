export type PurchaseOrderItemDto = {
  id?: string;
  productId?: string;
  supplierProductId?: string;
  warehouseCode?: string;
  expectedQty?: number;
  receivedQty?: number;
  unitPrice?: number;
};

export class CreateAsnDto {
  poNumber?: string;
  shipmentNumber?: string;
  supplierId?: string;
  orderDate?: string;
  expectedDate?: string;
  status?: string;
  description?: string;
  items?: PurchaseOrderItemDto[];
}
