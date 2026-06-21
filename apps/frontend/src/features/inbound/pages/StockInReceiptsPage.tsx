import React from 'react';
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  FilePlus2,
  History,
  Package,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  Truck,
} from 'lucide-react';

type Supplier = {
  id: string;
  supplierCode?: string;
  name: string;
};

type Product = {
  id: string;
  internalSku: string;
  name: string;
  unit?: string;
};

type StockInOrder = {
  id: string;
  orderCode: string;
  status: string;
  sourcePurchaseOrder?: {
    supplier?: Supplier | null;
  } | null;
  details: Array<{
    id: string;
    warehouseCode?: string;
    requestedQty: number;
    actualQty: number;
    unitPrice: number;
    product?: Product | null;
  }>;
};

type StockInReceiptDetail = {
  id: string;
  warehouseCode?: string;
  quantity: number;
  unitPrice: number;
  totalLineAmount: number;
  note?: string;
  product?: Product | null;
};

type StockInReceipt = {
  id: string;
  receiptCode: string;
  receiptType: 'PURCHASE_GOODS' | 'FINISHED_GOODS' | 'RETURNED_GOODS' | 'OTHER';
  warehouseCode?: string;
  sourceReferenceNo?: string;
  sourceStockInOrderId?: string;
  sourceStockInOrder?: {
    id: string;
    orderCode: string;
  } | null;
  supplier?: Supplier | null;
  receiptDate?: string;
  status: 'DRAFT' | 'POSTED';
  description?: string;
  totalAmount: number;
  postedAt?: string;
  createdAt?: string;
  updatedAt?: string;
  details: StockInReceiptDetail[];
  totalQuantity: number;
  logs: StockInReceiptLog[];
};

type StockInReceiptLog = {
  id: string;
  action: string;
  resource: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
  createdAt?: string;
  actorEmail?: string;
};

type ReceiptFormRow = {
  rowId: string;
  productId: string;
  warehouseCode: string;
  quantity: string;
  unitPrice: string;
  note: string;
};

type ReceiptForm = {
  receiptCode: string;
  receiptType: StockInReceipt['receiptType'];
  warehouseCode: string;
  supplierId: string;
  sourceStockInOrderId: string;
  sourceReferenceNo: string;
  receiptDate: string;
  status: StockInReceipt['status'];
  description: string;
  rows: ReceiptFormRow[];
};

type Toast = {
  type: 'success' | 'error';
  message: string;
};

const API_BASE_URL = 'http://localhost:3000/api';

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
  };
}

function formatDate(value?: string) {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleDateString('vi-VN');
}

function formatDateTime(value?: string) {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleString('vi-VN');
}

function formatMoney(value: number) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value || 0);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('vi-VN').format(value || 0);
}

function parseNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function receiptTypeLabel(value: StockInReceipt['receiptType']) {
  switch (value) {
    case 'FINISHED_GOODS':
      return 'Nhập kho thành phẩm';
    case 'RETURNED_GOODS':
      return 'Hàng bán bị trả lại';
    case 'OTHER':
      return 'Nhập khác';
    default:
      return 'Nhập kho mua hàng';
  }
}

function statusLabel(status?: string) {
  return (status || 'DRAFT') === 'POSTED' ? 'Đã ghi sổ' : 'Chưa ghi sổ';
}

function statusClass(status?: string) {
  return (status || 'DRAFT') === 'POSTED'
    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
    : 'border-amber-200 bg-amber-50 text-amber-700';
}

function logLabel(action?: string) {
  switch (action) {
    case 'receipt.create':
      return 'Tạo phiếu';
    case 'receipt.update':
      return 'Cập nhật phiếu';
    case 'receipt.post':
      return 'Ghi sổ phiếu';
    default:
      return action || 'Hoạt động';
  }
}

function makeRow(productId = '', warehouseCode = 'DEFAULT', quantity = '1', unitPrice = '0'): ReceiptFormRow {
  return {
    rowId: `${Date.now()}-${Math.random()}`,
    productId,
    warehouseCode,
    quantity,
    unitPrice,
    note: '',
  };
}

