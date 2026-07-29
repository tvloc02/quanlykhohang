import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  Eye,
  Pencil,
  PlusCircle,
  RefreshCw,
  Search,
  Trash2,
  Warehouse,
  X,
  MapPin,
  Move3d,
  Layers,
  Building,
  Plus,
  Check,
  Globe,
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
  type SubWarehouse,
} from '../../shared/utils/warehouseAssignments';
import Warehouse3DViewer from './components/Warehouse3DViewer';
import VietnamMapModal, { VIETNAM_PROVINCES } from './components/VietnamMapModal';

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
  province: string;
  ward: string;
  detailAddress: string;
  latitude?: number;
  longitude?: number;
  status: 'active' | 'inactive';
  managerIds: string[];
  staffIds: string[];

  wallSpec: string;
  ceilingSpec: string;
  floorSpec: string;
  doorSpec: string;

  // Danh sách kho nhỏ
  subWarehouses: SubWarehouse[];
};

type ModalMode = 'create' | 'view' | 'edit' | 'delete' | 'view3d' | null;

const API_BASE_URL = 'http://localhost:3000/api';

function authHeaders() {
  const token = localStorage.getItem('token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

function buildEmptyForm(): WarehouseForm {
  return {
    code: '',
    name: '',
    address: '',
    province: VIETNAM_PROVINCES[0].name,
    ward: VIETNAM_PROVINCES[0].wards[0],
    detailAddress: '',
    status: 'active',
    managerIds: [],
    staffIds: [],
    wallSpec: '',
    ceilingSpec: '',
    floorSpec: '',
    doorSpec: '',
    subWarehouses: [],
  };
}

function buildWarehouseForm(warehouse: WarehouseRecord): WarehouseForm {
  const norm = normalizeWarehouseRecord(warehouse);
  return {
    code: norm.code,
    name: norm.name,
    address: norm.address,
    province: norm.province || VIETNAM_PROVINCES[0].name,
    ward: norm.ward || VIETNAM_PROVINCES[0].wards[0],
    detailAddress: norm.detailAddress || norm.address,
    latitude: norm.latitude,
    longitude: norm.longitude,
    status: norm.status,
    managerIds: norm.managerIds,
    staffIds: norm.staffIds,
    wallSpec: norm.wallSpec || '',
    ceilingSpec: norm.ceilingSpec || '',
    floorSpec: norm.floorSpec || '',
    doorSpec: norm.doorSpec || '',
    subWarehouses: norm.subWarehouses || [],
  };
}

export default function WarehouseManagement() {
  const [users, setUsers] = useState<PersonnelUser[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseRecord[]>(() => getStoredWarehouses());
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [modalMode, setModalMode] = useState<ModalMode>(null);

  // Active Tab inside Modal: 'main' (Master warehouse) or sub-warehouse ID
  const [activeTabId, setActiveTabId] = useState<string>('main');

  const [selectedWarehouse, setSelectedWarehouse] = useState<WarehouseRecord | null>(null);
  const [form, setForm] = useState<WarehouseForm>(buildEmptyForm());
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isMapOpen, setIsMapOpen] = useState(false);

  // Pagination states
  const [pageSize, setPageSize] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_BASE_URL}/warehouses`, { headers: authHeaders() });
      if (response.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
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

      const remoteById = new Map(data.map((w) => [String(w.id), normalizeWarehouseRecord(w)]));
      const warehousesToSync = nextWarehouses.filter((w) => {
        const remoteW = remoteById.get(w.id);
        return !remoteW || !warehouseListEquals(remoteW, w);
      });

      if (warehousesToSync.length > 0) {
        const syncedWarehouses = await Promise.all(
          warehousesToSync.map((w) => {
            const isNew = !remoteById.has(String(w.id));
            return upsertWarehouseToApi(w, isNew ? 'POST' : undefined);
          }),
        );
        const syncedById = new Map(syncedWarehouses.map((w) => [w.id, w]));
        const mergedAfterSync = nextWarehouses.map((w) => syncedById.get(w.id) || w);
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

  useEffect(() => {
    async function loadUsers() {
      try {
        const response = await fetch(`${API_BASE_URL}/users`, { headers: authHeaders() });
        if (response.status === 401) {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
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

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    saveStoredWarehouses(warehouses);
  }, [warehouses]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter]);

  useEffect(() => {
    if (error || success) {
      const timer = setTimeout(() => {
        setError('');
        setSuccess('');
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [error, success]);

  const activeCount = warehouses.filter((w) => w.status === 'active').length;
  const inactiveCount = warehouses.filter((w) => w.status === 'inactive').length;

  const filteredWarehouses = warehouses.filter((w) => {
    const keyword = search.trim().toLowerCase();
    const matchesKeyword =
      !keyword ||
      w.name.toLowerCase().includes(keyword) ||
      w.code.toLowerCase().includes(keyword) ||
      w.address.toLowerCase().includes(keyword);
    const matchesStatus = statusFilter === 'all' || w.status === statusFilter;

    return matchesKeyword && matchesStatus;
  });

  const totalItems = filteredWarehouses.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const paginatedWarehouses = filteredWarehouses.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const startIndex = (currentPage - 1) * pageSize + 1;
  const endIndex = Math.min(currentPage * pageSize, totalItems);

  const closeModal = () => {
    setModalMode(null);
    setSelectedWarehouse(null);
    setActiveTabId('main');
  };

  const openCreateModal = () => {
    setError('');
    setSuccess('');
    setSelectedWarehouse(null);
    const newForm = buildEmptyForm();
    setForm(newForm);
    setActiveTabId('main');
    setModalMode('create');
  };

  const openWarehouseModal = (mode: Exclude<ModalMode, 'create' | null>, warehouse: WarehouseRecord) => {
    setError('');
    setSuccess('');
    setSelectedWarehouse(warehouse);
    const loadedForm = buildWarehouseForm(warehouse);
    setForm(loadedForm);

    if (mode === 'view3d') {
      const firstSubId = loadedForm.subWarehouses[0]?.id || 'main';
      setActiveTabId(firstSubId);
    } else {
      setActiveTabId('main');
    }

    setModalMode(mode);
  };

  // Add new Sub-warehouse Tab
  const handleAddNewSubWarehouseTab = () => {
    const newId = `sub-${Date.now()}`;
    const newSub: SubWarehouse = {
      id: newId,
      code: `ZONE-${String.fromCharCode(65 + form.subWarehouses.length)}`,
      name: `Kho Nhỏ Phân Khu ${form.subWarehouses.length + 1}`,
      length: 15,
      width: 10,
      height: 6,
      racksCount: 4,
      shelvesPerRack: 4,
      structure: {
        wallType: 'Tường tôn cách nhiệt PPU',
        ceilingType: 'Trần thạch cao chống nóng',
        floorType: 'Sàn bê tông phủ Epoxy',
        cornerInfo: 'Góc bo tròn inox',
      },
    };

    setForm((prev) => ({
      ...prev,
      subWarehouses: [...prev.subWarehouses, newSub],
    }));

    setActiveTabId(newId);
  };

  // Delete a Sub-warehouse tab
  const handleDeleteSubTab = (subId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setForm((prev) => {
      const filtered = prev.subWarehouses.filter((s) => s.id !== subId);
      return { ...prev, subWarehouses: filtered };
    });
    if (activeTabId === subId) {
      setActiveTabId('main');
    }
  };

  // Update specific Sub-warehouse
  const handleUpdateSubWarehouse = (subId: string, updatedFields: Partial<SubWarehouse>) => {
    setForm((prev) => ({
      ...prev,
      subWarehouses: prev.subWarehouses.map((sub) =>
        sub.id === subId ? { ...sub, ...updatedFields } : sub,
      ),
    }));
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.code.trim() || !form.name.trim()) {
      setError('Vui lòng nhập mã kho và tên kho.');
      return;
    }

    const normalizedCode = form.code.trim().toUpperCase();
    const duplicateCode = warehouses.some(
      (w) => w.code.toUpperCase() === normalizedCode && w.id !== selectedWarehouse?.id,
    );

    if (duplicateCode) {
      setError('Mã kho đã tồn tại.');
      return;
    }

    const combinedAddress = [form.detailAddress, form.ward, form.province].filter(Boolean).join(', ');

    const payload: WarehouseRecord = {
      id: selectedWarehouse?.id || crypto.randomUUID(),
      code: normalizedCode,
      name: form.name.trim(),
      address: combinedAddress || form.address,
      province: form.province,
      ward: form.ward,
      detailAddress: form.detailAddress,
      latitude: form.latitude,
      longitude: form.longitude,
      status: form.status,
      managerIds: form.managerIds,
      staffIds: form.staffIds,
      length: 50,
      width: 30,
      height: 12,
      totalArea: 1500,
      totalVolume: 18000,
      wallSpec: form.wallSpec,
      ceilingSpec: form.ceilingSpec,
      floorSpec: form.floorSpec,
      doorSpec: form.doorSpec,
      subWarehouses: form.subWarehouses,
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

        const fallback = getStoredWarehouses();
        const nextFallback = fallback.filter((w) => w.id !== selectedWarehouse.id);
        saveStoredWarehouses(nextFallback);

        await loadData();
        setSuccess('Đã xóa kho hàng.');
        closeModal();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Không xóa được kho hàng');
      } finally {
        setSaving(false);
      }
    })();
  };

  const currentSubWarehouse = form.subWarehouses.find((s) => s.id === activeTabId);

  const modalTitle =
    modalMode === 'create'
      ? 'Thêm Kho Tổng & Tạo Kho Nhỏ Mới'
      : modalMode === 'view'
        ? 'Chi Tiết Kho Hàng'
        : modalMode === 'edit'
          ? 'Chỉnh Sửa Kho Hàng & Kho Nhỏ'
          : modalMode === 'view3d'
            ? 'Mô Phỏng 3D Kho Nhỏ Realtime'
            : 'Xóa Kho Hàng';

  return (
    <div className="space-y-6 font-sans text-slate-800 antialiased">
      <Toast
        message={error || success}
        type={error ? 'error' : 'success'}
        onClose={() => {
          setError('');
          setSuccess('');
        }}
      />

      {/* HEADER SECTION - CYAN DESIGN SYSTEM */}
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <div className="inline-flex items-center gap-2.5 rounded-xl border border-cyan-500/30 bg-cyan-600 px-4 py-2 text-white shadow-sm">
            <Warehouse className="h-5 w-5 text-cyan-100" />
            <h1 className="text-base font-bold tracking-tight text-white">Quản Lý Kho Hàng & Mô Hình 3D Kho Nhỏ</h1>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-xs font-bold text-slate-700 transition hover:bg-slate-50 cursor-pointer disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Làm mới
          </button>
          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-cyan-500 bg-cyan-600 px-5 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-cyan-700 cursor-pointer active:scale-95"
          >
            <PlusCircle className="h-4 w-4" />
            Tạo Kho Tổng Mới
          </button>
        </div>
      </div>

      {/* STATUS FILTER TABS */}
      <div className="flex border-b border-slate-200">
        <button
          type="button"
          onClick={() => setStatusFilter('active')}
          className={`px-4 pb-3 text-xs font-bold transition cursor-pointer ${
            statusFilter === 'active' || statusFilter === 'all'
              ? 'border-b-2 border-cyan-600 text-cyan-600'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          Đang hoạt động ({activeCount})
        </button>
        <button
          type="button"
          onClick={() => setStatusFilter('inactive')}
          className={`ml-4 px-4 pb-3 text-xs font-bold transition cursor-pointer ${
            statusFilter === 'inactive'
              ? 'border-b-2 border-cyan-600 text-cyan-600'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          Không hoạt động ({inactiveCount})
        </button>
      </div>

      {/* SEARCH AND FILTERS */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-cyan-500" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="h-10 w-full rounded-xl border border-cyan-500/80 bg-white pl-10 pr-4 text-xs font-medium outline-none transition focus:border-cyan-600 focus:ring-2 focus:ring-cyan-500/20"
            placeholder="Tìm kiếm mã kho, tên kho tổng, địa chỉ..."
          />
        </div>
        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          className="h-10 w-full rounded-xl border border-cyan-500/80 bg-white px-4 text-xs font-bold text-slate-700 outline-none transition focus:border-cyan-600"
        >
          <option value="all">Tất cả trạng thái kho</option>
          <option value="active">Đang hoạt động</option>
          <option value="inactive">Không hoạt động</option>
        </select>
      </div>

      {/* MAIN DATA TABLE */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[950px] border-collapse bg-white">
            <thead className="bg-cyan-50/70">
              <tr className="border-b border-slate-200">
                <th className="w-14 border-x border-slate-200 px-3 py-3 text-center text-xs font-bold uppercase tracking-wider text-slate-800">
                  STT
                </th>
                <th className="border-x border-slate-200 px-3 py-3 text-center text-xs font-bold uppercase tracking-wider text-slate-800">
                  Mã kho
                </th>
                <th className="border-x border-slate-200 px-3 py-3 text-center text-xs font-bold uppercase tracking-wider text-slate-800">
                  Tên kho tổng
                </th>
                <th className="border-x border-slate-200 px-3 py-3 text-center text-xs font-bold uppercase tracking-wider text-slate-800">
                  Kho nhỏ / Phân khu
                </th>
                <th className="border-x border-slate-200 px-3 py-3 text-center text-xs font-bold uppercase tracking-wider text-slate-800">
                  Địa chỉ kho
                </th>
                <th className="border-x border-slate-200 px-3 py-3 text-center text-xs font-bold uppercase tracking-wider text-slate-800">
                  Trạng thái
                </th>
                <th className="sticky right-0 w-44 border-l border-slate-200 bg-cyan-50/70 px-3 py-3 text-center text-xs font-bold uppercase tracking-wider text-slate-800 shadow-[-4px_0_12px_rgba(0,0,0,0.03)]">
                  Thao tác & 3D Kho Nhỏ
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-xs font-semibold text-slate-500">
                    Đang tải danh sách kho hàng...
                  </td>
                </tr>
              ) : paginatedWarehouses.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-xs font-semibold text-slate-500">
                    {error ? 'Lỗi khi tải dữ liệu. Vui lòng thử lại.' : 'Chưa có kho hàng. Hãy tạo kho hàng mới.'}
                  </td>
                </tr>
              ) : (
                paginatedWarehouses.map((w, index) => (
                  <tr key={w.id} className="group border-b border-slate-200 transition hover:bg-cyan-50/40">
                    <td className="border-x border-slate-200 px-3 py-3.5 text-center text-xs font-bold text-slate-700">
                      {startIndex + index}
                    </td>
                    <td className="border-x border-slate-200 px-3 py-3.5 text-center text-xs font-bold text-cyan-700 uppercase">
                      {w.code}
                    </td>
                    <td className="border-x border-slate-200 px-3 py-3.5 text-center text-xs font-bold text-slate-900">
                      {w.name}
                    </td>
                    <td className="border-x border-slate-200 px-3 py-3.5 text-center text-xs font-bold text-slate-700">
                      <span className="inline-flex items-center gap-1 rounded-lg bg-indigo-50 px-2.5 py-1 text-indigo-700 border border-indigo-200">
                        <Layers className="h-3.5 w-3.5" />
                        {w.subWarehouses?.length || 0} Kho nhỏ
                      </span>
                    </td>
                    <td className="max-w-[280px] truncate border-x border-slate-200 px-3 py-3.5 text-center text-xs font-medium text-slate-700">
                      {w.address ||
                        `${w.detailAddress ? w.detailAddress + ', ' : ''}${w.ward ? w.ward + ', ' : ''}${w.province || ''}`}
                    </td>
                    <td className="border-x border-slate-200 px-3 py-3.5 text-center align-middle">
                      <span
                        className={`inline-flex rounded-lg border px-3 py-1 text-xs font-bold ${
                          w.status === 'active'
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                            : 'border-slate-200 bg-slate-100 text-slate-600'
                        }`}
                      >
                        {w.status === 'active' ? 'Đang hoạt động' : 'Không hoạt động'}
                      </span>
                    </td>
                    <td className="sticky right-0 border-l border-slate-200 bg-white px-3 py-3.5 text-center align-middle shadow-[-4px_0_12px_rgba(0,0,0,0.03)] group-hover:bg-cyan-50/40">
                      <div className="flex items-center justify-center gap-1.5">
                        {/* 3D Kho Nhỏ Button */}
                        <button
                          type="button"
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-indigo-500 bg-indigo-50 text-indigo-600 shadow-sm transition hover:bg-indigo-600 hover:text-white cursor-pointer"
                          aria-label="Xem 3D Kho Nhỏ"
                          title="Xem 3D Kệ Kho Nhỏ"
                          onClick={() => openWarehouseModal('view3d', w)}
                        >
                          <Move3d size={16} strokeWidth={2.2} />
                        </button>
                        <button
                          type="button"
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-cyan-500 bg-white text-cyan-600 shadow-sm transition hover:bg-cyan-50 cursor-pointer"
                          aria-label="Xem kho"
                          title="Xem chi tiết"
                          onClick={() => openWarehouseModal('view', w)}
                        >
                          <Eye size={16} strokeWidth={2.2} />
                        </button>
                        <button
                          type="button"
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-cyan-500 bg-white text-cyan-600 shadow-sm transition hover:bg-cyan-50 cursor-pointer"
                          aria-label="Sửa kho"
                          title="Chỉnh sửa"
                          onClick={() => openWarehouseModal('edit', w)}
                        >
                          <Pencil size={16} strokeWidth={2.2} />
                        </button>
                        <button
                          type="button"
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-cyan-500 bg-white text-cyan-600 shadow-sm transition hover:bg-cyan-50 cursor-pointer"
                          aria-label="Xóa kho"
                          title="Xóa kho"
                          onClick={() => openWarehouseModal('delete', w)}
                        >
                          <Trash2 size={16} strokeWidth={2.2} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* PAGINATION BAR */}
        <div className="flex flex-col items-center justify-between border-t border-slate-200 bg-slate-50/50 px-6 py-3 sm:flex-row">
          <div className="text-xs font-semibold text-slate-600">
            Tổng số: <b className="text-slate-900">{totalItems}</b> kho hàng{' '}
            <span className="ml-2">Hiển thị {totalItems > 0 ? startIndex : 0} - {endIndex}</span>
          </div>
          <div className="mt-4 flex items-center gap-2 sm:mt-0">
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs font-bold outline-none transition focus:border-cyan-500"
            >
              <option value={5}>5 kho/trang</option>
              <option value={20}>20 kho/trang</option>
              <option value={50}>50 kho/trang</option>
            </select>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-50 font-bold text-xs"
              >
                «
              </button>
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-50 font-bold text-xs"
              >
                ‹
              </button>
              <button className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-600 text-xs font-bold text-white shadow-sm">
                {currentPage}
              </button>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-50 font-bold text-xs"
              >
                ›
              </button>
              <button
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-50 font-bold text-xs"
              >
                »
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* POPUP MODAL */}
      {modalMode &&
        createPortal(
          <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-950/70 p-4 sm:p-6 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-full max-w-4xl max-h-[90vh] flex flex-col rounded-2xl bg-white shadow-2xl overflow-hidden border border-cyan-500">
              {/* Modal Header */}
              <div className="flex-shrink-0 flex items-center justify-between border-b border-slate-100 bg-cyan-600 px-6 py-3.5 text-white">
                <div className="flex items-center gap-3">
                  <div className="rounded-xl bg-white/10 p-2 text-white">
                    <Warehouse className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold tracking-tight text-white">{modalTitle}</h2>
                    <p className="text-xs text-cyan-100/90 font-normal">
                      Cấu hình thông tin kho tổng & tạo các Tab kho nhỏ với mô phỏng 3D
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-lg p-1.5 text-white/80 hover:bg-white/20 hover:text-white transition cursor-pointer"
                  title="Đóng cửa sổ"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Modal Body */}
              {modalMode === 'delete' ? (
                <div className="p-6">
                  <p className="text-xs font-semibold text-slate-700">
                    Bạn có chắc chắn muốn xóa kho tổng{' '}
                    <span className="font-bold text-slate-950">{selectedWarehouse?.name}</span> (Mã:{' '}
                    <span className="font-bold text-rose-600">{selectedWarehouse?.code}</span>) cùng tất cả các kho
                    nhỏ thuộc kho này không?
                  </p>
                  <div className="mt-6 flex justify-end gap-2.5">
                    <button
                      type="button"
                      onClick={closeModal}
                      className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition cursor-pointer"
                    >
                      Hủy bỏ
                    </button>
                    <button
                      type="button"
                      onClick={handleDelete}
                      disabled={saving}
                      className="rounded-lg bg-red-600 px-5 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-red-700 disabled:opacity-60 cursor-pointer"
                    >
                      {saving ? 'Đang xóa...' : 'Xác Nhận Xóa Kho'}
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0 overflow-hidden">
                  {/* TAB BAR HEADER - FLUSH DIRECTLY UNDER MODAL HEADER */}
                  <div className="flex-shrink-0 flex items-center gap-2 border-b border-slate-200 bg-slate-100/90 px-6 py-2 overflow-x-auto">
                    <button
                      type="button"
                      onClick={() => setActiveTabId('main')}
                      className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                        activeTabId === 'main'
                          ? 'bg-cyan-600 text-white shadow-sm'
                          : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <Building className="h-4 w-4" />
                      Thông Tin & Địa Chỉ Kho Tổng
                    </button>

                    {form.subWarehouses.map((sub, idx) => (
                      <div key={sub.id} className="relative flex items-center">
                        <button
                          type="button"
                          onClick={() => setActiveTabId(sub.id)}
                          className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                            activeTabId === sub.id
                              ? 'bg-indigo-600 text-white shadow-sm'
                              : 'bg-white text-indigo-700 border border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          <Layers className="h-3.5 w-3.5" />
                          {sub.code || `Kho Nhỏ ${idx + 1}`}
                          {modalMode !== 'view' && form.subWarehouses.length > 1 && (
                            <span
                              onClick={(e) => handleDeleteSubTab(sub.id, e)}
                              className="ml-1 rounded-full p-0.5 hover:bg-black/20 text-white/80"
                              title="Xóa kho nhỏ"
                            >
                              <X className="h-3 w-3" />
                            </span>
                          )}
                        </button>
                      </div>
                    ))}

                    {modalMode !== 'view' && (
                      <button
                        type="button"
                        onClick={handleAddNewSubWarehouseTab}
                        className="inline-flex items-center gap-1 rounded-lg border border-dashed border-cyan-500 bg-cyan-50/60 px-3 py-1.5 text-xs font-bold text-cyan-700 hover:bg-cyan-100 transition cursor-pointer whitespace-nowrap"
                      >
                        <Plus className="h-3.5 w-3.5 text-cyan-600" />
                        Thêm Kho Nhỏ Mới
                      </button>
                    )}
                  </div>

                  {/* Scrollable Body */}
                  <div className="flex-1 overflow-y-auto p-5 space-y-5">
                    {/* TAB 1: MASTER WAREHOUSE INFO & ADDRESS */}
                    {activeTabId === 'main' && (
                      <div className="space-y-4 animate-in fade-in duration-200">
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                          <div>
                            <label className="mb-1 block text-xs font-semibold text-slate-600">
                              Mã kho tổng <span className="text-rose-500">*</span>
                            </label>
                            <input
                              value={form.code}
                              onChange={(event) => setForm((current) => ({ ...current, code: event.target.value }))}
                              readOnly={modalMode === 'view'}
                              className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 text-xs font-semibold uppercase text-slate-900 outline-none transition focus:border-cyan-500 focus:bg-white read-only:bg-slate-50"
                              placeholder="KH001"
                              required
                            />
                          </div>

                          <div>
                            <label className="mb-1 block text-xs font-semibold text-slate-600">
                              Tên kho tổng <span className="text-rose-500">*</span>
                            </label>
                            <input
                              value={form.name}
                              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                              readOnly={modalMode === 'view'}
                              className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 text-xs font-semibold text-slate-900 outline-none transition focus:border-cyan-500 focus:bg-white read-only:bg-slate-50"
                              placeholder="Kho Hà Đông"
                              required
                            />
                          </div>

                          <div>
                            <label className="mb-1 block text-xs font-semibold text-slate-600">Trạng Thái</label>
                            <select
                              value={form.status}
                              onChange={(event) =>
                                setForm((current) => ({
                                  ...current,
                                  status: event.target.value as WarehouseForm['status'],
                                }))
                              }
                              disabled={modalMode === 'view'}
                              className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-900 outline-none focus:border-cyan-500"
                            >
                              <option value="active">Đang hoạt động</option>
                              <option value="inactive">Không hoạt động</option>
                            </select>
                          </div>
                        </div>

                        {/* Unified Address Box with exact Labels */}
                        <div className="rounded-xl border border-cyan-200/80 bg-cyan-50/20 p-4 space-y-3">
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-cyan-200/50 pb-2">
                            <div className="flex items-center gap-2">
                              <MapPin className="h-4 w-4 text-cyan-600" />
                              <h4 className="text-xs font-bold text-cyan-900">Thông Tin Địa Chỉ Kho</h4>
                            </div>
                            <button
                              type="button"
                              onClick={() => setIsMapOpen(true)}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-500 bg-cyan-600 px-3 py-1 text-xs font-semibold text-white shadow-sm hover:bg-cyan-700 transition cursor-pointer"
                            >
                              <Globe className="h-3.5 w-3.5" />
                              Chọn Từ Bản Đồ Kho
                            </button>
                          </div>

                          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                            <div>
                              <label className="mb-1 block text-xs font-semibold text-slate-600">
                                Tỉnh / Thành Phố
                              </label>
                              <select
                                value={form.province}
                                onChange={(e) => {
                                  const pName = e.target.value;
                                  const pData = VIETNAM_PROVINCES.find((p) => p.name === pName);
                                  setForm((prev) => ({
                                    ...prev,
                                    province: pName,
                                    ward: pData ? pData.wards[0] : prev.ward,
                                  }));
                                }}
                                disabled={modalMode === 'view'}
                                className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-900 outline-none transition focus:border-cyan-500"
                              >
                                {VIETNAM_PROVINCES.map((p) => (
                                  <option key={p.code} value={p.name}>
                                    {p.name}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div>
                              <label className="mb-1 block text-xs font-semibold text-slate-600">Phường / Xã</label>
                              <select
                                value={form.ward}
                                onChange={(e) => setForm((prev) => ({ ...prev, ward: e.target.value }))}
                                disabled={modalMode === 'view'}
                                className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-900 outline-none transition focus:border-cyan-500"
                              >
                                {(
                                  VIETNAM_PROVINCES.find((p) => p.name === form.province)?.wards || [
                                    'Phường Bến Nghé (Quận 1)',
                                  ]
                                ).map((w) => (
                                  <option key={w} value={w}>
                                    {w}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div className="md:col-span-2">
                              <label className="mb-1 block text-xs font-semibold text-slate-600">
                                Địa chỉ chi tiết
                              </label>
                              <input
                                value={form.detailAddress}
                                onChange={(e) => setForm((prev) => ({ ...prev, detailAddress: e.target.value }))}
                                readOnly={modalMode === 'view'}
                                placeholder="242 Vạn Phúc..."
                                className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-900 outline-none transition focus:border-cyan-500 read-only:bg-slate-50"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* TAB 2: SUB-WAREHOUSE DETAILED TAB & 3D SIMULATION */}
                    {currentSubWarehouse && activeTabId !== 'main' && (
                      <div className="space-y-4 animate-in fade-in duration-200">
                        <div className="rounded-xl border border-indigo-200 bg-indigo-50/30 p-4 space-y-3">
                          <div className="flex items-center justify-between border-b border-indigo-200/60 pb-2">
                            <span className="text-xs font-bold text-indigo-900 uppercase">
                              Cấu Hình Kho Nhỏ: {currentSubWarehouse.code}
                            </span>
                            <span className="text-xs font-semibold text-slate-500">
                              {currentSubWarehouse.racksCount || 4} Kệ chứa hàng × {currentSubWarehouse.shelvesPerRack || 4} Tầng
                            </span>
                          </div>

                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                            <div>
                              <label className="block text-xs font-semibold text-slate-600 mb-1">Mã Kho Nhỏ</label>
                              <input
                                value={currentSubWarehouse.code}
                                onChange={(e) =>
                                  handleUpdateSubWarehouse(currentSubWarehouse.id, {
                                    code: e.target.value.toUpperCase(),
                                  })
                                }
                                readOnly={modalMode === 'view'}
                                className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold uppercase text-slate-900 outline-none focus:border-indigo-500"
                              />
                            </div>

                            <div className="sm:col-span-2">
                              <label className="block text-xs font-semibold text-slate-600 mb-1">Tên Kho Nhỏ</label>
                              <input
                                value={currentSubWarehouse.name}
                                onChange={(e) =>
                                  handleUpdateSubWarehouse(currentSubWarehouse.id, { name: e.target.value })
                                }
                                readOnly={modalMode === 'view'}
                                className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-900 outline-none focus:border-indigo-500"
                              />
                            </div>

                            <div>
                              <label className="block text-xs font-semibold text-slate-600 mb-1">Chiều Dài (m)</label>
                              <input
                                type="number"
                                value={currentSubWarehouse.length}
                                onChange={(e) =>
                                  handleUpdateSubWarehouse(currentSubWarehouse.id, {
                                    length: Number(e.target.value),
                                  })
                                }
                                readOnly={modalMode === 'view'}
                                className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-900 outline-none focus:border-indigo-500"
                              />
                            </div>

                            <div>
                              <label className="block text-xs font-semibold text-slate-600 mb-1">Chiều Rộng (m)</label>
                              <input
                                type="number"
                                value={currentSubWarehouse.width}
                                onChange={(e) =>
                                  handleUpdateSubWarehouse(currentSubWarehouse.id, {
                                    width: Number(e.target.value),
                                  })
                                }
                                readOnly={modalMode === 'view'}
                                className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-900 outline-none focus:border-indigo-500"
                              />
                            </div>

                            <div>
                              <label className="block text-xs font-semibold text-slate-600 mb-1">Chiều Cao (m)</label>
                              <input
                                type="number"
                                value={currentSubWarehouse.height}
                                onChange={(e) =>
                                  handleUpdateSubWarehouse(currentSubWarehouse.id, {
                                    height: Number(e.target.value),
                                  })
                                }
                                readOnly={modalMode === 'view'}
                                className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-900 outline-none focus:border-indigo-500"
                              />
                            </div>

                            <div>
                              <label className="block text-xs font-semibold text-slate-600 mb-1">Số Lượng Kệ (Racks)</label>
                              <input
                                type="number"
                                value={currentSubWarehouse.racksCount}
                                onChange={(e) =>
                                  handleUpdateSubWarehouse(currentSubWarehouse.id, {
                                    racksCount: Number(e.target.value),
                                  })
                                }
                                readOnly={modalMode === 'view'}
                                className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-900 outline-none focus:border-indigo-500"
                              />
                            </div>

                            <div>
                              <label className="block text-xs font-semibold text-slate-600 mb-1">Số Tầng / Kệ (Shelves)</label>
                              <input
                                type="number"
                                value={currentSubWarehouse.shelvesPerRack}
                                onChange={(e) =>
                                  handleUpdateSubWarehouse(currentSubWarehouse.id, {
                                    shelvesPerRack: Number(e.target.value),
                                  })
                                }
                                readOnly={modalMode === 'view'}
                                className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-900 outline-none focus:border-indigo-500"
                              />
                            </div>

                            <div>
                              <label className="block text-xs font-semibold text-slate-600 mb-1">Loại Tường / Trần</label>
                              <input
                                value={currentSubWarehouse.structure?.wallType || ''}
                                onChange={(e) =>
                                  handleUpdateSubWarehouse(currentSubWarehouse.id, {
                                    structure: {
                                      ...currentSubWarehouse.structure,
                                      wallType: e.target.value,
                                    },
                                  })
                                }
                                readOnly={modalMode === 'view'}
                                placeholder="Panel PU cách nhiệt..."
                                className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-900 outline-none focus:border-indigo-500"
                              />
                            </div>
                          </div>
                        </div>

                        {/* 3D REALTIME VIEWPORT */}
                        <div>
                          <Warehouse3DViewer subWarehouse={currentSubWarehouse} />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Modal Footer */}
                  <div className="flex-shrink-0 flex items-center justify-end gap-2.5 border-t border-slate-200 bg-slate-50/70 px-6 py-3">
                    <button
                      type="button"
                      onClick={closeModal}
                      className="rounded-lg border border-slate-200 bg-white px-5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                    >
                      {modalMode === 'view' || modalMode === 'view3d' ? 'Đóng' : 'Hủy bỏ'}
                    </button>
                    {modalMode !== 'view' && modalMode !== 'view3d' && (
                      <button
                        type="submit"
                        disabled={saving}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-500 bg-cyan-600 px-6 py-2 text-xs font-bold text-white shadow-sm hover:bg-cyan-700 disabled:opacity-60 transition cursor-pointer active:scale-95"
                      >
                        <Check className="h-4 w-4" />
                        {saving ? 'Đang lưu...' : modalMode === 'create' ? 'Tạo Kho Hàng' : 'Lưu Thay Đổi'}
                      </button>
                    )}
                  </div>
                </form>
              )}
            </div>
          </div>,
          document.body,
        )}

      {/* VIETNAM ADDRESS MAP MODAL */}
      <VietnamMapModal
        isOpen={isMapOpen}
        onClose={() => setIsMapOpen(false)}
        initialProvince={form.province}
        initialWard={form.ward}
        initialDetail={form.detailAddress}
        onSelectAddress={(data) => {
          setForm((prev) => ({
            ...prev,
            province: data.province,
            ward: data.ward,
            detailAddress: data.detailAddress,
            latitude: data.lat,
            longitude: data.lng,
          }));
        }}
      />
    </div>
  );
}
