import React from 'react';
import {
  ArrowRightLeft,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  FileText,
  PackageCheck,
  RefreshCw,
  Search,
  Settings2,
  ArrowUpRight,
  Truck,
} from 'lucide-react';
import type { InboundReceipt } from '../types';

type PurchaseOrdersWindowProps = {
  compact?: boolean;
  receipts: InboundReceipt[];
};

type TabId = 'purchase-orders' | 'return-requests' | 'stock-in-orders' | 'stock-in';
type StatusGroup = 'waiting' | 'in-transit' | 'completed' | 'cancelled';
type TimeFilter = 'all' | 'this-month' | '7-days';

const DAY_MS = 24 * 60 * 60 * 1000;

function normalizeText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function formatDate(value?: string) {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '-';
  return parsed.toLocaleDateString('vi-VN');
}

function formatQuantity(value: number) {
  return new Intl.NumberFormat('vi-VN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value || 0);
}

function sumExpected(receipt: InboundReceipt) {
  return (receipt.details || []).reduce((total, detail) => total + (detail.expectedQty || 0), 0);
}

function sumReceived(receipt: InboundReceipt) {
  return (receipt.details || []).reduce((total, detail) => total + (detail.receivedQty || 0), 0);
}

function receiptNumber(receipt: InboundReceipt, index: number) {
  const rawId = String(receipt.id || '').trim();
  if (/^DMH\d+$/i.test(rawId)) return rawId.toUpperCase();
  const digits = rawId.replace(/\D/g, '');
  if (digits) return `DMH${digits.padStart(5, '0')}`;
  return `DMH${String(index + 1).padStart(5, '0')}`;
}

function inferOrderDate(receipt: InboundReceipt) {
  if (!receipt.expectedDate) return null;
  const expected = new Date(receipt.expectedDate);
  if (Number.isNaN(expected.getTime())) return null;
  return new Date(expected.getTime() - 2 * DAY_MS);
}

function getStatusGroup(status?: string): StatusGroup {
  const normalized = (status || 'CREATED').toUpperCase();
  if (normalized === 'RECEIVED' || normalized === 'COMPLETED') return 'completed';
  if (normalized === 'PARTIALLY_RECEIVED' || normalized === 'IN_TRANSIT' || normalized === 'DELIVERING') return 'in-transit';
  if (normalized === 'CANCELLED' || normalized === 'CANCELED') return 'cancelled';
  return 'waiting';
}

function statusLabel(status?: string) {
  const group = getStatusGroup(status);
  if (group === 'completed') return 'Hoàn thành';
  if (group === 'in-transit') return 'Đang giao';
  if (group === 'cancelled') return 'Đã hủy';
  return 'Chờ nhập kho';
}

function statusClass(status?: string) {
  const group = getStatusGroup(status);
  if (group === 'completed') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (group === 'in-transit') return 'border-blue-200 bg-blue-50 text-blue-700';
  if (group === 'cancelled') return 'border-red-200 bg-red-50 text-red-600';
  return 'border-amber-200 bg-amber-50 text-amber-700';
}

function supplierLabel(receipt: InboundReceipt) {
  return receipt.supplier?.name || 'Nhà cung cấp chưa đồng bộ';
}

function supplierCode(receipt: InboundReceipt) {
  return receipt.supplier?.supplierCode || '-';
}

function buildSearchText(receipt: InboundReceipt, index: number) {
  const detailText = (receipt.details || [])
    .map((detail) => [detail.product?.internalSku, detail.product?.name].filter(Boolean).join(' '))
    .join(' ');

  return normalizeText(
    [
      receiptNumber(receipt, index),
      supplierCode(receipt),
      supplierLabel(receipt),
      detailText,
      statusLabel(receipt.status),
      formatDate(receipt.expectedDate),
    ]
      .filter(Boolean)
      .join(' '),
  );
}

function RowActionButton({
  label,
  title,
  icon,
  onClick,
}: {
  label: string;
  title: string;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      title={title}
      aria-label={label}
      className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:border-cyan-300 hover:bg-cyan-50 hover:text-cyan-600"
    >
      {icon}
    </button>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <label className="mb-2 block text-sm font-bold text-slate-700">{label}</label>
      <div className="flex h-11 items-center rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-700">
        {value || '-'}
      </div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
      <span className="text-sm font-semibold text-slate-500">{label}</span>
      <span className="text-sm font-black text-slate-900">{value}</span>
    </div>
  );
}

export default function PurchaseOrdersWindow({ compact, receipts }: PurchaseOrdersWindowProps) {
  const [activeTab, setActiveTab] = React.useState<TabId>('purchase-orders');
  const [search, setSearch] = React.useState('');
  const [timeFilter, setTimeFilter] = React.useState<TimeFilter>('this-month');
  const [statusFilter, setStatusFilter] = React.useState<'all' | StatusGroup>('all');
  const [pageSize, setPageSize] = React.useState(10);
  const [currentPage, setCurrentPage] = React.useState(1);
  const [selectedId, setSelectedId] = React.useState<string | null>(receipts[0]?.id || null);

  React.useEffect(() => {
    if (!selectedId && receipts[0]) {
      setSelectedId(receipts[0].id);
    }
  }, [receipts, selectedId]);

  const sortedReceipts = React.useMemo(
    () =>
      [...receipts].sort((left, right) => {
        const leftTime = left.expectedDate ? new Date(left.expectedDate).getTime() : 0;
        const rightTime = right.expectedDate ? new Date(right.expectedDate).getTime() : 0;
        return rightTime - leftTime;
      }),
    [receipts],
  );

  const filteredReceipts = React.useMemo(() => {
    const keyword = normalizeText(search.trim());
    const now = new Date();

    return sortedReceipts.filter((receipt, index) => {
      const searchable = buildSearchText(receipt, index);
      const matchesKeyword = !keyword || searchable.includes(keyword);
      const statusGroup = getStatusGroup(receipt.status);
      const matchesStatus = statusFilter === 'all' || statusGroup === statusFilter;

      let matchesTime = true;
      if (timeFilter !== 'all') {
        const receiptDate = receipt.expectedDate ? new Date(receipt.expectedDate) : null;
        if (!receiptDate || Number.isNaN(receiptDate.getTime())) {
          matchesTime = false;
        } else if (timeFilter === 'this-month') {
          matchesTime =
            receiptDate.getFullYear() === now.getFullYear() &&
            receiptDate.getMonth() === now.getMonth();
        } else if (timeFilter === '7-days') {
          matchesTime = now.getTime() - receiptDate.getTime() <= 7 * DAY_MS;
        }
      }

      const matchesTab = activeTab === 'purchase-orders';

      return matchesKeyword && matchesStatus && matchesTime && matchesTab;
    });
  }, [activeTab, search, sortedReceipts, statusFilter, timeFilter]);

  React.useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, search, statusFilter, timeFilter]);

  React.useEffect(() => {
    if (filteredReceipts.length === 0) {
      setSelectedId(null);
      return;
    }

    if (!selectedId || !filteredReceipts.some((receipt) => receipt.id === selectedId)) {
      setSelectedId(filteredReceipts[0].id);
    }
  }, [filteredReceipts, selectedId]);

  React.useEffect(() => {
    const nextTotalPages = Math.max(1, Math.ceil(filteredReceipts.length / pageSize));
    if (currentPage > nextTotalPages) {
      setCurrentPage(nextTotalPages);
    }
  }, [currentPage, filteredReceipts.length, pageSize]);

  const selectedReceipt = React.useMemo(
    () => filteredReceipts.find((receipt) => receipt.id === selectedId) || filteredReceipts[0] || null,
    [filteredReceipts, selectedId],
  );

  const totalItems = filteredReceipts.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const paginatedReceipts = filteredReceipts.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const startIndex = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endIndex = Math.min(currentPage * pageSize, totalItems);

  const waitingCount = receipts.filter((receipt) => getStatusGroup(receipt.status) === 'waiting').length;
  const transitCount = receipts.filter((receipt) => getStatusGroup(receipt.status) === 'in-transit').length;
  const completedCount = receipts.filter((receipt) => getStatusGroup(receipt.status) === 'completed').length;
  const selectedExpected = selectedReceipt ? sumExpected(selectedReceipt) : 0;
  const selectedReceived = selectedReceipt ? sumReceived(selectedReceipt) : 0;
  const selectedRate = selectedExpected > 0 ? Math.min(100, Math.round((selectedReceived / selectedExpected) * 100)) : 0;

  const tabs: Array<{ id: TabId; label: string }> = [
    { id: 'purchase-orders', label: 'Đơn mua hàng' },
    { id: 'return-requests', label: 'Đề nghị nhập kho hàng trả lại' },
    { id: 'stock-in-orders', label: 'Lệnh nhập kho' },
    { id: 'stock-in', label: 'Nhập kho' },
  ];

  if (compact) {
    return (
      <div className="flex h-full flex-col gap-3">
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
            <p className="text-xs font-black uppercase text-amber-600">Chờ nhập kho</p>
            <p className="mt-2 text-2xl font-black text-amber-700">{waitingCount}</p>
          </div>
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-3">
            <p className="text-xs font-black uppercase text-blue-600">Đang giao</p>
            <p className="mt-2 text-2xl font-black text-blue-700">{transitCount}</p>
          </div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
            <p className="text-xs font-black uppercase text-emerald-600">Hoàn thành</p>
            <p className="mt-2 text-2xl font-black text-emerald-700">{completedCount}</p>
          </div>
        </div>

        <div className="space-y-2">
          {receipts.slice(0, 3).map((receipt, index) => {
            const expected = sumExpected(receipt);
            const received = sumReceived(receipt);

            return (
              <button
                key={receipt.id}
                type="button"
                onClick={() => setSelectedId(receipt.id)}
                className="w-full rounded-xl border border-slate-200 bg-white p-3 text-left transition hover:border-cyan-300 hover:bg-cyan-50/50"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="font-black text-slate-900">{receiptNumber(receipt, index)}</p>
                  <span className={`rounded-lg border px-2.5 py-1 text-xs font-bold ${statusClass(receipt.status)}`}>
                    {statusLabel(receipt.status)}
                  </span>
                </div>
                <p className="mt-1 text-sm font-semibold text-slate-500">{supplierLabel(receipt)}</p>
                <p className="mt-1 text-xs font-semibold text-slate-400">
                  {formatDate(receipt.expectedDate)} · SL {formatQuantity(received)}/{formatQuantity(expected)}
                </p>
              </button>
            );
          })}

          {receipts.length === 0 && (
            <div className="rounded-xl border border-slate-200 bg-white p-5 text-center text-sm font-semibold text-slate-500">
              Chưa có đơn mua hàng nào được đồng bộ.
            </div>
          )}
        </div>
      </div>
    );
  }

  if (activeTab !== 'purchase-orders') {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`rounded-xl px-4 py-2 text-sm font-bold transition ${
                  tab.id === activeTab
                    ? 'bg-cyan-600 text-white shadow-sm'
                    : 'border border-slate-200 bg-white text-slate-600 hover:border-cyan-300 hover:bg-cyan-50'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
          <ArrowRightLeft className="mx-auto h-10 w-10 text-cyan-500" />
          <h3 className="mt-3 text-xl font-black text-slate-900">{tabs.find((tab) => tab.id === activeTab)?.label}</h3>
          <p className="mt-2 text-sm font-medium text-slate-500">Màn hình này chưa có dữ liệu demo trong component hiện tại.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-xl px-4 py-2 text-sm font-bold transition ${
                tab.id === activeTab
                  ? 'bg-cyan-600 text-white shadow-sm'
                  : 'border border-slate-200 bg-white text-slate-600 hover:border-cyan-300 hover:bg-cyan-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-black uppercase text-slate-500">Tổng số PO</p>
          <p className="mt-2 text-3xl font-black text-slate-900">{receipts.length}</p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
          <p className="text-xs font-black uppercase text-amber-600">Chờ nhập kho</p>
          <p className="mt-2 text-3xl font-black text-amber-700">{waitingCount}</p>
        </div>
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 shadow-sm">
          <p className="text-xs font-black uppercase text-blue-600">Đang giao</p>
          <p className="mt-2 text-3xl font-black text-blue-700">{transitCount}</p>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
          <p className="text-xs font-black uppercase text-emerald-600">Hoàn thành</p>
          <p className="mt-2 text-3xl font-black text-emerald-700">{completedCount}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1.2fr_0.9fr_0.9fr_auto]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="h-11 w-full rounded-xl border-2 border-slate-200 bg-white pl-11 pr-4 text-sm font-medium outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
              placeholder="Tìm kiếm số đơn, nhà cung cấp, sản phẩm..."
            />
          </div>
          <select
            value={timeFilter}
            onChange={(event) => setTimeFilter(event.target.value as TimeFilter)}
            className="h-11 rounded-xl border-2 border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
          >
            <option value="this-month">Thời gian: Tháng này</option>
            <option value="7-days">Thời gian: 7 ngày gần đây</option>
            <option value="all">Thời gian: Tất cả</option>
          </select>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as 'all' | StatusGroup)}
            className="h-11 rounded-xl border-2 border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
          >
            <option value="all">Tình trạng nhận hàng: Tất cả</option>
            <option value="waiting">Tình trạng nhận hàng: Chờ nhập kho</option>
            <option value="in-transit">Tình trạng nhận hàng: Đang giao</option>
            <option value="completed">Tình trạng nhận hàng: Hoàn thành</option>
          </select>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setTimeFilter('this-month');
                setStatusFilter('all');
              }}
              className="inline-flex h-11 items-center justify-center rounded-xl border-2 border-slate-200 bg-white px-3 text-slate-500 transition hover:bg-slate-50 hover:text-slate-700"
              title="Đặt lại bộ lọc"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="inline-flex h-11 items-center justify-center rounded-xl border-2 border-slate-200 bg-white px-3 text-slate-500 transition hover:bg-slate-50 hover:text-slate-700"
              title="Bố cục"
            >
              <ArrowUpRight className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="inline-flex h-11 items-center justify-center rounded-xl border-2 border-slate-200 bg-white px-3 text-slate-500 transition hover:bg-slate-50 hover:text-slate-700"
              title="Cài đặt"
            >
              <Settings2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1220px] border-collapse bg-white">
            <thead className="bg-slate-50">
              <tr className="border-b border-slate-200">
                <th className="w-16 border-x border-slate-200 px-3 py-4 text-center text-sm font-black uppercase text-slate-700">#</th>
                <th className="border-x border-slate-200 px-3 py-4 text-left text-sm font-black uppercase text-slate-700">Số đơn hàng</th>
                <th className="border-x border-slate-200 px-3 py-4 text-center text-sm font-black uppercase text-slate-700">Ngày đơn hàng</th>
                <th className="border-x border-slate-200 px-3 py-4 text-left text-sm font-black uppercase text-slate-700">Tên nhà cung cấp</th>
                <th className="border-x border-slate-200 px-3 py-4 text-center text-sm font-black uppercase text-slate-700">Ngày giao hàng</th>
                <th className="border-x border-slate-200 px-3 py-4 text-left text-sm font-black uppercase text-slate-700">Diễn giải</th>
                <th className="border-x border-slate-200 px-3 py-4 text-center text-sm font-black uppercase text-slate-700">Tình trạng</th>
                <th className="sticky right-0 w-28 border-l border-slate-200 bg-slate-50 px-3 py-4 text-center text-sm font-black uppercase text-slate-700 shadow-[-4px_0_12px_rgba(0,0,0,0.03)]">
                  Thao tác
                </th>
              </tr>
            </thead>
            <tbody>
              {paginatedReceipts.length ? (
                paginatedReceipts.map((receipt, index) => {
                  const number = receiptNumber(receipt, (currentPage - 1) * pageSize + index);
                  const isSelected = receipt.id === selectedId;

                  return (
                    <tr
                      key={receipt.id}
                      onClick={() => setSelectedId(receipt.id)}
                      className={`group cursor-pointer border-b border-slate-200 transition hover:bg-cyan-50/60 ${
                        isSelected ? 'bg-blue-50/60' : ''
                      }`}
                      aria-selected={isSelected}
                    >
                      <td className="border-x border-slate-200 px-3 py-4 text-center text-sm font-semibold text-slate-600">
                        {startIndex + index}
                      </td>
                      <td className="border-x border-slate-200 px-3 py-4 text-sm font-black text-blue-600">
                        {number}
                      </td>
                      <td className="border-x border-slate-200 px-3 py-4 text-center text-sm font-semibold text-slate-700">
                        <span className="inline-flex items-center gap-2">
                          <CalendarDays className="h-4 w-4 text-slate-400" />
                          {formatDate(inferOrderDate(receipt)?.toISOString())}
                        </span>
                      </td>
                      <td className="border-x border-slate-200 px-3 py-4 text-sm font-semibold text-slate-700">
                        {supplierLabel(receipt)}
                      </td>
                      <td className="border-x border-slate-200 px-3 py-4 text-center text-sm font-semibold text-slate-700">
                        {formatDate(receipt.expectedDate)}
                      </td>
                      <td className="border-x border-slate-200 px-3 py-4 text-sm font-medium text-slate-500">-</td>
                      <td className="border-x border-slate-200 px-3 py-4 text-center align-middle">
                        <span className={`inline-flex items-center gap-1 rounded-lg border px-3 py-1 text-xs font-bold ${statusClass(receipt.status)}`}>
                          <Truck className="h-3.5 w-3.5" />
                          {statusLabel(receipt.status)}
                        </span>
                      </td>
                      <td className="sticky right-0 border-l border-slate-200 bg-white px-3 py-4 text-center align-middle shadow-[-4px_0_12px_rgba(0,0,0,0.03)] group-hover:bg-cyan-50/60">
                        <div className="flex items-center justify-center gap-2">
                          <RowActionButton
                            label="Xem chi tiết"
                            title="Xem chi tiết"
                            icon={<ArrowUpRight className="h-4 w-4" />}
                            onClick={() => setSelectedId(receipt.id)}
                          />
                          <RowActionButton
                            label="Lập lệnh nhập kho"
                            title="Lập lệnh nhập kho"
                            icon={<ChevronRight className="h-4 w-4" />}
                            onClick={() => setSelectedId(receipt.id)}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} className="px-6 py-14 text-center">
                    <PackageCheck className="mx-auto h-10 w-10 text-slate-300" />
                    <p className="mt-3 text-sm font-semibold text-slate-500">Chưa có đơn mua hàng phù hợp với bộ lọc hiện tại.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col items-center justify-between gap-4 border-t border-slate-200 bg-slate-50/50 px-6 py-3 sm:flex-row">
          <div className="text-sm text-slate-600">
            Tổng số: <b>{totalItems}</b>
            {totalItems > 0 && (
              <span className="ml-2">
                Hiển thị {startIndex} - {endIndex}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-slate-600">Số dòng/trang</span>
            <select
              value={pageSize}
              onChange={(event) => {
                setPageSize(Number(event.target.value));
                setCurrentPage(1);
              }}
              className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-40"
              >
                «
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                disabled={currentPage === 1}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-40"
              >
                ‹
              </button>
              <button
                type="button"
                className="flex h-9 min-w-9 items-center justify-center rounded-lg bg-cyan-600 px-3 text-sm font-bold text-white"
              >
                {currentPage}
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                disabled={currentPage === totalPages}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-40"
              >
                ›
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-40"
              >
                »
              </button>
            </div>
          </div>
        </div>
      </div>

      {selectedReceipt && (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
            <div>
              <p className="text-2xl font-black text-slate-900">Đơn mua hàng {receiptNumber(selectedReceipt, 0)}</p>
              <p className="mt-1 text-sm font-medium text-slate-500">
                Dữ liệu đồng bộ từ nhà cung cấp {supplierLabel(selectedReceipt)}.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className={`rounded-lg border px-3 py-1 text-sm font-bold ${statusClass(selectedReceipt.status)}`}>
                {statusLabel(selectedReceipt.status)}
              </span>
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                title="Đóng chi tiết"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
            </div>
          </div>

          <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_280px]">
            <div className="border-b border-slate-200 p-5 lg:border-b-0 lg:border-r">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                <Field label="Mã nhà cung cấp" value={supplierCode(selectedReceipt)} />
                <Field label="Tên nhà cung cấp" value={supplierLabel(selectedReceipt)} />
                <Field label="Số đơn hàng" value={receiptNumber(selectedReceipt, 0)} />
                <Field label="Ngày đơn hàng" value={formatDate(inferOrderDate(selectedReceipt)?.toISOString())} />
                <Field label="Ngày giao hàng" value={formatDate(selectedReceipt.expectedDate)} />
                <Field label="Tình trạng nhập kho" value={statusLabel(selectedReceipt.status)} />
                <Field label="Tình trạng nhận hàng" value={statusLabel(selectedReceipt.status)} />
                <Field label="Diễn giải" value="-" />
                <Field label="Tham chiếu" value="LNK00055" />
              </div>
            </div>

            <div className="p-5">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center gap-2">
                  <Clock3 className="h-4 w-4 text-cyan-600" />
                  <p className="text-sm font-black uppercase text-slate-700">Tổng quan</p>
                </div>
                <div className="mt-4 space-y-3">
                  <SummaryRow label="Số dòng hàng" value={`${selectedReceipt.details?.length || 0}`} />
                  <SummaryRow label="SL yêu cầu" value={formatQuantity(selectedExpected)} />
                  <SummaryRow label="SL đã nhận" value={formatQuantity(selectedReceived)} />
                  <SummaryRow label="Tỷ lệ nhận" value={`${selectedRate}%`} />
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-200 px-5 py-4">
            <div className="mb-3 flex items-center gap-2">
              <FileText className="h-5 w-5 text-cyan-600" />
              <h3 className="text-lg font-black text-slate-900">Hàng hóa</h3>
            </div>
            <div className="overflow-hidden rounded-xl border border-slate-200">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[980px] border-collapse bg-white">
                  <thead className="bg-slate-50">
                    <tr className="border-b border-slate-200">
                      <th className="w-14 border-x border-slate-200 px-3 py-3 text-center text-sm font-black uppercase text-slate-700">#</th>
                      <th className="border-x border-slate-200 px-3 py-3 text-left text-sm font-black uppercase text-slate-700">Mã hàng</th>
                      <th className="border-x border-slate-200 px-3 py-3 text-left text-sm font-black uppercase text-slate-700">Tên hàng</th>
                      <th className="border-x border-slate-200 px-3 py-3 text-center text-sm font-black uppercase text-slate-700">Mã quy cách</th>
                      <th className="border-x border-slate-200 px-3 py-3 text-left text-sm font-black uppercase text-slate-700">Kho</th>
                      <th className="border-x border-slate-200 px-3 py-3 text-center text-sm font-black uppercase text-slate-700">Đơn vị tính</th>
                      <th className="border-x border-slate-200 px-3 py-3 text-right text-sm font-black uppercase text-slate-700">SL yêu cầu</th>
                      <th className="border-x border-slate-200 px-3 py-3 text-right text-sm font-black uppercase text-slate-700">SL đã nhận</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(selectedReceipt.details || []).length ? (
                      (selectedReceipt.details || []).map((detail, index) => (
                        <tr key={detail.id} className="border-b border-slate-200 transition hover:bg-cyan-50/40">
                          <td className="border-x border-slate-200 px-3 py-3 text-center text-sm font-semibold text-slate-700">
                            {index + 1}
                          </td>
                          <td className="border-x border-slate-200 px-3 py-3 text-sm font-bold text-slate-800">
                            {detail.product?.internalSku || '-'}
                          </td>
                          <td className="border-x border-slate-200 px-3 py-3 text-sm font-semibold text-slate-700">
                            {detail.product?.name || '-'}
                          </td>
                          <td className="border-x border-slate-200 px-3 py-3 text-center text-sm font-semibold text-slate-500">-</td>
                          <td className="border-x border-slate-200 px-3 py-3 text-sm font-medium text-slate-600">Kho nguyên vật liệu</td>
                          <td className="border-x border-slate-200 px-3 py-3 text-center text-sm font-semibold text-slate-700">
                            {detail.product?.unit || '-'}
                          </td>
                          <td className="border-x border-slate-200 px-3 py-3 text-right text-sm font-black text-slate-800">
                            {formatQuantity(detail.expectedQty)}
                          </td>
                          <td className="border-x border-slate-200 px-3 py-3 text-right text-sm font-black text-slate-800">
                            {formatQuantity(detail.receivedQty)}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={8} className="px-6 py-12 text-center text-sm font-semibold text-slate-500">
                          Đơn hàng này chưa có dòng hàng nào.
                        </td>
                      </tr>
                    )}
                    <tr className="bg-slate-50">
                      <td colSpan={6} className="border-x border-slate-200 px-3 py-3 text-right text-sm font-black uppercase text-slate-700">
                        Tổng cộng
                      </td>
                      <td className="border-x border-slate-200 px-3 py-3 text-right text-sm font-black text-slate-900">
                        {formatQuantity(selectedExpected)}
                      </td>
                      <td className="border-x border-slate-200 px-3 py-3 text-right text-sm font-black text-slate-900">
                        {formatQuantity(selectedReceived)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex flex-col gap-3 border-t border-slate-200 px-5 py-4 sm:flex-row sm:justify-end">
              <button
                type="button"
                className="inline-flex items-center justify-center rounded-xl border-2 border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
              >
                Hoàn thành
              </button>
              <button
                type="button"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-cyan-700"
              >
                <Truck className="h-4 w-4" />
                Lập lệnh nhập kho
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
