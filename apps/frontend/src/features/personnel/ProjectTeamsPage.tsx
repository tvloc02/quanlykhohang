import React from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  Building2,
  Check,
  CheckCircle,
  ChevronDown,
  ClipboardCheck,
  Pencil,
  Plus,
  PlusCircle,
  ScanLine,
  Search,
  ShieldCheck,
  Trash2,
  UserCheck,
  Users,
  Warehouse,
  X,
  XCircle,
} from 'lucide-react';

const API_BASE_URL = 'http://localhost:3000/api';
const STORAGE_KEY = 'smart-wms-project-teams';

type UserRole = { name: string };

type User = {
  id: string;
  email: string;
  fullName?: string;
  phone?: string;
  roles?: UserRole[];
};

type WarehouseRecord = {
  id: string;
  code: string;
  name: string;
  address?: string;
};

type Team = {
  id: string;
  warehouseId: string;
  warehouseCode?: string;
  name: string;
  description?: string;
  storekeeperIds: string[];
  inventoryCheckerIds: string[];
};

type FormState = {
  warehouseId: string;
  name: string;
  description: string;
  storekeeperIds: string[];
  inventoryCheckerIds: string[];
};

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
  };
}

function getPrimaryRole(u: User): string {
  if (!Array.isArray(u.roles) || u.roles.length === 0) return 'staff';
  const roles = u.roles.map((r) => String(r?.name || '').toLowerCase()).filter(Boolean);
  if (roles.includes('admin')) return 'admin';
  if (roles.includes('manager')) return 'manager';
  if (roles.includes('inventory_checker')) return 'inventory_checker';
  if (roles.includes('staff')) return 'staff';
  return roles[0] || 'staff';
}

