import React from 'react';
import {
  BadgeDollarSign,
  Building2,
  Clock,
  Eye,
  KeyRound,
  Mail,
  MapPin,
  Pencil,
  Phone,
  PlusCircle,
  Search,
  Trash2,
  Truck,
  User,
  X,
} from 'lucide-react';
import Toast from '../../shared/components/Toast';

type SupplierStatus = 'active' | 'inactive';
type PriorityLevel = 'strategic' | 'secondary';

type ProductSummary = {
  id: string;
  internalSku: string;
  name: string;
  unit?: string;
};

type SupplierProductLink = {
  id: string;
  supplierSku?: string;
  purchasePrice: string;
  isPrimary: boolean;
  product: ProductSummary | null;
};

type Supplier = {
  id: string;
  supplierCode: string;
  name: string;
  taxCode?: string;
  status: SupplierStatus;
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
  leadTimeDays: number;
  paymentTerms?: string;
  currency: string;
  priorityLevel: PriorityLevel;
  accountEmail?: string;
  productCount: number;
  products?: SupplierProductLink[];
};

type SupplierForm = {
  supplierCode: string;
  name: string;
  taxCode: string;
  status: SupplierStatus;
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
  leadTimeDays: string;
  paymentTerms: string;
  currency: string;
  priorityLevel: PriorityLevel;
  accountEmail: string;
  accountPassword: string;
};

type ModalMode = 'create' | 'view' | 'edit' | 'delete' | null;

const API_BASE_URL = 'http://localhost:3000/api';

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
  };
}

function buildEmptyForm(): SupplierForm {
  return {
    supplierCode: '',
    name: '',
    taxCode: '',
    status: 'active',
    contactPerson: '',
    phone: '',
    email: '',
    address: '',
    leadTimeDays: '',
    paymentTerms: '',
    currency: '',
    priorityLevel: 'secondary',
    accountEmail: '',
    accountPassword: '',
  };
}

function buildForm(supplier: Supplier): SupplierForm {
  return {
    supplierCode: supplier.supplierCode || '',
    name: supplier.name || '',
    taxCode: supplier.taxCode || '',
    status: supplier.status || 'active',
    contactPerson: supplier.contactPerson || '',
    phone: supplier.phone || '',
    email: supplier.email || '',
    address: supplier.address || '',
    leadTimeDays: String(supplier.leadTimeDays ?? 0),
    paymentTerms: supplier.paymentTerms || '',
    currency: supplier.currency || 'VND',
    priorityLevel: supplier.priorityLevel || 'secondary',
    accountEmail: supplier.accountEmail || supplier.email || '',
    accountPassword: '',
  };
}

function getStatusLabel(status: SupplierStatus) {
  return status === 'active' ? 'Đang hợp tác' : 'Ngừng hợp tác';
}

function getPriorityLabel(priority: PriorityLevel) {
  return priority === 'strategic' ? 'NCC chiến lược' : 'NCC phụ';
}

function formatMoney(value: string, currency: string) {
  const amount = Number(value || 0);
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: currency || 'VND' }).format(amount);
}

function normalizeSupplier(supplier: Partial<Supplier>): Supplier {
  return {
    id: supplier.id || crypto.randomUUID(),
    supplierCode: supplier.supplierCode || '',
    name: supplier.name || '',
    taxCode: supplier.taxCode || '',
    status: supplier.status === 'inactive' ? 'inactive' : 'active',
    contactPerson: supplier.contactPerson || '',
    phone: supplier.phone || '',
    email: supplier.email || '',
    address: supplier.address || '',
    leadTimeDays: Number(supplier.leadTimeDays || 0),
    paymentTerms: supplier.paymentTerms || '',
    currency: supplier.currency || 'VND',
    priorityLevel: supplier.priorityLevel === 'strategic' ? 'strategic' : 'secondary',
    accountEmail: supplier.accountEmail || supplier.email || '',
    productCount: Number(supplier.productCount || 0),
    products: Array.isArray(supplier.products) ? supplier.products : [],
  };
}

