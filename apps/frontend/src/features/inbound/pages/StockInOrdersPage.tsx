import React from 'react';
import {
    ArrowRight,
    CheckCircle2,
    Clock3,
    FileText,
    History,
    Package,
    RefreshCw,
    Search,
    ShieldAlert,
    Truck,
    Workflow,
    X,
    XCircle,
} from 'lucide-react';
import { getStoredWarehouses, type WarehouseRecord } from '../../../shared/utils/warehouseAssignments';

type Supplier = {
    id: string;
    supplierCode?: string;
    name: string;
};

type PurchaseOrderDetail = {
    id: string;
    warehouseCode?: string;
    expectedQty: number;
    receivedQty: number;
    unitPrice: number;
    totalLineAmount: number;
    product?: {
        id: string;
        internalSku: string;
        name: string;
        unit?: string;
    } | null;
};

type PurchaseOrder = {
    id: string;
    poNumber: string;
    orderDate?: string;
    expectedDate?: string;
    status?: string;
    description?: string;
    totalAmount: number;
    supplier?: Supplier | null;
    details?: PurchaseOrderDetail[];
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
    resourceId?: string;
    metadata?: Record<string, unknown>;
    createdAt?: string;
    actorEmail?: string;
    actorId?: string;
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
    currentStepUserEmail?: string;
    note?: string;
    completedAt?: string;
    createdAt?: string;
    updatedAt?: string;
    details: StockInOrderDetail[];
    totalRequestedQty: number;
    totalActualQty: number;
    totalAmount: number;
    logs: StockInOrderLog[];
};

type Toast = {
    type: 'success' | 'error';
    message: string;
};

type DraftRow = {
    id: string;
    warehouseCode: string;
    requestedQty: string;
    actualQty: string;
    unitPrice: string;
};