function buildEmptyForm(): ReceiptForm {
  return {
    receiptCode: '',
    receiptType: 'PURCHASE_GOODS',
    warehouseCode: 'DEFAULT',
    supplierId: '',
    sourceStockInOrderId: '',
    sourceReferenceNo: '',
    receiptDate: new Date().toISOString().slice(0, 10),
    status: 'DRAFT',
    description: '',
    rows: [makeRow()],
  };
}

function toFormFromReceipt(receipt: StockInReceipt): ReceiptForm {
  return {
    receiptCode: receipt.receiptCode,
    receiptType: receipt.receiptType,
    warehouseCode: receipt.warehouseCode || 'DEFAULT',
    supplierId: receipt.supplier?.id || '',
    sourceStockInOrderId: receipt.sourceStockInOrderId || '',
    sourceReferenceNo: receipt.sourceReferenceNo || '',
    receiptDate: receipt.receiptDate ? receipt.receiptDate.slice(0, 10) : new Date().toISOString().slice(0, 10),
    status: receipt.status,
    description: receipt.description || '',
    rows:
      receipt.details?.length
        ? receipt.details.map((detail) => ({
            rowId: `${detail.id}-${Date.now()}`,
            productId: detail.product?.id || '',
            warehouseCode: detail.warehouseCode || receipt.warehouseCode || 'DEFAULT',
            quantity: String(detail.quantity || 0),
            unitPrice: String(detail.unitPrice || 0),
            note: detail.note || '',
          }))
        : [makeRow()],
  };
}

