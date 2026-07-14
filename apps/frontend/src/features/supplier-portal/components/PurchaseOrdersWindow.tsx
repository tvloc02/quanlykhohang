import React from 'react';
import { useNavigate } from 'react-router-dom';
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
  X,
} from 'lucide-react';
import type { InboundReceipt } from '../types';

type PurchaseOrdersWindowProps = {
  compact?: boolean;
  receipts: InboundReceipt[];
};

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

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
  };
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
  if (normalized === 'SUPPLIER_APPROVED' || normalized === 'PARTIALLY_RECEIVED' || normalized === 'IN_TRANSIT' || normalized === 'DELIVERING') return 'in-transit';
  if (normalized === 'CANCELLED' || normalized === 'CANCELED') return 'cancelled';
  return 'waiting';
}

function statusLabel(status?: string) {
  const normalized = (status || 'CREATED').toUpperCase();
  const group = getStatusGroup(status);
  if (normalized === 'APPROVED') return 'Chờ NCC xác nhận';
  if (normalized === 'SUPPLIER_APPROVED') return 'NCC đã xác nhận';
  if (group === 'completed') return 'Hoàn thành';
  if (group === 'in-transit') return 'Đang giao';
  if (group === 'cancelled') return 'Đã hủy';
  return 'Chờ manager duyệt';
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
  const [search, setSearch] = React.useState('');
  const [timeFilter, setTimeFilter] = React.useState<TimeFilter>('this-month');
  const [statusFilter, setStatusFilter] = React.useState<'all' | StatusGroup>('all');
  const [pageSize, setPageSize] = React.useState(10);
  const [currentPage, setCurrentPage] = React.useState(1);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [creatingStockIn, setCreatingStockIn] = React.useState(false);
  const navigate = useNavigate();



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

      return matchesKeyword && matchesStatus && matchesTime;
    });
  }, [search, sortedReceipts, statusFilter, timeFilter]);

  React.useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter, timeFilter]);



  React.useEffect(() => {
    const nextTotalPages = Math.max(1, Math.ceil(filteredReceipts.length / pageSize));
    if (currentPage > nextTotalPages) {
      setCurrentPage(nextTotalPages);
    }
  }, [currentPage, filteredReceipts.length, pageSize]);

  const selectedReceipt = React.useMemo(
    () => filteredReceipts.find((receipt) => receipt.id === selectedId) || null,
    [filteredReceipts, selectedId],
  );

  const API_BASE_URL = 'http://localhost:3000/api';
  const [isAsnModalOpen, setIsAsnModalOpen] = React.useState(false);
  const [asnDate, setAsnDate] = React.useState('');
  const [asnNote, setAsnNote] = React.useState('');
  const [asnItems, setAsnItems] = React.useState<Array<{ id: string; expectedQty: number; name: string; sku: string }>>([]);
  const [loadedReceipt, setLoadedReceipt] = React.useState<InboundReceipt | null>(null);
  const [loadingDetails, setLoadingDetails] = React.useState(false);

  // Load full details when a receipt is selected
  React.useEffect(() => {
    if (!selectedReceipt) {
      setLoadedReceipt(null);
      return;
    }

    setLoadingDetails(true);
    const loadDetails = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/inbound/purchase-orders/${selectedReceipt.id}`, {
          headers: authHeaders(),
        });
        if (response.ok) {
          const fullReceipt = await response.json() as InboundReceipt;
          setLoadedReceipt(fullReceipt);
        }
      } catch (err) {
        console.error('Failed to load receipt details:', err);
        setLoadedReceipt(selectedReceipt);
      } finally {
        setLoadingDetails(false);
      }
    };
    void loadDetails();
  }, [selectedReceipt?.id]);

  React.useEffect(() => {
    const receipt = loadedReceipt || selectedReceipt;
    if (receipt) {
      setAsnDate(receipt.expectedDate ? receipt.expectedDate.split('T')[0] : '');
      setAsnNote(receipt.description || '');
      setAsnItems((receipt.details || []).map(d => ({
        id: d.id,
        expectedQty: d.expectedQty || 0,
        name: d.product?.name || '',
        sku: d.product?.internalSku || ''
      })));
    }
  }, [loadedReceipt, selectedReceipt]);

  const handleAsnSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReceipt) return;

    try {
      const response = await fetch(`${API_BASE_URL}/inbound/purchase-orders/${selectedReceipt.id}/supplier-approve`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          expectedDate: asnDate,
          description: asnNote,
        })
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data?.message || 'Khong xac nhan duoc don mua hang');
      }

      setIsAsnModalOpen(false);
      window.location.reload();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Đã có lỗi xảy ra');
    }
  };

  const handleRejectOrder = async () => {
    if (!selectedReceipt) return;
    const reason = window.prompt('Vui lòng nhập lý do từ chối đơn hàng:');
    if (reason === null) return; // User cancelled

    try {
      const response = await fetch(`${API_BASE_URL}/inbound/purchase-orders/${selectedReceipt.id}/supplier-reject`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ reason })
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data?.message || 'Không thể từ chối đơn hàng');
      }

      window.location.reload();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Đã có lỗi xảy ra');
    }
  };

  const totalItems = filteredReceipts.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const paginatedReceipts = filteredReceipts.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const startIndex = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endIndex = Math.min(currentPage * pageSize, totalItems);

  const waitingCount = receipts.filter((receipt) => getStatusGroup(receipt.status) === 'waiting').length;
  const transitCount = receipts.filter((receipt) => getStatusGroup(receipt.status) === 'in-transit').length;
  const completedCount = receipts.filter((receipt) => getStatusGroup(receipt.status) === 'completed').length;
  const displayReceipt = loadedReceipt || selectedReceipt;
  const selectedExpected = displayReceipt ? sumExpected(displayReceipt) : 0;
  const selectedReceived = displayReceipt ? sumReceived(displayReceipt) : 0;
  const selectedRate = selectedExpected > 0 ? Math.min(100, Math.round((selectedReceived / selectedExpected) * 100)) : 0;

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

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="flex h-[72px] items-center justify-center rounded-xl bg-[#4295b4] px-4 shadow-sm">
          <p className="text-lg font-bold text-white uppercase">{receipts.length} TỔNG PO</p>
        </div>
        <div className="flex h-[72px] items-center justify-center rounded-xl bg-[#4295b4] px-4 shadow-sm">
          <p className="text-lg font-bold text-white uppercase">{waitingCount} CHỜ DUYỆT</p>
        </div>
        <div className="flex h-[72px] items-center justify-center rounded-xl bg-[#4295b4] px-4 shadow-sm">
          <p className="text-lg font-bold text-white uppercase">{transitCount} ĐÃ DUYỆT</p>
        </div>
        <div className="flex h-[72px] items-center justify-center rounded-xl bg-[#4295b4] px-4 shadow-sm">
          <p className="text-lg font-bold text-white uppercase">{completedCount} HOÀN THÀNH</p>
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
                            label="Mở chi tiết"
                            title="Mở chi tiết"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-6xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl">
          <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
            <div>
              <p className="text-2xl font-black text-slate-900">Đơn mua hàng {receiptNumber(displayReceipt || selectedReceipt, 0)}</p>
              <p className="mt-1 text-sm font-medium text-slate-500">
                Dữ liệu đồng bộ từ nhà cung cấp {supplierLabel(displayReceipt || selectedReceipt)}.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className={`rounded-lg border px-3 py-1 text-sm font-bold ${statusClass(displayReceipt?.status)}`}>
                {statusLabel(displayReceipt?.status)}
              </span>
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                title="Đóng chi tiết"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_280px]">
            <div className="border-b border-slate-200 p-5 lg:border-b-0 lg:border-r">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                <Field label="Mã nhà cung cấp" value={supplierCode(displayReceipt || selectedReceipt)} />
                <Field label="Tên nhà cung cấp" value={supplierLabel(displayReceipt || selectedReceipt)} />
                <Field label="Số đơn hàng" value={receiptNumber(displayReceipt || selectedReceipt, 0)} />
                <Field label="Ngày đơn hàng" value={formatDate(inferOrderDate(displayReceipt || selectedReceipt)?.toISOString())} />
                <Field label="Ngày giao hàng" value={formatDate((displayReceipt || selectedReceipt)?.expectedDate)} />
                <Field label="Tình trạng nhập kho" value={statusLabel(displayReceipt?.status)} />
                <Field label="Tình trạng nhập kho" value={statusLabel(displayReceipt?.status)} />
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
                  <SummaryRow label="Số dòng hàng" value={`${displayReceipt?.details?.length || 0}`} />
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
                    {(displayReceipt?.details || []).length ? (
                      (displayReceipt?.details || []).map((detail, index) => (
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
                {displayReceipt?.status && displayReceipt.status.toUpperCase() === 'APPROVED' && (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleRejectOrder}
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-5 py-2.5 text-sm font-bold text-red-600 shadow-sm transition hover:bg-red-100"
                    >
                      <X className="h-4 w-4" />
                      Từ chối
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsAsnModalOpen(true)}
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-cyan-700"
                    >
                      <Truck className="h-4 w-4" />
                      Xác nhận đơn mua hàng
                    </button>
                  </div>
                )}
                {displayReceipt?.status && displayReceipt.status.toUpperCase() === 'SUPPLIER_APPROVED' && (
                  <button
                    type="button"
                    onClick={async () => {
                      if (!displayReceipt || creatingStockIn) return;
                      try {
                        setCreatingStockIn(true);
                        const resp = await fetch(`${API_BASE_URL}/inbound/stock-in-orders/from-purchase-orders/${displayReceipt.id}`, {
                          method: 'POST',
                          headers: authHeaders(),
                        });
                        if (!resp.ok) {
                          const data = await resp.json().catch(() => ({}));
                          throw new Error(data?.message || 'Không tạo được phiếu nhập kho');
                        }
                        const created = await resp.json();
                        // Show success and navigate to phiếu nhập kho list
                        window.alert(`Đã tạo phiếu nhập kho ${created.orderCode}`);
                        navigate('/inbound/stock-in-orders');
                      } catch (err) {
                        const msg = err instanceof Error ? err.message : 'Lỗi khi tạo phiếu nhập kho';
                        window.alert(msg);
                      } finally {
                        setCreatingStockIn(false);
                      }
                    }}
                    disabled={creatingStockIn}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-cyan-700 disabled:opacity-60"
                  >
                    <PackageCheck className="h-4 w-4" />
                    {creatingStockIn ? 'Đang tạo...' : 'Tạo phiếu nhập kho'}
                  </button>
                )}
            </div>
            </div>
          </div>
        </div>
      )}

      {isAsnModalOpen && selectedReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <h3 className="text-xl font-black text-slate-900">Gửi thông báo giao hàng trước (ASN)</h3>
              <button
                type="button"
                onClick={() => setIsAsnModalOpen(false)}
                className="rounded-xl p-2 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleAsnSubmit} className="mt-4 space-y-4">
              <div>
                <label className="mb-2 block text-sm font-bold text-slate-700">Ngày giao hàng dự kiến</label>
                <input
                  type="date"
                  value={asnDate}
                  onChange={(e) => setAsnDate(e.target.value)}
                  className="h-11 w-full rounded-xl border-2 border-slate-200 px-4 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
                  required
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold text-slate-700">Diễn giải / Ghi chú giao hàng</label>
                <textarea
                  value={asnNote}
                  onChange={(e) => setAsnNote(e.target.value)}
                  className="w-full rounded-xl border-2 border-slate-200 px-4 py-2 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
                  rows={3}
                  placeholder="Nhập thông tin biển số xe, người vận chuyển..."
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold text-slate-700">Chi tiết số lượng giao hàng</label>
                <div className="max-h-48 overflow-y-auto space-y-2 border border-slate-200 rounded-xl p-3 bg-slate-50">
                  {asnItems.map((item, idx) => (
                    <div key={item.id} className="flex items-center justify-between gap-4 border-b border-slate-100 pb-2 last:border-0 last:pb-0">
                      <div>
                        <p className="text-sm font-bold text-slate-800">{item.sku} - {item.name}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-400 font-semibold">Số lượng:</span>
                        <input
                          type="number"
                          min={1}
                          value={item.expectedQty}
                          onChange={(e) => {
                            const newQty = Number(e.target.value);
                            setAsnItems(prev => prev.map((it, i) => i === idx ? { ...it, expectedQty: newQty } : it));
                          }}
                          className="h-9 w-24 rounded-lg border border-slate-300 bg-white px-2 text-right text-sm font-bold outline-none focus:border-cyan-500"
                          required
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsAsnModalOpen(false)}
                  className="rounded-xl border-2 border-slate-200 px-5 py-2.5 font-bold text-slate-600 hover:bg-slate-50"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-cyan-600 px-6 py-2.5 font-bold text-white shadow-sm hover:bg-cyan-700"
                >
                  Xác nhận gửi ASN
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