type DraftState = {
    currentStepUserEmail: string;
    nextStepUserEmail: string;
    note: string;
    rows: Record<string, DraftRow>;
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

function actionLabel(action?: string) {
    switch ((action || '').toLowerCase()) {
        case 'workflow.create':
            return 'Tạo lệnh';
        case 'workflow.update':
            return 'Cập nhật';
        case 'workflow.transition':
            return 'Chuyển bước';
        case 'workflow.complete':
            return 'Hoàn thành';
        default:
            return action || 'Hoạt động';
    }
}

function TimelineDot({ action }: { action?: string }) {
    const base = 'flex h-9 w-9 items-center justify-center rounded-full border';
    switch ((action || '').toLowerCase()) {
        case 'workflow.complete':
            return <div className={`${base} border-emerald-200 bg-emerald-50 text-emerald-600`}><CheckCircle2 className="h-4 w-4" /></div>;
        case 'workflow.transition':
            return <div className={`${base} border-cyan-200 bg-cyan-50 text-cyan-600`}><ArrowRight className="h-4 w-4" /></div>;
        case 'workflow.update':
            return <div className={`${base} border-amber-200 bg-amber-50 text-amber-600`}><Workflow className="h-4 w-4" /></div>;
        default:
            return <div className={`${base} border-slate-200 bg-slate-50 text-slate-500`}><Clock3 className="h-4 w-4" /></div>;
    }
}

function makeDraft(order: StockInOrder | null): DraftState {
    return {
        currentStepUserEmail: order?.currentStepUserEmail || '',
        nextStepUserEmail: order?.currentStepUserEmail || '',
        note: order?.note || '',
        rows: Object.fromEntries(
            (order?.details || []).map((detail) => [
                detail.id,
                {
                    id: detail.id,
                    warehouseCode: detail.warehouseCode || 'KHO-NVL',
                    requestedQty: String(detail.requestedQty || 0),
                    actualQty: String(detail.actualQty || 0),
                    unitPrice: String(detail.unitPrice || 0),
                },
            ]),
        ),
    };
}

export default function StockInOrdersPage() {
    const [orders, setOrders] = React.useState<StockInOrder[]>([]);
    const [purchaseOrders, setPurchaseOrders] = React.useState<PurchaseOrder[]>([]);
    const [selectedId, setSelectedId] = React.useState<string>('');
    const [createSourceId, setCreateSourceId] = React.useState('');
    const [search, setSearch] = React.useState('');
    const [loading, setLoading] = React.useState(true);
    const [saving, setSaving] = React.useState(false);
    const [toast, setToast] = React.useState<Toast | null>(null);
    const [draft, setDraft] = React.useState<DraftState>(() => makeDraft(null));
    const [createForm, setCreateForm] = React.useState({ currentStepUserEmail: '', note: '' });
    const [warehouses, setWarehouses] = React.useState<WarehouseRecord[]>(() => getStoredWarehouses());

    React.useEffect(() => {
        if (!toast) return;
        const timer = window.setTimeout(() => setToast(null), 3500);
        return () => window.clearTimeout(timer);
    }, [toast]);

    const loadData = React.useCallback(async () => {
        setLoading(true);
        try {
            const [ordersResponse, purchaseOrdersResponse] = await Promise.all([
                fetch(`${API_BASE_URL}/inbound/stock-in-orders`, { headers: authHeaders() }),
                fetch(`${API_BASE_URL}/inbound/purchase-orders`, { headers: authHeaders() }),
            ]);

            if (!ordersResponse.ok) {
                const data = await ordersResponse.json().catch(() => null);
                throw new Error(data?.message || 'Không tải được danh sách lệnh nhập kho');
            }

            if (!purchaseOrdersResponse.ok) {
                const data = await purchaseOrdersResponse.json().catch(() => null);
                throw new Error(data?.message || 'Không tải được danh sách đơn mua hàng');
            }

            const ordersData = (await ordersResponse.json()) as StockInOrder[];
            const purchaseOrdersData = (await purchaseOrdersResponse.json()) as PurchaseOrder[];

            setOrders(ordersData);
            setPurchaseOrders(purchaseOrdersData);
        } catch (error) {
            setToast({ type: 'error', message: error instanceof Error ? error.message : 'Lỗi tải dữ liệu lệnh nhập kho' });
        } finally {
            setLoading(false);
        }
    }, []);

    React.useEffect(() => {
        loadData();
    }, [loadData]);

    React.useEffect(() => {
        if (!selectedId && orders[0]) {
            setSelectedId(orders[0].id);
            return;
        }
        if (selectedId && !orders.some((order) => order.id === selectedId)) {
            setSelectedId(orders[0]?.id || '');
        }
    }, [orders, selectedId]);

    React.useEffect(() => {
        const syncWarehouses = () => setWarehouses(getStoredWarehouses());
        window.addEventListener('storage', syncWarehouses);
        return () => window.removeEventListener('storage', syncWarehouses);
    }, []);

    React.useEffect(() => {
        if (purchaseOrders[0]) {
            setCreateSourceId((current) => current || purchaseOrders[0].id);
        }
    }, [purchaseOrders]);

    const selectedOrder = React.useMemo(
        () => orders.find((order) => order.id === selectedId) || orders[0] || null,
        [orders, selectedId],
    );

    React.useEffect(() => {
        setDraft(makeDraft(selectedOrder));
    }, [selectedOrder]);

    const usedPurchaseOrderIds = React.useMemo(() => new Set(orders.map((order) => order.sourcePurchaseOrderId).filter(Boolean)), [orders]);

    const filteredOrders = React.useMemo(() => {
        const keyword = search.trim().toLowerCase();
        if (!keyword) return orders;
        return orders.filter((order) => {
            const sourceName = order.sourcePurchaseOrder?.supplier?.name || order.sourcePurchaseOrderNo || '';
            return (
                order.orderCode.toLowerCase().includes(keyword) ||
                sourceName.toLowerCase().includes(keyword) ||
                order.note?.toLowerCase().includes(keyword) ||
                order.status.toLowerCase().includes(keyword)
            );
        });
    }, [orders, search]);

    const stats = React.useMemo(() => {
        const total = orders.length;
        const completed = orders.filter((order) => order.status === 'COMPLETED').length;
        const inProgress = orders.filter((order) => order.status === 'IN_PROGRESS').length;
        const difference = orders.filter((order) => order.totalActualQty !== order.totalRequestedQty).length;
        return { total, completed, inProgress, difference };
    }, [orders]);

    const createFromPurchaseOrder = async () => {
        if (!createSourceId) {
            setToast({ type: 'error', message: 'Hãy chọn một đơn mua hàng để lập lệnh nhập kho' });
            return;
        }

        setSaving(true);
        try {
            const response = await fetch(`${API_BASE_URL}/inbound/stock-in-orders/from-purchase-orders/${createSourceId}`, {
                method: 'POST',
                headers: authHeaders(),
                body: JSON.stringify({
                    note: createForm.note || undefined,
                    currentStepUserEmail: createForm.currentStepUserEmail || undefined,
                }),
            });

            if (!response.ok) {
                const data = await response.json().catch(() => null);
                throw new Error(data?.message || 'Không tạo được lệnh nhập kho');
            }

            const created = (await response.json()) as StockInOrder;
            setToast({ type: 'success', message: `Đã lập lệnh ${created.orderCode}` });
            setCreateForm({ currentStepUserEmail: '', note: '' });
            await loadData();
            setSelectedId(created.id);
        } catch (error) {
            setToast({ type: 'error', message: error instanceof Error ? error.message : 'Lỗi khi lập lệnh nhập kho' });
        } finally {
            setSaving(false);
        }
    };

    const updateDraftRow = (rowId: string, patch: Partial<DraftRow>) => {
        setDraft((current) => ({
            ...current,
            rows: {
                ...current.rows,
                [rowId]: {
                    ...(current.rows[rowId] || { id: rowId, warehouseCode: 'KHO-NVL', requestedQty: '0', actualQty: '0', unitPrice: '0' }),
                    ...patch,
                },
            },
        }));
    };

    const saveOrder = async () => {
        if (!selectedOrder) return;
        setSaving(true);
        try {
            const payload = {
                currentStepUserEmail: draft.currentStepUserEmail || undefined,
                note: draft.note || undefined,
                status: selectedOrder.status,
                details: selectedOrder.details.map((detail) => {
                    const row = draft.rows[detail.id];
                    return {
                        id: detail.id,
                        warehouseCode: row?.warehouseCode || detail.warehouseCode,
                        requestedQty: parseNumber(row?.requestedQty ?? String(detail.requestedQty)),
                        actualQty: parseNumber(row?.actualQty ?? String(detail.actualQty)),
                        unitPrice: parseNumber(row?.unitPrice ?? String(detail.unitPrice)),
                    };
                }),
            };

            const response = await fetch(`${API_BASE_URL}/inbound/stock-in-orders/${selectedOrder.id}`, {
                method: 'PUT',
                headers: authHeaders(),
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                const data = await response.json().catch(() => null);
                throw new Error(data?.message || 'Không lưu được lệnh nhập kho');
            }

            setToast({ type: 'success', message: 'Đã lưu thay đổi' });
            await loadData();
        } catch (error) {
            setToast({ type: 'error', message: error instanceof Error ? error.message : 'Lỗi khi lưu lệnh nhập kho' });
        } finally {
            setSaving(false);
        }
    };

    const transitionOrder = async () => {
        if (!selectedOrder) return;
        setSaving(true);
        try {
            const response = await fetch(`${API_BASE_URL}/inbound/stock-in-orders/${selectedOrder.id}/transition`, {
                method: 'POST',
                headers: authHeaders(),
                body: JSON.stringify({
                    nextStepUserEmail: draft.nextStepUserEmail || undefined,
                    note: draft.note || undefined,
                }),
            });

            if (!response.ok) {
                const data = await response.json().catch(() => null);
                throw new Error(data?.message || 'Không chuyển bước được');
            }

            setToast({ type: 'success', message: 'Đã chuyển bước xử lý' });
            await loadData();
        } catch (error) {
            setToast({ type: 'error', message: error instanceof Error ? error.message : 'Lỗi khi chuyển bước' });
        } finally {
            setSaving(false);
        }
    };

    const completeOrder = async () => {
        if (!selectedOrder) return;
        const hasDifference = selectedOrder.details.some((detail) => {
            const row = draft.rows[detail.id];
            const actualQty = parseNumber(row?.actualQty ?? String(detail.actualQty));
            const requestedQty = parseNumber(row?.requestedQty ?? String(detail.requestedQty));
            return actualQty !== requestedQty;
        });

        if (hasDifference && !window.confirm('Có chênh lệch số lượng. Bạn vẫn muốn hoàn thành lệnh này?')) {
            return;
        }

        setSaving(true);
        try {
            const response = await fetch(`${API_BASE_URL}/inbound/stock-in-orders/${selectedOrder.id}/complete`, {
                method: 'POST',
                headers: authHeaders(),
                body: JSON.stringify({
                    confirmDifference: hasDifference,
                    nextStepUserEmail: draft.nextStepUserEmail || undefined,
                    note: draft.note || undefined,
                }),
            });

            if (!response.ok) {
                const data = await response.json().catch(() => null);
                throw new Error(data?.message || 'Không hoàn thành được lệnh nhập kho');
            }

            setToast({ type: 'success', message: 'Đã hoàn thành lệnh nhập kho' });
            await loadData();
        } catch (error) {
            setToast({ type: 'error', message: error instanceof Error ? error.message : 'Lỗi khi hoàn thành lệnh' });
        } finally {
            setSaving(false);
        }
    };

    const selectedOrderDifferences = selectedOrder
        ? selectedOrder.details.filter((detail) => {
            const row = draft.rows[detail.id];
            const actualQty = parseNumber(row?.actualQty ?? String(detail.actualQty));
            const requestedQty = parseNumber(row?.requestedQty ?? String(detail.requestedQty));
            return actualQty !== requestedQty;
        }).length
        : 0;

    const selectedLogs = selectedOrder?.logs || [];

    return (
        <div className="space-y-4">
            {/* Toast Notification (Match PurchaseOrders) */}
            {toast && (
                <div className={`fixed right-4 top-4 z-[70] flex items-center gap-3 rounded-xl border bg-white px-4 py-3 shadow-xl ${toast.type === 'error' ? 'border-red-200 text-red-600' : 'border-emerald-200 text-emerald-600'}`}>
                    {toast.type === 'error' ? <XCircle className="h-5 w-5" /> : <CheckCircle2 className="h-5 w-5" />}
                    <p className="text-sm font-bold">{toast.message}</p>
                    <button type="button" onClick={() => setToast(null)} className="rounded-lg p-1 hover:bg-slate-100">
                        <X className="h-4 w-4" />
                    </button>
                </div>
            )}

            {/* Header Section (Match PurchaseOrders) */}
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div>
                    <h1 className="text-2xl font-black text-slate-900">Lệnh nhập kho</h1>
                </div>
            </div>

            {/* Metric Cards (Match PurchaseOrders) */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <p className="text-xs font-black uppercase text-slate-500">Tổng lệnh</p>
                    <p className="mt-2 text-3xl font-black text-slate-900">{formatNumber(stats.total)}</p>
                </div>
                <div className="rounded-xl border border-cyan-200 bg-cyan-50 p-4 shadow-sm">
                    <p className="text-xs font-black uppercase text-cyan-600">Đang xử lý</p>
                    <p className="mt-2 text-3xl font-black text-cyan-700">{formatNumber(stats.inProgress)}</p>
                </div>
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
                    <p className="text-xs font-black uppercase text-emerald-600">Hoàn thành</p>
                    <p className="mt-2 text-3xl font-black text-emerald-700">{formatNumber(stats.completed)}</p>
                </div>
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
                    <p className="text-xs font-black uppercase text-amber-600">Có chênh lệch</p>
                    <p className="mt-2 text-3xl font-black text-amber-700">{formatNumber(stats.difference)}</p>
                </div>
            </div>

            {/* Main Content Layout */}
            <section className="grid gap-4 xl:grid-cols-[330px_1fr_320px]">
                {/* Left Column */}
                <div className="space-y-4">
                    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <h2 className="text-lg font-black text-slate-900">Danh sách lệnh</h2>
                                <p className="text-sm font-medium text-slate-500">Chọn lệnh để xem chi tiết.</p>
                            </div>
                            <button
                                type="button"
                                onClick={loadData}
                                className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50"
                            >
                                <RefreshCw className="h-4 w-4" />
                            </button>
                        </div>

                        <div className="mt-4 relative">
                            <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                            <input
                                value={search}
                                onChange={(event) => setSearch(event.target.value)}
                                placeholder="Tìm lệnh, PO hoặc ghi chú"
                                className="h-11 w-full rounded-xl border-2 border-slate-200 bg-white pl-11 pr-4 text-sm font-semibold outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
                            />
                        </div>

                        <div className="mt-4 space-y-3">
                            {loading && <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">Đang tải dữ liệu...</div>}
                            {!loading && filteredOrders.length === 0 && (
                                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">Chưa có lệnh nhập kho nào.</div>
                            )}
                            {filteredOrders.map((order) => {
                                const active = order.id === selectedOrder?.id;
                                return (
                                    <button
                                        key={order.id}
                                        type="button"
                                        onClick={() => setSelectedId(order.id)}
                                        className={`w-full rounded-xl border p-4 text-left transition ${
                                            active ? 'border-cyan-300 bg-cyan-50 ring-2 ring-cyan-500/20' : 'border-slate-200 bg-white hover:border-cyan-200 hover:bg-slate-50'
                                        }`}
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div>
                                                <div className="text-sm font-black text-slate-900">{order.orderCode}</div>
                                                <div className="mt-1 text-xs font-medium text-slate-500">
                                                    {order.sourcePurchaseOrder?.supplier?.name || order.sourcePurchaseOrderNo || 'Chưa có nguồn'}
                                                </div>
                                            </div>
                                            <span className={`inline-flex rounded-lg border px-2.5 py-1 text-[11px] font-bold ${statusClass(order.status)}`}>
                        {statusLabel(order.status)}
                      </span>
                                        </div>
                                        <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                                            <span>{order.details.length} dòng hàng</span>
                                            <span>{formatDate(order.createdAt)}</span>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-50 text-cyan-600">
                                <FileText className="h-5 w-5" />
                            </div>
                            <div>
                                <h3 className="font-black text-slate-900">Lập lệnh mới</h3>
                                <p className="text-xs font-medium text-slate-500">Tạo từ đơn mua hàng</p>
                            </div>
                        </div>

                        <div className="mt-4 space-y-4">
                            <div>
                                <label className="mb-2 block text-sm font-bold text-slate-700">Đơn mua hàng nguồn</label>
                                <select
                                    value={createSourceId}
                                    onChange={(event) => setCreateSourceId(event.target.value)}
                                    className="h-11 w-full rounded-xl border-2 border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
                                >
                                    <option value="">Chọn đơn mua hàng</option>
                                    {purchaseOrders.map((po) => (
                                        <option key={po.id} value={po.id} disabled={usedPurchaseOrderIds.has(po.id)}>
                                            {po.poNumber} - {po.supplier?.name || 'Không có NCC'} {usedPurchaseOrderIds.has(po.id) ? '(đã lập lệnh)' : ''}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid grid-cols-1 gap-3">
                                <input
                                    value={createForm.currentStepUserEmail}
                                    onChange={(event) => setCreateForm((current) => ({ ...current, currentStepUserEmail: event.target.value }))}
                                    placeholder="Người đang xử lý"
                                    className="h-11 w-full rounded-xl border-2 border-slate-200 bg-white px-4 text-sm font-semibold outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
                                />
                                <textarea
                                    value={createForm.note}
                                    onChange={(event) => setCreateForm((current) => ({ ...current, note: event.target.value }))}
                                    placeholder="Ghi chú lệnh"
                                    className="min-h-24 w-full rounded-xl border-2 border-slate-200 bg-white px-4 py-3 text-sm font-semibold outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
                                />
                            </div>

                            <button
                                type="button"
                                onClick={createFromPurchaseOrder}
                                disabled={saving}
                                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-cyan-700 disabled:opacity-60"
                            >
                                <Package className="h-4 w-4" />
                                Lập lệnh nhập kho
                            </button>
                        </div>
                    </div>
                </div>

                {/* Middle Column */}
                <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                    {selectedOrder ? (
                        <>
                            <div className="flex flex-col gap-4 border-b border-slate-200 px-5 py-4 lg:flex-row lg:items-start lg:justify-between">
                                <div>
                                    <div className="flex flex-wrap items-center gap-3">
                                        <h2 className="text-2xl font-black text-slate-900">{selectedOrder.orderCode}</h2>
                                        <span className={`inline-flex rounded-lg border px-3 py-1 text-xs font-bold ${statusClass(selectedOrder.status)}`}>
                      {statusLabel(selectedOrder.status)}
                    </span>
                                    </div>
                                    <div className="mt-2 flex flex-wrap items-center gap-3 text-sm font-medium text-slate-500">
                                        <span>Đơn mua hàng: {selectedOrder.sourcePurchaseOrder?.poNumber || selectedOrder.sourcePurchaseOrderNo || '-'}</span>
                                        <span>•</span>
                                        <span>{selectedOrder.sourcePurchaseOrder?.supplier?.name || 'Chưa có nhà cung cấp'}</span>
                                        <span>•</span>
                                        <span>Tạo lúc {formatDateTime(selectedOrder.createdAt)}</span>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                                    <MiniStat label="Dòng hàng" value={formatNumber(selectedOrder.details.length)} />
                                    <MiniStat label="SL yêu cầu" value={formatNumber(selectedOrder.totalRequestedQty)} />
                                    <MiniStat label="SL thực" value={formatNumber(selectedOrder.totalActualQty)} />
                                    <MiniStat label="Giá trị" value={formatMoney(selectedOrder.totalAmount)} />
                                </div>
                            </div>

                            <div className="p-5 space-y-5 border-b border-slate-200">
                                <div className="grid gap-4 md:grid-cols-2">
                                    <Field
                                        label="Người đang giữ lệnh"
                                        value={draft.currentStepUserEmail || selectedOrder.currentStepUserEmail || '-'}
                                        onChange={(value) => setDraft((current) => ({ ...current, currentStepUserEmail: value }))}
                                    />
                                    <Field
                                        label="Người chuyển tiếp"
                                        value={draft.nextStepUserEmail}
                                        onChange={(value) => setDraft((current) => ({ ...current, nextStepUserEmail: value }))}
                                    />
                                </div>

                                <div className="overflow-hidden rounded-xl border border-slate-200">
                                    <div className="overflow-x-auto">
                                        <table className="w-full min-w-[980px] border-collapse bg-white">
                                            <thead className="bg-slate-50">
                                            <tr className="border-b border-slate-200">
                                                <th className="border-x border-slate-200 px-3 py-3 text-left text-sm font-black uppercase text-slate-700">Mã hàng</th>
                                                <th className="border-x border-slate-200 px-3 py-3 text-left text-sm font-black uppercase text-slate-700">Tên hàng</th>
                                                <th className="border-x border-slate-200 px-3 py-3 text-right text-sm font-black uppercase text-slate-700">SL yêu cầu</th>
                                                <th className="w-32 border-x border-slate-200 px-3 py-3 text-right text-sm font-black uppercase text-slate-700">SL thực nhập</th>
                                                <th className="w-40 border-x border-slate-200 px-3 py-3 text-left text-sm font-black uppercase text-slate-700">Kho</th>
                                                <th className="border-x border-slate-200 px-3 py-3 text-right text-sm font-black uppercase text-slate-700">Đơn giá</th>
                                                <th className="border-x border-slate-200 px-3 py-3 text-right text-sm font-black uppercase text-slate-700">Thành tiền</th>
                                            </tr>
                                            </thead>
                                            <tbody>
                                            {selectedOrder.details.map((detail) => {
                                                const row = draft.rows[detail.id] || {
                                                    id: detail.id,
                                                    warehouseCode: detail.warehouseCode || 'KHO-NVL',
                                                    requestedQty: String(detail.requestedQty || 0),
                                                    actualQty: String(detail.actualQty || 0),
                                                    unitPrice: String(detail.unitPrice || 0),
                                                };
                                                const actualQty = parseNumber(row.actualQty);
                                                const requestedQty = parseNumber(row.requestedQty);
                                                const overQty = actualQty > requestedQty;
                                                return (
                                                    <tr key={detail.id} className="border-b border-slate-200 transition hover:bg-cyan-50/40">
                                                        <td className="border-x border-slate-200 px-3 py-3 text-sm font-bold text-slate-800">{detail.product?.internalSku || '-'}</td>
                                                        <td className="border-x border-slate-200 px-3 py-3">
                                                            <div className="text-sm font-semibold text-slate-900">{detail.product?.name || '-'}</div>
                                                            <div className="text-xs font-semibold text-slate-500">{detail.product?.unit || '-'}</div>
                                                        </td>
                                                        <td className="border-x border-slate-200 px-3 py-3 text-right text-sm font-black text-slate-900">{formatNumber(requestedQty)}</td>
                                                        <td className="border-x border-slate-200 px-3 py-3">
                                                            <input
                                                                type="number"
                                                                min={0}
                                                                value={row.actualQty}
                                                                onChange={(event) => updateDraftRow(detail.id, { actualQty: event.target.value })}
                                                                className={`h-10 w-full rounded-lg border-2 px-3 text-right text-sm font-bold outline-none transition ${
                                                                    overQty ? 'border-red-300 bg-red-50 text-red-700 focus:border-red-500 focus:ring-4 focus:ring-red-500/10' : 'border-slate-200 focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10'
                                                                }`}
                                                            />
                                                        </td>
                                                        <td className="border-x border-slate-200 px-3 py-3">
                                                            <select
                                                                value={row.warehouseCode}
                                                                onChange={(event) => updateDraftRow(detail.id, { warehouseCode: event.target.value })}
                                                                className="h-10 w-full rounded-lg border-2 border-slate-200 bg-white px-3 text-sm font-semibold outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
                                                            >
                                                                <option value="">Chọn kho</option>
                                                                {warehouses.map((warehouse) => (
                                                                    <option key={warehouse.code} value={warehouse.code}>
                                                                        {warehouse.code} - {warehouse.name}
                                                                    </option>
                                                                ))}
                                                            </select>
                                                        </td>
                                                        <td className="border-x border-slate-200 px-3 py-3 text-right text-sm font-black text-slate-900">
                                                            {formatMoney(parseNumber(row.unitPrice))}
                                                        </td>
                                                        <td className="border-x border-slate-200 px-3 py-3 text-right text-sm font-black text-slate-900">
                                                            {formatMoney(actualQty * parseNumber(row.unitPrice))}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>

                            {/* Actions Footer */}
                            <div className="flex flex-col gap-3 bg-slate-50/50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between rounded-b-2xl">
                                <div className="text-sm font-medium text-slate-600">
                                    Chênh lệch hiện tại: <span className="font-black text-slate-900">{selectedOrderDifferences}</span> dòng
                                </div>
                                <div className="flex flex-wrap items-center justify-end gap-3">
                                    <button
                                        type="button"
                                        onClick={saveOrder}
                                        disabled={saving}
                                        className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
                                    >
                                        <RefreshCw className="h-4 w-4" />
                                        Lưu
                                    </button>
                                    <button
                                        type="button"
                                        onClick={transitionOrder}
                                        disabled={saving}
                                        className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-cyan-200 bg-cyan-50 px-5 py-2.5 text-sm font-bold text-cyan-700 transition hover:bg-cyan-100 disabled:opacity-60"
                                    >
                                        <ArrowRight className="h-4 w-4" />
                                        Chuyển bước
                                    </button>
                                    <button
                                        type="button"
                                        onClick={completeOrder}
                                        disabled={saving || selectedOrder.status === 'COMPLETED'}
                                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-cyan-700 disabled:opacity-60"
                                    >
                                        <CheckCircle2 className="h-4 w-4" />
                                        Hoàn thành
                                    </button>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="flex min-h-[500px] items-center justify-center border-dashed border-slate-200 bg-slate-50 rounded-2xl">
                            <div className="text-center">
                                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-white text-cyan-600 shadow-sm">
                                    <Package className="h-8 w-8" />
                                </div>
                                <h3 className="mt-4 text-xl font-black text-slate-900">Chưa có lệnh nhập kho</h3>
                                <p className="mt-2 text-sm text-slate-500">Hãy chọn một đơn mua hàng ở khối bên trái để lập lệnh mới.</p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Right Column */}
                <div className="space-y-4">
                    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-50 text-cyan-600">
                                <History className="h-5 w-5" />
                            </div>
                            <div>
                                <h3 className="font-black text-slate-900">Tổng quan</h3>
                                <p className="text-sm font-medium text-slate-500">Nhìn nhanh các chỉ số.</p>
                            </div>
                        </div>

                        {selectedOrder ? (
                            <div className="mt-5 space-y-3">
                                <InfoRow label="Mã lệnh" value={selectedOrder.orderCode} />
                                <InfoRow label="Nguồn" value={selectedOrder.sourcePurchaseOrderNo || '-'} />
                                <InfoRow label="Nhà cung cấp" value={selectedOrder.sourcePurchaseOrder?.supplier?.name || '-'} />
                                <InfoRow label="Ngày hoàn thành" value={formatDateTime(selectedOrder.completedAt)} />
                                <InfoRow label="Cập nhật" value={formatDateTime(selectedOrder.updatedAt)} />
                                <InfoRow label="Ghi chú" value={selectedOrder.note || '-'} />
                            </div>
                        ) : (
                            <div className="mt-5 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                                Chưa chọn lệnh nào.
                            </div>
                        )}
                    </div>

                    {selectedOrder && (
                        <>
                            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 shadow-sm">
                                <div className="flex items-center gap-2">
                                    <ShieldAlert className="h-5 w-5 text-amber-500" />
                                    <h3 className="text-sm font-black uppercase text-slate-900">Kiểm soát</h3>
                                </div>
                                <div className="mt-4 space-y-3 text-sm text-slate-600">
                                    <div className="flex justify-between">SL yêu cầu: <span className="font-black text-slate-900">{formatNumber(selectedOrder.totalRequestedQty)}</span></div>
                                    <div className="flex justify-between">SL thực nhập: <span className="font-black text-slate-900">{formatNumber(selectedOrder.totalActualQty)}</span></div>
                                    <div className={`pt-2 border-t border-slate-200 font-bold ${selectedOrderDifferences > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                                        {selectedOrderDifferences > 0 ? 'Có chênh lệch cần xác nhận' : 'Không có chênh lệch'}
                                    </div>
                                </div>
                            </div>

                            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                                <div className="flex items-center gap-2">
                                    <History className="h-5 w-5 text-cyan-600" />
                                    <h3 className="text-sm font-black uppercase text-slate-900">Lịch sử hoạt động</h3>
                                </div>
                                <div className="mt-5 space-y-4">
                                    {selectedLogs.length === 0 && <div className="text-sm font-semibold text-slate-500">Chưa có lịch sử.</div>}
                                    {selectedLogs.map((log) => (
                                        <div key={log.id} className="flex gap-3">
                                            <TimelineDot action={log.action} />
                                            <div className="min-w-0 flex-1">
                                                <div className="text-sm font-bold text-slate-900">{actionLabel(log.action)}</div>
                                                <div className="text-xs font-semibold text-slate-500">{log.actorEmail || 'Hệ thống'} • {formatDateTime(log.createdAt)}</div>
                                                {log.metadata && (
                                                    <pre className="mt-2 overflow-x-auto rounded-xl border border-slate-200 bg-slate-50 p-3 text-[11px] font-semibold leading-5 text-slate-600">
                            {JSON.stringify(log.metadata, null, 2)}
                          </pre>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </section>
        </div>
    );
}

function MiniStat({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <div className="text-xs font-black uppercase tracking-wide text-slate-500">{label}</div>
            <div className="mt-1 text-base font-black text-slate-900">{value}</div>
        </div>
    );
}

function Field({
                   label,
                   value,
                   onChange,
               }: {
    label: string;
    value: string;
    onChange?: (value: string) => void;
}) {
    return (
        <div>
            <label className="mb-2 block text-sm font-bold text-slate-700">{label}</label>
            {onChange ? (
                <input
                    value={value}
                    onChange={(event) => onChange(event.target.value)}
                    className="h-11 w-full rounded-xl border-2 border-slate-200 px-4 text-sm font-semibold outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
                />
            ) : (
                <div className="flex h-11 items-center rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-700">
                    {value || '-'}
                </div>
            )}
        </div>
    );
}

function InfoRow({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <span className="text-sm font-semibold text-slate-500">{label}</span>
            <span className="max-w-[55%] truncate text-sm font-black text-slate-900">{value}</span>
        </div>
    );
}