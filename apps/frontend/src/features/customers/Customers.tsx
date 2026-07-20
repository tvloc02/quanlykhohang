import React from 'react';
import {
  Download,
  Eye,
  Pencil,
  PlusCircle,
  Search,
  Trash2,
  Upload,
  UserPlus,
  Users,
  X,
  ChevronDown,
  EyeOff,
} from 'lucide-react';
import Toast from '../../shared/components/Toast';

type Role = {
  id: string;
  name: string;
};

type CustomerUser = {
  id: string;
  email: string;
  fullName?: string;
  phone?: string;
  address?: string;
  roles?: Role[];
  status?: string;
};

type CustomerForm = {
  email: string;
  fullName: string;
  phone: string;
  status: 'active' | 'inactive';
  password?: string;
  address?: string;
};

type ModalMode = 'create' | 'view' | 'edit' | 'delete' | null;

type SelectOption = {
  value: string;
  label: string;
};

const API_BASE_URL = 'http://localhost:3000/api';

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
  };
}

function getPrimaryRole(user: CustomerUser) {
  if (!Array.isArray(user.roles) || user.roles.length === 0) return 'customer';
  const normalizedRoles = user.roles
    .map((role) => String(role?.name || '').toLowerCase())
    .filter(Boolean);
  return normalizedRoles[0] || 'customer';
}

function isCustomer(user: CustomerUser) {
  const role = getPrimaryRole(user);
  return role === 'customer';
}

