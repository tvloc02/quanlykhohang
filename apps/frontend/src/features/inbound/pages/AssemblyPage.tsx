import React from 'react';
import {
  ArrowRight,
  CheckCircle2,
  FileText,
  RefreshCw,
  Search,
  ShieldAlert,
  XCircle,
} from 'lucide-react';
import { getStoredWarehouses, type WarehouseRecord } from '../../../shared/utils/warehouseAssignments';

const API_BASE_URL = 'http://localhost:3000/api';

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
  };
}

function formatDateTime(value?: string) {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleString('vi-VN');
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('vi-VN').format(value || 0);
}

function parseNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function statusLabel(status?: string) {
  switch ((status || 'DRAFT').toUpperCase()) {
    case 'IN_PROGRESS':
      return 'Đang thực hiện';
    case 'READY':
      return 'Sẵn sàng';
    case 'COMPLETED':
      return 'Hoàn thành';
    case 'CANCELLED':
      return 'Đã hủy';
    default:
      return 'Nháp';
  }
}

function statusClass(status?: string) {
  switch ((status || 'DRAFT').toUpperCase()) {
    case 'IN_PROGRESS':
      return 'border-cyan-200 bg-cyan-50 text-cyan-700';
    case 'READY':
      return 'border-amber-200 bg-amber-50 text-amber-700';
    case 'COMPLETED':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    case 'CANCELLED':
      return 'border-rose-200 bg-rose-50 text-rose-700';
    default:
      return 'border-slate-200 bg-slate-50 text-slate-600';
  }
}

type Supplier = {
  id: string;
  supplierCode?: string;
  name?: string;
};

type StockInOrderDetail = {
  id: string;
  warehouseCode?: string;
  requestedQty: number;
  actualQty: number;
  unitPrice: number;
  totalLineAmount: number;
  product?: {
    id: string;
    internalSku: string;
    name: string;
    unit?: string;
  } | null;
};

type StockInOrderLog = {
  id: string;
  action: string;
  resource: string;
  createdAt?: string;
  actorEmail?: string;
  metadata?: Record<string, unknown>;
};

type StockInOrder = {
  id: string;
  orderCode: string;
  sourcePurchaseOrderId?: string;
  sourcePurchaseOrderNo?: string;
  sourcePurchaseOrder?: {
    id: string;
    poNumber?: string;
    supplier?: Supplier | null;
  } | null;
  status: 'DRAFT' | 'IN_PROGRESS' | 'READY' | 'COMPLETED' | 'CANCELLED';
  createdAt?: string;
  completedAt?: string;
  note?: string;
  details: StockInOrderDetail[];
  totalRequestedQty: number;
  totalActualQty: number;
  totalAmount: number;
  logs: StockInOrderLog[];
};

type Product = {
  id: string;
  internalSku: string;
  name: string;
};

type AssemblyDetail = {
  id: string;
  componentProduct?: {
    id: string;
    internalSku: string;
    name: string;
    unit?: string;
  } | null;
  usedQty: number;
  warehouseCode?: string;
};

type Assembly = {
  id: string;
  assemblyCode: string;
  assembledProduct?: {
    id: string;
    internalSku: string;
    name: string;
    unit?: string;
  } | null;
  warehouseCode: string;
  quantity: number;
  barcode?: string;
  note?: string;
  status: 'COMPLETED' | 'RECOUNTED';
  recountedQty?: number;
  recountedAt?: string;
  createdAt?: string;
  updatedAt?: string;
  details: AssemblyDetail[];
};

type AssemblyForm = {
  assembledProductId: string;
  assembledQty: string;
  barcode: string;
  warehouseCode: string;
  note: string;
  components: Record<string, string>;
};

type Toast = {
  type: 'success' | 'error';
  message: string;
};