function readTeamsLocal(): Team[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveTeamsLocal(teams: Team[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(teams));
}

function Toast({ message, type, onClose }: { message: string; type: 'success' | 'error'; onClose: () => void }) {
  React.useEffect(() => {
    if (message) {
      const timer = setTimeout(() => onClose(), 3500);
      return () => clearTimeout(timer);
    }
  }, [message, onClose]);

  if (!message) return null;

  return (
    <div className={`fixed top-4 right-4 z-[70] flex items-center gap-3 rounded-xl px-4 py-3 shadow-xl transition-all border ${
      type === 'error' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'
    }`}>
      {type === 'error' ? <XCircle className="h-5 w-5 flex-shrink-0" /> : <CheckCircle className="h-5 w-5 flex-shrink-0" />}
      <p className="text-sm font-bold">{message}</p>
      <button type="button" onClick={onClose} className="ml-2 rounded-lg p-1 hover:bg-black/5 transition">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

export default function ProjectTeamsPage() {
  const [teams, setTeams] = React.useState<Team[]>(readTeamsLocal);
  const [users, setUsers] = React.useState<User[]>([]);
  const [warehouses, setWarehouses] = React.useState<WarehouseRecord[]>([]);
  const [loading, setLoading] = React.useState(true);

  // Filters
  const [search, setSearch] = React.useState('');
  const [warehouseFilter, setWarehouseFilter] = React.useState('ALL');

  // Modal State
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [editingTeam, setEditingTeam] = React.useState<Team | null>(null);
  const [form, setForm] = React.useState<FormState>({
    warehouseId: '',
    name: '',
    description: '',
    storekeeperIds: [],
    inventoryCheckerIds: [],
  });

  // Feedback State
  const [error, setError] = React.useState('');
  const [success, setSuccess] = React.useState('');
  const [saving, setSaving] = React.useState(false);

  // Delete Confirm Modal State
  const [deletingTeamId, setDeletingTeamId] = React.useState<string | null>(null);

  // Sync to localStorage
  React.useEffect(() => {
    saveTeamsLocal(teams);
  }, [teams]);

  // Load initial data
  const fetchData = React.useCallback(async () => {
    setLoading(true);
    try {
      const [uRes, wRes, tRes] = await Promise.all([
        fetch(`${API_BASE_URL}/users`, { headers: authHeaders() }),
        fetch(`${API_BASE_URL}/warehouses`, { headers: authHeaders() }),
        fetch(`${API_BASE_URL}/project-teams`, { headers: authHeaders() }),
      ]);

      if (uRes.ok) {
        const uData = await uRes.json();
        setUsers(Array.isArray(uData) ? uData : []);
      }
      if (wRes.ok) {
        const wData = await wRes.json();
        setWarehouses(Array.isArray(wData) ? wData : []);
      }
      if (tRes.ok) {
        const tData = await tRes.json();
        if (Array.isArray(tData) && tData.length > 0) {
          setTeams(tData);
        }
      }
    } catch {
      // Keep local fallback
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void fetchData();
  }, [fetchData]);

  // Categorize personnel available
  const storekeepers = React.useMemo(() => {
    return users.filter((u) => {
      const r = getPrimaryRole(u);
      return r === 'staff' || r === 'storekeeper';
    });
  }, [users]);

  const inventoryCheckers = React.useMemo(() => {
    return users.filter((u) => getPrimaryRole(u) === 'inventory_checker');
  }, [users]);

  // Filtered Teams List
  const filteredTeams = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return teams.filter((t) => {
      const wh = warehouses.find((w) => w.id === t.warehouseId);
      const whCode = t.warehouseCode || wh?.code || '';
      const whName = wh?.name || '';
      const matchesWarehouse = warehouseFilter === 'ALL' || t.warehouseId === warehouseFilter;

      const matchesSearch =
        !q ||
        t.name.toLowerCase().includes(q) ||
        (t.description || '').toLowerCase().includes(q) ||
        whCode.toLowerCase().includes(q) ||
        whName.toLowerCase().includes(q);

      return matchesWarehouse && matchesSearch;
    });
  }, [teams, warehouses, warehouseFilter, search]);

  // Overview statistics
  const totalTeamsCount = teams.length;
  const activeWarehousesCount = new Set(teams.map((t) => t.warehouseId)).size;
  const assignedStorekeepersCount = new Set(teams.flatMap((t) => t.storekeeperIds || [])).size;
  const assignedCheckersCount = new Set(teams.flatMap((t) => t.inventoryCheckerIds || [])).size;

  // Open Modal for Create or Edit
  const openModal = (teamToEdit?: Team) => {
    setError('');
    if (teamToEdit) {
      setEditingTeam(teamToEdit);
      setForm({
        warehouseId: teamToEdit.warehouseId,
        name: teamToEdit.name,
        description: teamToEdit.description || '',
        storekeeperIds: teamToEdit.storekeeperIds || [],
        inventoryCheckerIds: teamToEdit.inventoryCheckerIds || [],
      });
    } else {
      setEditingTeam(null);
      setForm({
        warehouseId: warehouses[0]?.id || '',
        name: '',
        description: '',
        storekeeperIds: [],
        inventoryCheckerIds: [],
      });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingTeam(null);
    setError('');
  };

  // Toggle member selection in modal form
  const toggleMember = (field: 'storekeeperIds' | 'inventoryCheckerIds', memberId: string) => {
    setForm((prev) => {
      const currentList = prev[field];
      const exists = currentList.includes(memberId);
      return {
        ...prev,
        [field]: exists ? currentList.filter((id) => id !== memberId) : [...currentList, memberId],
      };
    });
  };

  // Save Team (Create or Update)
  const handleSaveTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.warehouseId) {
      setError('Vui lòng chọn kho hàng phụ trách.');
      return;
    }
    if (!form.name.trim()) {
      setError('Vui lòng nhập tên đội dự án.');
      return;
    }

    setSaving(true);
    setError('');

    const selectedWh = warehouses.find((w) => w.id === form.warehouseId);
    const payload = {
      warehouseId: form.warehouseId,
      warehouseCode: selectedWh?.code || '',
      name: form.name.trim(),
      description: form.description.trim(),
      storekeeperIds: form.storekeeperIds,
      inventoryCheckerIds: form.inventoryCheckerIds,
    };

    try {
      if (editingTeam) {
        // Update existing team
        const res = await fetch(`${API_BASE_URL}/project-teams/${editingTeam.id}`, {
          method: 'PATCH',
          headers: authHeaders(),
          body: JSON.stringify(payload),
        });

        let updatedTeam: Team;
        if (res.ok) {
          updatedTeam = await res.json();
        } else {
          updatedTeam = { ...editingTeam, ...payload };
        }

        setTeams((prev) => prev.map((t) => (t.id === editingTeam.id ? updatedTeam : t)));
        setSuccess(`Đã cập nhật đội dự án "${payload.name}".`);
      } else {
        // Create new team
        const res = await fetch(`${API_BASE_URL}/project-teams`, {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify(payload),
        });

        let createdTeam: Team;
        if (res.ok) {
          createdTeam = await res.json();
        } else {
          createdTeam = { ...payload, id: `team-${Date.now()}` };
        }

        setTeams((prev) => [...prev, createdTeam]);
        setSuccess(`Đã tạo đội dự án mới "${payload.name}".`);
      }

      closeModal();
    } catch {
      // Local fallback
      if (editingTeam) {
        setTeams((prev) => prev.map((t) => (t.id === editingTeam.id ? { ...editingTeam, ...payload } : t)));
        setSuccess(`Đã cập nhật đội dự án "${payload.name}".`);
      } else {
        setTeams((prev) => [...prev, { ...payload, id: `team-${Date.now()}` }]);
        setSuccess(`Đã tạo đội dự án mới "${payload.name}".`);
      }
      closeModal();
    } finally {
      setSaving(false);
    }
  };

  // Delete team
  const handleDeleteTeam = async (id: string) => {
    try {
      await fetch(`${API_BASE_URL}/project-teams/${id}`, {
        method: 'DELETE',
        headers: authHeaders(),
      }).catch(() => undefined);

      setTeams((prev) => prev.filter((t) => t.id !== id));
      setSuccess('Đã xóa đội dự án.');
    } catch {
      setTeams((prev) => prev.filter((t) => t.id !== id));
      setSuccess('Đã xóa đội dự án.');
    } finally {
      setDeletingTeamId(null);
    }
  };

  // Lookup member names
  const getUserDisplayName = (userId: string) => {
    const user = users.find((u) => u.id === userId);
    if (!user) return userId;
    return user.fullName || user.email;
  };

  return (
    <div className="space-y-6">
      <Toast message={error || success} type={error ? 'error' : 'success'} onClose={() => { setError(''); setSuccess(''); }} />

      {/* Header section matching high-fidelity personnel design */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2.5">
          <Link
            to="/personnel"
            className="inline-flex items-center gap-2.5 rounded-xl border-2 border-cyan-500 bg-white px-4 py-2.5 text-sm font-bold text-cyan-700 shadow-sm transition hover:bg-cyan-50"
          >
            <Users className="h-4.5 w-4.5 text-cyan-600" />
            <span>Quản lý nhân sự</span>
          </Link>
          <Link
            to="/personnel/teams"
            className="inline-flex items-center gap-2.5 rounded-xl border-2 border-cyan-500 bg-cyan-600 px-4 py-2.5 text-white shadow-md transition"
          >
            <Users className="h-5 w-5 text-cyan-100" />
            <h1 className="text-base font-bold tracking-tight text-white">Đội dự án</h1>
          </Link>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => openModal()}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-600 px-5 py-2.5 text-sm font-bold text-white shadow-md transition hover:bg-cyan-700 active:scale-95"
          >
            <PlusCircle className="h-4 w-4" />
            Thêm mới Đội
          </button>
        </div>
      </div>

      {/* 4 Stat Overview Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex h-[76px] items-center justify-between rounded-2xl border-2 border-cyan-500 bg-white px-5 shadow-sm">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-wide text-slate-400">TỔNG ĐỘI DỰ ÁN</p>
            <p className="text-2xl font-black text-slate-800">{totalTeamsCount}</p>
          </div>
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-100 text-cyan-700">
            <Users className="h-5 w-5" />
          </div>
        </div>

        <div className="flex h-[76px] items-center justify-between rounded-2xl border-2 border-cyan-500 bg-white px-5 shadow-sm">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-wide text-slate-400">KHO CÓ ĐỘI</p>
            <p className="text-2xl font-black text-slate-800">{activeWarehousesCount}</p>
          </div>
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-100 text-cyan-700">
            <Warehouse className="h-5 w-5" />
          </div>
        </div>

        <div className="flex h-[76px] items-center justify-between rounded-2xl border-2 border-cyan-500 bg-white px-5 shadow-sm">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-wide text-slate-400">THỦ KHO ĐÃ PHÂN ĐỘI</p>
            <p className="text-2xl font-black text-slate-800">{assignedStorekeepersCount}</p>
          </div>
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-100 text-cyan-700">
            <ShieldCheck className="h-5 w-5" />
          </div>
        </div>

        <div className="flex h-[76px] items-center justify-between rounded-2xl border-2 border-cyan-500 bg-white px-5 shadow-sm">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-wide text-slate-400">NV KIỂM KÊ ĐÃ PHÂN ĐỘI</p>
            <p className="text-2xl font-black text-slate-800">{assignedCheckersCount}</p>
          </div>
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-100 text-cyan-700">
            <ScanLine className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between rounded-2xl border-2 border-slate-200 bg-white p-4 shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-cyan-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm kiếm theo tên đội, kho hàng, mô tả hoặc nhân sự..."
            className="h-11 w-full rounded-xl border-2 border-slate-200 bg-white pl-12 pr-4 text-sm font-semibold text-slate-700 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
          />
        </div>

        <div className="flex items-center gap-3">
          <label className="whitespace-nowrap text-sm font-bold text-slate-600">Lọc kho hàng:</label>
          <div className="relative min-w-[220px]">
            <select
              value={warehouseFilter}
              onChange={(e) => setWarehouseFilter(e.target.value)}
              className="h-11 w-full appearance-none rounded-xl border-2 border-cyan-500 bg-white px-4 pr-10 text-sm font-bold text-slate-700 outline-none transition focus:ring-4 focus:ring-cyan-500/10 cursor-pointer"
            >
              <option value="ALL">Tất cả kho hàng</option>
              {warehouses.map((wh) => (
                <option key={wh.id} value={wh.id}>
                  {wh.code} - {wh.name}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-cyan-600" />
          </div>
        </div>
      </div>

      {/* Teams Grid */}
      {filteredTeams.length > 0 ? (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
          {filteredTeams.map((team) => {
            const wh = warehouses.find((w) => w.id === team.warehouseId);
            const whCode = team.warehouseCode || wh?.code || 'KHO';
            const whName = wh?.name || 'Chưa chọn kho';
            const storekeeperCount = (team.storekeeperIds || []).length;
            const checkerCount = (team.inventoryCheckerIds || []).length;
            const totalMembers = storekeeperCount + checkerCount;

            return (
              <article
                key={team.id}
                className="group flex flex-col justify-between rounded-3xl border-2 border-slate-200 bg-white p-6 shadow-sm transition-all hover:border-cyan-500 hover:shadow-xl"
              >
                <div>
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-3 border-b-2 border-slate-100 pb-4">
                    <div className="min-w-0 flex-1">
                      <div className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-50 px-2.5 py-1 text-xs font-black text-cyan-700 border border-cyan-200">
                        <Building2 className="h-3.5 w-3.5" />
                        <span className="truncate">{whCode} • {whName}</span>
                      </div>
                      <h2 className="mt-2 text-xl font-black tracking-tight text-slate-900 truncate">
                        {team.name}
                      </h2>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => openModal(team)}
                        className="rounded-xl p-2 text-slate-400 transition hover:bg-cyan-50 hover:text-cyan-600"
                        title="Chỉnh sửa đội"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeletingTeamId(team.id)}
                        className="rounded-xl p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                        title="Xóa đội"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {/* Description */}
                  <p className="mt-3 text-xs font-medium text-slate-500 line-clamp-2 min-h-[32px]">
                    {team.description || 'Không có mô tả chi tiết cho đội dự án này.'}
                  </p>

                  {/* Member Sections */}
                  <div className="mt-5 space-y-4">
                    {/* Storekeepers Section */}
                    <div className="rounded-2xl border border-slate-100 bg-slate-50/60 p-3.5">
                      <div className="flex items-center justify-between text-xs font-bold text-slate-700 mb-2">
                        <span className="inline-flex items-center gap-1.5 text-cyan-800">
                          <ShieldCheck className="h-4 w-4 text-cyan-600" />
                          Thủ kho ({storekeeperCount})
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {storekeeperCount > 0 ? (
                          (team.storekeeperIds || []).map((id) => (
                            <span
                              key={id}
                              className="inline-flex items-center gap-1.5 rounded-xl border border-cyan-200 bg-white px-2.5 py-1 text-xs font-bold text-slate-800 shadow-2xs"
                            >
                              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-cyan-600 text-[10px] font-black text-white">
                                {getUserDisplayName(id).charAt(0).toUpperCase()}
                              </span>
                              <span className="max-w-[120px] truncate">{getUserDisplayName(id)}</span>
                            </span>
                          ))
                        ) : (
                          <span className="text-xs font-medium text-slate-400 italic">Chưa phân công Thủ kho</span>
                        )}
                      </div>
                    </div>

                    {/* Inventory Checkers Section */}
                    <div className="rounded-2xl border border-slate-100 bg-slate-50/60 p-3.5">
                      <div className="flex items-center justify-between text-xs font-bold text-slate-700 mb-2">
                        <span className="inline-flex items-center gap-1.5 text-emerald-800">
                          <ScanLine className="h-4 w-4 text-emerald-600" />
                          Nhân viên kiểm kê ({checkerCount})
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {checkerCount > 0 ? (
                          (team.inventoryCheckerIds || []).map((id) => (
                            <span
                              key={id}
                              className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-white px-2.5 py-1 text-xs font-bold text-slate-800 shadow-2xs"
                            >
                              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-[10px] font-black text-white">
                                {getUserDisplayName(id).charAt(0).toUpperCase()}
                              </span>
                              <span className="max-w-[120px] truncate">{getUserDisplayName(id)}</span>
                            </span>
                          ))
                        ) : (
                          <span className="text-xs font-medium text-slate-400 italic">Chưa phân công NV kiểm kê</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Card Footer */}
                <div className="mt-5 border-t-2 border-slate-100 pt-3 flex items-center justify-between text-xs">
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-100/70 px-3 py-1.5 font-bold text-cyan-800">
                    <Users className="h-3.5 w-3.5 text-cyan-600" />
                    {totalMembers} Nhân sự
                  </span>
                  <span className="font-semibold text-slate-400">Smart WMS</span>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-slate-200 bg-white p-12 text-center shadow-sm">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-600 mb-4">
            <Users className="h-8 w-8" />
          </div>
          <h3 className="text-lg font-black text-slate-800">Không tìm thấy đội dự án nào</h3>
          <p className="mt-1 text-sm font-medium text-slate-500 max-w-md">
            Chưa có đội dự án nào khớp với điều kiện tìm kiếm hoặc lọc kho hàng hiện tại.
          </p>
          <button
            type="button"
            onClick={() => openModal()}
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-5 py-2.5 text-sm font-bold text-white shadow-md hover:bg-cyan-700 transition"
          >
            <Plus className="h-4 w-4" />
            Tạo Đội dự án mới
          </button>
        </div>
      )}

      {/* Create / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm transition-all">
          <div className="w-full max-w-3xl rounded-3xl bg-white shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b-2 border-slate-100 px-6 py-4 bg-gradient-to-r from-cyan-50 to-white">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-600 text-white shadow-sm">
                  <Users className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-900">
                    {editingTeam ? 'Chỉnh sửa Đội dự án' : 'Thêm mới Đội dự án'}
                  </h2>
                  <p className="text-xs font-semibold text-slate-500">
                    {editingTeam ? 'Cập nhật phân công kho hàng và thành viên đội' : 'Tạo đội mới và phân bổ Thủ kho, NV kiểm kê'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSaveTeam} className="flex-1 overflow-y-auto p-6 space-y-6">
              {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700 flex items-center gap-2">
                  <XCircle className="h-4 w-4 flex-shrink-0" />
                  {error}
                </div>
              )}

              {/* Warehouse & Name */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-bold text-slate-700">
                    Kho hàng trực thuộc <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={form.warehouseId}
                    onChange={(e) => setForm({ ...form, warehouseId: e.target.value })}
                    className="h-11 w-full rounded-xl border-2 border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10 cursor-pointer"
                    required
                  >
                    <option value="">-- Chọn Kho hàng --</option>
                    {warehouses.map((wh) => (
                      <option key={wh.id} value={wh.id}>
                        {wh.code} - {wh.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-bold text-slate-700">
                    Tên Đội dự án <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="VD: Đội kiểm kê Đợt 1..."
                    className="h-11 w-full rounded-xl border-2 border-slate-200 px-4 text-sm font-semibold text-slate-700 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
                    required
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="mb-2 block text-sm font-bold text-slate-700">Mô tả đội dự án</label>
                <input
                  type="text"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Ghi chú về trách nhiệm, phạm vi hoặc khu vực phụ trách..."
                  className="h-11 w-full rounded-xl border-2 border-slate-200 px-4 text-sm font-semibold text-slate-700 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
                />
              </div>

              {/* Personnel Selection Grids */}
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                {/* Storekeepers Selection */}
                <fieldset className="rounded-2xl border-2 border-cyan-100 bg-slate-50/50 p-4">
                  <legend className="px-2 text-sm font-black text-cyan-900 flex items-center gap-1.5">
                    <ShieldCheck className="h-4 w-4 text-cyan-600" />
                    Phân công Thủ kho ({form.storekeeperIds.length})
                  </legend>
                  <div className="mt-2 max-h-56 overflow-y-auto space-y-2 pr-1">
                    {storekeepers.length > 0 ? (
                      storekeepers.map((u) => {
                        const checked = form.storekeeperIds.includes(u.id);
                        return (
                          <label
                            key={u.id}
                            className={`flex items-center justify-between rounded-xl border-2 p-3 cursor-pointer transition ${
                              checked
                                ? 'border-cyan-500 bg-cyan-50/80 text-cyan-900 font-bold'
                                : 'border-slate-200 bg-white hover:border-slate-300 text-slate-700 font-medium'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleMember('storekeeperIds', u.id)}
                                className="h-4 w-4 rounded text-cyan-600 focus:ring-cyan-500 cursor-pointer"
                              />
                              <div className="min-w-0">
                                <p className="text-xs font-black truncate">{u.fullName || u.email}</p>
                                <p className="text-[11px] text-slate-400 truncate">{u.email}</p>
                              </div>
                            </div>
                            {checked && <Check className="h-4 w-4 text-cyan-600 flex-shrink-0" />}
                          </label>
                        );
                      })
                    ) : (
                      <p className="py-4 text-center text-xs font-medium text-slate-400">
                        Chưa có tài khoản với vai trò Thủ kho
                      </p>
                    )}
                  </div>
                </fieldset>

                {/* Inventory Checkers Selection */}
                <fieldset className="rounded-2xl border-2 border-emerald-100 bg-slate-50/50 p-4">
                  <legend className="px-2 text-sm font-black text-emerald-900 flex items-center gap-1.5">
                    <ScanLine className="h-4 w-4 text-emerald-600" />
                    Phân công Nhân viên kiểm kê ({form.inventoryCheckerIds.length})
                  </legend>
                  <div className="mt-2 max-h-56 overflow-y-auto space-y-2 pr-1">
                    {inventoryCheckers.length > 0 ? (
                      inventoryCheckers.map((u) => {
                        const checked = form.inventoryCheckerIds.includes(u.id);
                        return (
                          <label
                            key={u.id}
                            className={`flex items-center justify-between rounded-xl border-2 p-3 cursor-pointer transition ${
                              checked
                                ? 'border-emerald-500 bg-emerald-50/80 text-emerald-900 font-bold'
                                : 'border-slate-200 bg-white hover:border-slate-300 text-slate-700 font-medium'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleMember('inventoryCheckerIds', u.id)}
                                className="h-4 w-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                              />
                              <div className="min-w-0">
                                <p className="text-xs font-black truncate">{u.fullName || u.email}</p>
                                <p className="text-[11px] text-slate-400 truncate">{u.email}</p>
                              </div>
                            </div>
                            {checked && <Check className="h-4 w-4 text-emerald-600 flex-shrink-0" />}
                          </label>
                        );
                      })
                    ) : (
                      <p className="py-4 text-center text-xs font-medium text-slate-400">
                        Chưa có tài khoản Nhân viên kiểm kê
                      </p>
                    )}
                  </div>
                </fieldset>
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-end gap-3 border-t-2 border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-xl border-2 border-slate-200 px-5 py-2.5 text-sm font-bold text-slate-600 transition hover:bg-slate-100"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-6 py-2.5 text-sm font-bold text-white shadow-md transition hover:bg-cyan-700 disabled:opacity-60"
                >
                  {saving ? 'Đang lưu...' : editingTeam ? 'Lưu cập nhật' : 'Tạo Đội dự án'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingTeamId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm transition-all">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl text-center space-y-4">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-100 text-red-600">
              <Trash2 className="h-7 w-7" />
            </div>
            <h3 className="text-lg font-black text-slate-900">Xác nhận xóa Đội dự án</h3>
            <p className="text-sm font-medium text-slate-500">
              Bạn có chắc chắn muốn xóa đội dự án này? Hành động này không thể hoàn tác.
            </p>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeletingTeamId(null)}
                className="rounded-xl border-2 border-slate-200 px-5 py-2.5 text-sm font-bold text-slate-600 transition hover:bg-slate-100"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={() => handleDeleteTeam(deletingTeamId)}
                className="rounded-xl bg-red-600 px-6 py-2.5 text-sm font-bold text-white shadow-md transition hover:bg-red-700"
              >
                Xác nhận Xóa
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