function StyledSelect({
  value,
  options,
  onChange,
  className = '',
  disabled = false,
}: {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  className?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const selectedOption = options.find((option) => option.value === value) || options[0];

  return (
    <div className={`relative ${className}`} onBlur={() => window.setTimeout(() => setOpen(false), 120)}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        className="flex h-full min-h-9 w-full items-center justify-between rounded-xl border-2 border-slate-200 bg-white px-4 text-left text-sm font-semibold text-slate-700 outline-none transition hover:border-cyan-400 focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10 disabled:bg-slate-50 disabled:text-slate-500"
      >
        <span className="truncate">{selectedOption?.label}</span>
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && !disabled && (
        <div className="absolute left-0 right-0 top-[calc(100%+0.35rem)] z-50 overflow-hidden rounded-xl border-2 border-slate-200 bg-white p-1 shadow-xl shadow-slate-900/10">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
              className={`w-full rounded-lg px-3 py-2 text-left text-sm font-semibold transition ${
                option.value === value
                  ? 'bg-cyan-50 text-cyan-700'
                  : 'text-slate-700 hover:bg-slate-50 hover:text-cyan-700'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function CustomersManagement() {
  const [users, setUsers] = React.useState<CustomerUser[]>([]);
  const [search, setSearch] = React.useState('');
  const [customerStatusFilter, setCustomerStatusFilter] = React.useState<'active' | 'inactive'>('active');
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState('');
  const [success, setSuccess] = React.useState('');
  const [modalMode, setModalMode] = React.useState<ModalMode>(null);
  const [selectedUser, setSelectedUser] = React.useState<CustomerUser | null>(null);
  const [form, setForm] = React.useState<CustomerForm>({ email: '', fullName: '', phone: '', status: 'active', password: '' });
  const [showPassword, setShowPassword] = React.useState(false);

  // Pagination states
  const [pageSize, setPageSize] = React.useState(20);
  const [currentPage, setCurrentPage] = React.useState(1);

  const loadData = React.useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const usersResponse = await fetch(`${API_BASE_URL}/users`, { headers: authHeaders() });

      if ([401, 403].includes(usersResponse.status)) {
        throw new Error('AUTH_FALLBACK');
      }

      if (!usersResponse.ok) {
        throw new Error('Không tải được danh sách khách hàng');
      }

      const userData = (await usersResponse.json()) as CustomerUser[];
      setUsers(userData.length > 0 ? userData : []);
    } catch (err) {
      if (err instanceof Error && err.message !== 'AUTH_FALLBACK' && !/unauthorized/i.test(err.message)) {
        setError(err.message || 'Không tải được dữ liệu khách hàng');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  React.useEffect(() => {
    setCurrentPage(1);
  }, [search, customerStatusFilter]);

  const customerUsers = users.filter(isCustomer);
  const activeUsers = customerUsers.filter((user) => (user.status || 'active') === 'active');
  const inactiveUsers = customerUsers.filter((user) => user.status === 'inactive');
  const listedUsers = customerStatusFilter === 'active' ? activeUsers : inactiveUsers;
  
  const filteredUsers = listedUsers.filter((user) => {
    const keyword = search.trim().toLowerCase();
    const matchesKeyword =
      !keyword ||
      user.email.toLowerCase().includes(keyword) ||
      (user.fullName || '').toLowerCase().includes(keyword) ||
      user.id.toLowerCase().includes(keyword) ||
      (user.phone || '').toLowerCase().includes(keyword);

    return matchesKeyword;
  });

  const totalItems = filteredUsers.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const paginatedUsers = filteredUsers.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const startIndex = (currentPage - 1) * pageSize + 1;
  const endIndex = Math.min(currentPage * pageSize, totalItems);

  const statusOptions = [
    { value: 'active', label: 'Đang hoạt động' },
    { value: 'inactive', label: 'Không hoạt động' },
  ];

  const closeModal = () => {
    setModalMode(null);
    setSelectedUser(null);
    setSaving(false);
    setShowPassword(false);
  };

  const openCreateModal = () => {
    setError('');
    setSuccess('');
    setSelectedUser(null);
    setShowPassword(false);
    setForm({ email: '', fullName: '', phone: '', address: '', status: 'active', password: '' });
    setModalMode('create');
  };

  const openUserModal = (mode: Exclude<ModalMode, 'create' | null>, user: CustomerUser) => {
    setError('');
    setSuccess('');
    setSelectedUser(user);
    setShowPassword(false);
    setForm({
      email: user.email,
      fullName: user.fullName || '',
      phone: user.phone || '',
      address: user.address || '',
      status: (user.status as any) || 'active',
      password: '',
    });
    setModalMode(mode);
  };

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!modalMode || modalMode === 'view' || modalMode === 'delete') return;

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const isEdit = modalMode === 'edit';
      const url = isEdit && selectedUser ? `${API_BASE_URL}/users/${selectedUser.id}` : `${API_BASE_URL}/users`;
      const body: Record<string, string> = {
        email: form.email,
        fullName: form.fullName,
        phone: form.phone,
        address: form.address || '',
        role: 'customer',
        status: form.status,
      };

      if (form.password) {
        body.password = form.password;
      }

      const response = await fetch(url, {
        method: isEdit ? 'PUT' : 'POST',
        headers: authHeaders(),
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.message || (isEdit ? 'Không cập nhật được khách hàng' : 'Không tạo được khách hàng'));
      }

      setSuccess(isEdit ? 'Đã cập nhật khách hàng.' : 'Đã tạo khách hàng mới.');
      closeModal();
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không lưu được khách hàng');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteUser() {
    if (!selectedUser) return;

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch(`${API_BASE_URL}/users/${selectedUser.id}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.message || 'Không xóa được khách hàng');
      }

      setSuccess('Đã xóa khách hàng.');
      closeModal();
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không xóa được khách hàng');
    } finally {
      setSaving(false);
    }
  }

  const modalTitle =
    modalMode === 'create'
      ? 'Thêm khách hàng mới'
      : modalMode === 'view'
        ? 'Chi tiết khách hàng'
        : modalMode === 'edit'
          ? 'Sửa thông tin khách hàng'
          : 'Xóa khách hàng';

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
          <h1 className="text-2xl font-black text-slate-900">Quản lý khách hàng</h1>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-cyan-700"
          >
            <PlusCircle className="h-4 w-4" />
            Thêm mới
          </button>
        </div>
      </div>

      <div className="mt-8 flex border-b-2 border-slate-100">
        <button
          type="button"
          onClick={() => setCustomerStatusFilter('active')}
          className={`border-b-2 px-3 pb-3 text-base font-bold transition-colors ${
            customerStatusFilter === 'active'
              ? 'border-cyan-600 text-cyan-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Đang hoạt động ({activeUsers.length})
        </button>
        <button
          type="button"
          onClick={() => setCustomerStatusFilter('inactive')}
          className={`border-b-2 px-12 pb-3 text-base font-bold transition-colors ${
            customerStatusFilter === 'inactive'
              ? 'border-cyan-600 text-cyan-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Không hoạt động ({inactiveUsers.length})
        </button>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4">
        <div className="relative max-w-lg">
          <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="h-11 w-full rounded-xl border-2 border-slate-200 bg-white pl-11 pr-4 text-base outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
            placeholder="Tìm kiếm theo họ và tên, email, SĐT"
          />
        </div>
      </div>

      <div className="mt-5 overflow-hidden rounded-xl border-2 border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px] border-collapse bg-white">
            <thead className="bg-slate-50">
              <tr className="border-b-2 border-slate-200">
                <th className="border-x border-slate-200 px-3 py-4 text-center text-sm font-black uppercase text-slate-700">STT</th>
                <th className="border-x border-slate-200 px-3 py-4 text-left text-sm font-black uppercase text-slate-700">Họ và Tên</th>
                <th className="border-x border-slate-200 px-3 py-4 text-left text-sm font-black uppercase text-slate-700">Email</th>
                <th className="border-x border-slate-200 px-3 py-4 text-center text-sm font-black uppercase text-slate-700">Số điện thoại</th>
                <th className="border-x border-slate-200 px-3 py-4 text-left text-sm font-black uppercase text-slate-700">Địa chỉ</th>
                <th className="border-x border-slate-200 px-3 py-4 text-center text-sm font-black uppercase text-slate-700">Trạng thái</th>
                <th className="sticky right-0 w-36 border-l border-slate-200 bg-slate-50 px-3 py-4 text-center text-sm font-black uppercase text-slate-700 shadow-[-4px_0_12px_rgba(0,0,0,0.03)]">
                  Thao tác
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-sm text-slate-500">
                    Đang tải dữ liệu khách hàng...
                  </td>
                </tr>
              ) : paginatedUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-sm text-slate-500">
                    Không có khách hàng phù hợp.
                  </td>
                </tr>
              ) : (
                paginatedUsers.map((user, index) => {
                  return (
                    <tr key={user.id} className="group border-b border-slate-200 transition hover:bg-cyan-50/50">
                      <td className="border-x border-slate-200 px-3 py-4 text-center text-sm text-slate-700">
                        {startIndex + index}
                      </td>
                      <td className="border-x border-slate-200 px-3 py-4 text-left text-sm font-bold text-slate-900">
                        {user.fullName || 'Chưa cập nhật tên'}
                      </td>
                      <td className="border-x border-slate-200 px-3 py-4 text-left text-sm text-slate-700">
                        {user.email}
                      </td>
                      <td className="border-x border-slate-200 px-3 py-4 text-center text-sm text-slate-700">
                        {user.phone || '-'}
                      </td>
                      <td className="border-x border-slate-200 px-3 py-4 text-left text-sm text-slate-700 truncate max-w-[200px]" title={user.address}>
                        {user.address || '-'}
                      </td>
                      <td className="border-x border-slate-200 px-3 py-4 text-center align-middle">
                        <span
                          className={`inline-flex rounded-lg border px-3 py-1 text-xs font-bold ${
                            (user.status || 'active') === 'active'
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                              : 'border-slate-200 bg-slate-100 text-slate-600'
                          }`}
                        >
                          {(user.status || 'active') === 'active' ? 'Đang hoạt động' : 'Không hoạt động'}
                        </span>
                      </td>
                      <td className="sticky right-0 border-l border-slate-200 bg-white px-3 py-4 text-center align-middle shadow-[-4px_0_12px_rgba(0,0,0,0.03)] group-hover:bg-cyan-50/50">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            type="button"
                            className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-50 text-cyan-600 transition-colors hover:bg-cyan-100 hover:text-cyan-700"
                            aria-label="Xem chi tiết"
                            title="Xem chi tiết"
                            onClick={() => openUserModal('view', user)}
                          >
                            <Eye size={18} strokeWidth={2} />
                          </button>
                          <button
                            type="button"
                            className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-50 text-cyan-600 transition-colors hover:bg-cyan-100 hover:text-cyan-700"
                            aria-label="Sửa khách hàng"
                            title="Sửa khách hàng"
                            onClick={() => openUserModal('edit', user)}
                          >
                            <Pencil size={18} strokeWidth={2} />
                          </button>
                          <button
                            type="button"
                            className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-50 text-cyan-600 transition-colors hover:bg-cyan-100 hover:text-cyan-700"
                            aria-label="Xóa khách hàng"
                            title="Xóa khách hàng"
                            onClick={() => openUserModal('delete', user)}
                          >
                            <Trash2 size={18} strokeWidth={2} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Phân trang dính liền viền dưới của bảng */}
        {!loading && totalItems > 0 && (
          <div className="flex flex-col items-center justify-between border-t border-slate-200 bg-slate-50/50 px-6 py-3 sm:flex-row">
            <div className="text-sm text-slate-600">
              Tổng số: <b>{totalItems}</b> <span className="ml-2">Hiển thị {totalItems > 0 ? startIndex : 0} - {endIndex}</span>
            </div>
            <div className="mt-4 flex items-center gap-2 sm:mt-0">
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
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
                <button
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-50"
                >
                  «
                </button>
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-50"
                >
                  ‹
                </button>
                <button className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-600 text-sm font-bold text-white">
                  {currentPage}
                </button>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-50"
                >
                  ›
                </button>
                <button
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-50"
                >
                  »
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {modalMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm transition-all">
          <div className="w-full max-w-3xl rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b-2 border-slate-100 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-cyan-50 p-2 text-cyan-600">
                  {modalMode === 'create' ? <UserPlus className="h-6 w-6" /> : <Users className="h-6 w-6" />}
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-800">{modalTitle}</h2>
                  <p className="text-sm font-medium text-slate-500">
                    {modalMode === 'view' ? 'Thông tin chỉ xem' : 'Thao tác được xử lý trong popup'}
                  </p>
                </div>
              </div>
              <button type="button" onClick={closeModal} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition">
                <X className="h-5 w-5" />
              </button>
            </div>

            {modalMode === 'delete' ? (
              <div className="px-6 py-5">
                <p className="text-base text-slate-700">
                  Bạn có chắc muốn xóa khách hàng{' '}
                  <span className="font-black text-slate-950">{selectedUser?.fullName || selectedUser?.email}</span> không?
                </p>
                <p className="mt-2 text-sm text-slate-500">Hành động này sẽ xóa tài khoản khách hàng khỏi hệ thống.</p>
                <div className="mt-8 flex justify-end gap-3">
                  <button type="button" onClick={closeModal} className="rounded-xl border-2 border-slate-200 px-5 py-2.5 font-bold text-slate-600 hover:bg-slate-50 hover:text-slate-800 transition">
                    Hủy
                  </button>
                  <button
                    type="button"
                    onClick={handleDeleteUser}
                    disabled={saving}
                    className="rounded-xl bg-red-600 px-5 py-2.5 font-bold text-white shadow-sm transition hover:bg-red-700 disabled:opacity-60"
                  >
                    {saving ? 'Đang xóa...' : 'Xóa khách hàng'}
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="px-6 py-5">
                <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-bold text-slate-700">Họ và tên</label>
                    <input
                      value={form.fullName}
                      onChange={(event) => setForm((current) => ({ ...current, fullName: event.target.value }))}
                      readOnly={modalMode === 'view'}
                      className="h-11 w-full rounded-xl border-2 border-slate-200 px-4 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10 read-only:bg-slate-50 read-only:focus:border-slate-200 read-only:focus:ring-0"
                      placeholder="Nguyễn Văn A"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-bold text-slate-700">Email</label>
                    <input
                      type="email"
                      value={form.email}
                      onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                      readOnly={modalMode === 'view'}
                      className="h-11 w-full rounded-xl border-2 border-slate-200 px-4 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10 read-only:bg-slate-50 read-only:focus:border-slate-200 read-only:focus:ring-0"
                      placeholder="khachhang@example.com"
                      required
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-bold text-slate-700">Số điện thoại</label>
                    <input
                      value={form.phone}
                      onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
                      readOnly={modalMode === 'view'}
                      className="h-11 w-full rounded-xl border-2 border-slate-200 px-4 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10 read-only:bg-slate-50 read-only:focus:border-slate-200 read-only:focus:ring-0"
                      placeholder="0901234567"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-bold text-slate-700">Địa chỉ</label>
                    <input
                      value={form.address || ''}
                      onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))}
                      readOnly={modalMode === 'view'}
                      className="h-11 w-full rounded-xl border-2 border-slate-200 px-4 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10 read-only:bg-slate-50 read-only:focus:border-slate-200 read-only:focus:ring-0"
                      placeholder="Số nhà, đường, phường, quận..."
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-bold text-slate-700">Trạng thái</label>
                    <StyledSelect
                      value={form.status}
                      options={statusOptions}
                      onChange={(value) =>
                        setForm((current) => ({ ...current, status: value as CustomerForm['status'] }))
                      }
                      disabled={modalMode === 'view'}
                      className="h-11 w-full"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-bold text-slate-700">
                      {modalMode === 'create' ? 'Mật khẩu' : 'Mật khẩu mới'}
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={form.password || ''}
                        onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
                        readOnly={modalMode === 'view'}
                        className="h-11 w-full rounded-xl border-2 border-slate-200 px-4 pr-12 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10 read-only:bg-slate-50 read-only:focus:border-slate-200 read-only:focus:ring-0"
                        placeholder={modalMode === 'edit' ? 'Để trống nếu không đổi' : 'Tối thiểu 6 ký tự'}
                        required={modalMode === 'create'}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((current) => !current)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1 text-slate-500 transition hover:bg-slate-100 hover:text-cyan-600"
                        aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                        title={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                      >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="mt-8 flex justify-end gap-3">
                  <button type="button" onClick={closeModal} className="rounded-xl border-2 border-slate-200 px-5 py-2.5 font-bold text-slate-600 hover:bg-slate-50 hover:text-slate-800 transition">
                    {modalMode === 'view' ? 'Đóng' : 'Hủy'}
                  </button>
                  {modalMode !== 'view' && (
                    <button
                      type="submit"
                      disabled={saving}
                      className="rounded-xl bg-cyan-600 px-6 py-2.5 font-bold text-white shadow-sm transition hover:bg-cyan-700 disabled:opacity-60"
                    >
                      {saving ? 'Đang lưu...' : modalMode === 'create' ? 'Thêm khách hàng' : 'Lưu thay đổi'}
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
