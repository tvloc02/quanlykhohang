import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
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
  Lock,
  Unlock,
  AlertTriangle,
  Users,
} from 'lucide-react';
import Toast from '../../shared/components/Toast';
import {
  getStoredProjectTeams,
  getStoredWarehouses,
  getUserWarehouseIds,
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
  role?: string;
};

type PersonnelCategory = 'manager' | 'storekeeper' | 'inventory_checker';

function getUserRole(user: PersonnelUser): string {
  if (user.role) return user.role.toLowerCase();
  if (user.roles && user.roles.length > 0) return user.roles[0].name.toLowerCase();
  return 'staff';
}

function getUserRoleCategory(user: PersonnelUser): PersonnelCategory {
  const r = getUserRole(user);
  if (r === 'admin' || r === 'manager') return 'manager';
  if (r === 'inventory_checker') return 'inventory_checker';
  return 'storekeeper';
}

function formatRoleBadge(role: string) {
  const r = role.toLowerCase();
  if (r === 'admin') return { label: 'Admin', color: 'bg-rose-50 text-rose-700 border-rose-200' };
  if (r === 'manager') return { label: 'Quản lý', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
  if (r === 'storekeeper') return { label: 'Thủ kho', color: 'bg-cyan-50 text-cyan-700 border-cyan-200' };
  if (r === 'inventory_checker') return { label: 'NV kiểm kê', color: 'bg-amber-50 text-amber-700 border-amber-200' };
  return { label: 'Nhân viên', color: 'bg-slate-100 text-slate-700 border-slate-200' };
}

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

function buildWarehouseForm(warehouse: WarehouseRecord, teams = getStoredProjectTeams()): WarehouseForm {
  const norm = normalizeWarehouseRecord(warehouse);
  const teamMemberIds = Array.isArray(teams)
    ? teams
        .filter((t) => t.warehouseId === warehouse.id)
        .flatMap((t) => [...(t.storekeeperIds || []), ...(t.inventoryCheckerIds || [])])
    : [];

  const mergedStaffIds = Array.from(new Set([...(norm.staffIds || []), ...teamMemberIds]));

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
    staffIds: mergedStaffIds,
    wallSpec: norm.wallSpec || '',
    ceilingSpec: norm.ceilingSpec || '',
    floorSpec: norm.floorSpec || '',
    doorSpec: norm.doorSpec || '',
    subWarehouses: norm.subWarehouses || [],
  };
}