export default function StockInReceiptsPage({ receiptTypeFilter }: { receiptTypeFilter?: StockInReceipt['receiptType'] }) {
  const [receipts, setReceipts] = React.useState<StockInReceipt[]>([]);
  const [stockInOrders, setStockInOrders] = React.useState<StockInOrder[]>([]);
  const [selectedId, setSelectedId] = React.useState('');
  const [search, setSearch] = React.useState('');
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [toast, setToast] = React.useState<Toast | null>(null);
  const [form, setForm] = React.useState<ReceiptForm>(() => {
    const initial = buildEmptyForm();
    return receiptTypeFilter ? { ...initial, receiptType: receiptTypeFilter } : initial;
  });
  const [createMode, setCreateMode] = React.useState<'manual' | 'from-order'>('manual');

  React.useEffect(() => {
    if (receiptTypeFilter) {
      setForm((current) => ({ ...current, receiptType: receiptTypeFilter }));
    }
  }, [receiptTypeFilter]);

  React.useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const loadData = React.useCallback(async () => {
    setLoading(true);
    try {
      const [receiptsResponse, ordersResponse] = await Promise.all([
        fetch(`${API_BASE_URL}/inbound/stock-in-receipts`, { headers: authHeaders() }),
        fetch(`${API_BASE_URL}/inbound/stock-in-orders`, { headers: authHeaders() }),
      ]);

      if (!receiptsResponse.ok) {
        const data = await receiptsResponse.json().catch(() => null);
        throw new Error(data?.message || 'Không tải được danh sách phiếu nhập kho');
      }
      if (!ordersResponse.ok) {
        const data = await ordersResponse.json().catch(() => null);
        throw new Error(data?.message || 'Không tải được danh sách lệnh nhập kho');
      }

      setReceipts((await receiptsResponse.json()) as StockInReceipt[]);
      setStockInOrders((await ordersResponse.json()) as StockInOrder[]);
    } catch (error) {
      setToast({ type: 'error', message: error instanceof Error ? error.message : 'Lỗi tải dữ liệu' });
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  React.useEffect(() => {
    if (!selectedId && receipts[0]) {
      setSelectedId(receipts[0].id);
    }
    if (selectedId && !receipts.some((receipt) => receipt.id === selectedId)) {
      setSelectedId(receipts[0]?.id || '');
    }
  }, [receipts, selectedId]);

  React.useEffect(() => {
    const selectedReceipt = receipts.find((receipt) => receipt.id === selectedId);
    if (selectedReceipt) {
      setForm(toFormFromReceipt(selectedReceipt));
    }
  }, [receipts, selectedId]);

  const displayReceipts = React.useMemo(
    () => (receiptTypeFilter ? receipts.filter((receipt) => receipt.receiptType === receiptTypeFilter) : receipts),
    [receipts, receiptTypeFilter],
  );

  const selectedReceipt = React.useMemo(
    () => displayReceipts.find((receipt) => receipt.id === selectedId) || displayReceipts[0] || null,
    [displayReceipts, selectedId],
  );

  React.useEffect(() => {
    if (!selectedId && displayReceipts[0]) {
      setSelectedId(displayReceipts[0].id);
    }
    if (selectedId && !displayReceipts.some((receipt) => receipt.id === selectedId)) {
      setSelectedId(displayReceipts[0]?.id || '');
    }
  }, [displayReceipts, selectedId]);

  const filteredReceipts = React.useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return displayReceipts;
    return displayReceipts.filter((receipt) => {
      const supplierName = receipt.supplier?.name || '';
      return (
        receipt.receiptCode.toLowerCase().includes(keyword) ||
        receipt.receiptType.toLowerCase().includes(keyword) ||
        supplierName.toLowerCase().includes(keyword) ||
        receipt.sourceReferenceNo?.toLowerCase().includes(keyword) ||
        receipt.description?.toLowerCase().includes(keyword)
      );
    });
  }, [displayReceipts, search]);

  const stats = React.useMemo(() => {
    const total = displayReceipts.length;
    const posted = displayReceipts.filter((receipt) => receipt.status === 'POSTED').length;
    const draft = displayReceipts.filter((receipt) => receipt.status === 'DRAFT').length;
    const totalAmount = displayReceipts.reduce((sum, receipt) => sum + receipt.totalAmount, 0);
    return { total, posted, draft, totalAmount };
  }, [displayReceipts]);

  const pageTitle = receiptTypeFilter === 'RETURNED_GOODS' ? 'Đề nghị nhập kho hàng trả lại' : 'Lập phiếu nhập kho';
  const pageDescription =
    receiptTypeFilter === 'RETURNED_GOODS'
      ? 'Quản lý phiếu nhập kho của hàng trả lại, phù hợp với luồng đồng bộ đơn trả hàng từ CRM.'
      : 'Lưu nháp phiếu nhập kho mua hàng, thành phẩm, hàng trả lại hoặc nhập khác. Có thể kế thừa từ lệnh nhập kho và ghi sổ để cập nhật tồn kho.';

  const addRow = () => setForm((current) => ({ ...current, rows: [...current.rows, makeRow()] }));

  const updateRow = (rowId: string, patch: Partial<ReceiptFormRow>) => {
    setForm((current) => ({
      ...current,
      rows: current.rows.map((row) => (row.rowId === rowId ? { ...row, ...patch } : row)),
    }));
  };

  const removeRow = (rowId: string) => {
    setForm((current) => ({
      ...current,
      rows: current.rows.length > 1 ? current.rows.filter((row) => row.rowId !== rowId) : [makeRow()],
    }));
  };

  const selectedOrder = React.useMemo(
    () => stockInOrders.find((order) => order.id === form.sourceStockInOrderId) || null,
    [form.sourceStockInOrderId, stockInOrders],
  );

  React.useEffect(() => {
    if (createMode === 'from-order' && selectedOrder) {
      setForm((current) => ({
        ...current,
        receiptType: receiptTypeFilter || 'PURCHASE_GOODS',
        warehouseCode: selectedOrder.details[0]?.warehouseCode || current.warehouseCode,
        supplierId: selectedOrder.sourcePurchaseOrder?.supplier?.id || current.supplierId,
        sourceReferenceNo: selectedOrder.orderCode,
        rows: selectedOrder.details.length
          ? selectedOrder.details.map((detail) =>
              makeRow(detail.product?.id || '', detail.warehouseCode || current.warehouseCode, String(detail.actualQty || detail.requestedQty || 0), String(detail.unitPrice || 0)),
            )
          : [makeRow()],
      }));
    }
  }, [createMode, selectedOrder, receiptTypeFilter]);

  const buildPayload = () => ({
    receiptCode: form.receiptCode.trim() || undefined,
    receiptType: form.receiptType,
    warehouseCode: form.warehouseCode.trim() || undefined,
    supplierId: form.supplierId || undefined,
    sourceStockInOrderId: form.sourceStockInOrderId || undefined,
    sourceReferenceNo: form.sourceReferenceNo.trim() || undefined,
    receiptDate: form.receiptDate,
    status: form.status,
    description: form.description.trim() || undefined,
    items: form.rows
      .filter((row) => row.productId && parseNumber(row.quantity) > 0)
      .map((row) => ({
        productId: row.productId,
        warehouseCode: row.warehouseCode.trim() || undefined,
        quantity: parseNumber(row.quantity),
        unitPrice: parseNumber(row.unitPrice),
        note: row.note.trim() || undefined,
      })),
  });

  const saveReceipt = async (mode: 'save' | 'post') => {
    const payload = buildPayload();
    if (!payload.warehouseCode) {
      setToast({ type: 'error', message: 'Kho nhập là bắt buộc' });
      return;
    }
    if (payload.items.length === 0 && !payload.sourceStockInOrderId) {
      setToast({ type: 'error', message: 'Phiếu cần ít nhất một dòng hàng hoặc kế thừa từ lệnh nhập kho' });
      return;
    }

    setSaving(true);
    try {
      const isEdit = Boolean(selectedReceipt && selectedReceipt.status === 'DRAFT' && selectedReceipt.id === selectedId);
      const url = isEdit ? `${API_BASE_URL}/inbound/stock-in-receipts/${selectedReceipt!.id}` : `${API_BASE_URL}/inbound/stock-in-receipts`;
      const response = await fetch(url, {
        method: isEdit ? 'PUT' : 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ ...payload, status: mode === 'post' ? 'POSTED' : 'DRAFT' }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.message || 'Không lưu được phiếu nhập kho');
      }

      const result = (await response.json()) as StockInReceipt;
      setToast({ type: 'success', message: mode === 'post' ? 'Đã ghi sổ phiếu nhập kho' : 'Đã lưu phiếu nhập kho' });
      await loadData();
      setSelectedId(result.id);
      setForm(toFormFromReceipt(result));
    } catch (error) {
      setToast({ type: 'error', message: error instanceof Error ? error.message : 'Lỗi lưu phiếu nhập kho' });
    } finally {
      setSaving(false);
    }
  };

  const inheritFromOrder = async () => {
    if (!form.sourceStockInOrderId) {
      setToast({ type: 'error', message: 'Hãy chọn lệnh nhập kho để kế thừa' });
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(`${API_BASE_URL}/inbound/stock-in-receipts/from-stock-in-orders/${form.sourceStockInOrderId}`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          warehouseCode: form.warehouseCode,
          receiptCode: form.receiptCode || undefined,
          description: form.description || undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.message || 'Không tạo được phiếu từ lệnh nhập kho');
      }

      const result = (await response.json()) as StockInReceipt;
      setToast({ type: 'success', message: `Đã sinh phiếu ${result.receiptCode}` });
      await loadData();
      setSelectedId(result.id);
      setForm(toFormFromReceipt(result));
    } catch (error) {
      setToast({ type: 'error', message: error instanceof Error ? error.message : 'Lỗi khi sinh phiếu' });
    } finally {
      setSaving(false);
    }
  };

  const postSelected = async () => {
    if (!selectedReceipt) return;
    setSaving(true);
    try {
      const response = await fetch(`${API_BASE_URL}/inbound/stock-in-receipts/${selectedReceipt.id}/post`, {
        method: 'POST',
        headers: authHeaders(),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.message || 'Không ghi sổ được phiếu nhập kho');
      }
      const result = (await response.json()) as StockInReceipt;
      setToast({ type: 'success', message: 'Đã ghi sổ phiếu nhập kho' });
      await loadData();
      setSelectedId(result.id);
      setForm(toFormFromReceipt(result));
    } catch (error) {
      setToast({ type: 'error', message: error instanceof Error ? error.message : 'Lỗi ghi sổ' });
    } finally {
      setSaving(false);
    }
  };

  const isDraft = selectedReceipt?.status === 'DRAFT';
  const selectedOrderCount = stockInOrders.filter((order) => order.status === 'COMPLETED').length;

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
        <div className="grid gap-6 bg-gradient-to-r from-cyan-600 via-sky-600 to-indigo-600 px-6 py-6 text-white md:grid-cols-[1.2fr_0.8fr] md:px-8">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em]">
              <Package className="h-4 w-4" />
              {pageTitle}
            </div>
            <h1 className="mt-4 text-3xl font-black leading-tight md:text-4xl">{pageTitle}</h1>
            <p className="mt-3 max-w-2xl text-sm font-medium text-white/85">{pageDescription}</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <MetricCard label="Tổng phiếu" value={formatNumber(stats.total)} />
            <MetricCard label="Đã ghi sổ" value={formatNumber(stats.posted)} />
            <MetricCard label="Nháp" value={formatNumber(stats.draft)} />
            <MetricCard label="Từ lệnh" value={formatNumber(selectedOrderCount)} />
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[330px_1fr_360px]">
        <div className="space-y-6">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-black text-slate-900">Danh sách phiếu</h2>
                <p className="text-sm font-medium text-slate-500">Chọn phiếu để xem chi tiết.</p>
              </div>
              <button
                type="button"
                onClick={loadData}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Tìm phiếu"
                className="h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm outline-none transition focus:border-cyan-500 focus:bg-white"
              />
            </div>

            <div className="mt-4 space-y-3">
              {loading && <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">Đang tải...</div>}
              {!loading && filteredReceipts.length === 0 && (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">Chưa có phiếu nhập kho.</div>
              )}
              {filteredReceipts.map((receipt) => {
                const active = receipt.id === selectedReceipt?.id;
                return (
                  <button
                    key={receipt.id}
                    type="button"
                    onClick={() => setSelectedId(receipt.id)}
                    className={`w-full rounded-2xl border p-4 text-left transition ${
                      active ? 'border-cyan-300 bg-cyan-50 shadow-sm' : 'border-slate-200 bg-white hover:border-cyan-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-black text-slate-900">{receipt.receiptCode}</div>
                        <div className="mt-1 text-xs font-medium text-slate-500">{receiptTypeLabel(receipt.receiptType)}</div>
                      </div>
                      <span className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${statusClass(receipt.status)}`}>
                        {statusLabel(receipt.status)}
                      </span>
                    </div>
                    <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                      <span>{receipt.supplier?.name || receipt.sourceReferenceNo || 'Phiếu thủ công'}</span>
                      <span>{formatDate(receipt.receiptDate)}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-600">
                <FilePlus2 className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-black text-slate-900">Tạo phiếu mới</h3>
                <p className="text-sm font-medium text-slate-500">Chọn loại phiếu rồi khai báo thông tin chung.</p>
              </div>
            </div>

            <div className="mt-4 space-y-4">
              <div>
                <label className="mb-2 block text-sm font-bold text-slate-700">Kiểu tạo</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setCreateMode('manual')}
                    className={`rounded-2xl border px-3 py-3 text-sm font-bold transition ${
                      createMode === 'manual' ? 'border-cyan-300 bg-cyan-50 text-cyan-700' : 'border-slate-200 bg-white text-slate-600'
                    }`}
                  >
                    Thủ công
                  </button>
                  <button
                    type="button"
                    onClick={() => setCreateMode('from-order')}
                    className={`rounded-2xl border px-3 py-3 text-sm font-bold transition ${
                      createMode === 'from-order' ? 'border-cyan-300 bg-cyan-50 text-cyan-700' : 'border-slate-200 bg-white text-slate-600'
                    }`}
                  >
                    Từ lệnh
                  </button>
                </div>
              </div>

              <SelectField
                label="Loại phiếu"
                value={form.receiptType}
                onChange={(value) => setForm((current) => ({ ...current, receiptType: value as ReceiptForm['receiptType'] }))}
                options={
                  receiptTypeFilter
                    ? [[receiptTypeFilter, receiptTypeLabel(receiptTypeFilter)]]
                    : [
                        ['PURCHASE_GOODS', 'Nhập kho mua hàng'],
                        ['FINISHED_GOODS', 'Nhập kho thành phẩm'],
                        ['RETURNED_GOODS', 'Hàng bán bị trả lại'],
                        ['OTHER', 'Nhập khác'],
                      ]
                }
                disabled={Boolean(receiptTypeFilter)}
              />
              <InputField label="Kho nhập" value={form.warehouseCode} onChange={(value) => setForm((current) => ({ ...current, warehouseCode: value }))} />
              <InputField
                label="Ngày nhập"
                type="date"
                value={form.receiptDate}
                onChange={(value) => setForm((current) => ({ ...current, receiptDate: value }))}
              />
              <InputField
                label="Mã phiếu"
                value={form.receiptCode}
                onChange={(value) => setForm((current) => ({ ...current, receiptCode: value }))}
                placeholder="Để trống để hệ thống tự sinh"
              />

              {createMode === 'manual' ? (
                <>
                  <InputField label="Mã NCC" value={form.supplierId} onChange={(value) => setForm((current) => ({ ...current, supplierId: value }))} />
                  <InputField
                    label="Tham chiếu"
                    value={form.sourceReferenceNo}
                    onChange={(value) => setForm((current) => ({ ...current, sourceReferenceNo: value }))}
                    placeholder="Số đơn / lệnh / chứng từ"
                  />
                </>
              ) : (
                <div>
                  <label className="mb-2 block text-sm font-bold text-slate-700">Lệnh nhập kho</label>
                  <select
                    value={form.sourceStockInOrderId}
                    onChange={(event) => setForm((current) => ({ ...current, sourceStockInOrderId: event.target.value }))}
                    className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 outline-none transition focus:border-cyan-500"
                  >
                    <option value="">Chọn lệnh</option>
                    {stockInOrders
                      .filter((order) => order.status === 'COMPLETED')
                      .map((order) => (
                        <option key={order.id} value={order.id}>
                          {order.orderCode} - {order.sourcePurchaseOrder?.supplier?.name || 'Không có NCC'}
                        </option>
                      ))}
                  </select>
                </div>
              )}

              <div>
                <label className="mb-2 block text-sm font-bold text-slate-700">Diễn giải</label>
                <textarea
                  value={form.description}
                  onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                  className="min-h-24 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-cyan-500"
                  placeholder="Lý do nhập kho, ghi chú..."
                />
              </div>

              {createMode === 'from-order' && (
                <button
                  type="button"
                  onClick={inheritFromOrder}
                  disabled={saving}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-cyan-600 px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-cyan-700 disabled:opacity-60"
                >
                  <ArrowRight className="h-4 w-4" />
                  Kế thừa dữ liệu từ lệnh
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          {selectedReceipt ? (
            <>
              <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="text-2xl font-black text-slate-900">{selectedReceipt.receiptCode}</h2>
                    <span className={`rounded-full border px-3 py-1 text-xs font-bold ${statusClass(selectedReceipt.status)}`}>
                      {statusLabel(selectedReceipt.status)}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-sm font-medium text-slate-500">
                    <span>{receiptTypeLabel(selectedReceipt.receiptType)}</span>
                    <span>•</span>
                    <span>Kho {selectedReceipt.warehouseCode || '-'}</span>
                    <span>•</span>
                    <span>Ngày nhập {formatDate(selectedReceipt.receiptDate)}</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <MiniStat label="Dòng hàng" value={formatNumber(selectedReceipt.details.length)} />
                  <MiniStat label="Số lượng" value={formatNumber(selectedReceipt.totalQuantity)} />
                  <MiniStat label="Giá trị" value={formatMoney(selectedReceipt.totalAmount)} />
                  <MiniStat label="Nguồn" value={selectedReceipt.sourceStockInOrder?.orderCode || '-'} />
                </div>
              </div>

              <div className="mt-5 space-y-5">
                <div className="grid gap-4 md:grid-cols-2">
                  <InfoCard label="Nhà cung cấp" value={selectedReceipt.supplier?.name || '-'} />
                  <InfoCard label="Tham chiếu" value={selectedReceipt.sourceReferenceNo || '-'} />
                  <InfoCard label="Ngày ghi sổ" value={formatDateTime(selectedReceipt.postedAt)} />
                  <InfoCard label="Cập nhật" value={formatDateTime(selectedReceipt.updatedAt)} />
                </div>

                <div className="overflow-hidden rounded-3xl border border-slate-200">
                  <div className="overflow-x-auto">
                    <table className="min-w-full border-collapse bg-white">
                      <thead className="bg-slate-50">
                        <tr className="text-left text-xs font-black uppercase tracking-wide text-slate-600">
                          <th className="px-4 py-3">Mã hàng</th>
                          <th className="px-4 py-3">Tên hàng</th>
                          <th className="px-4 py-3 text-right">Số lượng</th>
                          <th className="px-4 py-3 text-right">Đơn giá</th>
                          <th className="px-4 py-3 text-right">Thành tiền</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedReceipt.details.map((detail) => (
                          <tr key={detail.id} className="border-t border-slate-200">
                            <td className="px-4 py-3 text-sm font-bold text-slate-800">{detail.product?.internalSku || '-'}</td>
                            <td className="px-4 py-3">
                              <div className="text-sm font-semibold text-slate-900">{detail.product?.name || '-'}</div>
                              <div className="text-xs text-slate-500">{detail.note || detail.product?.unit || '-'}</div>
                            </td>
                            <td className="px-4 py-3 text-right text-sm font-bold text-slate-700">{formatNumber(detail.quantity)}</td>
                            <td className="px-4 py-3 text-right text-sm font-bold text-slate-700">{formatMoney(detail.unitPrice)}</td>
                            <td className="px-4 py-3 text-right text-sm font-black text-slate-900">{formatMoney(detail.totalLineAmount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={saveReceipt.bind(null, 'save')}
                    disabled={saving || !isDraft}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Lưu nháp
                  </button>
                  <button
                    type="button"
                    onClick={postSelected}
                    disabled={saving || selectedReceipt.status === 'POSTED'}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:opacity-60"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Ghi sổ
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex min-h-[520px] items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-slate-50">
              <div className="text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-white text-cyan-600 shadow-sm">
                  <Package className="h-8 w-8" />
                </div>
                <h3 className="mt-4 text-xl font-black text-slate-900">Chưa có phiếu nhập kho</h3>
                <p className="mt-2 text-sm text-slate-500">Tạo phiếu mới ở cột bên trái hoặc kế thừa từ lệnh nhập kho đã hoàn thành.</p>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-600">
                <ShieldAlert className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-black text-slate-900">Kiểm soát</h3>
                <p className="text-sm font-medium text-slate-500">Kho nhập là bắt buộc trước khi ghi sổ.</p>
              </div>
            </div>
            <div className="mt-4 space-y-2 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
              <div>Kho nhập: <span className="font-black text-slate-900">{selectedReceipt?.warehouseCode || form.warehouseCode || '-'}</span></div>
              <div>Loại phiếu: <span className="font-black text-slate-900">{selectedReceipt ? receiptTypeLabel(selectedReceipt.receiptType) : receiptTypeLabel(form.receiptType)}</span></div>
              <div>Trạng thái: <span className="font-black text-slate-900">{selectedReceipt ? statusLabel(selectedReceipt.status) : statusLabel(form.status)}</span></div>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <History className="h-4 w-4 text-cyan-600" />
              <h3 className="text-sm font-black text-slate-900">Lịch sử hoạt động</h3>
            </div>
            <div className="mt-4 space-y-4">
              {selectedReceipt?.logs?.length ? (
                selectedReceipt.logs.map((log) => (
                  <div key={log.id} className="flex gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-500">
                      <Clock3 className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-bold text-slate-900">{logLabel(log.action)}</div>
                      <div className="text-xs text-slate-500">{log.actorEmail || 'Hệ thống'} • {formatDateTime(log.createdAt)}</div>
                      {log.metadata && <pre className="mt-2 overflow-x-auto rounded-2xl bg-slate-50 p-3 text-[11px] leading-5 text-slate-600">{JSON.stringify(log.metadata, null, 2)}</pre>}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-sm text-slate-500">Chưa có lịch sử.</div>
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <Truck className="h-4 w-4 text-cyan-600" />
              <h3 className="text-sm font-black text-slate-900">Lệnh nhập kho hoàn thành</h3>
            </div>
            <div className="mt-3 space-y-2">
              {stockInOrders.filter((order) => order.status === 'COMPLETED').slice(0, 5).map((order) => (
                <button
                  key={order.id}
                  type="button"
                  onClick={() => setForm((current) => ({ ...current, sourceStockInOrderId: order.id }))}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-left text-sm transition hover:border-cyan-200 hover:bg-cyan-50"
                >
                  <div className="font-bold text-slate-900">{order.orderCode}</div>
                  <div className="text-xs text-slate-500">{order.sourcePurchaseOrder?.supplier?.name || 'Không có NCC'}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="space-y-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2">
          <Plus className="h-4 w-4 text-cyan-600" />
          <h3 className="text-sm font-black text-slate-900">Chi tiết phiếu đang lập</h3>
        </div>
        <div className="overflow-hidden rounded-3xl border border-slate-200">
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse bg-white">
              <thead className="bg-slate-50">
                <tr className="text-left text-xs font-black uppercase tracking-wide text-slate-600">
                  <th className="px-4 py-3">#</th>
                  <th className="px-4 py-3">Mã hàng</th>
                  <th className="px-4 py-3">Kho</th>
                  <th className="px-4 py-3 text-right">Số lượng</th>
                  <th className="px-4 py-3 text-right">Đơn giá</th>
                  <th className="px-4 py-3">Ghi chú</th>
                  <th className="px-4 py-3">Xóa</th>
                </tr>
              </thead>
              <tbody>
                {form.rows.map((row, index) => (
                  <tr key={row.rowId} className="border-t border-slate-200">
                    <td className="px-4 py-3 text-sm font-bold text-slate-700">{index + 1}</td>
                    <td className="px-4 py-3">
                      <input
                        value={row.productId}
                        onChange={(event) => updateRow(row.rowId, { productId: event.target.value })}
                        placeholder="Mã hàng"
                        className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none transition focus:border-cyan-500"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        value={row.warehouseCode}
                        onChange={(event) => updateRow(row.rowId, { warehouseCode: event.target.value })}
                        className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none transition focus:border-cyan-500"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        min={0}
                        value={row.quantity}
                        onChange={(event) => updateRow(row.rowId, { quantity: event.target.value })}
                        className="h-10 w-full rounded-xl border border-slate-200 px-3 text-right text-sm outline-none transition focus:border-cyan-500"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        min={0}
                        value={row.unitPrice}
                        onChange={(event) => updateRow(row.rowId, { unitPrice: event.target.value })}
                        className="h-10 w-full rounded-xl border border-slate-200 px-3 text-right text-sm outline-none transition focus:border-cyan-500"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        value={row.note}
                        onChange={(event) => updateRow(row.rowId, { note: event.target.value })}
                        className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none transition focus:border-cyan-500"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => removeRow(row.rowId)}
                        className="rounded-full border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 transition hover:bg-rose-100"
                      >
                        Xóa
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={addRow}
            className="inline-flex items-center gap-2 rounded-2xl border border-cyan-200 bg-cyan-50 px-4 py-2.5 text-sm font-bold text-cyan-700 transition hover:bg-cyan-100"
          >
            <Plus className="h-4 w-4" />
            Thêm dòng
          </button>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => saveReceipt('save')}
              disabled={saving}
              className="rounded-2xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
            >
              Lưu
            </button>
            <button
              type="button"
              onClick={() => saveReceipt('post')}
              disabled={saving}
              className="rounded-2xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:opacity-60"
            >
              Ghi sổ ngay
            </button>
          </div>
        </div>
      </div>

      {toast && <ToastBubble toast={toast} />}
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/15 bg-white/12 px-4 py-4 backdrop-blur-sm">
      <div className="text-xs font-bold uppercase tracking-wide text-white/70">{label}</div>
      <div className="mt-2 text-2xl font-black text-white">{value}</div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
      <div className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-base font-black text-slate-900">{value}</div>
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
      <div className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-sm font-black text-slate-900">{value}</div>
    </div>
  );
}

function InputField({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: React.InputHTMLAttributes<HTMLInputElement>['type'];
  placeholder?: string;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-bold text-slate-700">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none transition focus:border-cyan-500"
      />
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<[string, string]>;
  disabled?: boolean;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-bold text-slate-700">{label}</label>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 outline-none transition focus:border-cyan-500 disabled:cursor-not-allowed disabled:bg-slate-100"
      >
        {options.map(([optionValue, labelText]) => (
          <option key={optionValue} value={optionValue}>
            {labelText}
          </option>
        ))}
      </select>
    </div>
  );
}

function ToastBubble({ toast }: { toast: Toast }) {
  return (
    <div
      className={`fixed bottom-6 right-6 z-50 rounded-2xl border px-4 py-3 shadow-xl ${
        toast.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-rose-200 bg-rose-50 text-rose-700'
      }`}
    >
      <div className="text-sm font-semibold">{toast.message}</div>
    </div>
  );
}
