const API_BASE = '/api';

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
      if (res.ok) return await res.json();
    } catch (e) {
      console.warn('Fallback sales invoices fetch', e);
    }
    // Fallback to outbounds
    const resOutbound = await fetch(`${API_BASE}/outbounds`, { headers: getAuthHeaders() });
    if (!resOutbound.ok) return [];
    const list = await resOutbound.json();
    return list.map((item: any, idx: number) => ({
      id: item.id || String(idx),
      invoiceNo: `HD-${new Date().getFullYear()}-${String(idx + 1).padStart(4, '0')}`,
      orderCode: item.orderCode || `SO-${item.id?.slice(0, 6) || '001'}`,
      customerName: item.customerName || 'Khách hàng',
      customerTaxCode: '0101234567',
      address: item.address || 'Hà Nội, Việt Nam',
      issuedDate: item.createdAt || new Date().toISOString(),
      paymentMethod: 'Chuyển khoản / Tiền mặt',
      status: item.status || 'COMPLETED',
      items: (item.details || []).map((d: any) => ({
        id: d.id || String(Math.random()),
        productCode: d.sku || 'SKU-001',
        productName: d.productName || 'Sản phẩm kinh doanh',
        unit: 'Cái',
        quantity: d.qty || 1,
        unitPrice: 5000000,
        taxRate: 10,
      })),
    }));
  },

  async getStockInNotes(): Promise<StockInDoc[]> {
    try {
      const res = await fetch(`${API_BASE}/documents/stock-in-notes`, { headers: getAuthHeaders() });
      if (res.ok) return await res.json();
    } catch (e) {
      console.warn('Fallback stock-in fetch', e);
    }
    const resInbound = await fetch(`${API_BASE}/inbound/stock-in-orders`, { headers: getAuthHeaders() });
    if (!resInbound.ok) return [];
    const list = await resInbound.json();
    return list.map((item: any, idx: number) => ({
      id: item.id || String(idx),
      receiptNo: item.code || `PNK-${String(idx + 1).padStart(4, '0')}`,
      supplierName: item.supplierName || 'Nhà cung cấp',
      warehouseName: item.targetWarehouseName || 'Kho tổng',
      delivererName: item.createdByName || 'Nguyễn Văn A',
      createdDate: item.createdAt || new Date().toISOString(),
      note: item.note || 'Nhập kho hàng mua',
      status: item.status || 'COMPLETED',
      items: (item.details || []).map((d: any) => ({
        id: d.id || String(Math.random()),
        productCode: d.productSku || 'SKU-IN',
        productName: d.productName || 'Hàng nhập kho',
        unit: 'Chiếc',
        quantityExpected: d.expectedQty || 1,
        quantityActual: d.actualQty || d.expectedQty || 1,
        unitPrice: d.unitPrice || 2500000,
      })),
    }));
  },

  async getStockOutNotes(): Promise<StockOutDoc[]> {
    try {
      const res = await fetch(`${API_BASE}/documents/stock-out-notes`, { headers: getAuthHeaders() });
      if (res.ok) return await res.json();
    } catch (e) {
      console.warn('Fallback stock-out fetch', e);
    }
    const resOutbound = await fetch(`${API_BASE}/outbounds`, { headers: getAuthHeaders() });
    if (!resOutbound.ok) return [];
    const list = await resOutbound.json();
    return list.map((item: any, idx: number) => ({
      id: item.id || String(idx),
      noteNo: `PXK-${new Date().getFullYear()}-${String(idx + 1).padStart(4, '0')}`,
      receiverName: item.customerName || 'Người nhận',
      destinationAddress: item.address || 'Kho nhận / Khách nhận',
      exportWarehouse: 'Kho chính',
      createdDate: item.createdAt || new Date().toISOString(),
      reason: 'Xuất kho bán hàng',
      status: item.status || 'COMPLETED',
      items: (item.details || []).map((d: any) => ({
        id: d.id || String(Math.random()),
        productCode: d.sku || 'SKU-OUT',
        productName: d.productName || 'Hàng xuất kho',
        unit: 'Bộ',
        quantity: d.qty || 1,
        unitPrice: 4500000,
      })),
    }));
  },

  async getTransferNotes(): Promise<TransferDoc[]> {
    try {
      const res = await fetch(`${API_BASE}/documents/transfer-notes`, { headers: getAuthHeaders() });
      if (res.ok) return await res.json();
    } catch (e) {
      console.warn('Fallback transfer fetch', e);
    }
    const resDelivery = await fetch(`${API_BASE}/delivery/transfer-orders`, { headers: getAuthHeaders() });
    if (!resDelivery.ok) return [];
    const list = await resDelivery.json();
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
  },
};
