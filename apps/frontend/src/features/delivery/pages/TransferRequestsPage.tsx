import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Clock3,
  Eye,
  Filter,
  Package,
  Pencil,
  PlusCircle,
  RefreshCw,
  Search,
  Trash2,
  X,
  FileText,
} from 'lucide-react';

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
type ModalMode = 'view' | null;

const sampleRequests: TransferRequest[] = [];

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('vi-VN');
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
        className="h-11 w-full rounded-xl border-2 border-slate-200 px-4 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
      />
    </div>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-bold text-slate-700">{label}</label>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full rounded-xl border-2 border-slate-200 bg-white px-4 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export default function TransferRequestsPage() {
  const navigate = useNavigate();
  const [search, setSearch] = React.useState('');
  const [timeFilter, setTimeFilter] = React.useState<TimeFilter>('this-month');
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>('all');
  const [showAdvancedFilters, setShowAdvancedFilters] = React.useState(false);
  const [requests] = React.useState<TransferRequest[]>([]);
  const [modalMode, setModalMode] = React.useState<ModalMode>(null);
  const [selectedRequest, setSelectedRequest] = React.useState<TransferRequest | null>(null);

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

  const openCreate = () => {
    navigate('/delivery/create-transfer-order');
  };

  const openView = (request: TransferRequest) => {
    setSelectedRequest(request);
    setModalMode('view');
  };

  const approveAndCreateTransferOrder = (request: TransferRequest) => {
    navigate('/delivery/create-transfer-order', { state: { request } });
  };

  const closeModal = () => {
    setModalMode(null);
    setSelectedRequest(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Yêu cầu điều chuyển</h1>
          <p className="mt-2 text-sm text-slate-500">Tạo yêu cầu chuyển hàng từ kho này sang kho kia và gửi duyệt.</p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-600 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-cyan-700"
        >
          <PlusCircle className="h-4 w-4" />
          Tạo yêu cầu điều chuyển
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="rounded-xl bg-cyan-600 p-4 shadow-lg text-white">
          <p className="text-sm uppercase tracking-wide">Tổng yêu cầu</p>
          <p className="mt-3 text-3xl font-black">{requests.length}</p>
        </div>
        <div className="rounded-xl bg-cyan-600 p-4 shadow-lg text-white">
          <p className="text-sm uppercase tracking-wide">Chờ duyệt</p>
          <p className="mt-3 text-3xl font-black">{requests.filter((r) => r.status === 'PENDING').length}</p>
        </div>
        <div className="rounded-xl bg-cyan-600 p-4 shadow-lg text-white">
          <p className="text-sm uppercase tracking-wide">Đã duyệt</p>
          <p className="mt-3 text-3xl font-black">{requests.filter((r) => r.status === 'APPROVED').length}</p>
        </div>
        <div className="rounded-xl bg-cyan-600 p-4 shadow-lg text-white">
          <p className="text-sm uppercase tracking-wide">Hoàn thành</p>
          <p className="mt-3 text-3xl font-black">{requests.filter((r) => r.status === 'COMPLETED').length}</p>
        </div>
      </div>

      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="h-11 w-full rounded-xl border-2 border-slate-200 bg-white pl-11 pr-4 text-sm font-medium outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10 shadow-sm"
            placeholder="Tìm theo số yêu cầu, kho, người tạo..."
          />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Select
            label="Thời gian"
            value={timeFilter}
            onChange={(value) => setTimeFilter(value as TimeFilter)}
            options={[
              { value: 'this-month', label: 'Tháng này' },
              { value: '7-days', label: '7 ngày gần đây' },
              { value: 'all', label: 'Tất cả' },
            ]}
          />
          <Select
            label="Trạng thái"
            value={statusFilter}
            onChange={(value) => setStatusFilter(value as StatusFilter)}
            options={[
              { value: 'all', label: 'Tất cả' },
              { value: 'draft', label: 'Nháp' },
              { value: 'pending', label: 'Chờ duyệt' },
              { value: 'approved', label: 'Đã duyệt' },
              { value: 'completed', label: 'Hoàn thành' },
              { value: 'rejected', label: 'Từ chối' },
            ]}
          />
          <button
            type="button"
            onClick={() => setShowAdvancedFilters((current) => !current)}
            className={`inline-flex h-11 w-11 items-center justify-center rounded-xl border-2 transition shadow-sm ${showAdvancedFilters ? 'border-cyan-500 bg-cyan-50 text-cyan-600' : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-700'}`}
            title="Tìm kiếm nâng cao"
          >
            <Filter className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => {
              setSearch('');
              setStatusFilter('all');
              setTimeFilter('this-month');
              setShowAdvancedFilters(false);
            }}
            className="inline-flex h-11 items-center justify-center rounded-xl border-2 border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 shadow-sm"
          >
            <RefreshCw className="h-4 w-4" />
            Đặt lại
          </button>
        </div>
      </div>

      {showAdvancedFilters && (
        <div className="grid grid-cols-1 gap-4 rounded-xl border border-cyan-200 bg-cyan-50/30 p-4 shadow-sm md:grid-cols-2 lg:grid-cols-3">
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
            <thead className="bg-slate-50">
              <tr className="border-b border-slate-200">
                <th className="w-16 border-x border-slate-200 px-3 py-4 text-center text-sm font-semibold uppercase text-slate-700">STT</th>
                <th className="border-x border-slate-200 px-3 py-4 text-center text-sm font-semibold uppercase text-slate-700">Số yêu cầu</th>
                <th className="border-x border-slate-200 px-3 py-4 text-center text-sm font-semibold uppercase text-slate-700">Ngày tạo</th>
                <th className="border-x border-slate-200 px-3 py-4 text-center text-sm font-semibold uppercase text-slate-700">Kho nguồn</th>
                <th className="border-x border-slate-200 px-3 py-4 text-center text-sm font-semibold uppercase text-slate-700">Kho đích</th>
                <th className="border-x border-slate-200 px-3 py-4 text-center text-sm font-semibold uppercase text-slate-700">Người tạo</th>
                <th className="border-x border-slate-200 px-3 py-4 text-center text-sm font-semibold uppercase text-slate-700">Tình trạng</th>
                <th className="sticky right-0 w-40 border-l border-slate-200 bg-slate-50 px-3 py-4 text-center text-sm font-semibold uppercase text-slate-700 shadow-[-4px_0_12px_rgba(0,0,0,0.03)]">Hành động</th>
              </tr>
            </thead>
            <tbody>
              {filteredRequests.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-sm font-medium text-slate-500">
                    Hiện không có yêu cầu điều chuyển. Hãy tạo yêu cầu mới hoặc chuyển sang lập phiếu điều chuyển.
                  </td>
                </tr>
              ) : (
                filteredRequests.map((request, index) => (
                  <tr key={request.id} className="group border-b border-slate-200 transition hover:bg-slate-50">
                    <td className="border-x border-slate-200 px-3 py-4 text-center text-sm text-slate-600">{index + 1}</td>
                    <td className="border-x border-slate-200 px-3 py-4 text-center text-sm text-slate-600">{request.requestNumber}</td>
                    <td className="border-x border-slate-200 px-3 py-4 text-center text-sm text-slate-600">{formatDate(request.createdDate)}</td>
                    <td className="border-x border-slate-200 px-3 py-4 text-center text-sm text-slate-600">{request.sourceWarehouse}</td>
                    <td className="border-x border-slate-200 px-3 py-4 text-center text-sm text-slate-600">{request.destinationWarehouse}</td>
                    <td className="border-x border-slate-200 px-3 py-4 text-center text-sm text-slate-600">{request.createdBy}</td>
                    <td className="border-x border-slate-200 px-3 py-4 text-center align-middle">
                      <span className={`inline-flex rounded-lg border px-3 py-1 text-xs font-bold ${statusClass(request.status)}`}>
                        {formatStatus(request.status)}
                      </span>
                    </td>
                    <td className="sticky right-0 border-l border-slate-200 bg-white px-3 py-4 text-center align-middle shadow-[-4px_0_12px_rgba(0,0,0,0.03)] group-hover:bg-slate-50">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          type="button"
                          onClick={() => openView(request)}
                          className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-cyan-600 transition hover:bg-cyan-50 hover:text-cyan-700"
                          title="Xem"
                        >
                          <Eye className="h-5 w-5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => approveAndCreateTransferOrder(request)}
                          className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-700 transition hover:bg-slate-50 hover:text-slate-900"
                          title="Lập phiếu điều chuyển"
                        >
                          <Package className="h-5 w-5" />
                        </button>
                        <button
                          type="button"
                          className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-red-600 transition hover:bg-red-50 hover:text-red-700"
                          title="Xóa"
                        >
                          <Trash2 className="h-5 w-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
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
                      <div className="mt-1 text-sm font-bold text-slate-900">{formatDate(selectedRequest.createdDate)}</div>
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-slate-500">Kho nguồn</div>
                      <div className="mt-1 text-sm font-bold text-slate-900">{selectedRequest.sourceWarehouse}</div>
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-slate-500">Kho đích</div>
                      <div className="mt-1 text-sm font-bold text-slate-900">{selectedRequest.destinationWarehouse}</div>
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
                            <td className="border-x border-slate-200 px-3 py-3 text-center text-sm text-slate-600">{item.sourceWarehouse}</td>
                            <td className="border-x border-slate-200 px-3 py-3 text-center text-sm text-slate-600">{item.destinationWarehouse}</td>
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
                onClick={() => selectedRequest && approveAndCreateTransferOrder(selectedRequest)}
                className="rounded-xl bg-cyan-600 px-5 py-2.5 font-bold text-white hover:bg-cyan-700"
              >
                Duyệt & lập phiếu điều chuyển
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