export default function Suppliers() {
  const [suppliers, setSuppliers] = React.useState<Supplier[]>([]);
  const [search, setSearch] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<'all' | SupplierStatus>('all');
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState('');
  const [success, setSuccess] = React.useState('');
  const [modalMode, setModalMode] = React.useState<ModalMode>(null);
  const [selectedSupplier, setSelectedSupplier] = React.useState<Supplier | null>(null);
  const [form, setForm] = React.useState<SupplierForm>(buildEmptyForm());
  const [pageSize, setPageSize] = React.useState(20);
  const [currentPage, setCurrentPage] = React.useState(1);

  const loadData = React.useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_BASE_URL}/suppliers`, { headers: authHeaders() });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.message || 'Không tải được danh sách nhà cung cấp');
      }

      const data = (await response.json()) as Supplier[];
      setSuppliers(Array.isArray(data) ? data.map(normalizeSupplier) : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi hệ thống khi tải dữ liệu');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  React.useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter]);

  const filteredSuppliers = suppliers.filter((supplier) => {
    const keyword = search.trim().toLowerCase();
    const matchesKeyword =
      !keyword ||
      supplier.supplierCode?.toLowerCase().includes(keyword) ||
      supplier.name.toLowerCase().includes(keyword) ||
      supplier.taxCode?.toLowerCase().includes(keyword) ||
      supplier.contactPerson?.toLowerCase().includes(keyword) ||
      supplier.email?.toLowerCase().includes(keyword) ||
      supplier.phone?.includes(keyword);
    const matchesStatus = statusFilter === 'all' || supplier.status === statusFilter;

    return matchesKeyword && matchesStatus;
  });

  const totalItems = filteredSuppliers.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const paginatedSuppliers = filteredSuppliers.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const startIndex = (currentPage - 1) * pageSize + 1;
  const endIndex = Math.min(currentPage * pageSize, totalItems);
  const activeCount = suppliers.filter((supplier) => supplier.status === 'active').length;
  const inactiveCount = suppliers.filter((supplier) => supplier.status === 'inactive').length;

  const closeModal = () => {
    setModalMode(null);
    setSelectedSupplier(null);
    setSaving(false);
  };

  const openModal = (mode: ModalMode, supplier?: Supplier) => {
    setError('');
    setSuccess('');
    setSelectedSupplier(supplier || null);
    setForm(supplier ? buildForm(supplier) : buildEmptyForm());
    setModalMode(mode);
  };

  const buildPayload = () => {
    const payload: Record<string, unknown> = {
      supplierCode: form.supplierCode.trim() || undefined,
      name: form.name.trim(),
      taxCode: form.taxCode.trim(),
      status: form.status,
      contactPerson: form.contactPerson.trim(),
      phone: form.phone.trim(),
      email: form.email.trim(),
      address: form.address.trim(),
      leadTimeDays: Number(form.leadTimeDays || 0),
      paymentTerms: form.paymentTerms.trim(),
      currency: form.currency.trim().toUpperCase() || 'VND',
      priorityLevel: form.priorityLevel,
    };

    if (modalMode === 'create' || form.accountPassword.trim()) {
      payload.accountEmail = (form.accountEmail.trim() || form.email.trim()).toLowerCase();
      payload.accountPassword = form.accountPassword.trim();
    }

    return payload;
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.name.trim() || !form.email.trim() || !form.phone.trim()) {
      setError('Vui lòng nhập tên nhà cung cấp, email PO và số điện thoại.');
      return;
    }

    if (modalMode === 'create' && !form.accountPassword.trim()) {
      setError('Vui lòng nhập mật khẩu để tạo tài khoản đăng nhập cho nhà cung cấp.');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const isEdit = modalMode === 'edit';
      const url = isEdit && selectedSupplier ? `${API_BASE_URL}/suppliers/${selectedSupplier.id}` : `${API_BASE_URL}/suppliers`;
      const response = await fetch(url, {
        method: isEdit ? 'PUT' : 'POST',
        headers: authHeaders(),
        body: JSON.stringify(buildPayload()),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.message || (isEdit ? 'Không cập nhật được nhà cung cấp' : 'Không tạo được nhà cung cấp'));
      }

      setSuccess(isEdit ? 'Đã cập nhật nhà cung cấp.' : 'Đã tạo nhà cung cấp và tài khoản đăng nhập.');
      closeModal();
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi khi lưu nhà cung cấp');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedSupplier) return;
    setSaving(true);
    setError('');

    try {
      const response = await fetch(`${API_BASE_URL}/suppliers/${selectedSupplier.id}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.message || 'Không xóa được nhà cung cấp');
      }

      setSuccess('Đã xóa nhà cung cấp.');
      closeModal();
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi khi xóa nhà cung cấp');
    } finally {
      setSaving(false);
    }
  };

  const modalTitle =
    modalMode === 'create'
      ? 'Tạo tài khoản nhà cung cấp'
      : modalMode === 'view'
        ? 'Chi tiết nhà cung cấp'
        : modalMode === 'edit'
          ? 'Cập nhật nhà cung cấp'
          : 'Xóa nhà cung cấp';

  return (
    <div>
      <Toast
        message={error || success}
        type={error ? 'error' : 'success'}
        onClose={() => {
          setError('');
          setSuccess('');
        }}
      />

      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Quản lý nhà cung cấp</h1>
        </div>

        <button
          type="button"
          onClick={() => openModal('create')}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-cyan-700"
        >
          <PlusCircle className="h-4 w-4" />
          Tạo tài khoản NCC
        </button>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="rounded-xl border-2 border-slate-200 bg-white p-4">
          <p className="text-xs font-black uppercase text-slate-500">Tổng NCC</p>
          <p className="mt-2 text-2xl font-black text-slate-900">{suppliers.length}</p>
        </div>
        <div className="rounded-xl border-2 border-emerald-200 bg-emerald-50 p-4">
          <p className="text-xs font-black uppercase text-emerald-600">Đang hợp tác</p>
          <p className="mt-2 text-2xl font-black text-emerald-700">{activeCount}</p>
        </div>
        <div className="rounded-xl border-2 border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-black uppercase text-slate-500">Ngừng hợp tác</p>
          <p className="mt-2 text-2xl font-black text-slate-700">{inactiveCount}</p>
        </div>
        <div className="rounded-xl border-2 border-cyan-200 bg-cyan-50 p-4">
          <p className="text-xs font-black uppercase text-cyan-600">Link sản phẩm</p>
          <p className="mt-2 text-2xl font-black text-cyan-700">
            {suppliers.reduce((total, supplier) => total + (supplier.productCount || 0), 0)}
          </p>
        </div>
      </div>

      <div className="mt-5 rounded-xl border-2 border-slate-200 bg-white p-4">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1.4fr_0.7fr]">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="h-11 w-full rounded-xl border-2 border-slate-200 bg-slate-50 pl-11 pr-4 text-sm font-semibold outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
              placeholder="Tìm theo mã NCC, tên, MST, người liên hệ, email, số điện thoại..."
            />
          </div>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as 'all' | SupplierStatus)}
            className="h-11 rounded-xl border-2 border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-700 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
          >
            <option value="all">Trạng thái: Tất cả</option>
            <option value="active">Trạng thái: Đang hợp tác</option>
            <option value="inactive">Trạng thái: Ngừng hợp tác</option>
          </select>
        </div>
      </div>

      <div className="mt-5 overflow-hidden rounded-xl border-2 border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1240px] border-collapse bg-white">
            <thead className="bg-slate-50">
              <tr className="border-b-2 border-slate-200">
                <th className="w-16 border-x border-slate-200 px-3 py-4 text-center text-sm font-black uppercase text-slate-700">STT</th>
                <th className="border-x border-slate-200 px-3 py-4 text-left text-sm font-black uppercase text-slate-700">Identity</th>
                <th className="border-x border-slate-200 px-3 py-4 text-left text-sm font-black uppercase text-slate-700">Liên hệ</th>
                <th className="border-x border-slate-200 px-3 py-4 text-center text-sm font-black uppercase text-slate-700">Lead time</th>
                <th className="border-x border-slate-200 px-3 py-4 text-left text-sm font-black uppercase text-slate-700">Thanh toán</th>
                <th className="border-x border-slate-200 px-3 py-4 text-center text-sm font-black uppercase text-slate-700">Sản phẩm</th>
                <th className="border-x border-slate-200 px-3 py-4 text-center text-sm font-black uppercase text-slate-700">Trạng thái</th>
                <th className="sticky right-0 w-36 border-l border-slate-200 bg-slate-50 px-3 py-4 text-center text-sm font-black uppercase text-slate-700 shadow-[-4px_0_12px_rgba(0,0,0,0.03)]">
                  Thao tác
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-sm font-semibold text-slate-500">
                    Đang tải dữ liệu nhà cung cấp...
                  </td>
                </tr>
              ) : paginatedSuppliers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-sm font-semibold text-slate-500">
                    Chưa có nhà cung cấp phù hợp.
                  </td>
                </tr>
              ) : (
                paginatedSuppliers.map((supplier, index) => (
                  <tr key={supplier.id} className="group border-b border-slate-200 transition hover:bg-cyan-50/50">
                    <td className="border-x border-slate-200 px-3 py-4 text-center text-sm text-slate-700">
                      {startIndex + index}
                    </td>
                    <td className="border-x border-slate-200 px-3 py-4 text-left">
                      <p className="text-sm font-black text-slate-900">{supplier.supplierCode}</p>
                      <p className="mt-1 text-sm font-bold text-slate-700">{supplier.name}</p>
                      <p className="mt-1 text-xs font-semibold text-slate-500">MST: {supplier.taxCode || '-'}</p>
                    </td>
                    <td className="border-x border-slate-200 px-3 py-4 text-left text-sm text-slate-700">
                      <div className="space-y-1.5">
                        <p className="flex items-center gap-2 font-bold">
                          <User className="h-4 w-4 text-slate-400" />
                          {supplier.contactPerson || '-'}
                        </p>
                        <p className="flex items-center gap-2">
                          <Phone className="h-4 w-4 text-slate-400" />
                          {supplier.phone || '-'}
                        </p>
                        <p className="flex items-center gap-2">
                          <Mail className="h-4 w-4 text-slate-400" />
                          {supplier.email || '-'}
                        </p>
                      </div>
                    </td>
                    <td className="border-x border-slate-200 px-3 py-4 text-center">
                      <span className="inline-flex items-center gap-1 rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-1 text-xs font-black text-cyan-700">
                        <Clock className="h-3.5 w-3.5" />
                        {supplier.leadTimeDays || 0} ngày
                      </span>
                    </td>
                    <td className="border-x border-slate-200 px-3 py-4 text-left text-sm text-slate-700">
                      <p className="font-bold">{supplier.paymentTerms || '-'}</p>
                      <p className="mt-1 text-xs font-semibold text-slate-500">
                        {supplier.currency || 'VND'} · {getPriorityLabel(supplier.priorityLevel)}
                      </p>
                    </td>
                    <td className="border-x border-slate-200 px-3 py-4 text-center align-middle">
                      <span className="inline-flex rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs font-bold text-slate-700 shadow-sm">
                        {supplier.productCount || 0}
                      </span>
                    </td>
                    <td className="border-x border-slate-200 px-3 py-4 text-center align-middle">
                      <span
                        className={`inline-flex rounded-lg border px-3 py-1 text-xs font-bold ${
                          supplier.status === 'active'
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                            : 'border-slate-200 bg-slate-50 text-slate-600'
                        }`}
                      >
                        {getStatusLabel(supplier.status)}
                      </span>
                    </td>
                    <td className="sticky right-0 border-l border-slate-200 bg-white px-3 py-4 text-center align-middle shadow-[-4px_0_12px_rgba(0,0,0,0.03)] group-hover:bg-cyan-50/50">
                      <div className="flex items-center justify-center gap-2">
                        <button type="button" onClick={() => openModal('view', supplier)} title="Xem chi tiết" className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-50 text-cyan-600 transition-colors hover:bg-cyan-100">
                          <Eye size={18} strokeWidth={2} />
                        </button>
                        <button type="button" onClick={() => openModal('edit', supplier)} title="Sửa nhà cung cấp" className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-50 text-cyan-600 transition-colors hover:bg-cyan-100">
                          <Pencil size={18} strokeWidth={2} />
                        </button>
                        <button type="button" onClick={() => openModal('delete', supplier)} title="Xóa nhà cung cấp" className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-50 text-cyan-600 transition-colors hover:bg-cyan-100">
                          <Trash2 size={18} strokeWidth={2} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {!loading && totalItems > 0 && (
          <div className="flex flex-col items-center justify-between border-t border-slate-200 bg-slate-50/50 px-6 py-3 sm:flex-row">
            <div className="text-sm text-slate-600">
              Tổng số: <b>{totalItems}</b> <span className="ml-2">Hiển thị {startIndex} - {endIndex}</span>
            </div>
            <div className="mt-4 flex items-center gap-2 sm:mt-0">
              <select
                value={pageSize}
                onChange={(event) => {
                  setPageSize(Number(event.target.value));
                  setCurrentPage(1);
                }}
                className="h-8 rounded-lg border border-slate-300 bg-white px-2 text-sm outline-none transition focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
              >
                <option value={5}>5</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => setCurrentPage(1)} disabled={currentPage === 1} className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-50">«</button>
                <button type="button" onClick={() => setCurrentPage((page) => Math.max(1, page - 1))} disabled={currentPage === 1} className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-50">‹</button>
                <button type="button" className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-600 text-sm font-bold text-white">{currentPage}</button>
                <button type="button" onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))} disabled={currentPage === totalPages} className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-50">›</button>
                <button type="button" onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages} className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-50">»</button>
              </div>
            </div>
          </div>
        )}
      </div>

      {modalMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm transition-all">
          <div className="max-h-[92vh] w-full max-w-5xl overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b-2 border-slate-100 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-cyan-50 p-2 text-cyan-600">
                  <Building2 className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-800">{modalTitle}</h2>
                  <p className="text-sm font-medium text-slate-500">
                    Identity, liên hệ, nghiệp vụ mua hàng và tài khoản đăng nhập của NCC.
                  </p>
                </div>
              </div>
              <button type="button" onClick={closeModal} className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            {modalMode === 'delete' ? (
              <div className="px-6 py-5">
                <p className="text-base text-slate-700">
                  Bạn có chắc muốn xóa nhà cung cấp <span className="font-black text-slate-950">{selectedSupplier?.name}</span> không?
                </p>
                {(selectedSupplier?.productCount || 0) > 0 && (
                  <p className="mt-2 text-sm font-medium text-red-500">
                    NCC này đang có {selectedSupplier?.productCount} sản phẩm liên kết trong bảng Supplier_Products.
                  </p>
                )}
                <div className="mt-8 flex justify-end gap-3">
                  <button type="button" onClick={closeModal} className="rounded-xl border-2 border-slate-200 px-5 py-2.5 font-bold text-slate-600 transition hover:bg-slate-50">
                    Hủy
                  </button>
                  <button type="button" onClick={handleDelete} disabled={saving} className="rounded-xl bg-red-600 px-5 py-2.5 font-bold text-white shadow-sm transition hover:bg-red-700 disabled:opacity-60">
                    {saving ? 'Đang xóa...' : 'Xóa'}
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="max-h-[calc(92vh-86px)] overflow-y-auto px-6 py-5">
                <div className="space-y-6">
                  <section>
                    <div className="mb-4 flex items-center gap-2">
                      <Building2 className="h-5 w-5 text-cyan-600" />
                      <h3 className="font-black text-slate-900">Thông tin cơ bản</h3>
                    </div>
                    <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
                      <div>
                        <label className="mb-2 block text-sm font-bold text-slate-700">Mã NCC</label>
                        <input value={form.supplierCode} onChange={(event) => setForm((current) => ({ ...current, supplierCode: event.target.value }))} readOnly={modalMode === 'view'} className="h-11 w-full rounded-xl border-2 border-slate-200 px-4 uppercase outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10 read-only:bg-slate-50" placeholder="Tự sinh: NCC001" />
                      </div>
                      <div className="md:col-span-2">
                        <label className="mb-2 block text-sm font-bold text-slate-700">Tên nhà cung cấp <span className="text-red-500">*</span></label>
                        <input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} readOnly={modalMode === 'view'} className="h-11 w-full rounded-xl border-2 border-slate-200 px-4 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10 read-only:bg-slate-50" placeholder="Tên công ty/nhà cung cấp" required />
                      </div>
                      <div>
                        <label className="mb-2 block text-sm font-bold text-slate-700">Mã số thuế</label>
                        <input value={form.taxCode} onChange={(event) => setForm((current) => ({ ...current, taxCode: event.target.value }))} readOnly={modalMode === 'view'} className="h-11 w-full rounded-xl border-2 border-slate-200 px-4 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10 read-only:bg-slate-50" placeholder="MST để đối soát hóa đơn" />
                      </div>
                      <div>
                        <label className="mb-2 block text-sm font-bold text-slate-700">Trạng thái</label>
                        <select value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as SupplierStatus }))} disabled={modalMode === 'view'} className="h-11 w-full rounded-xl border-2 border-slate-200 bg-white px-4 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10 disabled:bg-slate-50">
                          <option value="active">Đang hợp tác</option>
                          <option value="inactive">Ngừng hợp tác</option>
                        </select>
                      </div>
                      <div>
                        <label className="mb-2 block text-sm font-bold text-slate-700">Tài khoản đăng nhập</label>
                        <input value={form.accountEmail} onChange={(event) => setForm((current) => ({ ...current, accountEmail: event.target.value }))} readOnly={modalMode === 'view'} className="h-11 w-full rounded-xl border-2 border-slate-200 px-4 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10 read-only:bg-slate-50" placeholder="login@ncc.com" />
                      </div>
                    </div>
                  </section>

                  <section>
                    <div className="mb-4 flex items-center gap-2">
                      <Phone className="h-5 w-5 text-cyan-600" />
                      <h3 className="font-black text-slate-900">Thông tin liên hệ</h3>
                    </div>
                    <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                      <div>
                        <label className="mb-2 block text-sm font-bold text-slate-700">Người liên hệ chính</label>
                        <input value={form.contactPerson} onChange={(event) => setForm((current) => ({ ...current, contactPerson: event.target.value }))} readOnly={modalMode === 'view'} className="h-11 w-full rounded-xl border-2 border-slate-200 px-4 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10 read-only:bg-slate-50" placeholder="Tên người đại diện" />
                      </div>
                      <div>
                        <label className="mb-2 block text-sm font-bold text-slate-700">Số điện thoại <span className="text-red-500">*</span></label>
                        <input type="tel" value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} readOnly={modalMode === 'view'} className="h-11 w-full rounded-xl border-2 border-slate-200 px-4 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10 read-only:bg-slate-50" placeholder="0912..." required />
                      </div>
                      <div>
                        <label className="mb-2 block text-sm font-bold text-slate-700">Email nhận PO <span className="text-red-500">*</span></label>
                        <input type="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} readOnly={modalMode === 'view'} className="h-11 w-full rounded-xl border-2 border-slate-200 px-4 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10 read-only:bg-slate-50" placeholder="po@ncc.com" required />
                      </div>
                      <div>
                        <label className="mb-2 block text-sm font-bold text-slate-700">Địa chỉ văn phòng/kho</label>
                        <input value={form.address} onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))} readOnly={modalMode === 'view'} className="h-11 w-full rounded-xl border-2 border-slate-200 px-4 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10 read-only:bg-slate-50" placeholder="Địa chỉ giao dịch" />
                      </div>
                    </div>
                  </section>

                  <section>
                    <div className="mb-4 flex items-center gap-2">
                      <Truck className="h-5 w-5 text-cyan-600" />
                      <h3 className="font-black text-slate-900">Thông tin kho & mua hàng</h3>
                    </div>
                    <div className="grid grid-cols-1 gap-5 md:grid-cols-4">
                      <div>
                        <label className="mb-2 block text-sm font-bold text-slate-700">Lead time (ngày)</label>
                        <input type="number" min={0} value={form.leadTimeDays} onChange={(event) => setForm((current) => ({ ...current, leadTimeDays: event.target.value }))} readOnly={modalMode === 'view'} className="h-11 w-full rounded-xl border-2 border-slate-200 px-4 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10 read-only:bg-slate-50" />
                      </div>
                      <div>
                        <label className="mb-2 block text-sm font-bold text-slate-700">Điều khoản thanh toán</label>
                        <input value={form.paymentTerms} onChange={(event) => setForm((current) => ({ ...current, paymentTerms: event.target.value }))} readOnly={modalMode === 'view'} className="h-11 w-full rounded-xl border-2 border-slate-200 px-4 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10 read-only:bg-slate-50" placeholder="Thanh toán ngay, Công nợ 30 ngày" />
                      </div>
                      <div>
                        <label className="mb-2 block text-sm font-bold text-slate-700">Tiền tệ</label>
                        <input value={form.currency} onChange={(event) => setForm((current) => ({ ...current, currency: event.target.value }))} readOnly={modalMode === 'view'} className="h-11 w-full rounded-xl border-2 border-slate-200 px-4 uppercase outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10 read-only:bg-slate-50" placeholder="VND" />
                      </div>
                      <div>
                        <label className="mb-2 block text-sm font-bold text-slate-700">Mức ưu tiên</label>
                        <select value={form.priorityLevel} onChange={(event) => setForm((current) => ({ ...current, priorityLevel: event.target.value as PriorityLevel }))} disabled={modalMode === 'view'} className="h-11 w-full rounded-xl border-2 border-slate-200 bg-white px-4 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10 disabled:bg-slate-50">
                          <option value="strategic">NCC chiến lược</option>
                          <option value="secondary">NCC phụ</option>
                        </select>
                      </div>
                    </div>
                  </section>

                  {modalMode !== 'view' && (
                    <section className="rounded-xl border-2 border-cyan-100 bg-cyan-50 p-4">
                      <div className="mb-4 flex items-center gap-2">
                        <KeyRound className="h-5 w-5 text-cyan-600" />
                        <h3 className="font-black text-slate-900">Tài khoản portal cho NCC</h3>
                      </div>
                      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                        <div>
                          <label className="mb-2 block text-sm font-bold text-slate-700">Email đăng nhập</label>
                          <input type="email" value={form.accountEmail} onChange={(event) => setForm((current) => ({ ...current, accountEmail: event.target.value }))} className="h-11 w-full rounded-xl border-2 border-cyan-200 bg-white px-4 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10" placeholder="Mặc định dùng email nhận PO" />
                        </div>
                        <div>
                          <label className="mb-2 block text-sm font-bold text-slate-700">
                            Mật khẩu {modalMode === 'create' && <span className="text-red-500">*</span>}
                          </label>
                          <input type="password" value={form.accountPassword} onChange={(event) => setForm((current) => ({ ...current, accountPassword: event.target.value }))} className="h-11 w-full rounded-xl border-2 border-cyan-200 bg-white px-4 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10" placeholder={modalMode === 'create' ? 'Tạo mật khẩu ban đầu' : 'Để trống nếu không tạo tài khoản mới'} />
                        </div>
                      </div>
                    </section>
                  )}

                  {modalMode === 'view' && (
                    <section>
                      <div className="mb-4 flex items-center gap-2">
                        <BadgeDollarSign className="h-5 w-5 text-cyan-600" />
                        <h3 className="font-black text-slate-900">Supplier_Products</h3>
                      </div>
                      <div className="overflow-hidden rounded-xl border-2 border-slate-200">
                        <table className="w-full min-w-[720px] border-collapse bg-white">
                          <thead className="bg-slate-50">
                            <tr>
                              <th className="border-x border-slate-200 px-3 py-3 text-left text-xs font-black uppercase text-slate-600">Sản phẩm</th>
                              <th className="border-x border-slate-200 px-3 py-3 text-left text-xs font-black uppercase text-slate-600">Supplier SKU</th>
                              <th className="border-x border-slate-200 px-3 py-3 text-right text-xs font-black uppercase text-slate-600">Giá nhập</th>
                              <th className="border-x border-slate-200 px-3 py-3 text-center text-xs font-black uppercase text-slate-600">NCC chính</th>
                            </tr>
                          </thead>
                          <tbody>
                            {selectedSupplier?.products?.length ? (
                              selectedSupplier.products.map((link) => (
                                <tr key={link.id} className="border-t border-slate-200">
                                  <td className="border-x border-slate-200 px-3 py-3 text-sm font-bold text-slate-800">
                                    {link.product?.internalSku} · {link.product?.name}
                                  </td>
                                  <td className="border-x border-slate-200 px-3 py-3 text-sm text-slate-700">{link.supplierSku || '-'}</td>
                                  <td className="border-x border-slate-200 px-3 py-3 text-right text-sm font-bold text-slate-700">
                                    {formatMoney(link.purchasePrice, selectedSupplier.currency)}
                                  </td>
                                  <td className="border-x border-slate-200 px-3 py-3 text-center text-sm text-slate-700">
                                    {link.isPrimary ? 'Có' : 'Không'}
                                  </td>
                                </tr>
                              ))
                            ) : (
                              <tr>
                                <td colSpan={4} className="px-4 py-8 text-center text-sm font-semibold text-slate-500">
                                  NCC chưa khai báo sản phẩm cung cấp.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </section>
                  )}
                </div>

                <div className="mt-8 flex justify-end gap-3 border-t border-slate-100 pt-5">
                  <button type="button" onClick={closeModal} className="rounded-xl border-2 border-slate-200 px-5 py-2.5 font-bold text-slate-600 transition hover:bg-slate-50">
                    {modalMode === 'view' ? 'Đóng' : 'Hủy'}
                  </button>
                  {modalMode !== 'view' && (
                    <button type="submit" disabled={saving} className="rounded-xl bg-cyan-600 px-6 py-2.5 font-bold text-white shadow-sm transition hover:bg-cyan-700 disabled:opacity-60">
                      {saving ? 'Đang lưu...' : modalMode === 'create' ? 'Tạo tài khoản NCC' : 'Lưu thay đổi'}
                    </button>
                  )}
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
