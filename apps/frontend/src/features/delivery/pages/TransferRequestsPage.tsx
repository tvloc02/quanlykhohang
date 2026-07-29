import React from 'react';
import {
  ChevronDown,
  Clock3,
  CheckCircle2,
  Eye,
  FileText,
  Filter,
  Package,
  Pencil,
  PlusCircle,
  MoreHorizontal,
  RefreshCw,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import CreateTransferRequestModal from '../components/CreateTransferRequestModal';
import TransferOrderModal from '../components/TransferOrderModal';
import { getStoredWarehouses, type WarehouseRecord } from '../../../shared/utils/warehouseAssignments';

type Toast = {
  type: 'success' | 'error';
  message: string;
};

type TransferRequestLine = {
  id: string;
  productCode: string;
  productName: string;
  unit: string;
  quantity: number;
  sourceWarehouse: string;
  destinationWarehouse: string;
};

type TransferRequest = {
  id: string;
  requestNumber: string;
  createdDate: string;
  status: 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'COMPLETED';
  description: string;
  createdBy: string;
  sourceWarehouse: string;
  destinationWarehouse: string;
  items: TransferRequestLine[];
};

type TimeFilter = 'this-month' | '7-days' | 'all';
type StatusFilter = 'all' | 'draft' | 'pending' | 'approved' | 'completed' | 'rejected';
type ModalMode = 'view' | 'create' | null;

function formatDateTime(value: string) {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString('vi-VN');
}

function renderWarehouse(wh?: string, warehousesList: WarehouseRecord[] = []) {
  if (!wh) return '-';
  const found = warehousesList.find(
    (w) => w.code === wh || w.id === wh || w.name === wh
  );
  if (found) {
    if (found.name && found.code && found.name !== found.code) {
      return `${found.name} (${found.code})`;
    }
    return found.name || found.code;
  }
  return wh;
}

function formatStatus(status: TransferRequest['status']) {
  switch (status) {
    case 'DRAFT':
      return 'Nháp';
    case 'PENDING':
      return 'Chờ duyệt';
    case 'APPROVED':
      return 'Đã duyệt';
    case 'REJECTED':
      return 'Từ chối';
    case 'COMPLETED':
      return 'Hoàn thành';
    default:
      return status;
  }
}

const warehouseOptions = [{ value: '', label: 'Tất cả kho' }];

function statusClass(status: TransferRequest['status']) {
  switch (status) {
    case 'DRAFT':
      return 'border-slate-200 bg-slate-100 text-slate-700';
    case 'PENDING':
      return 'border-amber-200 bg-amber-50 text-amber-700';
    case 'APPROVED':
      return 'border-cyan-200 bg-cyan-50 text-cyan-700';
    case 'REJECTED':
      return 'border-red-200 bg-red-50 text-red-700';
    case 'COMPLETED':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    default:
      return 'border-slate-200 bg-slate-100 text-slate-700';
  }
}

function Input({
  label,
  value,
  onChange,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: React.InputHTMLAttributes<HTMLInputElement>['type'];
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-bold text-slate-700">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full rounded-xl border-2 border-cyan-500 bg-white px-4 text-sm font-semibold outline-none transition focus:border-cyan-600 focus:ring-4 focus:ring-cyan-500/10 shadow-sm"
      />
    </div>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
  className = '',
}: {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  className?: string;
}) {
  const [isOpen, setIsOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOption = options.find((o) => o.value === value);

  const selectBody = (
    <div ref={containerRef} className="relative min-w-[180px]">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`h-11 w-full rounded-xl border-2 border-cyan-500 bg-white px-4 pr-10 text-left text-sm font-bold text-slate-700 outline-none transition focus:border-cyan-600 focus:ring-4 focus:ring-cyan-500/10 shadow-sm flex items-center justify-between cursor-pointer ${className}`}
      >
        <span className="truncate pr-2">{selectedOption ? selectedOption.label : 'Chọn...'}</span>
        <ChevronDown className={`h-4 w-4 text-cyan-600 shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1.5 rounded-xl border-2 border-cyan-500 bg-white p-1.5 shadow-2xl z-[9999] animate-in fade-in duration-100">
          {options.length === 0 ? (
            <div className="px-4 py-3 text-sm font-semibold text-slate-400 text-center">Không có lựa chọn</div>
          ) : (
            options.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
                className={`w-full rounded-lg px-4 py-2.5 text-left text-sm font-bold transition ${
                  option.value === value
                    ? 'bg-cyan-50 text-cyan-700 font-black'
                    : 'text-slate-700 hover:bg-cyan-50/50 hover:text-cyan-600'
                }`}
              >
                {option.label}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );

  if (label) {
    return (
      <div>
        <label className="mb-2 block text-sm font-bold text-slate-700">{label}</label>
        {selectBody}
      </div>
    );
  }

  return selectBody;
}

export default function TransferRequestsPage() {
  const [toast, setToast] = React.useState<Toast | null>(null);
  const [search, setSearch] = React.useState('');
  const [timeFilter, setTimeFilter] = React.useState<TimeFilter>('this-month');
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>('all');
  const [showAdvancedFilters, setShowAdvancedFilters] = React.useState(false);
  const [requests, setRequests] = React.useState<TransferRequest[]>([]);
  const [modalMode, setModalMode] = React.useState<ModalMode>(null);
  const [selectedRequest, setSelectedRequest] = React.useState<TransferRequest | null>(null);
  const [transferOrderRequest, setTransferOrderRequest] = React.useState<TransferRequest | null>(null);
  const [isTransferOrderModalOpen, setIsTransferOrderModalOpen] = React.useState(false);
  const [activeActionMenuId, setActiveActionMenuId] = React.useState<string | null>(null);
  const [warehouses, setWarehouses] = React.useState<WarehouseRecord[]>(() => getStoredWarehouses());

  React.useEffect(() => {
    async function loadWarehouses() {
      try {
        const res = await fetch('http://localhost:3000/api/warehouses', {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
          },
        });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            setWarehouses(data);
          }
        }
      } catch (e) {
        console.error('Lỗi tải danh sách kho', e);
      }
    }
    loadWarehouses();
  }, []);

  const loadRequests = React.useCallback(() => {
    try {
      const raw = localStorage.getItem('wms_transfer_requests');
      if (raw) {
        setRequests(JSON.parse(raw));
      } else {
        setRequests([]);
      }
    } catch {
      setRequests([]);
    }
  }, []);

  React.useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  React.useEffect(() => {
    function handleDocumentMouseDown(event: MouseEvent) {
      const target = event.target as HTMLElement | null;
      if (target && !target.closest('[data-action-menu]')) {
        setActiveActionMenuId(null);
      }
    }

    document.addEventListener('mousedown', handleDocumentMouseDown);
    return () => document.removeEventListener('mousedown', handleDocumentMouseDown);
  }, []);

  const handleDeleteRequest = (id: string) => {
    const updated = requests.filter((r) => r.id !== id);
    setRequests(updated);
    localStorage.setItem('wms_transfer_requests', JSON.stringify(updated));
    setToast({ type: 'success', message: 'Đã xóa yêu cầu điều chuyển!' });
  };

  const approveRequest = (request: TransferRequest) => {
    const updated = requests.map((item) =>
      item.id === request.id ? { ...item, status: 'APPROVED' as const } : item
    );
    setRequests(updated);
    localStorage.setItem('wms_transfer_requests', JSON.stringify(updated));
    setToast({ type: 'success', message: 'Đã duyệt yêu cầu điều chuyển!' });
    setActiveActionMenuId(null);
  };

  React.useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const filteredRequests = requests.filter((request) => {
    const query = search.trim().toLowerCase();
    const matchesSearch =
      !query ||
      request.requestNumber.toLowerCase().includes(query) ||
      request.description.toLowerCase().includes(query) ||
      request.createdBy.toLowerCase().includes(query) ||
      request.sourceWarehouse.toLowerCase().includes(query) ||
      request.destinationWarehouse.toLowerCase().includes(query);
    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'draft' && request.status === 'DRAFT') ||
      (statusFilter === 'pending' && request.status === 'PENDING') ||
      (statusFilter === 'approved' && request.status === 'APPROVED') ||
      (statusFilter === 'completed' && request.status === 'COMPLETED') ||
      (statusFilter === 'rejected' && request.status === 'REJECTED');
    return matchesSearch && matchesStatus;
  });

  const [pageSize, setPageSize] = React.useState(20);
  const [currentPage, setCurrentPage] = React.useState(1);

  React.useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter, timeFilter]);

  const totalItems = filteredRequests.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const startIndex = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endIndex = Math.min(currentPage * pageSize, totalItems);
  const paginatedRequests = filteredRequests.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const openCreate = () => {
    setModalMode('create');
  };

  const openView = (request: TransferRequest) => {
    setSelectedRequest(request);
    setModalMode('view');
    setActiveActionMenuId(null);
  };

  const openTransferOrderModal = (request: TransferRequest) => {
    setTransferOrderRequest(request);
    setIsTransferOrderModalOpen(true);
    setActiveActionMenuId(null);
  };

  const closeModal = () => {
    setModalMode(null);
    setSelectedRequest(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <div className="inline-flex items-center gap-2.5 rounded-xl border-2 border-cyan-500 bg-cyan-600 px-4 py-2 text-white shadow-md">
            <Package className="h-5 w-5 text-cyan-100" />
            <h1 className="text-lg font-bold tracking-tight text-white">Yêu Cầu Điều Chuyển</h1>
          </div>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-cyan-500 bg-cyan-600 px-5 py-2.5 text-sm font-bold text-white shadow-md transition hover:bg-cyan-700"
        >
          <PlusCircle className="h-4 w-4" />
          Tạo yêu cầu điều chuyển
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="flex h-[72px] items-center justify-center rounded-xl border-2 border-cyan-500 bg-white px-4 shadow-sm transition hover:bg-cyan-50">
          <p className="text-lg font-black text-cyan-700 uppercase">{requests.length} TỔNG YÊU CẦU</p>
        </div>
        <div className="flex h-[72px] items-center justify-center rounded-xl border-2 border-cyan-500 bg-white px-4 shadow-sm transition hover:bg-cyan-50">
          <p className="text-lg font-black text-cyan-700 uppercase">{requests.filter((r) => r.status === 'PENDING').length} CHỜ DUYỆT</p>
        </div>
        <div className="flex h-[72px] items-center justify-center rounded-xl border-2 border-cyan-500 bg-white px-4 shadow-sm transition hover:bg-cyan-50">
          <p className="text-lg font-black text-cyan-700 uppercase">{requests.filter((r) => r.status === 'APPROVED').length} ĐÃ DUYỆT</p>
        </div>
        <div className="flex h-[72px] items-center justify-center rounded-xl border-2 border-cyan-500 bg-white px-4 shadow-sm transition hover:bg-cyan-50">
          <p className="text-lg font-black text-cyan-700 uppercase">{requests.filter((r) => r.status === 'COMPLETED').length} HOÀN THÀNH</p>
        </div>
      </div>

      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-cyan-500" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="h-11 w-full rounded-xl border-2 border-cyan-500 bg-white pl-11 pr-4 text-sm font-semibold outline-none transition focus:border-cyan-600 focus:ring-4 focus:ring-cyan-500/10 shadow-sm"
            placeholder="Tìm theo số yêu cầu, kho, người tạo..."
          />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Select
            value={timeFilter}
            onChange={(value) => setTimeFilter(value as TimeFilter)}
            options={[
              { value: 'this-month', label: 'Thời gian: Tháng này' },
              { value: '7-days', label: 'Thời gian: 7 ngày gần đây' },
              { value: 'all', label: 'Thời gian: Tất cả' },
            ]}
          />
          <Select
            value={statusFilter}
            onChange={(value) => setStatusFilter(value as StatusFilter)}
            options={[
              { value: 'all', label: 'Trạng thái: Tất cả' },
              { value: 'draft', label: 'Trạng thái: Nháp' },
              { value: 'pending', label: 'Trạng thái: Chờ duyệt' },
              { value: 'approved', label: 'Trạng thái: Đã duyệt' },
              { value: 'completed', label: 'Trạng thái: Hoàn thành' },
              { value: 'rejected', label: 'Trạng thái: Từ chối' },
            ]}
          />
          <button
            type="button"
            onClick={() => setShowAdvancedFilters((current) => !current)}
            className={`inline-flex h-11 items-center justify-center gap-2 rounded-xl border-2 px-4 text-sm font-bold transition shadow-sm ${
              showAdvancedFilters
                ? 'border-cyan-500 bg-cyan-50 text-cyan-600'
                : 'border-cyan-500 bg-white text-cyan-600 hover:bg-cyan-50'
            }`}
          >
            <Filter className="h-4 w-4" />
            Bộ lọc
          </button>
          <button
            type="button"
            onClick={() => {
              setSearch('');
              setStatusFilter('all');
              setTimeFilter('this-month');
              setShowAdvancedFilters(false);
            }}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border-2 border-cyan-500 bg-white px-4 text-sm font-bold text-cyan-600 transition hover:bg-cyan-50 shadow-sm"
          >
            <RefreshCw className="h-4 w-4" />
            Đặt lại
          </button>
        </div>
      </div>

      {showAdvancedFilters && (
        <div className="grid grid-cols-1 gap-4 rounded-xl border-2 border-cyan-500 bg-cyan-50/30 p-4 shadow-sm md:grid-cols-2 lg:grid-cols-3">
          <Input label="Ngày bắt đầu" type="date" value="" onChange={() => {}} />
          <Input label="Ngày kết thúc" type="date" value="" onChange={() => {}} />
          <Select
            label="Kho nguồn"
            value=""
            onChange={() => {}}
            options={warehouseOptions}
          />
          <Select
            label="Kho đích"
            value=""
            onChange={() => {}}
            options={warehouseOptions}
          />
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1180px] border-collapse bg-white">
            <thead className="bg-cyan-50">
              <tr className="border-b border-slate-200">
                <th className="w-16 border-x border-slate-200 px-3 py-4 text-center text-sm font-extrabold uppercase text-slate-800">STT</th>
                <th className="border-x border-slate-200 px-3 py-4 text-center text-sm font-extrabold uppercase text-slate-800">Số yêu cầu</th>
                <th className="border-x border-slate-200 px-3 py-4 text-center text-sm font-extrabold uppercase text-slate-800">Ngày tạo</th>
                <th className="border-x border-slate-200 px-3 py-4 text-center text-sm font-extrabold uppercase text-slate-800">Kho nguồn</th>
                <th className="border-x border-slate-200 px-3 py-4 text-center text-sm font-extrabold uppercase text-slate-800">Kho đích</th>
                <th className="border-x border-slate-200 px-3 py-4 text-center text-sm font-extrabold uppercase text-slate-800">Người tạo</th>
                <th className="border-x border-slate-200 px-3 py-4 text-center text-sm font-extrabold uppercase text-slate-800">Tình trạng</th>
                <th className="sticky right-0 w-44 border-l border-slate-200 bg-cyan-50 px-3 py-4 text-center text-sm font-extrabold uppercase text-slate-800 shadow-[-4px_0_12px_rgba(0,0,0,0.03)]">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {paginatedRequests.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-sm font-medium text-slate-500">
                    Hiện không có yêu cầu điều chuyển. Hãy tạo yêu cầu mới hoặc chuyển sang lập phiếu điều chuyển.
                  </td>
                </tr>
              ) : (
                paginatedRequests.map((request, index) => (
                  <tr key={request.id} className="group border-b border-slate-200 transition hover:bg-cyan-50/50">
                    <td className="border-x border-slate-200 px-3 py-4 text-center text-sm font-semibold text-slate-700">
                      {startIndex + index}
                    </td>
                    <td className="border-x border-slate-200 px-3 py-4 text-center text-sm font-semibold text-slate-700">{request.requestNumber}</td>
                    <td className="border-x border-slate-200 px-3 py-4 text-center text-sm font-semibold text-slate-700">{formatDateTime(request.createdDate)}</td>
                    <td className="border-x border-slate-200 px-3 py-4 text-center text-sm font-semibold text-slate-700">{renderWarehouse(request.sourceWarehouse, warehouses)}</td>
                    <td className="border-x border-slate-200 px-3 py-4 text-center text-sm font-semibold text-slate-700">{renderWarehouse(request.destinationWarehouse, warehouses)}</td>
                    <td className="border-x border-slate-200 px-3 py-4 text-center text-sm font-semibold text-slate-700">{request.createdBy}</td>
                    <td className="border-x border-slate-200 px-3 py-4 text-center align-middle">
                      <span className={`inline-flex rounded-lg border px-3 py-1 text-xs font-bold ${statusClass(request.status)}`}>
                        {formatStatus(request.status)}
                      </span>
                    </td>
                    <td className="sticky right-0 border-l border-slate-200 bg-white px-3 py-4 text-center align-middle shadow-[-4px_0_12px_rgba(0,0,0,0.03)] group-hover:bg-cyan-50/50">
                      <div className="flex items-center justify-center gap-2" data-action-menu>
                        <button
                          type="button"
                          onClick={() => openView(request)}
                          className="flex h-9 w-9 items-center justify-center rounded-xl border-2 border-cyan-500 bg-white text-cyan-600 shadow-sm transition hover:bg-cyan-50"
                          title="Xem chi tiết"
                        >
                          <Eye className="h-4 w-4 text-cyan-600" strokeWidth={2.2} />
                        </button>
                        {request.status === 'PENDING' && (
                          <button
                            type="button"
                            onClick={() => approveRequest(request)}
                            className="flex h-9 w-9 items-center justify-center rounded-xl border-2 border-cyan-500 bg-white text-cyan-600 shadow-sm transition hover:bg-cyan-50"
                            title="Duyệt yêu cầu"
                          >
                            <CheckCircle2 className="h-4 w-4 text-cyan-600" strokeWidth={2.2} />
                          </button>
                        )}
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() => setActiveActionMenuId((current) => (current === request.id ? null : request.id))}
                            className="flex h-9 w-9 items-center justify-center rounded-xl border-2 border-cyan-500 bg-white text-cyan-600 shadow-sm transition hover:bg-cyan-50"
                            title="Thao tác khác"
                          >
                            <MoreHorizontal className="h-4 w-4 text-cyan-600" strokeWidth={2.5} />
                          </button>
                          {activeActionMenuId === request.id && (
                            <div className={`absolute right-0 ${index >= paginatedRequests.length - 3 ? 'bottom-full mb-2' : 'top-full mt-2'} w-52 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 text-left shadow-xl z-50`}>
                              {request.status === 'APPROVED' && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    openTransferOrderModal(request);
                                  }}
                                  className="flex w-full items-center gap-2 px-4 py-2 text-sm font-medium text-cyan-700 transition hover:bg-cyan-50 text-left"
                                >
                                  <Pencil className="h-4 w-4" strokeWidth={2.2} />
                                  Lập phiếu điều chuyển
                                </button>
                              )}
                              <div className="my-1 border-t border-slate-100" />
                              <button
                                type="button"
                                onClick={() => {
                                  handleDeleteRequest(request.id);
                                  setActiveActionMenuId(null);
                                }}
                                className="flex w-full items-center gap-2 px-4 py-2 text-sm font-medium text-cyan-700 transition hover:bg-cyan-50 text-left"
                              >
                                <Trash2 className="h-4 w-4" strokeWidth={2.2} />
                                Xóa yêu cầu
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Section matching system UI */}
        <div className="flex flex-col items-center justify-between border-t border-slate-200 bg-white px-6 py-3 sm:flex-row">
          <div className="text-sm font-medium text-slate-600">
            Tổng số: <b className="font-bold text-slate-900">{totalItems}</b>{' '}
            {totalItems > 0 && (
              <span className="ml-2 text-slate-500">
                Hiển thị {startIndex} - {endIndex}
              </span>
            )}
          </div>
          <div className="mt-4 flex items-center gap-2 sm:mt-0">
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="h-8 rounded-lg border border-slate-300 bg-white px-2 text-sm font-semibold text-slate-700 outline-none transition focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                «
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                ‹
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .slice(
                  Math.max(0, currentPage - 2),
                  Math.min(totalPages, currentPage + 1)
                )
                .map((page) => (
                  <button
                    key={page}
                    type="button"
                    onClick={() => setCurrentPage(page)}
                    className={`flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold shadow-sm ${
                      page === currentPage
                        ? 'bg-cyan-600 text-white'
                        : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {page}
                  </button>
                ))}
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages || totalPages === 0}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                ›
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages || totalPages === 0}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                »
              </button>
            </div>
          </div>
        </div>
      </div>

      {modalMode === 'view' && selectedRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
          <div className="max-h-[92vh] w-full max-w-6xl overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex flex-col gap-4 border-b border-slate-200 px-6 py-4 lg:flex-row lg:items-start lg:justify-between bg-slate-50">
              <div>
                <p className="text-2xl font-black text-slate-900">Yêu cầu {selectedRequest.requestNumber}</p>
                <p className="mt-1 text-sm font-medium text-slate-500">{selectedRequest.description}</p>
              </div>
              <button type="button" onClick={closeModal} className="rounded-xl p-2 text-slate-400 bg-white border border-slate-200 transition hover:bg-slate-100 hover:text-slate-700" title="Đóng">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="overflow-y-auto p-6">
              <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] mb-6">
                <div className="rounded-xl border border-slate-200 bg-white p-5">
                  <h4 className="mb-4 text-sm font-bold uppercase text-slate-500">Thông tin yêu cầu</h4>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                      <div className="text-sm font-semibold text-slate-500">Số yêu cầu</div>
                      <div className="mt-1 text-sm font-bold text-slate-900">{selectedRequest.requestNumber}</div>
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-slate-500">Ngày tạo</div>
                      <div className="mt-1 text-sm font-bold text-slate-900">{formatDateTime(selectedRequest.createdDate)}</div>
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-slate-500">Kho nguồn</div>
                      <div className="mt-1 text-sm font-bold text-slate-900">{renderWarehouse(selectedRequest.sourceWarehouse, warehouses)}</div>
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-slate-500">Kho đích</div>
                      <div className="mt-1 text-sm font-bold text-slate-900">{renderWarehouse(selectedRequest.destinationWarehouse, warehouses)}</div>
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-slate-500">Người tạo</div>
                      <div className="mt-1 text-sm font-bold text-slate-900">{selectedRequest.createdBy}</div>
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-slate-500">Tình trạng</div>
                      <div className={`mt-1 inline-flex rounded-lg border px-3 py-1 text-xs font-bold ${statusClass(selectedRequest.status)}`}>
                        {formatStatus(selectedRequest.status)}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <Clock3 className="h-5 w-5 text-cyan-600" />
                    <p className="text-sm font-bold uppercase text-slate-700">Tổng quan</p>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3">
                      <span className="text-sm font-medium text-slate-600">Số dòng</span>
                      <span className="text-sm font-bold text-slate-900">{selectedRequest.items.length}</span>
                    </div>
                    <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3">
                      <span className="text-sm font-medium text-slate-600">Số lượng yêu cầu</span>
                      <span className="text-sm font-bold text-slate-900">{selectedRequest.items.reduce((sum, item) => sum + item.quantity, 0)}</span>
                    </div>
                  </div>
                </div>
              </div>
              <div>
                <div className="mb-3 flex items-center gap-2">
                  <FileText className="h-5 w-5 text-cyan-600" />
                  <h3 className="text-lg font-black text-slate-900">Danh sách hàng hóa</h3>
                </div>
                <div className="overflow-hidden rounded-xl border border-slate-200">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[980px] border-collapse bg-white">
                      <thead className="bg-slate-50">
                        <tr className="border-b border-slate-200">
                          <th className="w-14 border-x border-slate-200 px-3 py-3 text-center text-sm font-semibold uppercase text-slate-700">STT</th>
                          <th className="border-x border-slate-200 px-3 py-3 text-center text-sm font-semibold uppercase text-slate-700">Mã hàng</th>
                          <th className="border-x border-slate-200 px-3 py-3 text-center text-sm font-semibold uppercase text-slate-700">Tên hàng</th>
                          <th className="border-x border-slate-200 px-3 py-3 text-center text-sm font-semibold uppercase text-slate-700">ĐVT</th>
                          <th className="border-x border-slate-200 px-3 py-3 text-center text-sm font-semibold uppercase text-slate-700">SL</th>
                          <th className="border-x border-slate-200 px-3 py-3 text-center text-sm font-semibold uppercase text-slate-700">Kho nguồn</th>
                          <th className="border-x border-slate-200 px-3 py-3 text-center text-sm font-semibold uppercase text-slate-700">Kho đích</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedRequest.items.map((item, idx) => (
                          <tr key={item.id} className="border-b border-slate-200 transition hover:bg-slate-50">
                            <td className="border-x border-slate-200 px-3 py-3 text-center text-sm text-slate-600">{idx + 1}</td>
                            <td className="border-x border-slate-200 px-3 py-3 text-center text-sm text-slate-600">{item.productCode}</td>
                            <td className="border-x border-slate-200 px-3 py-3 text-center text-sm text-slate-600">{item.productName}</td>
                            <td className="border-x border-slate-200 px-3 py-3 text-center text-sm text-slate-600">{item.unit}</td>
                            <td className="border-x border-slate-200 px-3 py-3 text-center text-sm text-slate-600">{item.quantity}</td>
                            <td className="border-x border-slate-200 px-3 py-3 text-center text-sm text-slate-600">{renderWarehouse(item.sourceWarehouse, warehouses)}</td>
                            <td className="border-x border-slate-200 px-3 py-3 text-center text-sm text-slate-600">{renderWarehouse(item.destinationWarehouse, warehouses)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 border-t border-slate-100 bg-slate-50 px-6 py-4">
              <button type="button" onClick={closeModal} className="rounded-xl border-2 border-slate-200 px-5 py-2.5 font-bold text-slate-600 hover:bg-slate-50">
                Đóng
              </button>
              <button
                type="button"
                onClick={() => selectedRequest && openTransferOrderModal(selectedRequest)}
                className="rounded-xl bg-cyan-600 px-5 py-2.5 font-bold text-white hover:bg-cyan-700"
              >
                Lập phiếu điều chuyển
              </button>
            </div>
          </div>
        </div>
      )}

      {modalMode === 'create' && (
        <CreateTransferRequestModal
          onClose={closeModal}
          onSuccess={() => {
            closeModal();
            loadRequests();
          }}
          setToast={setToast}
        />
      )}

      <TransferOrderModal
        open={isTransferOrderModalOpen}
        request={transferOrderRequest}
        onClose={() => {
          setIsTransferOrderModalOpen(false);
          setTransferOrderRequest(null);
        }}
        onSaved={() => {
          setIsTransferOrderModalOpen(false);
          setTransferOrderRequest(null);
          loadRequests();
        }}
        setToast={setToast}
      />

      {toast && (
        <div className={`fixed right-4 top-4 z-[70] flex items-center gap-3 rounded-xl border bg-white px-4 py-3 shadow-xl ${toast.type === 'error' ? 'border-red-200 text-red-600' : 'border-emerald-200 text-emerald-600'}`}>
          <p className="text-sm font-bold">{toast.message}</p>
          <button type="button" onClick={() => setToast(null)} className="rounded-lg p-1 hover:bg-slate-100">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
