import React from 'react';
import {
  Eye,
  Pencil,
  PlusCircle,
  RefreshCw,
  Search,
  Trash2,
  UserCog,
  Warehouse,
  X,
} from 'lucide-react';
import Toast from '../../shared/components/Toast';
import {
  getStoredWarehouses,
  mergeStoredWarehouses,
  normalizeWarehouseRecord,
  saveStoredWarehouses,
  upsertWarehouseToApi,
  warehouseListEquals,
  type WarehouseRecord,
} from '../../shared/utils/warehouseAssignments';

type Role = {
  id: string;
  name: string;
};

type PersonnelUser = {
  id: string;
  email: string;
  fullName?: string;
  roles?: Role[];
};

type WarehouseForm = {
  code: string;
  name: string;
  address: string;
  status: 'active' | 'inactive';
  managerIds: string[];
  staffIds: string[];
};

type ModalMode = 'create' | 'view' | 'edit' | 'delete' | null;

const API_BASE_URL = 'http://localhost:3000/api';

function authHeaders() {
  const token = localStorage.getItem('token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

function getPrimaryRole(user: PersonnelUser) {
  if (!Array.isArray(user.roles) || user.roles.length === 0) return 'staff';
  if (user.roles.some((role) => String(role?.name).toLowerCase() === 'admin')) return 'admin';
  if (user.roles.some((role) => String(role?.name).toLowerCase() === 'manager')) return 'manager';
  if (user.roles.some((role) => String(role?.name).toLowerCase() === 'staff')) return 'staff';
  return String(user.roles[0]?.name || 'staff');
}

function getDisplayName(user?: PersonnelUser) {
  if (!user) return '';
  return user.fullName || user.email;
}

function buildEmptyForm(): WarehouseForm {
  return {
    code: '',
    name: '',
    address: '',
    status: 'active',
    managerIds: [],
    staffIds: [],
  };
}

function buildWarehouseForm(warehouse: WarehouseRecord): WarehouseForm {
  const normalizedWarehouse = normalizeWarehouseRecord(warehouse);
  return {
    code: normalizedWarehouse.code,
    name: normalizedWarehouse.name,
    address: normalizedWarehouse.address,
    status: normalizedWarehouse.status,
    managerIds: normalizedWarehouse.managerIds,
    staffIds: normalizedWarehouse.staffIds,
  };
}

export default function WarehouseManagement() {
  const [users, setUsers] = React.useState<PersonnelUser[]>([]);
  const [warehouses, setWarehouses] = React.useState<WarehouseRecord[]>(() => getStoredWarehouses());
  const [search, setSearch] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState('all');
  const [modalMode, setModalMode] = React.useState<ModalMode>(null);
  const [selectedWarehouse, setSelectedWarehouse] = React.useState<WarehouseRecord | null>(null);
  const [form, setForm] = React.useState<WarehouseForm>(buildEmptyForm());
  const [error, setError] = React.useState('');
  const [success, setSuccess] = React.useState('');
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);

  // Pagination states
  const [pageSize, setPageSize] = React.useState(20);
  const [currentPage, setCurrentPage] = React.useState(1);

  const loadData = React.useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_BASE_URL}/warehouses`, { headers: authHeaders() });
      if (response.status === 401) {
        localStorage.removeItem('token');
        window.location.href = '/login';
        return;
      }

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.message || 'Không tải được danh sách kho hàng');
      }

      const data = (await response.json()) as WarehouseRecord[];
      const fallback = getStoredWarehouses();
      const nextWarehouses = (data.length > 0 ? mergeStoredWarehouses(data, fallback) : fallback).map(
        normalizeWarehouseRecord,
      );

      setWarehouses(nextWarehouses);
      saveStoredWarehouses(nextWarehouses);

      const remoteById = new Map(data.map((warehouse) => [String(warehouse.id), normalizeWarehouseRecord(warehouse)]));
      const warehousesToSync = nextWarehouses.filter((warehouse) => {
        const remoteWarehouse = remoteById.get(warehouse.id);
        return !remoteWarehouse || !warehouseListEquals(remoteWarehouse, warehouse);
      });

      if (warehousesToSync.length > 0) {
        const syncedWarehouses = await Promise.all(
          warehousesToSync.map((warehouse) => {
            const isNew = !remoteById.has(String(warehouse.id));
            return upsertWarehouseToApi(warehouse, isNew ? 'POST' : undefined);
          }),
        );
        const syncedById = new Map(syncedWarehouses.map((warehouse) => [warehouse.id, warehouse]));
        const mergedAfterSync = nextWarehouses.map(
          (warehouse) => syncedById.get(warehouse.id) || warehouse,
        );
        setWarehouses(mergedAfterSync);
        saveStoredWarehouses(mergedAfterSync);
      }
    } catch (err) {
      const fallback = getStoredWarehouses();
      setWarehouses(fallback.map(normalizeWarehouseRecord));
      if (fallback.length === 0 && err instanceof Error && err.message !== 'Không tải được danh sách kho hàng') {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    async function loadUsers() {
      try {
        const response = await fetch(`${API_BASE_URL}/users`, { headers: authHeaders() });
        if (response.status === 401) {
          localStorage.removeItem('token');
          window.location.href = '/login';
          return;
        }

        if (!response.ok) throw new Error('Không tải được danh sách nhân sự');
        setUsers((await response.json()) as PersonnelUser[]);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Không tải được danh sách nhân sự');
      }
    }

    loadUsers();
  }, []);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  React.useEffect(() => {
    saveStoredWarehouses(warehouses);
  }, [warehouses]);

  // Reset trang khi filter
  React.useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter]);

  const managers = users.filter((user) => ['admin', 'manager'].includes(getPrimaryRole(user)));
  const staff = users.filter((user) => getPrimaryRole(user) === 'staff');
  const activeCount = warehouses.filter((warehouse) => warehouse.status === 'active').length;
  const inactiveCount = warehouses.filter((warehouse) => warehouse.status === 'inactive').length;

  const filteredWarehouses = warehouses.filter((warehouse) => {
    const keyword = search.trim().toLowerCase();
    const matchesKeyword =
      !keyword ||
      warehouse.name.toLowerCase().includes(keyword) ||
      warehouse.code.toLowerCase().includes(keyword) ||
      warehouse.address.toLowerCase().includes(keyword);
    const matchesStatus = statusFilter === 'all' || warehouse.status === statusFilter;

    return matchesKeyword && matchesStatus;
  });

  // Calculate Pagination
  const totalItems = filteredWarehouses.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const paginatedWarehouses = filteredWarehouses.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const startIndex = (currentPage - 1) * pageSize + 1;
  const endIndex = Math.min(currentPage * pageSize, totalItems);

  const closeModal = () => {
    setModalMode(null);
    setSelectedWarehouse(null);
  };

  const openCreateModal = () => {
    setError('');
    setSuccess('');
    setSelectedWarehouse(null);
    setForm(buildEmptyForm());
    setModalMode('create');
  };

  const openWarehouseModal = (mode: Exclude<ModalMode, 'create' | null>, warehouse: WarehouseRecord) => {
    setError('');
    setSuccess('');
    setSelectedWarehouse(warehouse);
    setForm(buildWarehouseForm(warehouse));
    setModalMode(mode);
  };

  const toggleUser = (field: 'managerIds' | 'staffIds', userId: string) => {
    setForm((current) => {
      const exists = current[field].includes(userId);
      return {
        ...current,
        [field]: exists ? current[field].filter((id) => id !== userId) : [...current[field], userId],
      };
    });
  };

  const getNames = (ids: string[]) => {
    const names = ids.map((id) => getDisplayName(users.find((user) => user.id === id))).filter(Boolean);
    return names.length > 0 ? names.join(', ') : '-';
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.code.trim() || !form.name.trim()) {
      setError('Vui l?ng nh?p m? kho v? t?n kho.');
      return;
    }

    const normalizedCode = form.code.trim().toUpperCase();
    const duplicateCode = warehouses.some(
      (warehouse) => warehouse.code.toUpperCase() === normalizedCode && warehouse.id !== selectedWarehouse?.id,
    );

    if (duplicateCode) {
      setError('M? kho ?? t?n t?i.');
      return;
    }

    const payload: WarehouseRecord = {
      id: selectedWarehouse?.id || crypto.randomUUID(),
      code: normalizedCode,
      name: form.name.trim(),
      address: form.address.trim(),
      status: form.status,
      managerIds: form.managerIds,
      staffIds: form.staffIds,
    };

    void (async () => {
      setSaving(true);
      setError('');
      try {
        await upsertWarehouseToApi(payload, modalMode === 'create' ? 'POST' : undefined);
        await loadData();
        setSuccess(modalMode === 'edit' ? 'Đã cập nhật kho hàng.' : 'Đã thêm kho hàng mới.');
        closeModal();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Không lưu được kho hàng');
      } finally {
        setSaving(false);
      }
    })();
  };

  const handleDelete = () => {
    if (!selectedWarehouse) return;

    void (async () => {
      setSaving(true);
      setError('');
      try {
        const response = await fetch(`${API_BASE_URL}/warehouses/${encodeURIComponent(selectedWarehouse.id)}`, {
          method: 'DELETE',
          headers: authHeaders(),
        });

        if (!response.ok && response.status !== 404) {
          const data = await response.json().catch(() => null);
          throw new Error(data?.message || 'Không xóa được kho hàng');
        }

        // Remove from localStorage to prevent resurrection
        const fallback = getStoredWarehouses();
        const nextFallback = fallback.filter((w) => w.id !== selectedWarehouse.id);
        saveStoredWarehouses(nextFallback);

        await loadData();
        setSuccess('Đã xóa kho hàng.');
        closeModal();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Kh?ng x?a ???c kho h?ng');
      } finally {
        setSaving(false);
      }
    })();
  };

  const modalTitle =
    modalMode === 'create'
      ? 'Thêm kho hàng'
      : modalMode === 'view'
        ? 'Chi tiết kho hàng'
        : modalMode === 'edit'
          ? 'Sửa kho hàng'
          : 'Xóa kho hàng';

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
          <h1 className="text-2xl font-black text-slate-900">Quản lý kho hàng</h1>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-slate-600 transition hover:bg-slate-50 disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Làm mới
          </button>
          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-cyan-700"
          >
            <PlusCircle className="h-4 w-4" />
            Thêm kho
          </button>
        </div>
      </div>

      <div className="mt-8 flex border-b-2 border-slate-100">
        <button type="button" className="border-b-2 border-cyan-600 px-3 pb-3 text-base font-bold text-cyan-600">
          Đang hoạt động ({activeCount})
        </button>
        <button type="button" className="border-b-2 border-transparent px-12 pb-3 text-base font-bold text-slate-500 hover:text-slate-700">
          Không hoạt động ({inactiveCount})
        </button>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="h-11 w-full rounded-xl border-2 border-slate-200 bg-white pl-11 pr-4 text-base outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
            placeholder="Tìm kiếm theo mã kho, tên kho, địa chỉ"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          className="h-11 w-full rounded-xl border-2 border-slate-200 bg-white px-4 text-base outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
        >
          <option value="all">Trạng thái: -- Chọn --</option>
          <option value="active">Đang hoạt động</option>
          <option value="inactive">Không hoạt động</option>
        </select>
      </div>

      {/* Wrapper chứa bảng + phân trang dính liền nhau */}
      <div className="mt-5 overflow-hidden rounded-xl border-2 border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1040px] border-collapse bg-white">
            <thead className="bg-slate-50">
              <tr className="border-b-2 border-slate-200">
                <th className="w-16 border-x border-slate-200 px-3 py-4 text-center text-sm font-black uppercase text-slate-700">STT</th>
                <th className="border-x border-slate-200 px-3 py-4 text-center text-sm font-black uppercase text-slate-700">Mã kho</th>
                <th className="border-x border-slate-200 px-3 py-4 text-center text-sm font-black uppercase text-slate-700">Tên kho</th>
                <th className="border-x border-slate-200 px-3 py-4 text-center text-sm font-black uppercase text-slate-700">Địa chỉ</th>
                <th className="border-x border-slate-200 px-3 py-4 text-center text-sm font-black uppercase text-slate-700">Quản lý kho</th>
                <th className="border-x border-slate-200 px-3 py-4 text-center text-sm font-black uppercase text-slate-700">Nhân viên kho</th>
                <th className="border-x border-slate-200 px-3 py-4 text-center text-sm font-black uppercase text-slate-700">Trạng thái</th>
                <th className="sticky right-0 w-36 border-l border-slate-200 bg-slate-50 px-3 py-4 text-center text-sm font-black uppercase text-slate-700 shadow-[-4px_0_12px_rgba(0,0,0,0.03)]">
                  Thao tác
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-sm text-slate-500">
                    Đang tải danh sách kho hàng...
                  </td>
                </tr>
              ) : paginatedWarehouses.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-sm text-slate-500">
                    {error ? 'Lỗi khi tải dữ liệu. Vui lòng thử lại.' : 'Chưa có kho hàng. Hãy tạo kho hàng mới.'}
                  </td>
                </tr>
              ) : (
                paginatedWarehouses.map((warehouse, index) => (
                  <tr key={warehouse.id} className="group border-b border-slate-200 transition hover:bg-cyan-50/50">
                    <td className="border-x border-slate-200 px-3 py-4 text-center text-sm text-slate-700">
                      {startIndex + index}
                    </td>
                    <td className="border-x border-slate-200 px-3 py-4 text-center text-sm text-slate-700 uppercase">
                      {warehouse.code}
                    </td>
                    <td className="border-x border-slate-200 px-3 py-4 text-center text-sm text-slate-700">
                      {warehouse.name}
                    </td>
                    <td className="border-x border-slate-200 px-3 py-4 text-center text-sm text-slate-700">
                      {warehouse.address || '-'}
                    </td>
                    <td className="max-w-[220px] truncate border-x border-slate-200 px-3 py-4 text-center text-sm text-slate-700">
                      {getNames(warehouse.managerIds)}
                    </td>
                    <td className="max-w-[240px] truncate border-x border-slate-200 px-3 py-4 text-center text-sm text-slate-700">
                      {getNames(warehouse.staffIds)}
                    </td>
                    <td className="border-x border-slate-200 px-3 py-4 text-center align-middle">
                      <span
                        className={`inline-flex rounded-lg border px-3 py-1 text-xs font-bold ${warehouse.status === 'active'
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                            : 'border-slate-200 bg-slate-100 text-slate-600'
                          }`}
                      >
                        {warehouse.status === 'active' ? 'Đang hoạt động' : 'Không hoạt động'}
                      </span>
                    </td>
                    <td className="sticky right-0 border-l border-slate-200 bg-white px-3 py-4 text-center align-middle shadow-[-4px_0_12px_rgba(0,0,0,0.03)] group-hover:bg-cyan-50/50">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          type="button"
                          className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-50 text-cyan-600 transition-colors hover:bg-cyan-100 hover:text-cyan-700"
                          aria-label="Xem kho"
                          title="Xem kho"
                          onClick={() => openWarehouseModal('view', warehouse)}
                        >
                          <Eye size={18} strokeWidth={2} />
                        </button>
                        <button
                          type="button"
                          className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-50 text-cyan-600 transition-colors hover:bg-cyan-100 hover:text-cyan-700"
                          aria-label="Sửa kho"
                          title="Sửa kho"
                          onClick={() => openWarehouseModal('edit', warehouse)}
                        >
                          <Pencil size={18} strokeWidth={2} />
                        </button>
                        <button
                          type="button"
                          className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-50 text-cyan-600 transition-colors hover:bg-cyan-100 hover:text-cyan-700"
                          aria-label="Xóa kho"
                          title="Xóa kho"
                          onClick={() => openWarehouseModal('delete', warehouse)}
                        >
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

        {/* Phân trang dính liền viền dưới của bảng */}
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
      </div>

      {/* Modals */}
      {modalMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm transition-all">
          <div className="w-full max-w-3xl rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b-2 border-slate-100 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-cyan-50 p-2 text-cyan-600">
                  <Warehouse className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-800">{modalTitle}</h2>
                  <p className="text-sm font-medium text-slate-500">Gán quản lý kho và nhân viên kho trong popup này</p>
                </div>
              </div>
              <button type="button" onClick={closeModal} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition">
                <X className="h-5 w-5" />
              </button>
            </div>

            {modalMode === 'delete' ? (
              <div className="px-6 py-5">
                <p className="text-base text-slate-700">
                  Bạn có chắc muốn xóa kho{' '}
                  <span className="font-black text-slate-950">{selectedWarehouse?.name}</span> không?
                </p>
                <div className="mt-8 flex justify-end gap-3">
                  <button type="button" onClick={closeModal} className="rounded-xl border-2 border-slate-200 px-5 py-2.5 font-bold text-slate-600 hover:bg-slate-50 hover:text-slate-800 transition">
                    Hủy
                  </button>
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={saving}
                    className="rounded-xl bg-red-600 px-5 py-2.5 font-bold text-white shadow-sm transition hover:bg-red-700 disabled:opacity-60"
                  >
                    Xóa kho
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="px-6 py-5">
                <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-bold text-slate-700">Mã kho</label>
                    <input
                      value={form.code}
                      onChange={(event) => setForm((current) => ({ ...current, code: event.target.value }))}
                      readOnly={modalMode === 'view'}
                      className="h-11 w-full rounded-xl border-2 border-slate-200 px-4 uppercase outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10 read-only:bg-slate-50 read-only:focus:border-slate-200 read-only:focus:ring-0"
                      placeholder="KHO-01"
                      required
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-bold text-slate-700">Tên kho</label>
                    <input
                      value={form.name}
                      onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                      readOnly={modalMode === 'view'}
                      className="h-11 w-full rounded-xl border-2 border-slate-200 px-4 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10 read-only:bg-slate-50 read-only:focus:border-slate-200 read-only:focus:ring-0"
                      placeholder="Kho trung tâm"
                      required
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="mb-2 block text-sm font-bold text-slate-700">Địa chỉ</label>
                    <input
                      value={form.address}
                      onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))}
                      readOnly={modalMode === 'view'}
                      className="h-11 w-full rounded-xl border-2 border-slate-200 px-4 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10 read-only:bg-slate-50 read-only:focus:border-slate-200 read-only:focus:ring-0"
                      placeholder="Địa chỉ kho"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-bold text-slate-700">Trạng thái</label>
                    <select
                      value={form.status}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, status: event.target.value as WarehouseForm['status'] }))
                      }
                      disabled={modalMode === 'view'}
                      className="h-11 w-full rounded-xl border-2 border-slate-200 bg-white px-4 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10 disabled:bg-slate-50"
                    >
                      <option value="active">Đang hoạt động</option>
                      <option value="inactive">Không hoạt động</option>
                    </select>
                  </div>
                </div>

                <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2">
                  <div className="rounded-xl border-2 border-slate-200 p-4">
                    <p className="font-black text-slate-800">Quản lý kho</p>
                    <p className="mb-3 text-xs font-medium text-slate-500">Có thể chọn nhiều quản lý cho một kho</p>
                    <div className="max-h-48 space-y-2 overflow-y-auto pr-1">
                      {managers.length === 0 ? (
                        <p className="text-sm font-medium text-slate-500">Chưa có nhân sự vai trò quản lý.</p>
                      ) : (
                        managers.map((user) => (
                          <label key={user.id} className="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-slate-50 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={form.managerIds.includes(user.id)}
                              onChange={() => toggleUser('managerIds', user.id)}
                              disabled={modalMode === 'view'}
                              className="h-4 w-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-600"
                            />
                            <span className="text-sm font-semibold text-slate-700">{getDisplayName(user)}</span>
                          </label>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="rounded-xl border-2 border-slate-200 p-4">
                    <p className="font-black text-slate-800">Nhân viên kho</p>
                    <p className="mb-3 text-xs font-medium text-slate-500">Nhân viên trực tiếp vận hành trong kho</p>
                    <div className="max-h-48 space-y-2 overflow-y-auto pr-1">
                      {staff.length === 0 ? (
                        <p className="text-sm font-medium text-slate-500">Chưa có nhân sự vai trò nhân viên.</p>
                      ) : (
                        staff.map((user) => (
                          <label key={user.id} className="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-slate-50 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={form.staffIds.includes(user.id)}
                              onChange={() => toggleUser('staffIds', user.id)}
                              disabled={modalMode === 'view'}
                              className="h-4 w-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-600"
                            />
                            <span className="text-sm font-semibold text-slate-700">{getDisplayName(user)}</span>
                          </label>
                        ))
                      )}
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
                      {saving ? 'Đang lưu...' : modalMode === 'create' ? 'Thêm kho' : 'Lưu thay đổi'}
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