export default function WarehouseManagement() {
  const navigate = useNavigate();
  const [users, setUsers] = useState<PersonnelUser[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseRecord[]>(() => getStoredWarehouses());
  const [projectTeams, setProjectTeams] = useState<any[]>(() => getStoredProjectTeams());
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

  // Personnel category add popup modal states
  const [personnelPopupCategory, setPersonnelPopupCategory] = useState<PersonnelCategory | null>(null);
  const [tempSelectedUserIds, setTempSelectedUserIds] = useState<string[]>([]);
  const [popupSearch, setPopupSearch] = useState('');
  const [detailPersonnelModal, setDetailPersonnelModal] = useState<{ title: string; users: PersonnelUser[] } | null>(null);

  // Pagination states
  const [pageSize, setPageSize] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);

  const openPersonnelPopup = (category: PersonnelCategory) => {
    const assigned = users
      .filter(
        (u) =>
          getUserRoleCategory(u) === category &&
          (form.managerIds.includes(u.id) || form.staffIds.includes(u.id)),
      )
      .map((u) => u.id);

    setTempSelectedUserIds(assigned);
    setPopupSearch('');
    setPersonnelPopupCategory(category);
  };

  const handleConfirmPersonnelPopup = () => {
    if (!personnelPopupCategory) return;
    const category = personnelPopupCategory;

    setForm((prev) => {
      // Keep IDs belonging to other categories
      const otherManagerIds = prev.managerIds.filter((id) => {
        const u = users.find((usr) => usr.id === id);
        return u ? getUserRoleCategory(u) !== category : true;
      });

      const otherStaffIds = prev.staffIds.filter((id) => {
        const u = users.find((usr) => usr.id === id);
        return u ? getUserRoleCategory(u) !== category : true;
      });

      if (category === 'manager') {
        return {
          ...prev,
          managerIds: [...otherManagerIds, ...tempSelectedUserIds],
          staffIds: otherStaffIds,
        };
      } else {
        return {
          ...prev,
          managerIds: otherManagerIds,
          staffIds: [...otherStaffIds, ...tempSelectedUserIds],
        };
      }
    });

    setPersonnelPopupCategory(null);
  };

  const handleRemoveAssignedUser = (userId: string) => {
    setForm((prev) => ({
      ...prev,
      managerIds: prev.managerIds.filter((id) => id !== userId),
      staffIds: prev.staffIds.filter((id) => id !== userId),
    }));
  };

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
    async function loadUsersAndTeams() {
      try {
        const [uRes, tRes] = await Promise.all([
          fetch(`${API_BASE_URL}/users`, { headers: authHeaders() }),
          fetch(`${API_BASE_URL}/project-teams`, { headers: authHeaders() }),
        ]);

        if (uRes.status === 401) {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          window.location.href = '/login';
          return;
        }

        if (uRes.ok) {
          setUsers((await uRes.json()) as PersonnelUser[]);
        }
        if (tRes.ok) {
          const tData = await tRes.json();
          if (Array.isArray(tData) && tData.length > 0) {
            setProjectTeams(tData);
            localStorage.setItem('smart-wms-project-teams', JSON.stringify(tData));
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Không tải được danh sách nhân sự');
      }
    }

    loadUsersAndTeams();
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    saveStoredWarehouses(warehouses);
  }, [warehouses]);

  useEffect(() => {
    const syncData = () => setProjectTeams(getStoredProjectTeams());
    window.addEventListener('storage', syncData);
    return () => window.removeEventListener('storage', syncData);
  }, []);

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

  const [freezeModalTarget, setFreezeModalTarget] = useState<WarehouseRecord | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [batchActionType, setBatchActionType] = useState<'freeze' | 'unfreeze' | 'delete' | null>(null);

  const handleConfirmToggleFreeze = async (wh: WarehouseRecord) => {
    const action = wh.isFrozen ? 'unfreeze' : 'freeze';
    const actionText = wh.isFrozen ? 'Mở khóa kho' : 'Đóng băng kho';

    setSaving(true);
    try {
      const res = await fetch(`${API_BASE_URL}/warehouses/${wh.id}/${action}`, {
        method: 'POST',
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error(`Không thể ${actionText}`);
      setSuccess(`Đã ${actionText} thành công!`);
      setFreezeModalTarget(null);
      await loadData();
    } catch (err: any) {
      setError(err.message || `Lỗi khi ${actionText}`);
    } finally {
      setSaving(false);
    }
  };

  const handleExecuteBatchAction = async () => {
    if (!batchActionType || selectedIds.length === 0) return;
    setSaving(true);
    try {
      if (batchActionType === 'delete') {
        for (const id of selectedIds) {
          await fetch(`${API_BASE_URL}/warehouses/${id}`, {
            method: 'DELETE',
            headers: authHeaders(),
          });
        }
        setSuccess(`Đã xóa thành công ${selectedIds.length} kho hàng!`);
      } else {
        const action = batchActionType;
        const actionText = action === 'freeze' ? 'đóng băng' : 'mở khóa';
        for (const id of selectedIds) {
          await fetch(`${API_BASE_URL}/warehouses/${id}/${action}`, {
            method: 'POST',
            headers: authHeaders(),
          });
        }
        setSuccess(`Đã ${actionText} thành công ${selectedIds.length} kho hàng!`);
      }
      setSelectedIds([]);
      setBatchActionType(null);
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Lỗi khi thực hiện thao tác hàng loạt');
    } finally {
      setSaving(false);
    }
  };

  const totalWarehousesCount = warehouses.length;
  const activeWarehousesCount = warehouses.filter((w) => w.status === 'active').length;
  const frozenWarehousesCount = warehouses.filter((w) => w.isFrozen).length;
  const totalZonesCount = warehouses.reduce((acc, w) => acc + (w.subWarehouses?.length || 0), 0);
  const activeZonesCount = warehouses.reduce(
    (acc, w) => acc + (w.subWarehouses?.filter((s) => s.status !== 'inactive').length || 0),
    0,
  );

  const [cardFilter, setCardFilter] = useState<'all-warehouses' | 'all-zones' | 'active-warehouses' | 'frozen-warehouses' | 'active-zones'>('all-warehouses');

  const filteredWarehouses = warehouses.filter((w) => {
    const keyword = search.trim().toLowerCase();
    const matchesKeyword =
      !keyword ||
      w.name.toLowerCase().includes(keyword) ||
      w.code.toLowerCase().includes(keyword) ||
      w.address.toLowerCase().includes(keyword);

    let matchesStatus = true;
    if (statusFilter === 'active') {
      matchesStatus = w.status === 'active';
    } else if (statusFilter === 'inactive') {
      matchesStatus = w.status === 'inactive';
    } else if (statusFilter === 'frozen') {
      matchesStatus = Boolean(w.isFrozen);
    }

    if (cardFilter === 'all-zones') {
      return matchesKeyword && (w.subWarehouses?.length || 0) > 0;
    }
    if (cardFilter === 'active-zones') {
      return matchesKeyword && (w.subWarehouses?.some((s) => s.status !== 'inactive') || false);
    }
    if (cardFilter === 'frozen-warehouses') {
      return matchesKeyword && Boolean(w.isFrozen);
    }

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
    navigate('/warehouses/create');
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
      name: `Phân Khu ${form.subWarehouses.length + 1}`,
      status: 'active',
      length: 15,
      width: 10,
      height: 6,
      racksCount: 4,
      shelvesPerRack: 4,
      wallRacksCount: 2,
      rackRowsCount: 2,
      structure: {
        wallType: 'Tường tôn cách nhiệt PU',
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

        // Single-warehouse rule for inventory_checker:
        // Identify inventory checkers assigned to this saved warehouse and remove them from other warehouses
        const assignedCheckers = users.filter((u) => {
          const r = getUserRole(u);
          return r === 'inventory_checker' && (payload.managerIds.includes(u.id) || payload.staffIds.includes(u.id));
        });

        if (assignedCheckers.length > 0) {
          const checkerIds = new Set(assignedCheckers.map((u) => u.id));
          const otherWarehousesToSync = warehouses.filter((w) => {
            if (w.id === payload.id) return false;
            return w.managerIds.some((id) => checkerIds.has(id)) || w.staffIds.some((id) => checkerIds.has(id));
          });

          for (const otherW of otherWarehousesToSync) {
            const updatedOtherW = normalizeWarehouseRecord({
              ...otherW,
              managerIds: otherW.managerIds.filter((id) => !checkerIds.has(id)),
              staffIds: otherW.staffIds.filter((id) => !checkerIds.has(id)),
            });
            await upsertWarehouseToApi(updatedOtherW);
          }
        }

        await loadData();
        setSuccess(modalMode === 'edit' ? 'Đã cập nhật kho hàng thành công.' : 'Đã thêm kho hàng mới.');
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
      ? 'Thêm Kho Hàng & Tạo Phân Khu Mới'
      : modalMode === 'view'
        ? 'Chi Tiết Kho Hàng & Phân Khu'
        : modalMode === 'edit'
          ? 'Chỉnh Sửa Kho Hàng & Phân Khu'
          : modalMode === 'view3d'
            ? 'Mô Phỏng 3D Phân Khu Realtime'
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
            <h1 className="text-base font-bold tracking-tight text-white">QUẢN LÝ KHO HÀNG VÀ PHÂN KHU</h1>
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
            Tạo Kho Hàng Mới
          </button>
        </div>
      </div>

      {/* 5 STAT OVERVIEW BUTTONS MATCHING SYSTEM UI */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <button
          type="button"
          onClick={() => {
            setCardFilter('all-warehouses');
            setStatusFilter('all');
          }}
          className={`flex h-[72px] items-center justify-center rounded-xl border-2 border-cyan-500 px-3 shadow-sm transition text-center cursor-pointer ${cardFilter === 'all-warehouses'
              ? 'bg-cyan-600 text-white'
              : 'bg-white text-cyan-700 hover:bg-cyan-50'
            }`}
        >
          <p className="text-xs sm:text-sm font-black uppercase leading-tight">
            {totalWarehousesCount} KHO HÀNG
          </p>
        </button>

        <button
          type="button"
          onClick={() => {
            setCardFilter('active-warehouses');
            setStatusFilter('active');
          }}
          className={`flex h-[72px] items-center justify-center rounded-xl border-2 border-cyan-500 px-3 shadow-sm transition text-center cursor-pointer ${cardFilter === 'active-warehouses'
              ? 'bg-cyan-600 text-white'
              : 'bg-white text-cyan-700 hover:bg-cyan-50'
            }`}
        >
          <p className="text-xs sm:text-sm font-black uppercase leading-tight">
            {activeWarehousesCount} KHO HOẠT ĐỘNG
          </p>
        </button>

        <button
          type="button"
          onClick={() => {
            setCardFilter('frozen-warehouses');
            setStatusFilter('frozen');
          }}
          className={`flex h-[72px] items-center justify-center rounded-xl border-2 border-cyan-500 px-3 shadow-sm transition text-center cursor-pointer ${cardFilter === 'frozen-warehouses'
              ? 'bg-cyan-600 text-white'
              : 'bg-white text-cyan-700 hover:bg-cyan-50'
            }`}
        >
          <p className="text-xs sm:text-sm font-black uppercase leading-tight flex items-center justify-center gap-1">
            <Lock className="h-4 w-4" />
            {frozenWarehousesCount} KHO ĐÓNG BĂNG
          </p>
        </button>

        <button
          type="button"
          onClick={() => {
            setCardFilter('all-zones');
            setStatusFilter('all');
          }}
          className={`flex h-[72px] items-center justify-center rounded-xl border-2 border-cyan-500 px-3 shadow-sm transition text-center cursor-pointer ${cardFilter === 'all-zones'
              ? 'bg-cyan-600 text-white'
              : 'bg-white text-cyan-700 hover:bg-cyan-50'
            }`}
        >
          <p className="text-xs sm:text-sm font-black uppercase leading-tight">
            {totalZonesCount} PHÂN KHU
          </p>
        </button>

        <button
          type="button"
          onClick={() => {
            setCardFilter('active-zones');
            setStatusFilter('active');
          }}
          className={`flex h-[72px] items-center justify-center rounded-xl border-2 border-cyan-500 px-3 shadow-sm transition text-center cursor-pointer ${cardFilter === 'active-zones'
              ? 'bg-cyan-600 text-white'
              : 'bg-white text-cyan-700 hover:bg-cyan-50'
            }`}
        >
          <p className="text-xs sm:text-sm font-black uppercase leading-tight">
            {activeZonesCount} PHÂN KHU HOẠT ĐỘNG
          </p>
        </button>
      </div>

      {/* BATCH ACTION BAR IF ITEMS SELECTED */}
      {selectedIds.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 border-cyan-500 bg-cyan-50/90 p-4 shadow-md animate-in fade-in duration-150">
          <div className="flex items-center gap-2 text-xs font-bold text-cyan-950">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-cyan-600 text-xs font-black text-white">
              {selectedIds.length}
            </span>
            <span>Kho hàng đang được chọn</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setBatchActionType('freeze')}
              className="inline-flex items-center gap-1.5 rounded-xl border border-amber-500 bg-amber-50 px-3.5 py-2 text-xs font-bold text-amber-700 shadow-xs transition hover:bg-amber-100 cursor-pointer"
            >
              <Lock className="h-3.5 w-3.5" /> Đóng Băng Đã Chọn
            </button>
            <button
              type="button"
              onClick={() => setBatchActionType('unfreeze')}
              className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500 bg-emerald-50 px-3.5 py-2 text-xs font-bold text-emerald-700 shadow-xs transition hover:bg-emerald-100 cursor-pointer"
            >
              <Unlock className="h-3.5 w-3.5" /> Mở Khóa Đã Chọn
            </button>
            <button
              type="button"
              onClick={() => setBatchActionType('delete')}
              className="inline-flex items-center gap-1.5 rounded-xl border border-red-500 bg-red-50 px-3.5 py-2 text-xs font-bold text-red-700 shadow-xs transition hover:bg-red-100 cursor-pointer"
            >
              <Trash2 className="h-3.5 w-3.5" /> Xóa Đã Chọn
            </button>
            <button
              type="button"
              onClick={() => setSelectedIds([])}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-600 transition hover:bg-slate-100 cursor-pointer"
            >
              Bỏ Chọn
            </button>
          </div>
        </div>
      )}

      {/* SEARCH AND FILTERS */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-cyan-500" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="h-10 w-full rounded-xl border border-cyan-500/80 bg-white pl-10 pr-4 text-xs font-medium outline-none transition focus:border-cyan-600 focus:ring-2 focus:ring-cyan-500/20"
            placeholder="Tìm kiếm mã kho, tên kho, địa chỉ..."
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
          <option value="frozen">Đóng băng kiểm kê</option>
        </select>
      </div>

      {/* MAIN DATA TABLE */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px] border-collapse bg-white">
            <thead className="bg-cyan-50/70">
              <tr className="border-b border-slate-200">
                <th className="w-10 border-x border-slate-200 px-2 py-3 text-center">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500 cursor-pointer"
                    checked={
                      paginatedWarehouses.length > 0 &&
                      paginatedWarehouses.every((w) => selectedIds.includes(w.id))
                    }
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedIds(paginatedWarehouses.map((w) => w.id));
                      } else {
                        setSelectedIds([]);
                      }
                    }}
                  />
                </th>
                <th className="w-12 border-x border-slate-200 px-2 py-3 text-center text-xs font-bold uppercase tracking-wider text-slate-800">
                  STT
                </th>
                <th className="border-x border-slate-200 px-3 py-3 text-center text-xs font-bold uppercase tracking-wider text-slate-800">
                  Mã kho
                </th>
                <th className="border-x border-slate-200 px-3 py-3 text-center text-xs font-bold uppercase tracking-wider text-slate-800">
                  Tên kho
                </th>
                <th className="border-x border-slate-200 px-3 py-3 text-center text-xs font-bold uppercase tracking-wider text-slate-800">
                  Số phân khu
                </th>
                <th className="border-x border-slate-200 px-3 py-3 text-center text-xs font-bold uppercase tracking-wider text-slate-800">
                  Địa chỉ kho
                </th>
                <th className="border-x border-slate-200 px-3 py-3 text-center text-xs font-bold uppercase tracking-wider text-slate-800">
                  Quản lý kho
                </th>
                <th className="border-x border-slate-200 px-3 py-3 text-center text-xs font-bold uppercase tracking-wider text-slate-800">
                  Thủ kho
                </th>
                <th className="border-x border-slate-200 px-3 py-3 text-center text-xs font-bold uppercase tracking-wider text-slate-800">
                  NV kiểm kê
                </th>
                <th className="border-x border-slate-200 px-3 py-3 text-center text-xs font-bold uppercase tracking-wider text-slate-800">
                  Trạng thái
                </th>
                <th className="border-x border-slate-200 px-3 py-3 text-center text-xs font-bold uppercase tracking-wider text-slate-800">
                  Đóng băng
                </th>
                <th className="sticky right-0 w-48 border-l border-slate-200 bg-cyan-50/70 px-3 py-3 text-center text-xs font-bold uppercase tracking-wider text-slate-800 shadow-[-4px_0_12px_rgba(0,0,0,0.03)]">
                  Hành động
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={12} className="px-6 py-12 text-center text-xs font-semibold text-slate-500">
                    Đang tải danh sách kho hàng...
                  </td>
                </tr>
              ) : paginatedWarehouses.length === 0 ? (
                <tr>
                  <td colSpan={12} className="px-6 py-12 text-center text-xs font-semibold text-slate-500">
                    {error ? 'Lỗi khi tải dữ liệu. Vui lòng thử lại.' : 'Chưa có kho hàng. Hãy tạo kho hàng mới.'}
                  </td>
                </tr>
              ) : (
                paginatedWarehouses.map((w, index) => {
                  const teamMemberIds = projectTeams
                    .filter((t) => t.warehouseId === w.id)
                    .flatMap((t) => [...(t.storekeeperIds || []), ...(t.inventoryCheckerIds || [])]);
                  const assignedUsers = users.filter(
                    (u) => w.managerIds.includes(u.id) || w.staffIds.includes(u.id) || teamMemberIds.includes(u.id),
                  );
                  const managers = assignedUsers.filter((u) => getUserRoleCategory(u) === 'manager');
                  const storekeepers = assignedUsers.filter((u) => getUserRoleCategory(u) === 'storekeeper');
                  const checkers = assignedUsers.filter((u) => getUserRoleCategory(u) === 'inventory_checker');

                  return (
                    <tr key={w.id} className={`group border-b border-slate-200 transition ${w.isFrozen ? 'bg-amber-50/40 hover:bg-amber-50/70' : 'hover:bg-cyan-50/40'}`}>
                      <td className="border-x border-slate-200 px-2 py-3.5 text-center align-middle">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500 cursor-pointer"
                          checked={selectedIds.includes(w.id)}
                          onChange={() => {
                            setSelectedIds((prev) =>
                              prev.includes(w.id) ? prev.filter((id) => id !== w.id) : [...prev, w.id]
                            );
                          }}
                        />
                      </td>
                      <td className="border-x border-slate-200 px-2 py-3.5 text-center text-xs font-bold text-slate-700">
                        {startIndex + index}
                      </td>
                      <td className="border-x border-slate-200 px-3 py-3.5 text-center text-xs font-bold text-cyan-700 uppercase font-mono">
                        {w.code}
                      </td>
                      <td className="border-x border-slate-200 px-3 py-3.5 text-center text-xs font-bold text-slate-900">
                        {w.name}
                      </td>
                      <td className="border-x border-slate-200 px-3 py-3.5 text-center text-xs font-bold text-slate-700">
                        <span className="inline-flex items-center gap-1 rounded-lg bg-cyan-50 px-2.5 py-1 text-cyan-700 border border-cyan-200">
                          <Layers className="h-3.5 w-3.5 text-cyan-600" />
                          {w.subWarehouses?.length || 0} Phân khu
                        </span>
                      </td>
                      <td className="max-w-[200px] truncate border-x border-slate-200 px-3 py-3.5 text-center text-xs font-medium text-slate-700">
                        {w.address ||
                          `${w.detailAddress ? w.detailAddress + ', ' : ''}${w.ward ? w.ward + ', ' : ''}${w.province || ''}`}
                      </td>
                      {/* Column 1: Quản lý kho */}
                      <td className="border-x border-slate-200 px-2 py-3 text-center align-middle">
                        {managers.length === 0 ? (
                          <span className="text-[11px] font-medium text-slate-400 font-mono">-</span>
                        ) : (
                          <div className="flex flex-wrap items-center justify-center gap-1 max-w-[170px] mx-auto">
                            {managers.slice(0, 2).map((u) => (
                              <span
                                key={u.id}
                                className="inline-flex items-center gap-1 rounded-md border border-cyan-200 bg-cyan-50 px-1.5 py-0.5 text-[10px] font-bold text-cyan-800"
                                title={`${u.fullName || u.email}`}
                              >
                                {u.fullName || u.email.split('@')[0]}
                              </span>
                            ))}
                            {managers.length > 2 && (
                              <button
                                type="button"
                                onClick={() => setDetailPersonnelModal({ title: `Quản Lý Kho - ${w.name}`, users: managers })}
                                className="rounded-md bg-cyan-100 px-1.5 py-0.5 text-[10px] font-bold text-cyan-800 border border-cyan-300 hover:bg-cyan-200 transition cursor-pointer"
                                title="Xem tất cả quản lý"
                              >
                                +{managers.length - 2}
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                      {/* Column 2: Thủ kho */}
                      <td className="border-x border-slate-200 px-2 py-3 text-center align-middle">
                        {storekeepers.length === 0 ? (
                          <span className="text-[11px] font-medium text-slate-400 font-mono">-</span>
                        ) : (
                          <div className="flex flex-wrap items-center justify-center gap-1 max-w-[170px] mx-auto">
                            {storekeepers.slice(0, 2).map((u) => (
                              <span
                                key={u.id}
                                className="inline-flex items-center gap-1 rounded-md border border-cyan-200 bg-cyan-50 px-1.5 py-0.5 text-[10px] font-bold text-cyan-800"
                                title={`${u.fullName || u.email}`}
                              >
                                {u.fullName || u.email.split('@')[0]}
                              </span>
                            ))}
                            {storekeepers.length > 2 && (
                              <button
                                type="button"
                                onClick={() => setDetailPersonnelModal({ title: `Thủ Kho - ${w.name}`, users: storekeepers })}
                                className="rounded-md bg-cyan-100 px-1.5 py-0.5 text-[10px] font-bold text-cyan-800 border border-cyan-300 hover:bg-cyan-200 transition cursor-pointer"
                                title="Xem tất cả thủ kho"
                              >
                                +{storekeepers.length - 2}
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                      {/* Column 3: NV kiểm kê */}
                      <td className="border-x border-slate-200 px-2 py-3 text-center align-middle">
                        {checkers.length === 0 ? (
                          <span className="text-[11px] font-medium text-slate-400 font-mono">-</span>
                        ) : (
                          <div className="flex flex-wrap items-center justify-center gap-1 max-w-[170px] mx-auto">
                            {checkers.slice(0, 2).map((u) => (
                              <span
                                key={u.id}
                                className="inline-flex items-center gap-1 rounded-md border border-cyan-200 bg-cyan-50 px-1.5 py-0.5 text-[10px] font-bold text-cyan-800"
                                title={`${u.fullName || u.email}`}
                              >
                                {u.fullName || u.email.split('@')[0]}
                              </span>
                            ))}
                            {checkers.length > 2 && (
                              <button
                                type="button"
                                onClick={() => setDetailPersonnelModal({ title: `NV Kiểm Kê - ${w.name}`, users: checkers })}
                                className="rounded-md bg-cyan-100 px-1.5 py-0.5 text-[10px] font-bold text-cyan-800 border border-cyan-300 hover:bg-cyan-200 transition cursor-pointer"
                                title="Xem tất cả nhân viên kiểm kê"
                              >
                                +{checkers.length - 2}
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="border-x border-slate-200 px-3 py-3.5 text-center align-middle">
                        <span
                          className={`inline-flex rounded-lg border px-2.5 py-1 text-xs font-bold ${w.status === 'active'
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                              : 'border-slate-200 bg-slate-100 text-slate-600'
                            }`}
                        >
                          {w.status === 'active' ? 'Đang hoạt động' : 'Không hoạt động'}
                        </span>
                      </td>
                      <td className="border-x border-slate-200 px-3 py-3.5 text-center align-middle">
                        {w.isFrozen ? (
                          <span className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-100 px-2.5 py-1 text-xs font-extrabold text-red-700 animate-pulse">
                            <Lock className="h-3.5 w-3.5 text-red-600" /> Đóng băng
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-lg border border-emerald-200/60 bg-emerald-50/50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                            <Unlock className="h-3.5 w-3.5 text-emerald-600" /> Bình thường
                          </span>
                        )}
                      </td>
                      <td className="sticky right-0 border-l border-slate-200 bg-white px-3 py-3.5 text-center align-middle shadow-[-4px_0_12px_rgba(0,0,0,0.03)] group-hover:bg-cyan-50/40">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* Lock / Unlock Freeze Toggle Button - Styled Cyan */}
                          <button
                            type="button"
                            className="flex h-9 w-9 items-center justify-center rounded-xl border-2 border-cyan-500 bg-white text-cyan-600 shadow-sm transition hover:bg-cyan-50 cursor-pointer"
                            aria-label={w.isFrozen ? 'Mở khóa kho' : 'Đóng băng kho kiểm kê'}
                            title={w.isFrozen ? 'Mở khóa kho (Cho phép nhập/xuất trở lại)' : 'Đóng băng kho kiểm kê (Khóa nhập/xuất)'}
                            onClick={() => setFreezeModalTarget(w)}
                          >
                            {w.isFrozen ? <Unlock className="h-3.5 w-3.5 text-cyan-600" strokeWidth={2.2} /> : <Lock className="h-3.5 w-3.5 text-cyan-600" strokeWidth={2.2} />}
                          </button>
                          {/* 3D Phân Khu Button */}
                          <button
                            type="button"
                            className="flex h-9 w-9 items-center justify-center rounded-xl border-2 border-cyan-500 bg-white text-cyan-600 shadow-sm transition hover:bg-cyan-50 cursor-pointer"
                            aria-label="Xem 3D Phân Khu"
                            title="Xem 3D Kệ Phân Khu"
                            onClick={() => openWarehouseModal('view3d', w)}
                          >
                            <Move3d className="h-3.5 w-3.5 text-cyan-600" strokeWidth={2.2} />
                          </button>
                          <button
                            type="button"
                            className="flex h-9 w-9 items-center justify-center rounded-xl border-2 border-cyan-500 bg-white text-cyan-600 shadow-sm transition hover:bg-cyan-50 cursor-pointer"
                            aria-label="Xem kho"
                            title="Xem chi tiết"
                            onClick={() => openWarehouseModal('view', w)}
                          >
                            <Eye className="h-3.5 w-3.5 text-cyan-600" strokeWidth={2.2} />
                          </button>
                          <button
                            type="button"
                            className="flex h-9 w-9 items-center justify-center rounded-xl border-2 border-cyan-500 bg-white text-cyan-600 shadow-sm transition hover:bg-cyan-50 cursor-pointer"
                            aria-label="Sửa kho"
                            title="Chỉnh sửa"
                            onClick={() => navigate(`/warehouses/${w.id}/edit`)}
                          >
                            <Pencil className="h-3.5 w-3.5 text-cyan-600" strokeWidth={2.2} />
                          </button>
                          <button
                            type="button"
                            className="flex h-9 w-9 items-center justify-center rounded-xl border-2 border-cyan-500 bg-white text-cyan-600 shadow-sm transition hover:bg-cyan-50 cursor-pointer"
                            aria-label="Xóa kho"
                            title="Xóa kho"
                            onClick={() => openWarehouseModal('delete', w)}
                          >
                            <Trash2 className="h-3.5 w-3.5 text-cyan-600" strokeWidth={2.2} />
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
            <div className="w-full max-w-6xl max-h-[92vh] flex flex-col rounded-2xl bg-white shadow-2xl overflow-hidden border-2 border-cyan-500">
              {/* Modal Header */}
              <div className="flex-shrink-0 flex items-center justify-between border-b border-slate-100 bg-cyan-600 px-6 py-3.5 text-white">
                <div className="flex items-center gap-3">
                  <div className="rounded-xl bg-white/10 p-2 text-white">
                    <Warehouse className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold tracking-tight text-white">{modalTitle}</h2>
                    <p className="text-xs text-cyan-100/90 font-normal">
                      Cấu hình thông tin kho hàng & các phân khu với mô phỏng 3D
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
                    Bạn có chắc chắn muốn xóa kho hàng{' '}
                    <span className="font-bold text-slate-950">{selectedWarehouse?.name}</span> (Mã:{' '}
                    <span className="font-bold text-rose-600">{selectedWarehouse?.code}</span>) cùng tất cả các phân khu thuộc kho này không?
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
                      className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-bold transition cursor-pointer whitespace-nowrap ${activeTabId === 'main'
                          ? 'bg-cyan-600 text-white shadow-sm'
                          : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
                        }`}
                    >
                      <Building className="h-4 w-4" />
                      Thông Tin & Địa Chỉ Kho Hàng
                    </button>

                    {form.subWarehouses.map((sub, idx) => (
                      <div key={sub.id} className="relative flex items-center">
                        <button
                          type="button"
                          onClick={() => setActiveTabId(sub.id)}
                          className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-bold transition cursor-pointer whitespace-nowrap ${activeTabId === sub.id
                              ? 'bg-indigo-600 text-white shadow-sm'
                              : 'bg-white text-indigo-700 border border-slate-200 hover:bg-slate-50'
                            }`}
                        >
                          <Layers className="h-3.5 w-3.5" />
                          {sub.code || `Phân Khu ${idx + 1}`}
                          {modalMode !== 'view' && form.subWarehouses.length > 1 && (
                            <span
                              onClick={(e) => handleDeleteSubTab(sub.id, e)}
                              className="ml-1 rounded-full p-0.5 hover:bg-black/20 text-white/80"
                              title="Xóa phân khu"
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
                        Thêm Phân Khu Mới
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
                              Mã kho <span className="text-rose-500">*</span>
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
                              Tên kho <span className="text-rose-500">*</span>
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
                            <label className="mb-1 block text-xs font-semibold text-slate-600">Trạng Thái Kho</label>
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

                        {/* SECTION: PHÂN CÔNG NHÂN SỰ PHỤ TRÁCH KHO (3 CỘT RIÊNG BIỆT) */}
                        <div className="space-y-3 pt-2">
                          <div className="flex items-center justify-between border-b border-cyan-200/60 pb-2">
                            <div className="flex items-center gap-2">
                              <Users className="h-4 w-4 text-cyan-600" />
                              <h4 className="text-xs font-extrabold text-cyan-900 uppercase tracking-wide">
                                Phân Công Nhân Sự Phụ Trách Kho
                              </h4>
                            </div>

                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            {/* BOX 1: QUẢN LÝ KHO */}
                            {(() => {
                              const assigned = users.filter(
                                (u) =>
                                  getUserRoleCategory(u) === 'manager' &&
                                  (form.managerIds.includes(u.id) || form.staffIds.includes(u.id)),
                              );
                              const displayed = assigned.slice(0, 2);

                              return (
                                <div className="flex flex-col rounded-xl border border-cyan-200 bg-cyan-50/20 p-3 space-y-2">
                                  <div className="flex items-center justify-between border-b border-cyan-200/60 pb-2">
                                    <span className="text-xs font-bold text-cyan-950 flex items-center gap-1.5">
                                      <Building className="h-3.5 w-3.5 text-cyan-600" />
                                      Quản Lý Kho ({assigned.length})
                                    </span>
                                    {modalMode !== 'view' && (
                                      <button
                                        type="button"
                                        onClick={() => openPersonnelPopup('manager')}
                                        className="inline-flex items-center gap-1 rounded-lg bg-cyan-600 px-2 py-1 text-[11px] font-bold text-white shadow-xs transition hover:bg-cyan-700 cursor-pointer"
                                      >
                                        <Plus className="h-3 w-3" /> Thêm Quản lý
                                      </button>
                                    )}
                                  </div>
                                  <div className="flex-1 space-y-1.5 max-h-48 overflow-y-auto pr-1">
                                    {assigned.length === 0 ? (
                                      <p className="text-[11px] font-medium text-slate-400 italic py-2 text-center">Chưa chọn quản lý nào</p>
                                    ) : (
                                      <>
                                        {displayed.map((u) => (
                                          <div
                                            key={u.id}
                                            className="flex items-center justify-between rounded-lg border border-cyan-200/80 bg-white p-2 text-xs font-semibold text-slate-800 shadow-xs"
                                          >
                                            <div className="truncate pr-1">
                                              <div className="font-bold text-slate-900">{u.fullName || u.email}</div>
                                              <div className="text-[10px] font-normal text-slate-500 truncate">{u.email}</div>
                                            </div>
                                            {modalMode !== 'view' && (
                                              <button
                                                type="button"
                                                onClick={() => handleRemoveAssignedUser(u.id)}
                                                className="text-slate-400 hover:text-red-600 transition p-1 cursor-pointer"
                                                title="Gỡ khỏi kho"
                                              >
                                                <X className="h-3.5 w-3.5" />
                                              </button>
                                            )}
                                          </div>
                                        ))}
                                        {assigned.length > 2 && (
                                          <button
                                            type="button"
                                            onClick={() => openPersonnelPopup('manager')}
                                            className="w-full text-center py-1 text-[11px] font-bold text-cyan-700 hover:underline cursor-pointer"
                                          >
                                            + Xem thêm {assigned.length - 2} quản lý...
                                          </button>
                                        )}
                                      </>
                                    )}
                                  </div>
                                </div>
                              );
                            })()}

                            {/* BOX 2: THỦ KHO */}
                            {(() => {
                              const assigned = users.filter(
                                (u) =>
                                  getUserRoleCategory(u) === 'storekeeper' &&
                                  (form.managerIds.includes(u.id) || form.staffIds.includes(u.id)),
                              );
                              const displayed = assigned.slice(0, 2);

                              return (
                                <div className="flex flex-col rounded-xl border border-cyan-200 bg-cyan-50/20 p-3 space-y-2">
                                  <div className="flex items-center justify-between border-b border-cyan-200/60 pb-2">
                                    <span className="text-xs font-bold text-cyan-950 flex items-center gap-1.5">
                                      <Users className="h-3.5 w-3.5 text-cyan-600" />
                                      Thủ Kho ({assigned.length})
                                    </span>
                                    {modalMode !== 'view' && (
                                      <button
                                        type="button"
                                        onClick={() => openPersonnelPopup('storekeeper')}
                                        className="inline-flex items-center gap-1 rounded-lg bg-cyan-600 px-2 py-1 text-[11px] font-bold text-white shadow-xs transition hover:bg-cyan-700 cursor-pointer"
                                      >
                                        <Plus className="h-3 w-3" /> Thêm Thủ kho
                                      </button>
                                    )}
                                  </div>
                                  <div className="flex-1 space-y-1.5 max-h-48 overflow-y-auto pr-1">
                                    {assigned.length === 0 ? (
                                      <p className="text-[11px] font-medium text-slate-400 italic py-2 text-center">Chưa chọn thủ kho nào</p>
                                    ) : (
                                      <>
                                        {displayed.map((u) => (
                                          <div
                                            key={u.id}
                                            className="flex items-center justify-between rounded-lg border border-cyan-200/80 bg-white p-2 text-xs font-semibold text-slate-800 shadow-xs"
                                          >
                                            <div className="truncate pr-1">
                                              <div className="font-bold text-slate-900">{u.fullName || u.email}</div>
                                              <div className="text-[10px] font-normal text-slate-500 truncate">{u.email}</div>
                                            </div>
                                            {modalMode !== 'view' && (
                                              <button
                                                type="button"
                                                onClick={() => handleRemoveAssignedUser(u.id)}
                                                className="text-slate-400 hover:text-red-600 transition p-1 cursor-pointer"
                                                title="Gỡ khỏi kho"
                                              >
                                                <X className="h-3.5 w-3.5" />
                                              </button>
                                            )}
                                          </div>
                                        ))}
                                        {assigned.length > 2 && (
                                          <button
                                            type="button"
                                            onClick={() => openPersonnelPopup('storekeeper')}
                                            className="w-full text-center py-1 text-[11px] font-bold text-cyan-700 hover:underline cursor-pointer"
                                          >
                                            + Xem thêm {assigned.length - 2} thủ kho...
                                          </button>
                                        )}
                                      </>
                                    )}
                                  </div>
                                </div>
                              );
                            })()}

                            {/* BOX 3: NHÂN VIÊN KIỂM KÊ */}
                            {(() => {
                              const assigned = users.filter(
                                (u) =>
                                  getUserRoleCategory(u) === 'inventory_checker' &&
                                  (form.managerIds.includes(u.id) || form.staffIds.includes(u.id)),
                              );
                              const displayed = assigned.slice(0, 2);

                              return (
                                <div className="flex flex-col rounded-xl border border-cyan-200 bg-cyan-50/20 p-3 space-y-2">
                                  <div className="flex items-center justify-between border-b border-cyan-200/60 pb-2">
                                    <span className="text-xs font-bold text-cyan-950 flex items-center gap-1.5">
                                      <Check className="h-3.5 w-3.5 text-cyan-600" />
                                      NV Kiểm Kê ({assigned.length})
                                    </span>
                                    {modalMode !== 'view' && (
                                      <button
                                        type="button"
                                        onClick={() => openPersonnelPopup('inventory_checker')}
                                        className="inline-flex items-center gap-1 rounded-lg bg-cyan-600 px-2 py-1 text-[11px] font-bold text-white shadow-xs transition hover:bg-cyan-700 cursor-pointer"
                                      >
                                        <Plus className="h-3 w-3" /> Thêm NV kiểm kê
                                      </button>
                                    )}
                                  </div>
                                  <div className="flex-1 space-y-1.5 max-h-48 overflow-y-auto pr-1">
                                    {assigned.length === 0 ? (
                                      <p className="text-[11px] font-medium text-slate-400 italic py-2 text-center">Chưa chọn NV kiểm kê</p>
                                    ) : (
                                      <>
                                        {displayed.map((u) => (
                                          <div
                                            key={u.id}
                                            className="flex items-center justify-between rounded-lg border border-cyan-200/80 bg-white p-2 text-xs font-semibold text-slate-800 shadow-xs"
                                          >
                                            <div className="truncate pr-1">
                                              <div className="font-bold text-slate-900">{u.fullName || u.email}</div>
                                              <div className="text-[10px] font-normal text-slate-500 truncate">{u.email}</div>
                                            </div>
                                            {modalMode !== 'view' && (
                                              <button
                                                type="button"
                                                onClick={() => handleRemoveAssignedUser(u.id)}
                                                className="text-slate-400 hover:text-red-600 transition p-1 cursor-pointer"
                                                title="Gỡ khỏi kho"
                                              >
                                                <X className="h-3.5 w-3.5" />
                                              </button>
                                            )}
                                          </div>
                                        ))}
                                        {assigned.length > 2 && (
                                          <button
                                            type="button"
                                            onClick={() => openPersonnelPopup('inventory_checker')}
                                            className="w-full text-center py-1 text-[11px] font-bold text-cyan-700 hover:underline cursor-pointer"
                                          >
                                            + Xem thêm {assigned.length - 2} NV kiểm kê...
                                          </button>
                                        )}
                                      </>
                                    )}
                                  </div>
                                </div>
                              );
                            })()}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* TAB 2: SUB-WAREHOUSE DETAILED TAB & 3D SIMULATION */}
                    {currentSubWarehouse && activeTabId !== 'main' && (
                      <div className="space-y-4 animate-in fade-in duration-200">
                        <div className="rounded-xl border border-cyan-200 bg-cyan-50/30 p-4 space-y-3">
                          <div className="flex items-center justify-between border-b border-cyan-200/60 pb-2">
                            <span className="text-xs font-bold text-cyan-900 uppercase">
                              Cấu Hình Phân Khu: {currentSubWarehouse.code}
                            </span>
                            <span className="text-xs font-semibold text-slate-600">
                              {currentSubWarehouse.racksCount || 4} Kệ chứa hàng × {currentSubWarehouse.shelvesPerRack || 4} Tầng | {currentSubWarehouse.wallRacksCount || 2} Kệ Tường | {currentSubWarehouse.rackRowsCount || 2} Hàng Kệ
                            </span>
                          </div>

                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                            <div>
                              <label className="block text-xs font-semibold text-slate-600 mb-1">Mã Phân Khu</label>
                              <input
                                value={currentSubWarehouse.code}
                                onChange={(e) =>
                                  handleUpdateSubWarehouse(currentSubWarehouse.id, {
                                    code: e.target.value.toUpperCase(),
                                  })
                                }
                                readOnly={modalMode === 'view'}
                                className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold uppercase text-slate-900 outline-none focus:border-cyan-500"
                              />
                            </div>

                            <div className="sm:col-span-2">
                              <label className="block text-xs font-semibold text-slate-600 mb-1">Tên Phân Khu</label>
                              <input
                                value={currentSubWarehouse.name}
                                onChange={(e) =>
                                  handleUpdateSubWarehouse(currentSubWarehouse.id, { name: e.target.value })
                                }
                                readOnly={modalMode === 'view'}
                                className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-900 outline-none focus:border-cyan-500"
                              />
                            </div>

                            <div>
                              <label className="block text-xs font-semibold text-slate-600 mb-1">Trạng Thái Phân Khu</label>
                              <select
                                value={currentSubWarehouse.status || 'active'}
                                onChange={(e) =>
                                  handleUpdateSubWarehouse(currentSubWarehouse.id, {
                                    status: e.target.value as 'active' | 'inactive',
                                  })
                                }
                                disabled={modalMode === 'view'}
                                className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-900 outline-none focus:border-cyan-500"
                              >
                                <option value="active">Đang hoạt động</option>
                                <option value="inactive">Không hoạt động</option>
                              </select>
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
                                className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-900 outline-none focus:border-cyan-500"
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
                                className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-900 outline-none focus:border-cyan-500"
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
                                className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-900 outline-none focus:border-cyan-500"
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
                                className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-900 outline-none focus:border-cyan-500"
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
                                className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-900 outline-none focus:border-cyan-500"
                              />
                            </div>

                            <div>
                              <label className="block text-xs font-semibold text-slate-600 mb-1">Kệ Trên Tường (Wall Racks)</label>
                              <input
                                type="number"
                                value={currentSubWarehouse.wallRacksCount || 2}
                                onChange={(e) =>
                                  handleUpdateSubWarehouse(currentSubWarehouse.id, {
                                    wallRacksCount: Number(e.target.value),
                                  })
                                }
                                readOnly={modalMode === 'view'}
                                className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-900 outline-none focus:border-cyan-500"
                              />
                            </div>

                            <div>
                              <label className="block text-xs font-semibold text-slate-600 mb-1">Số Hàng Kệ (Rack Rows)</label>
                              <input
                                type="number"
                                value={currentSubWarehouse.rackRowsCount || 2}
                                onChange={(e) =>
                                  handleUpdateSubWarehouse(currentSubWarehouse.id, {
                                    rackRowsCount: Number(e.target.value),
                                  })
                                }
                                readOnly={modalMode === 'view'}
                                className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-900 outline-none focus:border-cyan-500"
                              />
                            </div>

                            <div>
                              <label className="block text-xs font-semibold text-slate-600 mb-1">Vật Liệu Tường / Trần</label>
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
                                className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-900 outline-none focus:border-cyan-500"
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
                    {modalMode === 'view' && (
                      <button
                        type="button"
                        onClick={() => setModalMode('edit')}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-500 bg-cyan-600 px-5 py-2 text-xs font-bold text-white shadow-sm hover:bg-cyan-700 transition cursor-pointer"
                      >
                        <Pencil className="h-4 w-4" />
                        Chuyển Sang Chỉnh Sửa
                      </button>
                    )}
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

      {/* FREEZE / UNFREEZE WARNING CONFIRMATION MODAL */}
      {freezeModalTarget &&
        createPortal(
          <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-2xl border-2 border-cyan-500">
              {/* Modal Header */}
              <div className="flex min-h-[72px] items-center justify-between border-b border-slate-100 bg-cyan-600 px-6 py-5 text-white">
                <div className="flex items-center gap-3">
                  <div className="rounded-xl bg-white/20 p-2.5 text-white flex-shrink-0">
                    {freezeModalTarget.isFrozen ? <Unlock className="h-6 w-6" /> : <Lock className="h-6 w-6" />}
                  </div>
                  <h3 className="text-lg font-black text-white uppercase tracking-wide leading-snug">
                    {freezeModalTarget.isFrozen ? 'Mở Khóa Kho Hàng' : 'Cảnh Báo Đóng Băng Kho Kiểm Kê'}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setFreezeModalTarget(null)}
                  className="rounded-xl p-2 text-white/80 transition hover:bg-white/20 hover:text-white cursor-pointer flex-shrink-0"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 sm:p-8 space-y-6">
                <div className={`flex items-start gap-4 rounded-2xl border-2 p-5 shadow-xs ${freezeModalTarget.isFrozen ? 'border-emerald-300 bg-emerald-50/80 text-emerald-950' : 'border-amber-300 bg-amber-50/90 text-amber-950'}`}>
                  <AlertTriangle className={`h-7 w-7 flex-shrink-0 mt-0.5 ${freezeModalTarget.isFrozen ? 'text-emerald-600' : 'text-amber-600'}`} />
                  <div className="space-y-2 text-sm sm:text-base leading-relaxed font-semibold">
                    <p className="text-base sm:text-lg font-black text-slate-900">
                      Kho: <span className="text-cyan-700 font-extrabold">{freezeModalTarget.name}</span> <span className="font-mono text-cyan-800">({freezeModalTarget.code})</span>
                    </p>
                    {freezeModalTarget.isFrozen ? (
                      <p className="text-slate-800 font-medium leading-relaxed">
                        Bạn đang thực hiện thao tác mở khóa cho kho hàng này. Khi kho được mở khóa, toàn bộ các chức năng tạo phiếu nhập kho & xuất kho sẽ <b>được cho phép hoạt động bình thường trở lại</b>.
                      </p>
                    ) : (
                      <p className="text-slate-800 font-medium leading-relaxed">
                        <b>Cơ chế đóng băng kho:</b> Khi kho ở trạng thái đóng băng, hệ thống WMS sẽ <b>tạm ngưng và ngăn chặn tất cả giao dịch tạo phiếu nhập kho & xuất kho</b> tại kho này. Việc này nhằm giữ cố định lượng tồn kho trong suốt quá trình đếm kiểm kê.
                      </p>
                    )}
                  </div>
                </div>

                <p className="text-base sm:text-lg font-black text-slate-800 text-center py-2 border-t border-b border-slate-100">
                  {freezeModalTarget.isFrozen
                    ? 'Bạn có chắc chắn muốn mở khóa hoạt động cho kho này?'
                    : 'Bạn có chắc chắn muốn đóng băng kho này để bắt đầu kiểm kê?'}
                </p>

                {/* Modal Footer Actions */}
                <div className="flex items-center justify-end gap-3.5 pt-2">
                  <button
                    type="button"
                    onClick={() => setFreezeModalTarget(null)}
                    className="rounded-xl border-2 border-slate-300 bg-white px-6 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-100 cursor-pointer active:scale-95"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => handleConfirmToggleFreeze(freezeModalTarget)}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-cyan-500 bg-cyan-600 px-7 py-3 text-sm font-bold text-white shadow-md transition hover:bg-cyan-700 disabled:opacity-50 cursor-pointer active:scale-95"
                  >
                    {saving ? (
                      'Đang xử lý...'
                    ) : freezeModalTarget.isFrozen ? (
                      <>
                        <Unlock className="h-5 w-5" /> Đồng Ý Mở Khóa Kho
                      </>
                    ) : (
                      <>
                        <Lock className="h-5 w-5" /> Đồng Ý Đóng Băng Kho
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {/* BATCH ACTION CONFIRMATION MODAL */}
      {batchActionType &&
        createPortal(
          <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-2xl border-2 border-cyan-500">
              <div className="flex min-h-[72px] items-center justify-between border-b border-slate-100 bg-cyan-600 px-6 py-5 text-white">
                <div className="flex items-center gap-3">
                  <div className="rounded-xl bg-white/20 p-2.5 text-white flex-shrink-0">
                    {batchActionType === 'delete' ? (
                      <Trash2 className="h-6 w-6" />
                    ) : batchActionType === 'freeze' ? (
                      <Lock className="h-6 w-6" />
                    ) : (
                      <Unlock className="h-6 w-6" />
                    )}
                  </div>
                  <h3 className="text-lg font-black text-white uppercase tracking-wide leading-snug">
                    Xác Nhận Thao Tác Hàng Loạt
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setBatchActionType(null)}
                  className="rounded-xl p-2 text-white/80 transition hover:bg-white/20 hover:text-white cursor-pointer flex-shrink-0"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              <div className="p-6 sm:p-8 space-y-6">
                <div className={`flex items-start gap-4 rounded-2xl border-2 p-5 shadow-xs ${batchActionType === 'delete' ? 'border-red-300 bg-red-50/80 text-red-950' : batchActionType === 'freeze' ? 'border-amber-300 bg-amber-50/90 text-amber-950' : 'border-emerald-300 bg-emerald-50/80 text-emerald-950'}`}>
                  <AlertTriangle className="h-7 w-7 flex-shrink-0 mt-0.5" />
                  <div className="space-y-2 text-sm sm:text-base leading-relaxed font-semibold">
                    <p className="text-base sm:text-lg font-black text-slate-900">
                      Thao tác cho <span className="text-cyan-700 font-extrabold">{selectedIds.length} kho hàng</span> đã chọn
                    </p>
                    {batchActionType === 'delete' ? (
                      <p className="text-slate-800 font-medium leading-relaxed">
                        Hành động này sẽ <b>xóa vĩnh viễn</b> danh sách {selectedIds.length} kho hàng khỏi hệ thống WMS. Hãy kiểm tra chắc chắn trước khi xác nhận.
                      </p>
                    ) : batchActionType === 'freeze' ? (
                      <p className="text-slate-800 font-medium leading-relaxed">
                        Hệ thống sẽ thực hiện <b>đóng băng toàn bộ {selectedIds.length} kho hàng</b> đã chọn, khóa các giao dịch tạo phiếu nhập & xuất kho phục vụ kiểm kê.
                      </p>
                    ) : (
                      <p className="text-slate-800 font-medium leading-relaxed">
                        Hệ thống sẽ <b>mở khóa hoạt động cho {selectedIds.length} kho hàng</b> đã chọn, cho phép tạo phiếu nhập kho và xuất kho trở lại bình thường.
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3.5 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setBatchActionType(null)}
                    className="rounded-xl border-2 border-slate-300 bg-white px-6 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-100 cursor-pointer active:scale-95"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={handleExecuteBatchAction}
                    className={`inline-flex items-center justify-center gap-2 rounded-xl border-2 px-7 py-3 text-sm font-bold text-white shadow-md transition disabled:opacity-50 cursor-pointer active:scale-95 ${batchActionType === 'delete'
                        ? 'border-red-500 bg-red-600 hover:bg-red-700'
                        : 'border-cyan-500 bg-cyan-600 hover:bg-cyan-700'
                      }`}
                  >
                    {saving ? 'Đang xử lý...' : 'Đồng Ý Thực Hiện'}
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {/* POPUP MODAL: THÊM NHÂN SỰ THEO LOẠI */}
      {personnelPopupCategory &&
        createPortal(
          <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs transition-all animate-in fade-in duration-200">
            <div className="w-full max-w-xl rounded-2xl bg-white shadow-2xl overflow-hidden border border-slate-200 flex flex-col max-h-[85vh]">
              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-slate-200 bg-cyan-600 px-5 py-4 text-white">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/20 text-white shadow-xs">
                    <Users className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-white uppercase tracking-wide">
                      {personnelPopupCategory === 'manager' && 'Thêm Quản Lý Kho'}
                      {personnelPopupCategory === 'storekeeper' && 'Thêm Thủ Kho'}
                      {personnelPopupCategory === 'inventory_checker' && 'Thêm Nhân Viên Kiểm Kê'}
                    </h3>
                    <p className="text-xs font-medium text-cyan-100">
                      Gán nhân sự vào kho: <b className="text-white font-bold">{form.name || 'Kho mới'}</b>
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setPersonnelPopupCategory(null)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-white/80 hover:bg-white/20 hover:text-white transition cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-4 space-y-3 overflow-y-auto flex-1 bg-slate-50/50">
                {/* Search bar & Bulk action controls */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-2 bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
                  <div className="relative w-full sm:w-64">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <input
                      type="text"
                      value={popupSearch}
                      onChange={(e) => setPopupSearch(e.target.value)}
                      placeholder="Tìm tên, email..."
                      className="h-9 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-xs font-semibold text-slate-800 outline-none transition focus:border-cyan-500 focus:bg-white"
                    />
                  </div>

                  {(() => {
                    const categoryUsers = users.filter(
                      (u) =>
                        getUserRoleCategory(u) === personnelPopupCategory &&
                        (u.fullName?.toLowerCase().includes(popupSearch.toLowerCase()) ||
                          u.email.toLowerCase().includes(popupSearch.toLowerCase())),
                    );
                    const allChecked =
                      categoryUsers.length > 0 && categoryUsers.every((u) => tempSelectedUserIds.includes(u.id));

                    return (
                      <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                        <button
                          type="button"
                          onClick={() => {
                            if (allChecked) {
                              const idsToRemove = new Set(categoryUsers.map((u) => u.id));
                              setTempSelectedUserIds((prev) => prev.filter((id) => !idsToRemove.has(id)));
                            } else {
                              const idsToAdd = categoryUsers.map((u) => u.id);
                              setTempSelectedUserIds((prev) => Array.from(new Set([...prev, ...idsToAdd])));
                            }
                          }}
                          className="h-9 rounded-xl border border-cyan-300 bg-cyan-50 px-3 text-xs font-bold text-cyan-700 hover:bg-cyan-100 transition cursor-pointer"
                        >
                          {allChecked ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
                        </button>
                        <span className="text-xs font-bold text-slate-700 bg-slate-100 px-3 py-2 rounded-xl border border-slate-200">
                          Đã chọn {tempSelectedUserIds.length}
                        </span>
                      </div>
                    );
                  })()}
                </div>

                {/* List of category users */}
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {(() => {
                    const categoryUsers = users.filter(
                      (u) =>
                        getUserRoleCategory(u) === personnelPopupCategory &&
                        (u.fullName?.toLowerCase().includes(popupSearch.toLowerCase()) ||
                          u.email.toLowerCase().includes(popupSearch.toLowerCase())),
                    );

                    if (categoryUsers.length === 0) {
                      return (
                        <div className="py-8 text-center text-xs font-medium text-slate-500 bg-white rounded-xl border border-slate-200">
                          {popupSearch ? 'Không tìm thấy nhân sự phù hợp' : 'Chưa có nhân sự thuộc loại này'}
                        </div>
                      );
                    }

                    return categoryUsers.map((user) => {
                      const isSelected = tempSelectedUserIds.includes(user.id);
                      const badge = formatRoleBadge(getUserRole(user));
                      const currentWhId = selectedWarehouse?.id || warehouses.find((w) => w.code === form.code || w.name === form.name)?.id;
                      const userWhIds = getUserWarehouseIds(user.id, warehouses, projectTeams);
                      const isCurrentWh = currentWhId && userWhIds.includes(currentWhId);
                      const assignedOtherWh = warehouses.find((w) => w.id !== currentWhId && userWhIds.includes(w.id));

                      return (
                        <label
                          key={user.id}
                          className={`flex items-center justify-between rounded-xl border p-3 transition cursor-pointer ${isSelected
                              ? 'border-cyan-500 bg-cyan-50/80 shadow-2xs'
                              : 'border-slate-200 bg-white hover:bg-slate-50'
                            }`}
                        >
                          <div className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {
                                setTempSelectedUserIds((prev) =>
                                  prev.includes(user.id)
                                    ? prev.filter((id) => id !== user.id)
                                    : [...prev, user.id],
                                );
                              }}
                              className="h-4 w-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500 cursor-pointer"
                            />
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-slate-900">
                                  {user.fullName || user.email}
                                </span>
                                <span className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-bold border ${badge.color}`}>
                                  {badge.label}
                                </span>
                              </div>
                              <span className="text-[11px] font-medium text-slate-500">{user.email}</span>
                            </div>
                          </div>

                          <div className="text-right">
                            {personnelPopupCategory === 'inventory_checker' && (
                              isCurrentWh ? (
                                <span className="inline-flex items-center gap-1 rounded bg-cyan-100 px-2 py-0.5 text-[10px] font-bold text-cyan-800 border border-cyan-300">
                                  Đang ở kho này
                                </span>
                              ) : assignedOtherWh ? (
                                <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800 border border-amber-300">
                                  Đang ở {assignedOtherWh.name} (Tự chuyển khi lưu)
                                </span>
                              ) : (
                                <span className="text-[10px] text-slate-400 font-medium">Chưa vào kho nào</span>
                              )
                            )}
                          </div>
                        </label>
                      );
                    });
                  })()}
                </div>
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-end gap-2 border-t border-slate-200 bg-white px-5 py-3">
                <button
                  type="button"
                  onClick={() => setPersonnelPopupCategory(null)}
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="button"
                  onClick={handleConfirmPersonnelPopup}
                  className="rounded-xl bg-cyan-600 px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-cyan-700 transition cursor-pointer"
                >
                  Xác nhận thêm ({tempSelectedUserIds.length})
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {/* DETAIL PERSONNEL MODAL (VIEW ALL PERSONNEL FOR A CATEGORY IN TABLE) */}
      {detailPersonnelModal &&
        createPortal(
          <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs transition-all animate-in fade-in duration-200">
            <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl overflow-hidden border border-slate-200 flex flex-col max-h-[80vh]">
              <div className="flex items-center justify-between border-b border-slate-200 bg-cyan-600 px-5 py-4 text-white">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/20 text-white shadow-xs">
                    <Users className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-white uppercase tracking-wide">
                      Danh Sách Nhân Sự
                    </h3>
                    <p className="text-xs font-medium text-cyan-100">{detailPersonnelModal.title}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setDetailPersonnelModal(null)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-white/80 hover:bg-white/20 hover:text-white transition cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="p-4 space-y-2 overflow-y-auto flex-1 bg-slate-50/50">
                {detailPersonnelModal.users.map((u) => {
                  const badge = formatRoleBadge(getUserRole(u));
                  return (
                    <div
                      key={u.id}
                      className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3 shadow-2xs"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-900">{u.fullName || u.email}</span>
                          <span className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-bold border ${badge.color}`}>
                            {badge.label}
                          </span>
                        </div>
                        <span className="text-[11px] font-medium text-slate-500">{u.email}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center justify-end border-t border-slate-200 bg-white px-5 py-3">
                <button
                  type="button"
                  onClick={() => setDetailPersonnelModal(null)}
                  className="rounded-xl bg-slate-100 px-5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-200 transition cursor-pointer"
                >
                  Đóng
                </button>
              </div>
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
