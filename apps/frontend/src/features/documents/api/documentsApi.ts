const API_BASE = 'http://localhost:3000/api';

function getAuthHeaders() {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export type SalesInvoiceDoc = {
  id: string;
  invoiceNo: string;
  invoiceName: string;
  orderCode: string;
  customerName: string;
  customerTaxCode: string;
  address: string;
  issuedDate: string;
  paymentMethod: string;
  status: string;
  items: Array<{
    id: string;
    productCode: string;
    productName: string;
    unit: string;
    quantity: number;
    unitPrice: number;
    taxRate: number;
  }>;
};

export type StockInDoc = {
  id: string;
  receiptNo: string;
  supplierName: string;
  warehouseName: string;
  delivererName: string;
  createdDate: string;
  note: string;
  status: string;
  items: Array<{
    id: string;
    productCode: string;
    productName: string;
    unit: string;
    quantityExpected: number;
    quantityActual: number;
    unitPrice: number;
  }>;
};

export type StockOutDoc = {
  id: string;
  noteNo: string;
  receiverName: string;
  destinationAddress: string;
  exportWarehouse: string;
  createdDate: string;
  reason: string;
  status: string;
  items: Array<{
    id: string;
    productCode: string;
    productName: string;
    unit: string;
    quantity: number;
    unitPrice: number;
  }>;
};

export type TransferDoc = {
  id: string;
  transferNo: string;
  commandNo: string;
  sourceWarehouse: string;
  destinationWarehouse: string;
  destinationAddress?: string;
  transporterName: string;
  createdDate: string;
  note: string;
  status: string;
  items: Array<{
    id: string;
    productCode: string;
    productName: string;
    unit: string;
    quantityExported: number;
    quantityImported: number;
    price: number;
  }>;
};

export const documentsApi = {
  async getSalesInvoices(): Promise<SalesInvoiceDoc[]> {
    try {
      const res = await fetch(`${API_BASE}/documents/sales-invoices`, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) return data;
      }
    } catch (e) {
      console.warn('Fallback sales invoices fetch', e);
    }

    try {
      // Fallback directly to outbound orders
      const resOutbound = await fetch(`${API_BASE}/outbound/orders`, { headers: getAuthHeaders() });
      if (resOutbound.ok) {
        const list = await resOutbound.json();
        if (Array.isArray(list) && list.length > 0) {
          return list.map((item: any, idx: number) => ({
            id: item.id || String(idx),
            invoiceNo: item.orderNo || `HD-${new Date().getFullYear()}-${String(idx + 1).padStart(4, '0')}`,
            invoiceName: item.description || item.orderNo || 'Hóa đơn bán hàng',
            orderCode: item.orderNo || `SO-${item.id?.slice(0, 6) || '001'}`,
            customerName: item.customerName || item.customer?.name || item.receiver || 'Khách hàng',
            customerTaxCode: '0101234567',
            address: item.customerAddress || item.customer?.address || 'Việt Nam',
            issuedDate: item.orderDate || item.expectedDate || item.createdAt || new Date().toISOString(),
            paymentMethod: 'Chuyển khoản / Tiền mặt',
            status: item.status || 'COMPLETED',
            items: (item.details || []).map((d: any) => ({
              id: d.id || String(Math.random()),
              productCode: d.productSku || d.sku || d.product?.internalSku || d.product?.sku || 'SKU-001',
              productName: d.productName || d.product?.name || 'Sản phẩm kinh doanh',
              unit: d.unit || d.product?.unit || 'Cái',
              quantity: d.requiredQty || d.qty || d.pickedQty || 1,
              unitPrice: Number(d.unitPrice) || Number(d.price) || 0,
              taxRate: Number(d.vatPercent) || Number(item.vatRate) || 10,
            })),
          }));
        }
      }
    } catch (e) {
      console.error('Failed to fallback fetch outbound orders', e);
    }

    return [];
  },

  async getStockInNotes(): Promise<StockInDoc[]> {
    try {
      const res = await fetch(`${API_BASE}/documents/stock-in-notes`, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) return data;
      }
    } catch (e) {
      console.warn('Fallback stock-in fetch', e);
    }

    try {
      const resInbound = await fetch(`${API_BASE}/inbound/stock-in-orders`, { headers: getAuthHeaders() });
      if (resInbound.ok) {
        const list = await resInbound.json();
        if (Array.isArray(list) && list.length > 0) {
          return list.map((item: any, idx: number) => ({
            id: item.id || String(idx),
            receiptNo: item.orderCode || item.code || `PNK-${String(idx + 1).padStart(4, '0')}`,
            supplierName: item.supplierName || item.supplier?.name || 'Nhà cung cấp',
            warehouseName: item.targetWarehouseName || item.warehouseName || 'Kho Tổng',
            delivererName: item.currentStepUserEmail || item.createdByName || 'Nguyễn Văn A',
            createdDate: item.createdAt || new Date().toISOString(),
            note: item.note || 'Nhập kho hàng mua',
            status: item.status || 'COMPLETED',
            items: (item.details || []).map((d: any) => ({
              id: d.id || String(Math.random()),
              productCode: d.productSku || d.sku || d.product?.internalSku || 'SKU-IN',
              productName: d.productName || d.product?.name || 'Hàng nhập kho',
              unit: d.unit || d.product?.unit || 'Chiếc',
              quantityExpected: d.requestedQty || d.expectedQty || 1,
              quantityActual: d.actualQty || d.requestedQty || d.expectedQty || 1,
              unitPrice: Number(d.unitPrice) || 2500000,
            })),
          }));
        }
      }
    } catch (e) {
      console.error('Failed to fallback fetch inbound orders', e);
    }

    return [];
  },

  async getStockOutNotes(): Promise<StockOutDoc[]> {
    try {
      const res = await fetch(`${API_BASE}/documents/stock-out-notes`, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) return data;
      }
    } catch (e) {
      console.warn('Fallback stock-out fetch', e);
    }

    try {
      const resOutbound = await fetch(`${API_BASE}/outbound/orders`, { headers: getAuthHeaders() });
      if (resOutbound.ok) {
        const list = await resOutbound.json();
        if (Array.isArray(list) && list.length > 0) {
          return list.map((item: any, idx: number) => ({
            id: item.id || String(idx),
            noteNo: item.orderNo || `PXK-${new Date().getFullYear()}-${String(idx + 1).padStart(4, '0')}`,
            receiverName: item.receiver || item.customerName || item.customer?.name || 'Người nhận',
            destinationAddress: item.customerAddress || item.customer?.address || 'Kho nhận / Khách nhận',
            exportWarehouse: item.branchCode || item.details?.[0]?.warehouseCode || 'Kho Tổng',
            createdDate: item.orderDate || item.expectedDate || item.createdAt || new Date().toISOString(),
            reason: item.description || 'Xuất kho bán hàng',
            status: item.status || 'COMPLETED',
            items: (item.details || []).map((d: any) => ({
              id: d.id || String(Math.random()),
              productCode: d.productSku || d.sku || d.product?.internalSku || d.product?.sku || 'SKU-OUT',
              productName: d.productName || d.product?.name || 'Hàng xuất kho',
              unit: d.unit || d.product?.unit || 'Bộ',
              quantity: d.requiredQty || d.qty || d.pickedQty || 1,
              unitPrice: Number(d.unitPrice) || Number(d.price) || 0,
            })),
          }));
        }
      }
    } catch (e) {
      console.error('Failed to fallback fetch stock-out orders', e);
    }

    return [];
  },

  async getTransferNotes(): Promise<TransferDoc[]> {
    try {
      const res = await fetch(`${API_BASE}/documents/transfer-notes`, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) return data;
      }
    } catch (e) {
      console.warn('Fallback transfer fetch', e);
    }

    try {
      const resDelivery = await fetch(`${API_BASE}/delivery/transfer-orders`, { headers: getAuthHeaders() });
      if (resDelivery.ok) {
        const list = await resDelivery.json();
        if (Array.isArray(list) && list.length > 0) {
          return list.map((item: any) => ({
            id: item.id,
            transferNo: item.transferNo,
            commandNo: `LDD-${item.transferNo}`,
            sourceWarehouse: item.sourceWarehouse,
            destinationWarehouse: item.destinationWarehouse,
            transporterName: item.createdBy || 'Người điều chuyển',
            createdDate: item.createdAt || new Date().toISOString(),
            note: item.note || 'Điều chuyển nội bộ',
            status: item.status,
            items: (item.items || []).map((it: any, idx: number) => ({
              id: it.id || String(idx),
              productCode: it.productCode || 'SKU-TRF',
              productName: it.productName || 'Sản phẩm điều chuyển',
              unit: it.unit || 'Cái',
              quantityExported: Number(it.quantity) || 1,
              quantityImported: Number(it.quantity) || 1,
              price: 10000000,
            })),
          }));
        }
      }
    } catch (e) {
      console.error('Failed to fallback fetch transfer orders', e);
    }

    return [];
  },
};