export default function AssemblyPage({ mode: initialMode = 'production' }: { mode?: 'production' | 'distribution' }) {
  const [orders, setOrders] = React.useState<StockInOrder[]>([]);
  const [products, setProducts] = React.useState<Product[]>([]);
  const [selectedOrderId, setSelectedOrderId] = React.useState<string>('');
  const [assemblies, setAssemblies] = React.useState<Assembly[]>([]);
  const [selectedAssemblyId, setSelectedAssemblyId] = React.useState<string>('');
  const [assemblyForm, setAssemblyForm] = React.useState<AssemblyForm>({
    assembledProductId: '',
    assembledQty: '0',
    barcode: '',
    warehouseCode: '',
    note: '',
    components: {},
  });
  const [recountQty, setRecountQty] = React.useState('0');
  const [search, setSearch] = React.useState('');
  const mode = initialMode;
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [toast, setToast] = React.useState<Toast | null>(null);
  const [warehouses, setWarehouses] = React.useState<WarehouseRecord[]>(() => getStoredWarehouses());

  React.useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const loadData = React.useCallback(async () => {
    setLoading(true);
    try {
      const [ordersResponse, productsResponse] = await Promise.all([
        fetch(`${API_BASE_URL}/inbound/stock-in-orders`, { headers: authHeaders() }),
        fetch(`${API_BASE_URL}/products`, { headers: authHeaders() }),
      ]);

      if (!ordersResponse.ok) {
        const data = await ordersResponse.json().catch(() => null);
        throw new Error(data?.message || 'Không tải được danh sách lệnh nhập kho');
      }
      if (!productsResponse.ok) {
        const data = await productsResponse.json().catch(() => null);
        throw new Error(data?.message || 'Không tải được danh sách sản phẩm');
      }

      const ordersData = (await ordersResponse.json()) as StockInOrder[];
      const productsData = (await productsResponse.json()) as Product[];

      setOrders(ordersData);
      setProducts(productsData);
    } catch (error) {
      setToast({ type: 'error', message: error instanceof Error ? error.message : 'Lỗi tải dữ liệu' });
    } finally {
      setLoading(false);
    }
  }, []);

  const completedOrders = React.useMemo(
    () => orders.filter((order) => order.status === 'COMPLETED'),
    [orders],
  );

  const selectedOrder = React.useMemo(
    () => completedOrders.find((order) => order.id === selectedOrderId) || completedOrders[0] || null,
    [completedOrders, selectedOrderId],
  );

  const selectedAssembly = React.useMemo(
    () => assemblies.find((assembly) => assembly.id === selectedAssemblyId) || assemblies[0] || null,
    [assemblies, selectedAssemblyId],
  );

  React.useEffect(() => {
    if (selectedOrder) {
      setSelectedOrderId(selectedOrder.id);
    }
  }, [selectedOrder]);

  const loadAssemblies = React.useCallback(async (orderId?: string) => {
    if (!orderId) {
      setAssemblies([]);
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/inbound/stock-in-orders/${orderId}/assemblies`, {
        headers: authHeaders(),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.message || 'Không tải được danh sách sản phẩm phân phối');
      }
      const data = (await response.json()) as Assembly[];
      setAssemblies(data);
    } catch (error) {
      setToast({ type: 'error', message: error instanceof Error ? error.message : 'Lỗi tải dữ liệu phân phối' });
    }
  }, []);

  React.useEffect(() => {
    if (selectedOrder) {
      loadAssemblies(selectedOrder.id);
    } else {
      setAssemblies([]);
      setSelectedAssemblyId('');
    }
  }, [selectedOrder, loadAssemblies]);

  React.useEffect(() => {
    if (selectedAssembly) {
      setRecountQty(String(selectedAssembly.quantity));
    } else {
      setRecountQty('0');
    }
  }, [selectedAssembly]);

  React.useEffect(() => {
    const syncWarehouses = () => setWarehouses(getStoredWarehouses());
    window.addEventListener('storage', syncWarehouses);
    return () => window.removeEventListener('storage', syncWarehouses);
  }, []);

  React.useEffect(() => {
    if (!selectedOrderId && completedOrders[0]) {
      setSelectedOrderId(completedOrders[0].id);
    }
  }, [completedOrders, selectedOrderId]);

  const filteredOrders = React.useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return completedOrders;
    return completedOrders.filter((order) => {
      const sourceName = order.sourcePurchaseOrder?.supplier?.name || order.sourcePurchaseOrderNo || '';
      return (
        order.orderCode.toLowerCase().includes(keyword) ||
        sourceName.toLowerCase().includes(keyword) ||
        order.note?.toLowerCase().includes(keyword) ||
        order.status.toLowerCase().includes(keyword)
      );
    });
  }, [completedOrders, search]);

  const createAssembly = async () => {
    if (!selectedOrder) return;

    if (!assemblyForm.assembledProductId) {
      setToast({ type: 'error', message: mode === 'production' ? 'Chọn sản phẩm sản xuất' : 'Chọn sản phẩm phân phối' });
      return;
    }

    const quantity = parseNumber(assemblyForm.assembledQty);
    if (quantity <= 0) {
      setToast({ type: 'error', message: mode === 'production' ? 'Số lượng sản xuất phải lớn hơn 0' : 'Số lượng phân phối phải lớn hơn 0' });
      return;
    }

    const components = selectedOrder.details
      .map((detail) => ({ detailId: detail.id, usedQty: parseNumber(assemblyForm.components[detail.id] ?? '0') }))
      .filter((item) => item.usedQty > 0);

    if (components.length === 0) {
      setToast({ type: 'error', message: 'Phải chọn ít nhất một thành phần' });
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(`${API_BASE_URL}/inbound/stock-in-orders/${selectedOrder.id}/assemblies`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          assembledProductId: assemblyForm.assembledProductId,
          assembledQty: quantity,
          barcode: assemblyForm.barcode || undefined,
          warehouseCode: assemblyForm.warehouseCode || selectedOrder.details[0]?.warehouseCode || 'DEFAULT',
          note: assemblyForm.note || undefined,
          components,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.message || 'Không tạo được sản phẩm phân phối');
      }

      const result = (await response.json()) as Assembly;
      setToast({ type: 'success', message: `Đã tạo sản phẩm ${result.assemblyCode}` });
      setAssemblyForm({ assembledProductId: '', assembledQty: '0', barcode: '', warehouseCode: '', note: '', components: {} });
      await loadAssemblies(selectedOrder.id);
      setSelectedAssemblyId(result.id);
    } catch (error) {
      setToast({ type: 'error', message: error instanceof Error ? error.message : 'Lỗi tạo sản phẩm phân phối' });
    } finally {
      setSaving(false);
    }
  };

  const recountAssembly = async (assemblyId: string, countedQty: number) => {
    if (!assemblyId) return;
    setSaving(true);
    try {
      const response = await fetch(`${API_BASE_URL}/inbound/stock-in-orders/assemblies/${assemblyId}/recount`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ countedQty }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.message || 'Không kiểm kê được sản phẩm phân phối');
      }

      const result = (await response.json()) as Assembly;
      setToast({ type: 'success', message: `Đã kiểm kê lại ${result.assemblyCode}` });
      await loadAssemblies(selectedOrder?.id);
      setSelectedAssemblyId(result.id);
    } catch (error) {
      setToast({ type: 'error', message: error instanceof Error ? error.message : 'Lỗi kiểm kê sản phẩm phân phối' });
    } finally {
      setSaving(false);
    }
  };

  const selectedAssemblyDetails = selectedAssembly?.details || [];

  return (
    <div className="space-y-4">
      {toast && (
        <div className={`fixed right-4 top-4 z-[70] flex items-center gap-3 rounded-xl border bg-white px-4 py-3 shadow-xl ${toast.type === 'error' ? 'border-red-200 text-red-600' : 'border-emerald-200 text-emerald-600'}`}>
          <XCircle className="h-5 w-5" />
          <p className="text-sm font-bold">{toast.message}</p>
          <button type="button" onClick={() => setToast(null)} className="rounded-lg p-1 hover:bg-slate-100">
            <XCircle className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h1 className="text-2xl font-black text-slate-900">
              {mode === 'production' ? 'Sản xuất' : 'Phân phối'}
            </h1>
          </div>
          <button
            type="button"
            onClick={loadData}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
          >
            <RefreshCw className="h-4 w-4" />
            Làm mới
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-black uppercase text-slate-500">Đơn hoàn thành</p>
          <p className="mt-2 text-3xl font-black text-slate-900">{formatNumber(completedOrders.length)}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-black uppercase text-slate-500">Sản phẩm</p>
          <p className="mt-2 text-3xl font-black text-slate-900">{formatNumber(products.length)}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-black uppercase text-slate-500">{mode === 'production' ? 'Sản phẩm sản xuất' : 'Sản phẩm phân phối'}</p>
          <p className="mt-2 text-3xl font-black text-slate-900">{formatNumber(assemblies.length)}</p>
        </div>
      </div>

      <section className="grid gap-4 xl:grid-cols-[320px_1fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-black text-slate-900">Đơn nhập kho hoàn thành</h2>
              <p className="text-sm text-slate-500">Chọn lệnh để thao tác trên sản xuất hoặc phân phối, tùy theo chế độ.</p>
            </div>
            <button
              type="button"
              onClick={() => setSearch('')}
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100"
            >
              Xóa tìm kiếm
            </button>
          </div>

          <div className="mt-4 relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Tìm kiếm mã lệnh, nhà cung cấp..."
              className="h-11 w-full rounded-xl border-2 border-slate-200 bg-white pl-11 pr-4 text-sm font-semibold outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
            />
          </div>

          <div className="mt-4 space-y-3">
            {loading && <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">Đang tải dữ liệu...</div>}
            {!loading && filteredOrders.length === 0 && (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">Không có lệnh nhập kho hoàn thành.</div>
            )}
            {filteredOrders.map((order) => {
              const active = order.id === selectedOrder?.id;
              return (
                <button
                  key={order.id}
                  type="button"
                  onClick={() => setSelectedOrderId(order.id)}
                  className={`w-full rounded-xl border p-4 text-left transition ${
                    active ? 'border-cyan-300 bg-cyan-50 ring-2 ring-cyan-500/20' : 'border-slate-200 bg-white hover:border-cyan-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-black text-slate-900">{order.orderCode}</div>
                      <div className="mt-1 text-xs font-medium text-slate-500">
                        {order.sourcePurchaseOrder?.supplier?.name || order.sourcePurchaseOrderNo || 'Không có nguồn'}
                      </div>
                    </div>
                    <span className={`inline-flex rounded-lg border px-2.5 py-1 text-[11px] font-bold ${statusClass(order.status)}`}>
                      {statusLabel(order.status)}
                    </span>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                    <span>{order.details.length} dòng hàng</span>
                    <span>{formatDateTime(order.createdAt)}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          {selectedOrder ? (
            <>
              <div className="flex flex-col gap-4 border-b border-slate-200 pb-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="text-2xl font-black text-slate-900">{selectedOrder.orderCode}</h2>
                    <span className={`inline-flex rounded-lg border px-3 py-1 text-xs font-bold ${statusClass(selectedOrder.status)}`}>
                      {statusLabel(selectedOrder.status)}
                    </span>
                  </div>
                          <div className="mt-2 flex flex-wrap items-center gap-3 text-sm font-medium text-slate-500">
                    <span>PO: {selectedOrder.sourcePurchaseOrder?.poNumber || selectedOrder.sourcePurchaseOrderNo || '-'}</span>
                    <span>•</span>
                    <span>{selectedOrder.sourcePurchaseOrder?.supplier?.name || 'Chưa có nhà cung cấp'}</span>
                    <span>•</span>
                    <span>Tạo lúc {formatDateTime(selectedOrder.createdAt)}</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-center">
                    <div className="text-xs font-black uppercase text-slate-500">Dòng hàng</div>
                    <div className="mt-2 text-lg font-black text-slate-900">{formatNumber(selectedOrder.details.length)}</div>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-center">
                    <div className="text-xs font-black uppercase text-slate-500">SL yêu cầu</div>
                    <div className="mt-2 text-lg font-black text-slate-900">{formatNumber(selectedOrder.totalRequestedQty)}</div>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-center">
                    <div className="text-xs font-black uppercase text-slate-500">SL thực</div>
                    <div className="mt-2 text-lg font-black text-slate-900">{formatNumber(selectedOrder.totalActualQty)}</div>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-center">
                    <div className="text-xs font-black uppercase text-slate-500">Giá trị</div>
                    <div className="mt-2 text-lg font-black text-slate-900">{formatNumber(selectedOrder.totalAmount)}</div>
                  </div>
                </div>
              </div>

              {selectedOrder.status !== 'COMPLETED' ? (
                <div className="mt-5 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">
                  Chỉ có thể tạo sản phẩm khi lệnh nhập kho đã hoàn tất.
                </div>
              ) : (
                <div className="mt-5 space-y-6">
                  <div>
                    <div className="grid gap-4 lg:grid-cols-2">
                      <div>
                        <label className="mb-2 block text-sm font-bold text-slate-700">Sản phẩm thành phẩm</label>
                        <select
                          value={assemblyForm.assembledProductId}
                          onChange={(event) => setAssemblyForm((current) => ({ ...current, assembledProductId: event.target.value }))}
                          className="h-11 w-full rounded-xl border-2 border-slate-200 bg-white px-4 text-sm font-semibold outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
                        >
                          <option value="">Chọn sản phẩm</option>
                          {products.map((product) => (
                            <option key={product.id} value={product.id}>
                              {product.internalSku} - {product.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="mb-2 block text-sm font-bold text-slate-700">Số lượng thành phẩm</label>
                        <input
                          type="number"
                          min={1}
                          value={assemblyForm.assembledQty}
                          onChange={(event) => setAssemblyForm((current) => ({ ...current, assembledQty: event.target.value }))}
                          className="h-11 w-full rounded-xl border-2 border-slate-200 bg-white px-4 text-sm font-semibold outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
                        />
                      </div>
                    </div>

                    <div className="grid gap-4 lg:grid-cols-3 mt-4">
                      <div>
                        <label className="mb-2 block text-sm font-bold text-slate-700">Mã barcode</label>
                        <input
                          value={assemblyForm.barcode}
                          onChange={(event) => setAssemblyForm((current) => ({ ...current, barcode: event.target.value }))}
                          className="h-11 w-full rounded-xl border-2 border-slate-200 bg-white px-4 text-sm font-semibold outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
                        />
                      </div>
                      <div>
                        <label className="mb-2 block text-sm font-bold text-slate-700">Kho {mode === 'production' ? 'sản xuất' : 'phân phối'}</label>
                        <select
                          value={assemblyForm.warehouseCode}
                          onChange={(event) => setAssemblyForm((current) => ({ ...current, warehouseCode: event.target.value }))}
                          className="h-11 w-full rounded-xl border-2 border-slate-200 bg-white px-4 text-sm font-semibold outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
                        >
                          <option value="">Chọn kho</option>
                          {warehouses.map((warehouse) => (
                            <option key={warehouse.code} value={warehouse.code}>
                              {warehouse.code} - {warehouse.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="mb-2 block text-sm font-bold text-slate-700">Ghi chú</label>
                        <input
                          value={assemblyForm.note}
                          onChange={(event) => setAssemblyForm((current) => ({ ...current, note: event.target.value }))}
                          className="h-11 w-full rounded-xl border-2 border-slate-200 bg-white px-4 text-sm font-semibold outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
                        />
                      </div>
                    </div>

                    <div className="mt-5 overflow-hidden rounded-xl border border-slate-200">
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[760px] border-collapse bg-white">
                          <thead className="bg-slate-50">
                            <tr className="border-b border-slate-200">
                              <th className="border-x border-slate-200 px-3 py-3 text-left text-sm font-black uppercase text-slate-700">Thành phần</th>
                              <th className="border-x border-slate-200 px-3 py-3 text-left text-sm font-black uppercase text-slate-700">Kho</th>
                              <th className="border-x border-slate-200 px-3 py-3 text-right text-sm font-black uppercase text-slate-700">SL thực tế</th>
                              <th className="border-x border-slate-200 px-3 py-3 text-right text-sm font-black uppercase text-slate-700">SL sử dụng</th>
                            </tr>
                          </thead>
                          <tbody>
                            {selectedOrder.details.map((detail) => {
                              const usedQty = assemblyForm.components[detail.id] || '0';
                              return (
                                <tr key={detail.id} className="border-b border-slate-200 transition hover:bg-cyan-50/40">
                                  <td className="border-x border-slate-200 px-3 py-3 text-sm font-bold text-slate-800">
                                    {detail.product?.internalSku || '-'} • {detail.product?.name || '-'}
                                  </td>
                                  <td className="border-x border-slate-200 px-3 py-3 text-sm text-slate-900">{detail.warehouseCode || '-'}</td>
                                  <td className="border-x border-slate-200 px-3 py-3 text-right text-sm font-black text-slate-900">{formatNumber(detail.actualQty)}</td>
                                  <td className="border-x border-slate-200 px-3 py-3">
                                    <input
                                      type="number"
                                      min={0}
                                      value={usedQty}
                                      onChange={(event) => setAssemblyForm((current) => ({
                                        ...current,
                                        components: {
                                          ...current.components,
                                          [detail.id]: event.target.value,
                                        },
                                      }))}
                                      className="h-10 w-full rounded-lg border-2 border-slate-200 px-3 text-right text-sm font-bold outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
                                    />
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div className="mt-4 flex justify-end">
                      <button
                        type="button"
                        onClick={createAssembly}
                        disabled={saving}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-cyan-700 disabled:opacity-60"
                      >
                        {mode === 'production' ? 'Tạo sản phẩm' : 'Tạo phân phối'}
                      </button>
                    </div>
                  </div>

                  {assemblies.length > 0 && (
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                      <h3 className="text-lg font-black text-slate-900">Sản phẩm đã tạo</h3>
                      <div className="mt-4 grid gap-3">
                        {assemblies.map((assembly) => {
                          const active = assembly.id === selectedAssembly?.id;
                          return (
                            <button
                              key={assembly.id}
                              type="button"
                              onClick={() => setSelectedAssemblyId(assembly.id)}
                              className={`w-full rounded-2xl border p-4 text-left transition ${
                                active ? 'border-cyan-300 bg-cyan-50 ring-2 ring-cyan-500/20' : 'border-slate-200 bg-white hover:border-cyan-200 hover:bg-slate-50'
                              }`}
                            >
                              <div className="flex flex-wrap items-center justify-between gap-3">
                                <div>
                                  <div className="font-black text-slate-900">{assembly.assemblyCode}</div>
                                  <div className="text-sm text-slate-500">{assembly.assembledProduct?.internalSku} - {assembly.assembledProduct?.name}</div>
                                </div>
                                <div className="text-sm font-black text-slate-900">{formatNumber(assembly.quantity)}</div>
                              </div>
                              <div className="mt-3 grid gap-3 sm:grid-cols-2 text-sm text-slate-600">
                                <div>Kho: {assembly.warehouseCode}</div>
                                <div>Trạng thái: {assembly.status}</div>
                              </div>
                            </button>
                          );
                        })}

                        {selectedAssembly && (
                          <div className="rounded-2xl border border-slate-200 bg-white p-5">
                            <div className="mb-4 flex items-center justify-between gap-3">
                              <div>
                                <div className="text-sm font-bold text-slate-700">Chi tiết sản phẩm</div>
                                <div className="text-xs text-slate-500">{selectedAssembly.assemblyCode}</div>
                              </div>
                              <div className="text-sm font-black text-slate-900">Tổng: {formatNumber(selectedAssembly.quantity)}</div>
                            </div>
                            <div className="grid gap-3 sm:grid-cols-2 text-sm text-slate-600">
                              <div>Kho thành phẩm: {selectedAssembly.warehouseCode}</div>
                              <div>Barcode: {selectedAssembly.barcode || '-'}</div>
                              <div>Trạng thái: {selectedAssembly.status}</div>
                              <div>
                                Kiểm kê: {selectedAssembly.recountedQty != null ? formatNumber(selectedAssembly.recountedQty) : 'Chưa'}
                                {selectedAssembly.recountedAt ? ` • ${formatDateTime(selectedAssembly.recountedAt)}` : ''}
                              </div>
                            </div>

                            <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                              <div className="overflow-x-auto">
                                <table className="w-full min-w-[640px] border-collapse bg-white">
                                  <thead className="bg-slate-50">
                                    <tr className="border-b border-slate-200">
                                      <th className="border-x border-slate-200 px-3 py-3 text-left text-sm font-black uppercase text-slate-700">Thành phần</th>
                                      <th className="border-x border-slate-200 px-3 py-3 text-left text-sm font-black uppercase text-slate-700">Kho</th>
                                      <th className="border-x border-slate-200 px-3 py-3 text-right text-sm font-black uppercase text-slate-700">SL dùng</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {selectedAssemblyDetails.map((detail) => (
                                      <tr key={detail.id} className="border-b border-slate-200">
                                        <td className="border-x border-slate-200 px-3 py-3 text-sm font-bold text-slate-800">
                                          {detail.componentProduct?.internalSku || '-'} • {detail.componentProduct?.name || '-'}
                                        </td>
                                        <td className="border-x border-slate-200 px-3 py-3 text-sm text-slate-900">{detail.warehouseCode || '-'}</td>
                                        <td className="border-x border-slate-200 px-3 py-3 text-right text-sm font-black text-slate-900">{formatNumber(detail.usedQty)}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>

                            <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
                              <input
                                type="number"
                                min={0}
                                value={recountQty}
                                onChange={(event) => setRecountQty(event.target.value)}
                                placeholder="Số lượng kiểm kê"
                                className="h-11 w-full rounded-xl border-2 border-slate-200 bg-white px-4 text-sm font-semibold outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
                              />
                              <button
                                type="button"
                                onClick={() => recountAssembly(selectedAssembly.id, parseNumber(recountQty))}
                                disabled={saving}
                                className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-60"
                              >
                                Kiểm kê lại
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="flex min-h-[420px] items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">
              Chưa có lệnh nhập kho hoàn thành để tạo sản phẩm.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
