import React from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  Building2,
  Check,
  CheckCircle,
  ChevronDown,
  ClipboardCheck,
  Eye,
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
import {
  saveStoredWarehouses,
  normalizeWarehouseRecord,
  type WarehouseRecord,
} from '../../shared/utils/warehouseAssignments';

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
  const [teamStatFilter, setTeamStatFilter] = React.useState<'ALL' | 'WITH_WAREHOUSE' | 'WITH_STOREKEEPER' | 'WITH_CHECKER'>('ALL');

  // Viewing Detail Modal State
  const [viewingTeam, setViewingTeam] = React.useState<Team | null>(null);

  // Pagination states
  const [pageSize, setPageSize] = React.useState(20);
  const [currentPage, setCurrentPage] = React.useState(1);

  // Search inside personnel selection modals
  const [memberSearchSk, setMemberSearchSk] = React.useState('');
  const [memberSearchIc, setMemberSearchIc] = React.useState('');

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
        setWarehouses(Array.isArray(wData) ? wData.map(normalizeWarehouseRecord) : []);
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

      let matchesStat = true;
      if (teamStatFilter === 'WITH_WAREHOUSE') {
        matchesStat = Boolean(t.warehouseId);
      } else if (teamStatFilter === 'WITH_STOREKEEPER') {
        matchesStat = (t.storekeeperIds || []).length > 0;
      } else if (teamStatFilter === 'WITH_CHECKER') {
        matchesStat = (t.inventoryCheckerIds || []).length > 0;
      }

      const matchesSearch =
        !q ||
        t.name.toLowerCase().includes(q) ||
        (t.description || '').toLowerCase().includes(q) ||
        whCode.toLowerCase().includes(q) ||
        whName.toLowerCase().includes(q);

      return matchesWarehouse && matchesStat && matchesSearch;
    });
  }, [teams, warehouses, warehouseFilter, teamStatFilter, search]);

  // Reset pagination on filter change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [search, warehouseFilter, teamStatFilter]);

  // Pagination calculations
  const totalItems = filteredTeams.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const startIndex = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endIndex = Math.min(currentPage * pageSize, totalItems);

  const paginatedTeams = React.useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredTeams.slice(start, start + pageSize);
  }, [filteredTeams, currentPage, pageSize]);

  // Overview statistics
  const totalTeamsCount = teams.length;
  const activeWarehousesCount = new Set(teams.map((t) => t.warehouseId)).size;
  const assignedStorekeepersCount = new Set(teams.flatMap((t) => t.storekeeperIds || [])).size;
  const assignedCheckersCount = new Set(teams.flatMap((t) => t.inventoryCheckerIds || [])).size;

  // Open Modal for Create or Edit
  const openModal = (teamToEdit?: Team) => {
    setError('');
    setMemberSearchSk('');
    setMemberSearchIc('');
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
      const checkerSet = new Set(payload.inventoryCheckerIds);

      if (editingTeam) {
        // Update existing team
        const res = await fetch(`${API_BASE_URL}/project-teams/${editingTeam.id}`, {
          method: 'PATCH',
          headers: authHeaders(),
          body: JSON.stringify(payload),
        });

        const updatedTeam: Team = res.ok ? await res.json() : { ...editingTeam, ...payload };

        setTeams((prev) => {
          const baseList = prev.map((t) => (t.id === editingTeam.id ? updatedTeam : t));
          return baseList.map((t) => {
            if (t.id === editingTeam.id) return t;
            const filteredCheckers = t.inventoryCheckerIds.filter((id) => !checkerSet.has(id));
            if (filteredCheckers.length !== t.inventoryCheckerIds.length) {
              const nextT = { ...t, inventoryCheckerIds: filteredCheckers };
              void fetch(`${API_BASE_URL}/project-teams/${t.id}`, {
                method: 'PATCH',
                headers: authHeaders(),
                body: JSON.stringify({ inventoryCheckerIds: filteredCheckers }),
              }).catch(() => null);
              return nextT;
            }
            return t;
          });
        });

        setSuccess(`Đã cập nhật đội dự án "${payload.name}".`);
      } else {
        // Create new team
        const res = await fetch(`${API_BASE_URL}/project-teams`, {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify(payload),
        });

        const createdTeam: Team = res.ok ? await res.json() : { ...payload, id: `team-${Date.now()}` };

        setTeams((prev) => {
          const baseList = [...prev, createdTeam];
          return baseList.map((t) => {
            if (t.id === createdTeam.id) return t;
            const filteredCheckers = t.inventoryCheckerIds.filter((id) => !checkerSet.has(id));
            if (filteredCheckers.length !== t.inventoryCheckerIds.length) {
              const nextT = { ...t, inventoryCheckerIds: filteredCheckers };
              void fetch(`${API_BASE_URL}/project-teams/${t.id}`, {
                method: 'PATCH',
                headers: authHeaders(),
                body: JSON.stringify({ inventoryCheckerIds: filteredCheckers }),
              }).catch(() => null);
              return nextT;
            }
            return t;
          });
        });

        setSuccess(`Đã tạo đội dự án mới "${payload.name}".`);
      }

      // Auto-assign team personnel (inventory checkers & storekeepers) to the selected warehouse
      if (form.warehouseId && warehouses.length > 0) {
        const checkersToAssign = payload.inventoryCheckerIds;
        const sksToAssign = payload.storekeeperIds;
        const allAssigned = Array.from(new Set([...checkersToAssign, ...sksToAssign]));

        setWarehouses((prevWhs) => {
          const nextWhs = prevWhs.map((wh) => {
            const isTarget = wh.id === form.warehouseId;
            const currentStaff = wh.staffIds || [];

            if (isTarget) {
              const updatedStaff = Array.from(new Set([...currentStaff, ...allAssigned]));
              if (updatedStaff.length !== currentStaff.length) {
                void fetch(`${API_BASE_URL}/warehouses/${wh.id}`, {
                  method: 'PUT',
                  headers: authHeaders(),
                  body: JSON.stringify({ ...wh, staffIds: updatedStaff }),
                }).catch(() => null);
                return { ...wh, staffIds: updatedStaff };
              }
            } else {
              // Single warehouse rule for checkers: remove assigned checkers from other warehouses
              const filteredStaff = currentStaff.filter((id) => !checkersToAssign.includes(id));
              if (filteredStaff.length !== currentStaff.length) {
                void fetch(`${API_BASE_URL}/warehouses/${wh.id}`, {
                  method: 'PUT',
                  headers: authHeaders(),
                  body: JSON.stringify({ ...wh, staffIds: filteredStaff }),
                }).catch(() => null);
                return { ...wh, staffIds: filteredStaff };
              }
            }
            return wh;
          });

          saveStoredWarehouses(nextWhs);
          return nextWhs;
        });
      }

      closeModal();
    } catch {
      // Local fallback
      const checkerSet = new Set(payload.inventoryCheckerIds);
      const fallbackTeamId = editingTeam ? editingTeam.id : `team-${Date.now()}`;

      setTeams((prev) => {
        const newTeamObj = editingTeam
          ? { ...editingTeam, ...payload }
          : { ...payload, id: fallbackTeamId };
        const baseList = editingTeam
          ? prev.map((t) => (t.id === editingTeam.id ? newTeamObj : t))
          : [...prev, newTeamObj];

        return baseList.map((t) => {
          if (t.id === fallbackTeamId) return t;
          return {
            ...t,
            inventoryCheckerIds: t.inventoryCheckerIds.filter((id) => !checkerSet.has(id)),
          };
        });
      });

      // Local fallback for warehouse assignment
      if (form.warehouseId) {
        const checkersToAssign = payload.inventoryCheckerIds;
        const sksToAssign = payload.storekeeperIds;
        const allAssigned = Array.from(new Set([...checkersToAssign, ...sksToAssign]));

        setWarehouses((prevWhs) =>
          prevWhs.map((wh) => {
            const isTarget = wh.id === form.warehouseId;
            const currentStaff = wh.staffIds || [];
            if (isTarget) {
              return { ...wh, staffIds: Array.from(new Set([...currentStaff, ...allAssigned])) };
            } else {
              return { ...wh, staffIds: currentStaff.filter((id) => !checkersToAssign.includes(id)) };
            }
          }),
        );
      }

      setSuccess(editingTeam ? `Đã cập nhật đội dự án "${payload.name}".` : `Đã tạo đội dự án mới "${payload.name}".`);
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

      {/* 4 Stat Overview Buttons matching Personnel.tsx design */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <button
          type="button"
          onClick={() => setTeamStatFilter('ALL')}
          className={`flex h-[72px] items-center justify-center rounded-xl border-2 border-cyan-500 px-3 shadow-sm transition text-center ${
            teamStatFilter === 'ALL' ? 'bg-cyan-600 text-white' : 'bg-white text-cyan-700 hover:bg-cyan-50'
          }`}
        >
          <p className="text-sm sm:text-base font-black uppercase">
            {totalTeamsCount} TỔNG ĐỘI DỰ ÁN
          </p>
        </button>

        <button
          type="button"
          onClick={() => setTeamStatFilter('WITH_WAREHOUSE')}
          className={`flex h-[72px] items-center justify-center rounded-xl border-2 border-cyan-500 px-3 shadow-sm transition text-center ${
            teamStatFilter === 'WITH_WAREHOUSE' ? 'bg-cyan-600 text-white' : 'bg-white text-cyan-700 hover:bg-cyan-50'
          }`}
        >
          <p className="text-sm sm:text-base font-black uppercase">
            {activeWarehousesCount} KHO CÓ ĐỘI
          </p>
        </button>

        <button
          type="button"
          onClick={() => setTeamStatFilter('WITH_STOREKEEPER')}
          className={`flex h-[72px] items-center justify-center rounded-xl border-2 border-cyan-500 px-3 shadow-sm transition text-center ${
            teamStatFilter === 'WITH_STOREKEEPER' ? 'bg-cyan-600 text-white' : 'bg-white text-cyan-700 hover:bg-cyan-50'
          }`}
        >
          <p className="text-sm sm:text-base font-black uppercase">
            {assignedStorekeepersCount} THỦ KHO ĐÃ PHÂN ĐỘI
          </p>
        </button>

        <button
          type="button"
          onClick={() => setTeamStatFilter('WITH_CHECKER')}
          className={`flex h-[72px] items-center justify-center rounded-xl border-2 border-cyan-500 px-3 shadow-sm transition text-center ${
            teamStatFilter === 'WITH_CHECKER' ? 'bg-cyan-600 text-white' : 'bg-white text-cyan-700 hover:bg-cyan-50'
          }`}
        >
          <p className="text-sm sm:text-base font-black uppercase">
            {assignedCheckersCount} NV KIỂM KÊ ĐÃ PHÂN ĐỘI
          </p>
        </button>
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
            className="h-11 w-full rounded-xl border-2 border-cyan-500 bg-white pl-12 pr-4 text-sm font-semibold text-slate-700 outline-none transition focus:ring-4 focus:ring-cyan-500/10"
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

      {/* High-density Table matching Personnel.tsx */}
      {filteredTeams.length > 0 ? (
        <div className="overflow-hidden rounded-xl border-2 border-slate-200 bg-white shadow-sm">
          <div className="max-h-[640px] overflow-auto">
            <table className="w-full border-collapse text-left">
              <thead className="bg-cyan-50 sticky top-0 z-20 shadow-sm">
                <tr className="border-b-2 border-slate-200">
                  <th className="border-x border-slate-200 px-3 py-4 text-center text-sm font-extrabold uppercase text-slate-800 w-16">
                    STT
                  </th>
                  <th className="border-r border-slate-200 px-4 py-4 text-center text-sm font-extrabold uppercase text-slate-800 min-w-[180px]">
                    Tên Đội dự án
                  </th>
                  <th className="border-r border-slate-200 px-4 py-4 text-center text-sm font-extrabold uppercase text-slate-800 min-w-[180px]">
                    Kho phụ trách
                  </th>
                  <th className="border-r border-slate-200 px-4 py-4 text-center text-sm font-extrabold uppercase text-slate-800 min-w-[200px]">
                    Mô tả
                  </th>
                  <th className="border-r border-slate-200 px-4 py-4 text-center text-sm font-extrabold uppercase text-slate-800 min-w-[200px]">
                    Phân công Thủ kho
                  </th>
                  <th className="border-r border-slate-200 px-4 py-4 text-center text-sm font-extrabold uppercase text-slate-800 min-w-[200px]">
                    Phân công NV kiểm kê
                  </th>
                  <th className="border-r border-slate-200 px-3 py-4 text-center text-sm font-extrabold uppercase text-slate-800 w-28">
                    Tổng TV
                  </th>
                  <th className="sticky right-0 border-l border-slate-200 bg-cyan-50 px-3 py-4 text-center text-sm font-extrabold uppercase text-slate-800 shadow-[-4px_0_12px_rgba(0,0,0,0.03)] min-w-[160px]">
                    THAO TÁC
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {paginatedTeams.map((team, index) => {
                  const globalIndex = (currentPage - 1) * pageSize + index + 1;
                  const wh = warehouses.find((w) => w.id === team.warehouseId);
                  const whCode = team.warehouseCode || wh?.code || '';
                  const whName = wh?.name || '';
                  const warehouseDisplay = whCode && whName ? `${whCode} - ${whName}` : whCode || whName || 'Chưa chọn kho';

                  const skList = (team.storekeeperIds || []).map(getUserDisplayName);
                  const icList = (team.inventoryCheckerIds || []).map(getUserDisplayName);
                  const totalCount = skList.length + icList.length;

                  return (
                    <tr key={team.id} className="group border-b border-slate-200 transition hover:bg-cyan-50/50">
                      <td className="border-r border-slate-200 px-3 py-3.5 text-center text-sm font-medium text-slate-700">
                        {globalIndex}
                      </td>
                      <td className="border-r border-slate-200 px-4 py-3.5 text-center text-sm font-medium text-slate-700">
                        {team.name}
                      </td>
                      <td className="border-r border-slate-200 px-4 py-3.5 text-center text-sm font-medium text-slate-700">
                        {warehouseDisplay}
                      </td>
                      <td className="border-r border-slate-200 px-4 py-3.5 text-center text-sm font-medium text-slate-700">
                        {team.description || 'Không có mô tả'}
                      </td>
                      <td className="border-r border-slate-200 px-4 py-3.5 text-center text-sm font-medium text-slate-700">
                        {skList.length > 0 ? skList.join(', ') : 'Chưa phân công'}
                      </td>
                      <td className="border-r border-slate-200 px-4 py-3.5 text-center text-sm font-medium text-slate-700">
                        {icList.length > 0 ? icList.join(', ') : 'Chưa phân công'}
                      </td>
                      <td className="border-r border-slate-200 px-3 py-3.5 text-center text-sm font-medium text-slate-700">
                        {totalCount} TV
                      </td>
                      <td className="sticky right-0 border-l border-slate-200 bg-white px-3 py-3.5 text-center align-middle shadow-[-4px_0_12px_rgba(0,0,0,0.03)] group-hover:bg-cyan-50/50">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            type="button"
                            className="flex h-9 w-9 items-center justify-center rounded-xl border-2 border-cyan-500 bg-white text-cyan-600 shadow-sm transition hover:bg-cyan-50 hover:text-cyan-700"
                            title="Xem chi tiết"
                            onClick={() => setViewingTeam(team)}
                          >
                            <Eye size={18} strokeWidth={2.5} />
                          </button>

                          <button
                            type="button"
                            className="flex h-9 w-9 items-center justify-center rounded-xl border-2 border-cyan-500 bg-white text-cyan-600 shadow-sm transition hover:bg-cyan-50 hover:text-cyan-700"
                            title="Sửa đội dự án"
                            onClick={() => openModal(team)}
                          >
                            <Pencil size={18} strokeWidth={2.5} />
                          </button>

                          <button
                            type="button"
                            className="flex h-9 w-9 items-center justify-center rounded-xl border-2 border-cyan-500 bg-white text-cyan-600 shadow-sm transition hover:bg-cyan-50 hover:text-cyan-700"
                            title="Xóa đội dự án"
                            onClick={() => setDeletingTeamId(team.id)}
                          >
                            <Trash2 size={18} strokeWidth={2.5} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          {totalItems > 0 && (
            <div className="flex flex-col items-center justify-between border-t border-slate-200 bg-slate-50/50 px-6 py-3 sm:flex-row">
              <div className="text-sm font-medium text-slate-600">
                Tổng số: <b className="font-extrabold text-slate-900">{totalItems}</b> đội{' '}
                <span className="ml-2 text-slate-500">
                  Hiển thị {startIndex} - {endIndex}
                </span>
              </div>
              <div className="mt-4 flex items-center gap-2 sm:mt-0">
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="h-8 rounded-lg border border-slate-300 bg-white px-2 text-sm font-bold text-slate-700 outline-none transition focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 cursor-pointer"
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
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-40"
                  >
                    «
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-40"
                  >
                    ‹
                  </button>
                  <button
                    type="button"
                    className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-600 text-sm font-bold text-white shadow-xs"
                  >
                    {currentPage}
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-40"
                  >
                    ›
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrentPage(totalPages)}
                    disabled={currentPage === totalPages}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-40"
                  >
                    »
                  </button>
                </div>
              </div>
            </div>
          )}
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
      {isModalOpen &&
        createPortal(
          <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs transition-all animate-in fade-in duration-200">
            <div className="w-full max-w-3xl rounded-3xl bg-white shadow-2xl overflow-hidden max-h-[90vh] flex flex-col border border-slate-200">
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
                  className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 cursor-pointer"
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
                  <fieldset className="rounded-2xl border-2 border-cyan-100 bg-slate-50/50 p-4 flex flex-col">
                    <legend className="px-2 text-sm font-black text-cyan-900 flex items-center gap-1.5">
                      <ShieldCheck className="h-4 w-4 text-cyan-600" />
                      Phân công Thủ kho ({form.storekeeperIds.length})
                    </legend>
                    <div className="relative my-2">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-cyan-600" />
                      <input
                        type="text"
                        value={memberSearchSk}
                        onChange={(e) => setMemberSearchSk(e.target.value)}
                        placeholder="Tìm kiếm thủ kho..."
                        className="h-9 w-full rounded-xl border border-slate-200 bg-white pl-8 pr-3 text-xs font-semibold text-slate-700 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/10"
                      />
                    </div>
                    <div className="mt-1 max-h-52 overflow-y-auto space-y-2 pr-1 flex-1">
                      {(() => {
                        const filtered = storekeepers.filter((u) => {
                          const q = memberSearchSk.trim().toLowerCase();
                          return !q || (u.fullName || u.email).toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
                        });
                        if (filtered.length === 0) {
                          return (
                            <p className="py-4 text-center text-xs font-medium text-slate-400">
                              {memberSearchSk ? 'Không tìm thấy thủ kho phù hợp' : 'Chưa có tài khoản với vai trò Thủ kho'}
                            </p>
                          );
                        }
                        return filtered.map((u) => {
                          const checked = form.storekeeperIds.includes(u.id);
                          return (
                            <label
                              key={u.id}
                              className={`flex items-center justify-between rounded-xl border-2 p-2.5 cursor-pointer transition ${
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
                        });
                      })()}
                    </div>
                  </fieldset>

                  {/* Inventory Checkers Selection */}
                  <fieldset className="rounded-2xl border-2 border-cyan-100 bg-slate-50/50 p-4 flex flex-col">
                    <legend className="px-2 text-sm font-black text-cyan-900 flex items-center gap-1.5">
                      <ScanLine className="h-4 w-4 text-cyan-600" />
                      Phân công Nhân viên kiểm kê ({form.inventoryCheckerIds.length})
                    </legend>
                    <div className="relative my-2">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-cyan-600" />
                      <input
                        type="text"
                        value={memberSearchIc}
                        onChange={(e) => setMemberSearchIc(e.target.value)}
                        placeholder="Tìm kiếm NV kiểm kê..."
                        className="h-9 w-full rounded-xl border border-slate-200 bg-white pl-8 pr-3 text-xs font-semibold text-slate-700 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/10"
                      />
                    </div>
                    <div className="mt-1 max-h-52 overflow-y-auto space-y-2 pr-1 flex-1">
                      {(() => {
                        const filtered = inventoryCheckers.filter((u) => {
                          const q = memberSearchIc.trim().toLowerCase();
                          return !q || (u.fullName || u.email).toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
                        });
                        if (filtered.length === 0) {
                          return (
                            <p className="py-4 text-center text-xs font-medium text-slate-400">
                              {memberSearchIc ? 'Không tìm thấy NV kiểm kê phù hợp' : 'Chưa có tài khoản Nhân viên kiểm kê'}
                            </p>
                          );
                        }
                        return filtered.map((u) => {
                          const checked = form.inventoryCheckerIds.includes(u.id);
                          return (
                            <label
                              key={u.id}
                              className={`flex items-center justify-between rounded-xl border-2 p-2.5 cursor-pointer transition ${
                                checked
                                  ? 'border-cyan-500 bg-cyan-50/80 text-cyan-900 font-bold'
                                  : 'border-slate-200 bg-white hover:border-slate-300 text-slate-700 font-medium'
                              }`}
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => toggleMember('inventoryCheckerIds', u.id)}
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
                        });
                      })()}
                    </div>
                  </fieldset>
                </div>

                {/* Modal Footer */}
                <div className="flex items-center justify-end gap-3 border-t-2 border-slate-100 pt-4">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="rounded-xl border-2 border-slate-200 px-5 py-2.5 text-sm font-bold text-slate-600 transition hover:bg-slate-100 cursor-pointer"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-6 py-2.5 text-sm font-bold text-white shadow-md transition hover:bg-cyan-700 disabled:opacity-60 cursor-pointer"
                  >
                    {saving ? 'Đang lưu...' : editingTeam ? 'Lưu cập nhật' : 'Tạo Đội dự án'}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body,
        )}

      {/* Delete Confirmation Modal */}
      {deletingTeamId &&
        createPortal(
          <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs transition-all animate-in fade-in duration-200">
            <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl text-center space-y-4 border border-slate-200">
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
                  className="rounded-xl border-2 border-slate-200 px-5 py-2.5 text-sm font-bold text-slate-600 transition hover:bg-slate-100 cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteTeam(deletingTeamId)}
                  className="rounded-xl bg-red-600 px-6 py-2.5 text-sm font-bold text-white shadow-md transition hover:bg-red-700 cursor-pointer"
                >
                  Xác nhận Xóa
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {/* View Team Details Modal */}
      {viewingTeam &&
        createPortal(
          <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs transition-all animate-in fade-in duration-200">
            <div className="w-full max-w-2xl rounded-3xl bg-white shadow-2xl overflow-hidden flex flex-col border border-slate-200">
              <div className="flex items-center justify-between border-b-2 border-slate-100 px-6 py-4 bg-gradient-to-r from-cyan-50 to-white">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-600 text-white shadow-sm">
                    <Users className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-slate-900">{viewingTeam.name}</h2>
                    <p className="text-xs font-semibold text-slate-500">Chi tiết đội dự án & danh sách thành viên</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setViewingTeam(null)}
                  className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="p-6 space-y-5">
                <div className="grid grid-cols-2 gap-4 rounded-2xl bg-cyan-50/50 p-4 border border-cyan-100">
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase">Kho phụ trách</p>
                    <p className="text-sm font-black text-cyan-900">
                      {viewingTeam.warehouseCode || 'KHO'} - {warehouses.find((w) => w.id === viewingTeam.warehouseId)?.name || 'Chưa chọn kho'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase">Tổng số thành viên</p>
                    <p className="text-sm font-black text-slate-800">
                      {(viewingTeam.storekeeperIds?.length || 0) + (viewingTeam.inventoryCheckerIds?.length || 0)} người
                    </p>
                  </div>
                </div>

                {viewingTeam.description && (
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase mb-1">Mô tả</p>
                    <p className="text-sm font-medium text-slate-700">{viewingTeam.description}</p>
                  </div>
                )}

                {/* Storekeepers */}
                <div>
                  <p className="text-sm font-black text-cyan-900 mb-2 flex items-center gap-1.5">
                    <ShieldCheck className="h-4 w-4 text-cyan-600" />
                    Thủ kho được phân công ({(viewingTeam.storekeeperIds || []).length})
                  </p>
                  <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                    {(viewingTeam.storekeeperIds || []).length > 0 ? (
                      viewingTeam.storekeeperIds.map((id) => {
                        const u = users.find((item) => item.id === id);
                        return (
                          <div key={id} className="flex items-center justify-between rounded-xl border border-cyan-200 bg-cyan-50/60 p-2.5">
                            <span className="text-xs font-bold text-cyan-950">{u?.fullName || u?.email || id}</span>
                            <span className="text-[11px] text-cyan-700">{u?.email}</span>
                          </div>
                        );
                      })
                    ) : (
                      <p className="text-xs text-slate-400 italic">Chưa phân công Thủ kho</p>
                    )}
                  </div>
                </div>

                {/* Inventory Checkers */}
                <div>
                  <p className="text-sm font-black text-cyan-900 mb-2 flex items-center gap-1.5">
                    <ScanLine className="h-4 w-4 text-cyan-600" />
                    Nhân viên kiểm kê được phân công ({(viewingTeam.inventoryCheckerIds || []).length})
                  </p>
                  <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                    {(viewingTeam.inventoryCheckerIds || []).length > 0 ? (
                      viewingTeam.inventoryCheckerIds.map((id) => {
                        const u = users.find((item) => item.id === id);
                        return (
                          <div key={id} className="flex items-center justify-between rounded-xl border border-cyan-200 bg-cyan-50/60 p-2.5">
                            <span className="text-xs font-bold text-cyan-950">{u?.fullName || u?.email || id}</span>
                            <span className="text-[11px] text-cyan-700">{u?.email}</span>
                          </div>
                        );
                      })
                    ) : (
                      <p className="text-xs text-slate-400 italic">Chưa phân công Nhân viên kiểm kê</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 border-t-2 border-slate-100 px-6 py-4">
                <button
                  type="button"
                  onClick={() => {
                    const teamToEdit = viewingTeam;
                    setViewingTeam(null);
                    openModal(teamToEdit);
                  }}
                  className="rounded-xl bg-cyan-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-cyan-700 transition cursor-pointer"
                >
                  Chỉnh sửa Đội
                </button>
                <button
                  type="button"
                  onClick={() => setViewingTeam(null)}
                  className="rounded-xl border-2 border-slate-200 px-5 py-2.5 text-sm font-bold text-slate-600 transition hover:bg-slate-100 cursor-pointer"
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
