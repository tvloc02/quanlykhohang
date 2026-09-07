import React from 'react';
import { createPortal } from 'react-dom';
import {
  Clock,
  Download,
  Eye,
  EyeOff,
  Lock,
  Pencil,
  Search,
  ShieldAlert,
  Trash2,
  Unlock,
  Upload,
  UserPlus,
  Users,
  X,
  XCircle,
  CheckCircle,
  ChevronDown,
  Check,
  Building2,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import {
  getUserWarehouseIds,
  getUserWarehouseNames,
  normalizeWarehouseRecord,
  saveStoredWarehouses,
  type WarehouseRecord,
  getStoredWarehouses,
} from '../../shared/utils/warehouseAssignments';
import {
  readStoredPermissionGroups,
  saveStoredPermissionGroups,
  type PermissionGroup,
} from './PermissionGroupsPage';

const API_BASE_URL = '/api';
const USERS_STORAGE_KEY = 'smart-wms-personnel-users';
const PROFILES_STORAGE_KEY = 'smart-wms-personnel-profiles';

export type UserRole = {
  name: string;
};

export type PersonnelUser = {
  id: string;
  email: string;
  fullName?: string;
  phone?: string;
  status?: string;
  roles?: UserRole[];
  groupIds?: string[];
  warehouseIds?: string[];
};

export type PersonnelProfile = {
  gender: string;
  phone: string;
  status: 'active' | 'inactive';
  isLocked: boolean;
  lockReason?: string;
  lockedAt?: string;
  lastLogin?: string;
};

type SelectOption = {
  value: string;
  label: string;
};

type PersonnelForm = {
  email: string;
  fullName: string;
  gender: string;
  phone: string;
  status: PersonnelProfile['status'];
  password?: string;
  role: string;
  groupIds: string[];
  warehouseIds: string[];
};

type ModalMode = 'create' | 'view' | 'edit' | 'delete' | null;

const DEFAULT_ROLES = [
  { id: 'admin', name: 'Quản trị viên' },
  { id: 'manager', name: 'Quản lý kho' },
  { id: 'storekeeper', name: 'Thủ kho' },
  { id: 'inventory-checker', name: 'Nhân viên kiểm kê' },
];

export function getFallbackPersonnelUsers(): PersonnelUser[] {
  return [];
}

export function readStoredPersonnelUsers(): PersonnelUser[] {
  try {
    const raw = localStorage.getItem(USERS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
    return [];
  } catch {
    return [];
  }
}

export function saveStoredPersonnelUsers(users: PersonnelUser[]) {
  localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
}

export function readStoredPersonnelProfiles(): Record<string, PersonnelProfile> {
  try {
    const raw = localStorage.getItem(PROFILES_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // fallback empty
  }
  return {};
}

export function saveStoredPersonnelProfiles(profiles: Record<string, PersonnelProfile>) {
  localStorage.setItem(PROFILES_STORAGE_KEY, JSON.stringify(profiles));
  window.dispatchEvent(new Event('storage'));
}

function getPrimaryRole(user: PersonnelUser): string {
  if (!user.roles || user.roles.length === 0) return 'storekeeper';
  return user.roles[0]?.name || 'storekeeper';
}

function getRoleLabel(role: string): string {
  const roleMap: Record<string, string> = {
    admin: 'Quản trị viên',
    manager: 'Người dùng',
    storekeeper: 'Người dùng',
    'inventory-checker': 'Người dùng',
    supplier: 'Nhà cung cấp',
    customer: 'Khách hàng',
  };

  return roleMap[role] || role;
}

function isInternalPersonnel(user: PersonnelUser) {
  const role = getPrimaryRole(user);
  return role !== 'supplier' && role !== 'customer';
}

function buildEmptyForm(defaultRole = 'storekeeper'): PersonnelForm {
  return {
    email: '',
    fullName: '',
    gender: 'Nam',
    phone: '',
    status: 'active',
    password: '',
    role: defaultRole,
    groupIds: [],
    warehouseIds: [],
  };
}

function buildUserForm(user: any, profile?: PersonnelProfile, warehouses: WarehouseRecord[] = getStoredWarehouses()): PersonnelForm {
  const gIds = Array.isArray(user.groupIds)
    ? user.groupIds
    : user.groupId
      ? [user.groupId]
      : [];

  return {
    email: user.email,
    fullName: user.fullName || '',
    gender: profile?.gender || 'Nam',
    phone: profile?.phone || user.phone || '',
    status: user.status || profile?.status || 'active',
    password: '',
    role: getPrimaryRole(user),
    groupIds: gIds,
    warehouseIds: getUserWarehouseIds(user.id, warehouses),
  };
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
  onChange: (val: string) => void;
  className?: string;
  disabled?: boolean;
}) {
  const [isOpen, setIsOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const selectedOpt = options.find((o) => o.value === value) || options[0];

  React.useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        className="flex h-full w-full items-center justify-between rounded-xl border-2 border-cyan-500 bg-white px-4 text-sm font-semibold text-slate-800 outline-none transition hover:border-cyan-600 focus:ring-4 focus:ring-cyan-500/10 disabled:bg-slate-50 disabled:border-slate-200 disabled:text-slate-400 cursor-pointer"
      >
        <span className="truncate">{selectedOpt?.label || value}</span>
        <ChevronDown className={`h-4 w-4 flex-shrink-0 text-cyan-600 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute left-0 right-0 top-full z-[9999] mt-1.5 max-h-60 overflow-auto rounded-xl border-2 border-cyan-500 bg-white p-1.5 shadow-2xl animate-in fade-in-50 slide-in-from-top-2">
          {options.map((opt) => {
            const isSelected = opt.value === value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  onChange(opt.value);
                  setIsOpen(false);
                }}
                className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-semibold transition cursor-pointer ${
                  isSelected
                    ? 'bg-cyan-500 text-white font-bold'
                    : 'text-slate-700 hover:bg-cyan-50 hover:text-cyan-800'
                }`}
              >
                <span>{opt.label}</span>
                {isSelected && <Check className="h-4 w-4 text-white" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Toast({ message, type, onClose }: { message: string; type: 'success' | 'error'; onClose: () => void }) {
  React.useEffect(() => {
    if (message) {
      const timer = setTimeout(() => onClose(), 3500);
      return () => clearTimeout(timer);
    }
  }, [message, onClose]);

  if (!message) return null;

  return createPortal(
    <div className={`fixed top-6 right-6 z-[9999] pointer-events-auto flex items-center gap-3 rounded-2xl px-5 py-3.5 shadow-2xl transition-all border backdrop-blur-md animate-in slide-in-from-top-4 ${
      type === 'error' ? 'bg-red-50/95 text-red-700 border-red-200' : 'bg-emerald-50/95 text-emerald-800 border-emerald-200'
    }`}>
      {type === 'error' ? <XCircle className="h-5 w-5 flex-shrink-0 text-red-600" /> : <CheckCircle className="h-5 w-5 flex-shrink-0 text-emerald-600" />}
      <p className="text-sm font-extrabold">{message}</p>
      <button type="button" onClick={onClose} className="ml-2 rounded-lg p-1 hover:bg-black/5 transition cursor-pointer">
        <X className="h-4 w-4" />
      </button>
    </div>,
    document.body
  );
}

export default function Personnel() {
  const [users, setUsers] = React.useState<PersonnelUser[]>(readStoredPersonnelUsers);
  const [profiles, setProfiles] = React.useState<Record<string, PersonnelProfile>>(readStoredPersonnelProfiles);
  const [warehouses, setWarehouses] = React.useState<WarehouseRecord[]>(getStoredWarehouses);
  const [permissionGroups, setPermissionGroups] = React.useState<PermissionGroup[]>(readStoredPermissionGroups);

  // Filter & Search states
  const [search, setSearch] = React.useState('');
  const [roleFilter, setRoleFilter] = React.useState('all');
  const [statFilter, setStatFilter] = React.useState<'ALL' | 'MANAGERS' | 'LOCKED'>('ALL');

  // Checkbox Selection for Bulk Actions
  const [selectedUserIds, setSelectedUserIds] = React.useState<string[]>([]);

  // Bulk Modal states
  const [bulkModalMode, setBulkModalMode] = React.useState<'group' | 'warehouse' | 'delete' | null>(null);
  const [bulkGroupIds, setBulkGroupIds] = React.useState<string[]>([]);
  const [bulkWarehouseIds, setBulkWarehouseIds] = React.useState<string[]>([]);

  // Pagination states
  const [pageSize, setPageSize] = React.useState(20);
  const [currentPage, setCurrentPage] = React.useState(1);

  // Modal states
  const [modalMode, setModalMode] = React.useState<ModalMode>(null);
  const [selectedUser, setSelectedUser] = React.useState<PersonnelUser | null>(null);
  const [form, setForm] = React.useState<PersonnelForm>(buildEmptyForm);

  // Search terms inside modal
  const [groupSearchInModal, setGroupSearchInModal] = React.useState('');
  const [warehouseSearchInModal, setWarehouseSearchInModal] = React.useState('');

  // Lock account modal state
  const [lockModalOpen, setLockModalOpen] = React.useState(false);
  const [userToLock, setUserToLock] = React.useState<PersonnelUser | null>(null);
  const [lockReasonInput, setLockReasonInput] = React.useState('');

  // UI state
  const [showPassword, setShowPassword] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState('');
  const [success, setSuccess] = React.useState('');

  const loadData = React.useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const headers = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token || ''}`,
      };

      const [uRes, wRes] = await Promise.all([
        fetch(`${API_BASE_URL}/users`, { headers }),
        fetch(`${API_BASE_URL}/warehouses`, { headers }),
      ]);

      const localUsers = readStoredPersonnelUsers();
      let mergedUsers = [...localUsers];

      if (uRes.ok) {
        const remoteUsers = (await uRes.json()) as PersonnelUser[];
        if (Array.isArray(remoteUsers)) {
          const userMap = new Map<string, PersonnelUser>();

          // Add local users first
          localUsers.forEach((u) => {
            const key = u.id || u.email;
            if (key) userMap.set(key, u);
          });

          // Overlay remote users from API
          remoteUsers.forEach((u) => {
            const key = u.id || u.email;
            if (!key) return;
            const existing = userMap.get(key);
            userMap.set(key, {
              ...existing,
              ...u,
              roles: u.roles && u.roles.length > 0 ? u.roles : (existing?.roles || [{ name: 'staff' }]),
              // An empty array is a valid saved value (it means all assignments were removed).
              // Do not replace it with stale local data after a refresh.
              groupIds: Array.isArray(u.groupIds) ? u.groupIds : (existing?.groupIds || []),
              warehouseIds: Array.isArray(u.warehouseIds) ? u.warehouseIds : (existing?.warehouseIds || []),
            });
          });

          mergedUsers = Array.from(userMap.values());
        }
      }

      setUsers(mergedUsers);

      if (wRes.ok) {
        const remoteWarehouses = (await wRes.json()) as WarehouseRecord[];
        if (Array.isArray(remoteWarehouses)) {
          setWarehouses(remoteWarehouses.map(normalizeWarehouseRecord));
        }
      }
      setPermissionGroups(readStoredPermissionGroups());
    } catch {
      // Fallback local data
      const localUsers = readStoredPersonnelUsers();
      setUsers(localUsers);
      setPermissionGroups(readStoredPermissionGroups());
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadData();

    const handlePermissionUpdate = () => {
      setPermissionGroups(readStoredPermissionGroups());
    };

    window.addEventListener('permissions-updated', handlePermissionUpdate);
    return () => {
      window.removeEventListener('permissions-updated', handlePermissionUpdate);
    };
  }, [loadData]);

  // Reset pagination when filters change
  React.useEffect(() => {
    setCurrentPage(1);
    setSelectedUserIds([]);
  }, [search, roleFilter, statFilter]);

  const getProfile = (user: any): PersonnelProfile => ({
    gender: profiles[user.id]?.gender || 'Nam',
    phone: profiles[user.id]?.phone || user.phone || '-',
    status: profiles[user.id]?.status || user.status || 'active',
    isLocked: profiles[user.id]?.isLocked || false,
    lockReason: profiles[user.id]?.lockReason || '',
    lockedAt: profiles[user.id]?.lockedAt || '',
    lastLogin: profiles[user.id]?.lastLogin || '',
  });

  const personnelUsers = users.filter(isInternalPersonnel);

  // Stat Overview counts
  const totalAccountsCount = personnelUsers.length;
  const lockedAccountsCount = personnelUsers.filter((user) => getProfile(user).isLocked).length;
  const managersCount = personnelUsers.filter((user) => {
    const role = getPrimaryRole(user);
    return role === 'admin' || role === 'manager';
  }).length;

  // Filtered Users List
  const filteredUsers = React.useMemo(() => {
    const query = search.trim().toLowerCase();

    return personnelUsers.filter((user) => {
      const userRole = getPrimaryRole(user);
      const profile = getProfile(user);

      let matchesStat = true;
      if (statFilter === 'MANAGERS') {
        matchesStat = userRole === 'admin' || userRole === 'manager';
      } else if (statFilter === 'LOCKED') {
        matchesStat = profile.isLocked;
      }

      const matchesRole = roleFilter === 'all' || userRole === roleFilter;

      const matchesSearch =
        !query ||
        user.email.toLowerCase().includes(query) ||
        (user.fullName || '').toLowerCase().includes(query) ||
        profile.phone.toLowerCase().includes(query);

      return matchesStat && matchesRole && matchesSearch;
    });
  }, [personnelUsers, search, roleFilter, statFilter, profiles]);

  // Pagination calculations
  const totalItems = filteredUsers.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const startIndex = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endIndex = Math.min(currentPage * pageSize, totalItems);

  const paginatedUsers = React.useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredUsers.slice(start, start + pageSize);
  }, [filteredUsers, currentPage, pageSize]);

  // Batch actions logic
  const handleBatchDelete = async () => {
    if (selectedUserIds.length === 0) return;
    setSaving(true);
    try {
      const nextUsers = users.filter((u) => !selectedUserIds.includes(u.id));
      setUsers(nextUsers);
      saveStoredPersonnelUsers(nextUsers);

      const nextProfiles = { ...profiles };
      selectedUserIds.forEach((id) => delete nextProfiles[id]);
      setProfiles(nextProfiles);
      saveStoredPersonnelProfiles(nextProfiles);

      setSuccess(`Đã xóa ${selectedUserIds.length} nhân sự đã chọn.`);
      setSelectedUserIds([]);
      setBulkModalMode(null);
    } catch {
      setError('Có lỗi xảy ra khi xóa danh sách nhân sự.');
    } finally {
      setSaving(false);
    }
  };

  const handleBatchAssignGroups = async () => {
    if (selectedUserIds.length === 0) return;
    setSaving(true);
    try {
      const nextUsers = users.map((u) => {
        if (selectedUserIds.includes(u.id)) {
          return { ...u, groupIds: bulkGroupIds };
        }
        return u;
      });
      const headers = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
      };
      await Promise.all(
        nextUsers
          .filter((u) => selectedUserIds.includes(u.id))
          .map((u) => fetch(`${API_BASE_URL}/users/${u.id}`, {
            method: 'PATCH',
            headers,
            body: JSON.stringify({ groupIds: u.groupIds || [] }),
          }))
      );
      setUsers(nextUsers);
      saveStoredPersonnelUsers(nextUsers);

      const currentGroups = readStoredPermissionGroups();
      const updatedGroups = currentGroups.map((g) => {
        const isAssigned = bulkGroupIds.includes(g.id);
        const members = new Set(g.memberIds || []);
        selectedUserIds.forEach((uid) => {
          if (isAssigned) members.add(uid);
          else members.delete(uid);
        });
        return { ...g, memberIds: Array.from(members) };
      });
      saveStoredPermissionGroups(updatedGroups);

      setSuccess(`Đã gán nhóm quyền cho ${selectedUserIds.length} nhân sự.`);
      setSelectedUserIds([]);
      setBulkModalMode(null);
    } catch {
      setError('Có lỗi xảy ra khi gán nhóm quyền.');
    } finally {
      setSaving(false);
    }
  };

  const handleBatchAssignWarehouses = async () => {
    if (selectedUserIds.length === 0) return;
    setSaving(true);
    try {
      let updatedWarehouses = [...warehouses];
      for (const wh of warehouses) {
        const shouldBeIn = bulkWarehouseIds.includes(wh.id);
        const storekeepers = new Set<string>((wh as any).storekeeperIds || wh.staffIds || []);
        selectedUserIds.forEach((uid) => {
          if (shouldBeIn) storekeepers.add(uid);
          else storekeepers.delete(uid);
        });
        const nextStorekeeperIds = Array.from(storekeepers);
        const payload = {
          storekeeperIds: nextStorekeeperIds,
          staffIds: nextStorekeeperIds,
        };
        updatedWarehouses = updatedWarehouses.map((item) =>
          item.id === wh.id ? { ...item, ...payload } : item
        );
      }
      const headers = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
      };
      await Promise.all(updatedWarehouses.map((warehouse) => fetch(`${API_BASE_URL}/warehouses/${warehouse.id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          managerIds: warehouse.managerIds || [],
          staffIds: (warehouse as any).staffIds || (warehouse as any).storekeeperIds || [],
        }),
      })));
      setWarehouses(updatedWarehouses);
      saveStoredWarehouses(updatedWarehouses);

      setSuccess(`Đã phân kho cho ${selectedUserIds.length} nhân sự.`);
      setSelectedUserIds([]);
      setBulkModalMode(null);
    } catch {
      setError('Có lỗi xảy ra khi phân kho.');
    } finally {
      setSaving(false);
    }
  };

  const openLockModal = (user: PersonnelUser) => {
    setUserToLock(user);
    const p = getProfile(user);
    setLockReasonInput(p.lockReason || '');
    setLockModalOpen(true);
  };

  const handleToggleLockAccount = async () => {
    if (!userToLock) return;
    const currentProfile = getProfile(userToLock);
    const willBeLocked = !currentProfile.isLocked;

    if (willBeLocked && !lockReasonInput.trim()) {
      setError('Vui lòng nhập lý do khóa tài khoản.');
      return;
    }

    const nextProfile: PersonnelProfile = {
      ...currentProfile,
      isLocked: willBeLocked,
      lockReason: willBeLocked ? lockReasonInput.trim() : '',
      lockedAt: willBeLocked ? new Date().toISOString() : '',
    };

    const nextProfiles = { ...profiles, [userToLock.id]: nextProfile };
    setProfiles(nextProfiles);
    saveStoredPersonnelProfiles(nextProfiles);

    setSuccess(
      willBeLocked
        ? `Đã khóa tài khoản nhân sự "${userToLock.fullName || userToLock.email}".`
        : `Đã mở khóa tài khoản nhân sự "${userToLock.fullName || userToLock.email}".`
    );

    setLockModalOpen(false);
    setUserToLock(null);
  };

  // Open Modal
  const openCreateModal = () => {
    setSelectedUser(null);
    setForm(buildEmptyForm());
    setShowPassword(false);
    setError('');
    setGroupSearchInModal('');
    setWarehouseSearchInModal('');
    setModalMode('create');
  };

  const openUserModal = (mode: ModalMode, user: PersonnelUser) => {
    setSelectedUser(user);
    setForm(buildUserForm(user, getProfile(user), warehouses));
    setShowPassword(false);
    setError('');
    setGroupSearchInModal('');
    setWarehouseSearchInModal('');
    setModalMode(mode);
  };

  const closeModal = () => {
    setModalMode(null);
    setSelectedUser(null);
    setError('');
  };

  const togglePermissionGroup = (groupId: string) => {
    setForm((current) => {
      const exists = current.groupIds.includes(groupId);
      return {
        ...current,
        groupIds: exists
          ? current.groupIds.filter((id) => id !== groupId)
          : [...current.groupIds, groupId],
      };
    });
  };

  const toggleWarehouse = (warehouseId: string) => {
    setForm((current) => {
      const exists = current.warehouseIds.includes(warehouseId);
      return {
        ...current,
        warehouseIds: exists
          ? current.warehouseIds.filter((id) => id !== warehouseId)
          : [...current.warehouseIds, warehouseId],
      };
    });
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.email || !form.fullName) {
      setError('Vui lòng điền đầy đủ họ tên và email.');
      return;
    }

    setSaving(true);
    setError('');

    const isEdit = modalMode === 'edit' && selectedUser;
    const userId = isEdit ? selectedUser.id : form.email.trim();

    try {
      const updatedUser: PersonnelUser = {
        id: userId,
        email: form.email.trim(),
        fullName: form.fullName.trim(),
        phone: form.phone.trim(),
        status: form.status,
        roles: [{ name: form.role }],
        groupIds: form.groupIds,
        warehouseIds: form.warehouseIds,
      };

      const token = localStorage.getItem('token');
      const headers = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token || ''}`,
      };

      if (isEdit) {
        await fetch(`${API_BASE_URL}/users/${selectedUser.id}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify({
            fullName: updatedUser.fullName,
            phone: updatedUser.phone,
            role: form.role,
            password: form.password || undefined,
            groupIds: form.groupIds,
          }),
        }).catch(async () => {
          await fetch(`${API_BASE_URL}/users/${selectedUser.id}`, {
            method: 'PATCH',
            headers,
            body: JSON.stringify({
              fullName: updatedUser.fullName,
              phone: updatedUser.phone,
              role: form.role,
              password: form.password || undefined,
              groupIds: form.groupIds,
            }),
          }).catch(() => null);
        });

        setUsers((current) => {
          const next = current.map((u) => (u.id === selectedUser.id || u.email === selectedUser.email ? updatedUser : u));
          saveStoredPersonnelUsers(next);
          return next;
        });
      } else {
        const createRes = await fetch(`${API_BASE_URL}/users`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            email: updatedUser.email,
            fullName: updatedUser.fullName,
            phone: updatedUser.phone,
            role: form.role,
            password: form.password || '123456',
            groupIds: form.groupIds,
          }),
        }).catch(() => null);

        if (createRes && createRes.ok) {
          const createdData = await createRes.json();
          if (createdData.id) {
            updatedUser.id = createdData.id;
          }
        }

        setUsers((current) => {
          const filtered = current.filter((u) => u.id !== updatedUser.id && u.email !== updatedUser.email);
          const next = [...filtered, updatedUser];
          saveStoredPersonnelUsers(next);
          return next;
        });
      }

      const effectiveUserId = updatedUser.id || userId;

      // Save profile metadata
      const nextProfiles = {
        ...profiles,
        [effectiveUserId]: {
          gender: form.gender,
          phone: form.phone,
          status: form.status,
          isLocked: profiles[effectiveUserId]?.isLocked || false,
          lockReason: profiles[effectiveUserId]?.lockReason || '',
          lockedAt: profiles[effectiveUserId]?.lockedAt || '',
        },
      };
      setProfiles(nextProfiles);
      saveStoredPersonnelProfiles(nextProfiles);

      // Sync warehouse assignments
      let updatedWarehouses = [...warehouses];
      for (const wh of warehouses) {
        const shouldBeIn = form.warehouseIds.includes(wh.id);
        const storekeepers = new Set<string>((wh as any).storekeeperIds || wh.staffIds || []);
        const checkers = new Set<string>((wh as any).inventoryCheckerIds || []);

        if (shouldBeIn) {
          if (form.role === 'inventory-checker') {
            checkers.add(effectiveUserId);
          } else {
            storekeepers.add(effectiveUserId);
          }
        } else {
          storekeepers.delete(effectiveUserId);
          checkers.delete(effectiveUserId);
        }

        const nextStorekeeperIds = Array.from(storekeepers);
        const nextCheckerIds = Array.from(checkers);

        const payload = {
          storekeeperIds: nextStorekeeperIds,
          inventoryCheckerIds: nextCheckerIds,
          staffIds: nextStorekeeperIds,
        };
        updatedWarehouses = updatedWarehouses.map((item) =>
          item.id === wh.id ? { ...item, ...payload } : item
        );
      }

      // Persist warehouse assignments in the database. Previously this was only
      // written to localStorage, so a refresh restored the old assignments.
      await Promise.all(updatedWarehouses.map((warehouse) => fetch(`${API_BASE_URL}/warehouses/${warehouse.id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          managerIds: warehouse.managerIds || [],
          staffIds: (warehouse as any).staffIds || (warehouse as any).storekeeperIds || [],
        }),
      })));
      setWarehouses(updatedWarehouses);
      saveStoredWarehouses(updatedWarehouses);

      // Sync permission groups members across matching IDs and group names
      const groups = readStoredPermissionGroups();
      const allSelectedGroupNames = new Set(
        groups.filter((g) => form.groupIds.includes(g.id)).map((g) => g.name.trim().toLowerCase())
      );

      const expandedGroupIds = Array.from(
        new Set([
          ...form.groupIds,
          ...groups
            .filter((g) => g.name && allSelectedGroupNames.has(g.name.trim().toLowerCase()))
            .map((g) => g.id),
        ])
      );

      const updatedGroups = groups.map((g) => {
        const isAssigned =
          expandedGroupIds.includes(g.id) ||
          (g.name && allSelectedGroupNames.has(g.name.trim().toLowerCase()));
        const currentMembers = g.memberIds || [];
        const filtered = currentMembers.filter(
          (m) => m !== effectiveUserId && m !== form.email && m !== userId
        );
        return {
          ...g,
          memberIds: isAssigned ? [...filtered, effectiveUserId, form.email] : filtered,
        };
      });
      saveStoredPermissionGroups(updatedGroups);

      // Sync updated memberIds to backend project-teams
      await Promise.all(
        updatedGroups.map((g) =>
          fetch(`${API_BASE_URL}/project-teams/${g.id}`, {
            method: 'PATCH',
            headers,
            body: JSON.stringify({ memberIds: g.memberIds }),
          }).catch(() => null)
        )
      );

      // If updating currently logged in user, update localStorage user
      try {
        const rawUser = localStorage.getItem('user');
        if (rawUser) {
          const loggedInUser = JSON.parse(rawUser);
          if (
            loggedInUser.email === form.email ||
            loggedInUser.id === effectiveUserId ||
            loggedInUser.id === userId
          ) {
            localStorage.setItem(
              'user',
              JSON.stringify({
                ...loggedInUser,
                groupIds: expandedGroupIds,
                role: form.role,
              })
            );
          }
        }
      } catch { /* ignore */ }

      window.dispatchEvent(new Event('storage'));
      window.dispatchEvent(new Event('permissions-updated'));

      setSuccess(isEdit ? 'Đã cập nhật nhân sự.' : 'Đã tạo nhân sự mới.');
      closeModal();
    } catch {
      setError('Có lỗi xảy ra khi lưu nhân sự.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) return;
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      await fetch(`${API_BASE_URL}/users/${selectedUser.id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token || ''}`,
        },
      }).catch(() => null);

      const nextUsers = users.filter((u) => u.id !== selectedUser.id && u.email !== selectedUser.email);
      setUsers(nextUsers);
      saveStoredPersonnelUsers(nextUsers);

      const nextProfiles = { ...profiles };
      delete nextProfiles[selectedUser.id];
      delete nextProfiles[selectedUser.email];
      setProfiles(nextProfiles);
      saveStoredPersonnelProfiles(nextProfiles);

      setSuccess('Đã xóa nhân sự.');
      closeModal();
    } catch {
      setError('Có lỗi xảy ra khi xóa nhân sự.');
    } finally {
      setSaving(false);
    }
  };

  // Helper for displaying assigned group names in table
  const getUserGroupNames = (user: PersonnelUser) => {
    const gIds = Array.isArray(user.groupIds)
      ? user.groupIds
      : (user as any).groupId
        ? [(user as any).groupId]
        : [];

    const matchedGroups = permissionGroups.filter((g) => {
      const isMemberInGroup =
        Array.isArray(g.memberIds) &&
        (g.memberIds.includes(user.id) || g.memberIds.includes(user.email));
      const isGroupInUser = gIds.includes(g.id);
      return isMemberInGroup || isGroupInUser;
    });

    return Array.from(new Set(matchedGroups.map((g) => g.name)));
  };

  const genderOptions: SelectOption[] = [
    { value: 'Nam', label: 'Nam' },
    { value: 'Nữ', label: 'Nữ' },
    { value: 'Khác', label: 'Khác' },
  ];

  const statusOptions: SelectOption[] = [
    { value: 'active', label: 'Đang hoạt động' },
    { value: 'inactive', label: 'Không hoạt động' },
  ];

  const modalTitle =
    modalMode === 'create'
      ? 'Thêm nhân sự mới'
      : modalMode === 'view'
        ? 'Chi tiết nhân sự'
        : modalMode === 'edit'
          ? 'Sửa thông tin nhân sự'
          : 'Xóa nhân sự';

  // Filtered lists inside modal for group & warehouse selection
  const filteredGroupsInModal = permissionGroups.filter((g) =>
    g.name.toLowerCase().includes(groupSearchInModal.toLowerCase()) ||
    (g.description || '').toLowerCase().includes(groupSearchInModal.toLowerCase())
  );

  const filteredWarehousesInModal = warehouses.filter((w) =>
    w.name.toLowerCase().includes(warehouseSearchInModal.toLowerCase()) ||
    w.code.toLowerCase().includes(warehouseSearchInModal.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <Toast
        message={error || success}
        type={error ? 'error' : 'success'}
        onClose={() => {
          setError('');
          setSuccess('');
        }}
      />

      {/* Title Header styled as pill badge matching "Cấu hình Mail" */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="inline-flex items-center gap-2.5 rounded-2xl bg-cyan-600 px-5 py-2.5 text-white shadow-md">
            <Users className="h-5 w-5" />
            <h1 className="text-xl font-extrabold tracking-tight">Người dùng / Nhân viên</h1>
          </div>
        </div>

        <div className="flex flex-wrap gap-2.5">
          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-600 px-5 py-2.5 text-sm font-bold text-white shadow-md transition hover:bg-cyan-700 active:scale-95 cursor-pointer"
          >
            <UserPlus className="h-4.5 w-4.5" />
            Thêm nhân sự mới
          </button>
        </div>
      </div>

      {/* 3 Stat Overview Buttons */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <button
          type="button"
          onClick={() => setStatFilter('ALL')}
          className={`flex h-[72px] items-center justify-center rounded-xl border-2 border-cyan-500 px-3 shadow-sm transition text-center cursor-pointer ${
            statFilter === 'ALL' ? 'bg-cyan-600 text-white' : 'bg-white text-cyan-700 hover:bg-cyan-50'
          }`}
        >
          <p className="text-sm sm:text-base font-black uppercase">
            {totalAccountsCount} TỔNG TÀI KHOẢN
          </p>
        </button>

        <button
          type="button"
          onClick={() => setStatFilter('MANAGERS')}
          className={`flex h-[72px] items-center justify-center rounded-xl border-2 border-cyan-500 px-3 shadow-sm transition text-center cursor-pointer ${
            statFilter === 'MANAGERS' ? 'bg-cyan-600 text-white' : 'bg-white text-cyan-700 hover:bg-cyan-50'
          }`}
        >
          <p className="text-sm sm:text-base font-black uppercase">
            {managersCount} QUẢN LÝ / QUẢN TRỊ
          </p>
        </button>

        <button
          type="button"
          onClick={() => setStatFilter('LOCKED')}
          className={`flex h-[72px] items-center justify-center rounded-xl border-2 border-cyan-500 px-3 shadow-sm transition text-center cursor-pointer ${
            statFilter === 'LOCKED' ? 'bg-cyan-600 text-white' : 'bg-white text-cyan-700 hover:bg-cyan-50'
          }`}
        >
          <p className="text-sm sm:text-base font-black uppercase">
            {lockedAccountsCount} TÀI KHOẢN ĐANG KHÓA
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
            placeholder="Tìm kiếm theo họ tên, email, SĐT nhân sự..."
            className="h-11 w-full rounded-xl border-2 border-cyan-500 bg-white pl-12 pr-4 text-sm font-semibold text-slate-700 outline-none transition focus:ring-4 focus:ring-cyan-500/10"
          />
        </div>

        <div className="w-full lg:w-64">
          <StyledSelect
            value={roleFilter}
            options={[
              { value: 'all', label: 'Tất cả vai trò' },
              ...DEFAULT_ROLES.map((r) => ({ value: r.id, label: r.name })),
            ]}
            onChange={setRoleFilter}
            className="h-11 w-full"
          />
        </div>
      </div>

      {/* Bulk Action Toolbar when items selected */}
      {selectedUserIds.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 border-cyan-500 bg-cyan-50 p-3.5 shadow-md animate-in slide-in-from-top-2">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-cyan-600 text-xs font-black text-white">
              {selectedUserIds.length}
            </span>
            <span className="text-sm font-extrabold text-cyan-950">
              Nhân sự đã được chọn
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setBulkGroupIds([]);
                setBulkModalMode('group');
              }}
              className="inline-flex items-center gap-1.5 rounded-xl border-2 border-cyan-500 bg-white px-3.5 py-1.5 text-xs font-bold text-cyan-700 hover:bg-cyan-100 transition cursor-pointer"
            >
              <Users className="h-4 w-4" /> Gán nhóm quyền
            </button>

            <button
              type="button"
              onClick={() => {
                setBulkWarehouseIds([]);
                setBulkModalMode('warehouse');
              }}
              className="inline-flex items-center gap-1.5 rounded-xl border-2 border-cyan-500 bg-white px-3.5 py-1.5 text-xs font-bold text-cyan-700 hover:bg-cyan-100 transition cursor-pointer"
            >
              <Building2 className="h-4 w-4" /> Phân kho
            </button>

            <button
              type="button"
              onClick={() => setBulkModalMode('delete')}
              className="inline-flex items-center gap-1.5 rounded-xl border-2 border-red-500 bg-white px-3.5 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50 transition cursor-pointer"
            >
              <Trash2 className="h-4 w-4" /> Xóa ({selectedUserIds.length})
            </button>

            <button
              type="button"
              onClick={() => setSelectedUserIds([])}
              className="rounded-lg p-1 text-slate-500 hover:bg-slate-200 transition cursor-pointer ml-2"
              title="Bỏ chọn tất cả"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Personnel High-Density Table - Spans naturally down without inner scrollbar */}
      <div className="overflow-x-auto rounded-xl border-2 border-slate-200 bg-white shadow-sm">
        <table className="w-full border-collapse text-left">
          <thead className="bg-cyan-50 sticky top-0 z-20 shadow-sm">
            <tr className="border-b-2 border-slate-200">
              {/* Checkbox Header */}
              <th className="border-x border-slate-200 px-3 py-4 text-center text-sm font-extrabold uppercase text-slate-800 w-12 whitespace-nowrap">
                <input
                  type="checkbox"
                  checked={paginatedUsers.length > 0 && paginatedUsers.every((u) => selectedUserIds.includes(u.id))}
                  onChange={(e) => {
                    if (e.target.checked) {
                      const currentIds = paginatedUsers.map((u) => u.id);
                      setSelectedUserIds((prev) => Array.from(new Set([...prev, ...currentIds])));
                    } else {
                      const currentIds = new Set(paginatedUsers.map((u) => u.id));
                      setSelectedUserIds((prev) => prev.filter((id) => !currentIds.has(id)));
                    }
                  }}
                  className="h-4 w-4 rounded border-slate-300 accent-cyan-600 focus:ring-cyan-500 cursor-pointer"
                />
              </th>
              <th className="border-r border-slate-200 px-3 py-4 text-center text-sm font-extrabold uppercase text-slate-800 w-14 whitespace-nowrap">
                STT
              </th>
              <th className="border-r border-slate-200 px-4 py-4 text-center text-sm font-extrabold uppercase text-slate-800 min-w-[170px] whitespace-nowrap">
                Họ và tên
              </th>
              <th className="border-r border-slate-200 px-4 py-4 text-center text-sm font-extrabold uppercase text-slate-800 min-w-[190px] whitespace-nowrap">
                Email
              </th>
              <th className="border-r border-slate-200 px-3 py-4 text-center text-sm font-extrabold uppercase text-slate-800 w-32 whitespace-nowrap">
                SĐT
              </th>
              <th className="border-r border-slate-200 px-4 py-4 text-center text-sm font-extrabold uppercase text-slate-800 min-w-[160px] whitespace-nowrap">
                Nhóm quyền
              </th>
              <th className="border-r border-slate-200 px-4 py-4 text-center text-sm font-extrabold uppercase text-slate-800 min-w-[170px] whitespace-nowrap">
                Kho hoạt động
              </th>
              <th className="border-r border-slate-200 px-4 py-4 text-center text-sm font-extrabold uppercase text-slate-800 min-w-[160px] whitespace-nowrap">
                Trạng thái
              </th>
              <th className="sticky right-0 border-l border-slate-200 bg-cyan-50 px-3 py-4 text-center text-sm font-extrabold uppercase text-slate-800 shadow-[-4px_0_12px_rgba(0,0,0,0.03)] w-52 min-w-[200px] whitespace-nowrap">
                THAO TÁC
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white">
            {loading ? (
              <tr>
                <td colSpan={9} className="py-12 text-center text-slate-500 font-semibold">
                  Đang tải danh sách nhân sự...
                </td>
              </tr>
            ) : paginatedUsers.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-12 text-center text-slate-500 font-semibold">
                  Không tìm thấy nhân sự phù hợp.
                </td>
              </tr>
            ) : (
              paginatedUsers.map((user, index) => {
                const globalIndex = (currentPage - 1) * pageSize + index + 1;
                const profile = getProfile(user);
                const assignedWhNames = getUserWarehouseNames(user.id, warehouses);
                const assignedGroupNames = getUserGroupNames(user);
                const isSelected = selectedUserIds.includes(user.id);

                return (
                  <tr
                    key={user.id}
                    className={`group border-b border-slate-200 transition hover:bg-cyan-50/50 ${
                      isSelected ? 'bg-cyan-50/70' : profile.isLocked ? 'bg-red-50/30' : ''
                    }`}
                  >
                    {/* Row Checkbox */}
                    <td className="border-r border-slate-200 px-3 py-3 text-center">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {
                          setSelectedUserIds((prev) =>
                            prev.includes(user.id)
                              ? prev.filter((id) => id !== user.id)
                              : [...prev, user.id]
                          );
                        }}
                        className="h-4 w-4 rounded border-slate-300 accent-cyan-600 focus:ring-cyan-500 cursor-pointer"
                      />
                    </td>
                    <td className="border-r border-slate-200 px-3 py-3 text-center text-sm font-medium text-slate-700 whitespace-nowrap">
                      {globalIndex}
                    </td>
                    <td className="border-r border-slate-200 px-4 py-3 text-center text-sm font-extrabold text-slate-800 whitespace-nowrap">
                      {user.fullName || '-'}
                    </td>
                    <td className="border-r border-slate-200 px-4 py-3 text-center text-sm font-medium text-slate-700 whitespace-nowrap">
                      {user.email}
                    </td>
                    <td className="border-r border-slate-200 px-3 py-3 text-center text-sm font-medium text-slate-700 whitespace-nowrap">
                      {profile.phone}
                    </td>
                    {/* Nhóm quyền column displaying 1 item pill + (+n) badge */}
                    <td className="border-r border-slate-200 px-4 py-3 text-center text-sm font-medium text-slate-700">
                      {assignedGroupNames.length > 0 ? (
                        <div className="flex items-center justify-center gap-1.5">
                          <span className="inline-block max-w-[130px] truncate rounded-md bg-cyan-100 px-2 py-0.5 text-xs font-bold text-cyan-900 border border-cyan-200">
                            {assignedGroupNames[0]}
                          </span>
                          {assignedGroupNames.length > 1 && (
                            <span
                              className="inline-block rounded-md bg-slate-100 px-1.5 py-0.5 text-xs font-extrabold text-slate-600 border border-slate-200 cursor-help"
                              title={assignedGroupNames.join(', ')}
                            >
                              +{assignedGroupNames.length - 1}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-400 italic text-xs">Chưa phân nhóm</span>
                      )}
                    </td>
                    {/* Kho hoạt động column displaying 1 item pill + (+n) badge */}
                    <td className="border-r border-slate-200 px-4 py-3 text-center text-sm font-medium text-slate-700">
                      {assignedWhNames.length > 0 ? (
                        <div className="flex items-center justify-center gap-1.5">
                          <span className="inline-block max-w-[130px] truncate rounded-md bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-700 border border-slate-200">
                            {assignedWhNames[0]}
                          </span>
                          {assignedWhNames.length > 1 && (
                            <span
                              className="inline-block rounded-md bg-cyan-100 px-1.5 py-0.5 text-xs font-extrabold text-cyan-800 border border-cyan-200 cursor-help"
                              title={assignedWhNames.join(', ')}
                            >
                              +{assignedWhNames.length - 1}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-400 italic text-xs">Toàn bộ kho</span>
                      )}
                    </td>
                    <td className="border-r border-slate-200 px-3 py-3 text-center text-sm whitespace-nowrap">
                      {profile.isLocked ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-3 py-1 text-xs font-extrabold text-red-700 whitespace-nowrap">
                          <ShieldAlert className="h-3.5 w-3.5" /> Bị khóa
                        </span>
                      ) : profile.status === 'active' ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-xs font-extrabold text-emerald-700 whitespace-nowrap">
                          <CheckCircle className="h-3.5 w-3.5" /> Đang hoạt động
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs font-extrabold text-slate-600 whitespace-nowrap">
                          <XCircle className="h-3.5 w-3.5" /> Tạm dừng
                        </span>
                      )}
                    </td>
                    {/* THAO TÁC column with Xem icon + all uniform cyan buttons */}
                    <td className="sticky right-0 border-l border-slate-200 bg-white px-3 py-3 text-center align-middle shadow-[-4px_0_12px_rgba(0,0,0,0.03)] group-hover:bg-cyan-50/50">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          className="flex h-8 w-8 items-center justify-center rounded-xl border-2 border-cyan-500 bg-white text-cyan-600 shadow-sm transition hover:bg-cyan-50 hover:text-cyan-700 cursor-pointer"
                          title="Xem chi tiết nhân sự"
                          onClick={() => openUserModal('view', user)}
                        >
                          <Eye size={16} strokeWidth={2.5} />
                        </button>

                        <button
                          type="button"
                          className="flex h-8 w-8 items-center justify-center rounded-xl border-2 border-cyan-500 bg-white text-cyan-600 shadow-sm transition hover:bg-cyan-50 hover:text-cyan-700 cursor-pointer"
                          title="Sửa nhân sự"
                          onClick={() => openUserModal('edit', user)}
                        >
                          <Pencil size={16} strokeWidth={2.5} />
                        </button>

                        <button
                          type="button"
                          className="flex h-8 w-8 items-center justify-center rounded-xl border-2 border-cyan-500 bg-white text-cyan-600 shadow-sm transition hover:bg-cyan-50 hover:text-cyan-700 cursor-pointer"
                          title={profile.isLocked ? 'Mở khóa tài khoản' : 'Khóa tài khoản'}
                          onClick={() => openLockModal(user)}
                        >
                          {profile.isLocked ? <Unlock size={16} strokeWidth={2.5} /> : <Lock size={16} strokeWidth={2.5} />}
                        </button>

                        <button
                          type="button"
                          className="flex h-8 w-8 items-center justify-center rounded-xl border-2 border-cyan-500 bg-white text-cyan-600 shadow-sm transition hover:bg-cyan-50 hover:text-cyan-700 cursor-pointer"
                          title="Xóa nhân sự"
                          onClick={() => openUserModal('delete', user)}
                        >
                          <Trash2 size={16} strokeWidth={2.5} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        {/* Pagination Footer */}
        {totalItems > 0 && (
          <div className="flex flex-col items-center justify-between border-t border-slate-200 bg-slate-50/50 px-6 py-3 sm:flex-row">
            <div className="text-sm font-medium text-slate-600">
              Tổng số: <b className="font-extrabold text-slate-900">{totalItems}</b> nhân sự{' '}
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
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-50"
                >
                  «
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-50"
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
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-50"
                >
                  ›
                </button>
                <button
                  type="button"
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

      {/* Lock Account Modal */}
      {lockModalOpen && userToLock &&
        createPortal(
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs transition-all">
            <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden border-2 border-slate-200">
              <div className="flex items-center justify-between border-b-2 border-slate-100 px-6 py-4 bg-cyan-50/50">
                <div className="flex items-center gap-3">
                  <div className={`rounded-xl p-2.5 ${getProfile(userToLock).isLocked ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-600'}`}>
                    <ShieldAlert className="h-6 w-6" />
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-slate-900">
                      {getProfile(userToLock).isLocked ? 'Mở khóa tài khoản' : 'Khóa tài khoản nhân sự'}
                    </h2>
                    <p className="text-xs font-semibold text-slate-500">
                      {userToLock.fullName || userToLock.email}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setLockModalOpen(false);
                    setUserToLock(null);
                  }}
                  className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="p-6 space-y-4">
                {getProfile(userToLock).isLocked ? (
                  <div>
                    <p className="text-sm font-medium text-slate-700">
                      Tài khoản này hiện đang bị khóa với lý do:
                    </p>
                    <div className="mt-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">
                      "{getProfile(userToLock).lockReason || 'Không ghi rõ lý do'}"
                    </div>
                    <p className="mt-3 text-xs text-slate-500">
                      Bạn có chắc chắn muốn mở khóa tài khoản cho nhân sự này?
                    </p>
                  </div>
                ) : (
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">
                      Lý do khóa tài khoản <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      rows={3}
                      value={lockReasonInput}
                      onChange={(e) => setLockReasonInput(e.target.value)}
                      placeholder="Nhập chi tiết lý do khóa (Ví dụ: Vi phạm chính sách an toàn thông tin...)"
                      className="w-full rounded-xl border-2 border-slate-200 p-3 text-sm outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10 font-medium"
                      required
                    />
                  </div>
                )}

                <div className="mt-6 flex justify-end gap-3 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => {
                      setLockModalOpen(false);
                      setUserToLock(null);
                    }}
                    className="rounded-xl border-2 border-slate-200 px-5 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50 transition cursor-pointer"
                  >
                    Hủy
                  </button>
                  <button
                    type="button"
                    onClick={handleToggleLockAccount}
                    className={`rounded-xl px-5 py-2.5 text-sm font-bold text-white shadow-sm transition cursor-pointer ${
                      getProfile(userToLock).isLocked
                        ? 'bg-emerald-600 hover:bg-emerald-700'
                        : 'bg-red-600 hover:bg-red-700'
                    }`}
                  >
                    {getProfile(userToLock).isLocked ? 'Xác nhận Mở khóa' : 'Xác nhận Khóa tài khoản'}
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* CREATE / EDIT PERSONNEL MODAL */}
      {modalMode &&
        createPortal(
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs transition-all overflow-y-auto">
            <div className="w-full max-w-4xl rounded-2xl bg-white shadow-2xl overflow-hidden my-6 border-2 border-slate-200">
              <div className="flex items-center justify-between border-b-2 border-slate-100 px-6 py-4 bg-cyan-50/40">
                <div className="flex items-center gap-3">
                  <div className="rounded-xl bg-cyan-100 p-2.5 text-cyan-700">
                    {modalMode === 'create' ? <UserPlus className="h-6 w-6" /> : <Users className="h-6 w-6" />}
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-slate-800">{modalTitle}</h2>
                    <p className="text-xs font-semibold text-slate-500">
                      {modalMode === 'view' ? 'Thông tin chi tiết nhân sự' : 'Nhập thông tin nhân sự đầy đủ'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {modalMode === 'delete' ? (
                <div className="px-6 py-5">
                  <p className="text-base font-semibold text-slate-700">
                    Bạn có chắc muốn xóa nhân sự{' '}
                    <span className="font-black text-slate-950">{selectedUser?.fullName || selectedUser?.email}</span> không?
                  </p>
                  <p className="mt-2 text-sm font-medium text-slate-500">Hành động này không thể hoàn tác.</p>
                  <div className="mt-8 flex justify-end gap-3">
                    <button type="button" onClick={closeModal} className="rounded-xl border-2 border-slate-200 px-5 py-2.5 font-bold text-slate-600 hover:bg-slate-50 transition cursor-pointer">
                      Hủy
                    </button>
                    <button
                      type="button"
                      onClick={handleDeleteUser}
                      disabled={saving}
                      className="rounded-xl bg-red-600 px-5 py-2.5 font-bold text-white shadow-sm transition hover:bg-red-700 disabled:opacity-60 cursor-pointer"
                    >
                      {saving ? 'Đang xóa...' : 'Xóa nhân sự'}
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-xs font-bold uppercase text-slate-700">
                        Họ và tên <span className="text-red-500">*</span>
                      </label>
                      <input
                        value={form.fullName}
                        onChange={(event) => setForm((current) => ({ ...current, fullName: event.target.value }))}
                        readOnly={modalMode === 'view'}
                        className="h-11 w-full rounded-xl border-2 border-cyan-500 px-4 text-sm font-semibold outline-none transition focus:border-cyan-600 focus:ring-4 focus:ring-cyan-500/10 read-only:bg-slate-50 read-only:border-slate-200"
                        placeholder="Nguyễn Văn A"
                        required
                      />
                    </div>

                    <div>
                      <label className="mb-1.5 block text-xs font-bold uppercase text-slate-700">Giới tính</label>
                      <StyledSelect
                        value={form.gender}
                        options={genderOptions}
                        onChange={(value) => setForm((current) => ({ ...current, gender: value }))}
                        disabled={modalMode === 'view'}
                        className="h-11 w-full"
                      />
                    </div>

                    <div>
                      <label className="mb-1.5 block text-xs font-bold uppercase text-slate-700">
                        Email <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="email"
                        value={form.email}
                        onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                        readOnly={modalMode === 'view'}
                        className="h-11 w-full rounded-xl border-2 border-cyan-500 px-4 text-sm font-semibold outline-none transition focus:border-cyan-600 focus:ring-4 focus:ring-cyan-500/10 read-only:bg-slate-50 read-only:border-slate-200"
                        placeholder="admin@example.com"
                        required
                      />
                    </div>

                    <div>
                      <label className="mb-1.5 block text-xs font-bold uppercase text-slate-700">
                        {modalMode === 'create' ? 'Mật khẩu *' : 'Mật khẩu mới'}
                      </label>
                      <div className="relative">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={form.password}
                          onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
                          readOnly={modalMode === 'view'}
                          className="h-11 w-full rounded-xl border-2 border-cyan-500 px-4 pr-12 text-sm font-semibold outline-none transition focus:border-cyan-600 focus:ring-4 focus:ring-cyan-500/10 read-only:bg-slate-50 read-only:border-slate-200"
                          placeholder={modalMode === 'edit' ? 'Để trống nếu giữ nguyên' : 'Tối thiểu 6 ký tự'}
                          required={modalMode === 'create'}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((current) => !current)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1 text-slate-500 transition hover:bg-slate-100 hover:text-cyan-600 cursor-pointer"
                          title={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                        >
                          {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="mb-1.5 block text-xs font-bold uppercase text-slate-700">Số điện thoại</label>
                      <input
                        value={form.phone}
                        onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
                        readOnly={modalMode === 'view'}
                        className="h-11 w-full rounded-xl border-2 border-cyan-500 px-4 text-sm font-semibold outline-none transition focus:border-cyan-600 focus:ring-4 focus:ring-cyan-500/10 read-only:bg-slate-50 read-only:border-slate-200"
                        placeholder="0901234567"
                      />
                    </div>

                    <div>
                      <label className="mb-1.5 block text-xs font-bold uppercase text-slate-700">Trạng thái</label>
                      <StyledSelect
                        value={form.status}
                        options={statusOptions}
                        onChange={(value) =>
                          setForm((current) => ({ ...current, status: value as PersonnelProfile['status'] }))
                        }
                        disabled={modalMode === 'view'}
                        className="h-11 w-full"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-5 md:grid-cols-2 pt-2">
                    <div className="flex flex-col rounded-xl border-2 border-cyan-500 bg-white overflow-hidden shadow-xs">
                      <div className="bg-cyan-50 px-4 py-2.5 border-b border-cyan-200 flex items-center justify-between">
                        <span className="text-xs font-extrabold uppercase text-cyan-900">
                          Phân Nhóm quyền ({form.groupIds.length} nhóm đã chọn)
                        </span>
                      </div>

                      <div className="p-2 border-b border-slate-200 bg-slate-50/60">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-cyan-600" />
                          <input
                            type="text"
                            value={groupSearchInModal}
                            onChange={(e) => setGroupSearchInModal(e.target.value)}
                            placeholder="Tìm kiếm nhóm quyền..."
                            className="h-8 w-full rounded-lg border border-cyan-400 bg-white pl-8 pr-3 text-xs font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-cyan-500/20"
                          />
                        </div>
                      </div>

                      <div className="h-44 overflow-y-auto p-2 space-y-1">
                        {filteredGroupsInModal.length === 0 ? (
                          <p className="text-xs font-medium text-slate-400 p-2 text-center">
                            Không tìm thấy nhóm quyền nào.
                          </p>
                        ) : (
                          filteredGroupsInModal.map((group) => {
                            const isChecked = form.groupIds.includes(group.id);
                            return (
                              <label
                                key={group.id}
                                className={`flex items-start gap-2.5 rounded-lg p-2 transition cursor-pointer ${
                                  isChecked ? 'bg-cyan-50 border border-cyan-200' : 'hover:bg-slate-50'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => togglePermissionGroup(group.id)}
                                  disabled={modalMode === 'view'}
                                  className="mt-0.5 h-4 w-4 rounded border-slate-300 accent-cyan-600 focus:ring-cyan-600 disabled:opacity-60 cursor-pointer"
                                />
                                <div className="text-xs leading-snug">
                                  <span className="font-extrabold text-slate-800 block">{group.name}</span>
                                  {group.description && (
                                    <span className="text-slate-500 text-[11px] line-clamp-1">{group.description}</span>
                                  )}
                                </div>
                              </label>
                            );
                          })
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col rounded-xl border-2 border-cyan-500 bg-white overflow-hidden shadow-xs">
                      <div className="bg-cyan-50 px-4 py-2.5 border-b border-cyan-200 flex items-center justify-between">
                        <span className="text-xs font-extrabold uppercase text-cyan-900">
                          Kho hoạt động ({form.warehouseIds.length} kho đã chọn)
                        </span>
                      </div>

                      <div className="p-2 border-b border-slate-200 bg-slate-50/60">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-cyan-600" />
                          <input
                            type="text"
                            value={warehouseSearchInModal}
                            onChange={(e) => setWarehouseSearchInModal(e.target.value)}
                            placeholder="Tìm kiếm kho hàng..."
                            className="h-8 w-full rounded-lg border border-cyan-400 bg-white pl-8 pr-3 text-xs font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-cyan-500/20"
                          />
                        </div>
                      </div>

                      <div className="h-44 overflow-y-auto p-2 space-y-1">
                        {filteredWarehousesInModal.length === 0 ? (
                          <p className="text-xs font-medium text-slate-400 p-2 text-center">
                            Không tìm thấy kho hàng nào.
                          </p>
                        ) : (
                          filteredWarehousesInModal.map((warehouse) => {
                            const isChecked = form.warehouseIds.includes(warehouse.id);
                            return (
                              <label
                                key={warehouse.id}
                                className={`flex items-center gap-2.5 rounded-lg p-2 transition cursor-pointer ${
                                  isChecked ? 'bg-cyan-50 border border-cyan-200' : 'hover:bg-slate-50'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => toggleWarehouse(warehouse.id)}
                                  disabled={modalMode === 'view'}
                                  className="h-4 w-4 rounded border-slate-300 accent-cyan-600 focus:ring-cyan-600 disabled:opacity-60 cursor-pointer"
                                />
                                <span className="text-xs font-extrabold text-slate-800">
                                  {warehouse.name}
                                  <span className="ml-1.5 text-[10px] font-bold uppercase text-cyan-700 bg-cyan-100 px-1.5 py-0.5 rounded">
                                    {warehouse.code}
                                  </span>
                                </span>
                              </label>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={closeModal}
                      className="rounded-xl border-2 border-slate-300 px-5 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                    >
                      {modalMode === 'view' ? 'Đóng' : 'Hủy'}
                    </button>
                    {modalMode !== 'view' && (
                      <button
                        type="submit"
                        disabled={saving}
                        className="rounded-xl bg-cyan-600 px-6 py-2.5 text-sm font-bold text-white shadow-md transition hover:bg-cyan-700 disabled:opacity-60 cursor-pointer"
                      >
                        {saving ? 'Đang lưu...' : modalMode === 'create' ? 'Thêm nhân sự' : 'Lưu thay đổi'}
                      </button>
                    )}
                  </div>
                </form>
              )}
            </div>
          </div>,
          document.body
        )}

      {/* BULK ACTION MODAL: GÁN NHÓM QUYỀN */}
      {bulkModalMode === 'group' &&
        createPortal(
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
            <div className="w-full max-w-lg rounded-2xl border-2 border-slate-200 bg-white p-6 shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-lg font-extrabold text-slate-800">
                  Gán nhóm quyền hàng loạt ({selectedUserIds.length} nhân sự)
                </h3>
                <button type="button" onClick={() => setBulkModalMode(null)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 cursor-pointer">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="mt-4 space-y-2 max-h-60 overflow-y-auto p-1">
                {permissionGroups.map((group) => {
                  const isChecked = bulkGroupIds.includes(group.id);
                  return (
                    <label key={group.id} className={`flex items-center gap-3 rounded-xl p-3 border transition cursor-pointer ${isChecked ? 'bg-cyan-50 border-cyan-400' : 'border-slate-200 hover:bg-slate-50'}`}>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {
                          setBulkGroupIds((prev) =>
                            prev.includes(group.id) ? prev.filter((id) => id !== group.id) : [...prev, group.id]
                          );
                        }}
                        className="h-4 w-4 rounded border-slate-300 accent-cyan-600 focus:ring-cyan-500 cursor-pointer"
                      />
                      <div>
                        <span className="block text-sm font-bold text-slate-800">{group.name}</span>
                        {group.description && <span className="text-xs text-slate-500">{group.description}</span>}
                      </div>
                    </label>
                  );
                })}
              </div>

              <div className="mt-6 flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button type="button" onClick={() => setBulkModalMode(null)} className="rounded-xl border-2 border-slate-300 px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100 cursor-pointer">
                  Hủy
                </button>
                <button type="button" onClick={handleBatchAssignGroups} disabled={saving} className="rounded-xl bg-cyan-600 px-5 py-2 text-sm font-bold text-white shadow-md hover:bg-cyan-700 disabled:opacity-60 cursor-pointer">
                  {saving ? 'Đang lưu...' : 'Xác nhận gán nhóm'}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* BULK ACTION MODAL: PHÂN KHO */}
      {bulkModalMode === 'warehouse' &&
        createPortal(
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
            <div className="w-full max-w-lg rounded-2xl border-2 border-slate-200 bg-white p-6 shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-lg font-extrabold text-slate-800">
                  Phân kho hoạt động hàng loạt ({selectedUserIds.length} nhân sự)
                </h3>
                <button type="button" onClick={() => setBulkModalMode(null)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 cursor-pointer">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="mt-4 space-y-2 max-h-60 overflow-y-auto p-1">
                {warehouses.map((wh) => {
                  const isChecked = bulkWarehouseIds.includes(wh.id);
                  return (
                    <label key={wh.id} className={`flex items-center gap-3 rounded-xl p-3 border transition cursor-pointer ${isChecked ? 'bg-cyan-50 border-cyan-400' : 'border-slate-200 hover:bg-slate-50'}`}>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {
                          setBulkWarehouseIds((prev) =>
                            prev.includes(wh.id) ? prev.filter((id) => id !== wh.id) : [...prev, wh.id]
                          );
                        }}
                        className="h-4 w-4 rounded border-slate-300 accent-cyan-600 focus:ring-cyan-500 cursor-pointer"
                      />
                      <div>
                        <span className="block text-sm font-bold text-slate-800">
                          {wh.name} <span className="ml-1 text-xs text-cyan-700 bg-cyan-100 px-1.5 py-0.5 rounded font-extrabold">{wh.code}</span>
                        </span>
                      </div>
                    </label>
                  );
                })}
              </div>

              <div className="mt-6 flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button type="button" onClick={() => setBulkModalMode(null)} className="rounded-xl border-2 border-slate-300 px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100 cursor-pointer">
                  Hủy
                </button>
                <button type="button" onClick={handleBatchAssignWarehouses} disabled={saving} className="rounded-xl bg-cyan-600 px-5 py-2 text-sm font-bold text-white shadow-md hover:bg-cyan-700 disabled:opacity-60 cursor-pointer">
                  {saving ? 'Đang lưu...' : 'Xác nhận phân kho'}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* BULK ACTION MODAL: XÓA NHIỀU */}
      {bulkModalMode === 'delete' &&
        createPortal(
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
            <div className="w-full max-w-md rounded-2xl border-2 border-slate-200 bg-white p-6 shadow-2xl">
              <h3 className="text-lg font-extrabold text-slate-800">Xác nhận xóa hàng loạt</h3>
              <p className="mt-2 text-sm text-slate-600">
                Bạn có chắc chắn muốn xóa <b className="text-slate-900">{selectedUserIds.length} nhân sự</b> đã chọn không? Hành động này không thể hoàn tác.
              </p>
              <div className="mt-6 flex items-center justify-end gap-3">
                <button type="button" onClick={() => setBulkModalMode(null)} className="rounded-xl border-2 border-slate-300 px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100 cursor-pointer">
                  Hủy
                </button>
                <button type="button" onClick={handleBatchDelete} disabled={saving} className="rounded-xl bg-red-600 px-5 py-2 text-sm font-bold text-white shadow-md hover:bg-red-700 cursor-pointer">
                  {saving ? 'Đang xóa...' : `Xóa ${selectedUserIds.length} nhân sự`}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
