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
  Lock,
  Unlock,
  ShieldAlert,
  Clock,
} from 'lucide-react';
import Toast from '../../shared/components/Toast';
import {
  getStoredWarehouses,
  getUserWarehouseIds,
  getUserWarehouseNames,
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
  phone?: string;
  roles?: Role[];
};

type PersonnelForm = {
  email: string;
  fullName: string;
  gender: string;
  phone: string;
  status: 'active' | 'inactive';
  password: string;
  role: string;
  warehouseIds: string[];
};

type ModalMode = 'create' | 'view' | 'edit' | 'delete' | null;

type PersonnelProfile = {
  gender: string;
  phone: string;
  status: 'active' | 'inactive';
  isLocked?: boolean;
  lockReason?: string;
  lockedAt?: string;
  lastLogin?: string; // ISO String
};

type SelectOption = {
  value: string;
  label: string;
};

const API_BASE_URL = 'http://localhost:3000/api';
const PERSONNEL_PROFILE_KEY = 'smart-wms-personnel-profiles';
const PERSONNEL_USERS_KEY = 'smart-wms-personnel-users';
const DEFAULT_ROLES: Role[] = [
  { id: 'role-admin', name: 'admin' },
  { id: 'role-manager', name: 'manager' },
  { id: 'role-staff', name: 'staff' },
  { id: 'role-supplier', name: 'supplier' },
  { id: 'role-customer', name: 'customer' },
];

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
  };
}

function getPrimaryRole(user: PersonnelUser) {
  if (!Array.isArray(user.roles) || user.roles.length === 0) return 'staff';
  const normalizedRoles = user.roles
    .map((role) => String(role?.name || '').toLowerCase())
    .filter(Boolean);

  if (normalizedRoles.includes('admin')) return 'admin';
  if (normalizedRoles.includes('manager')) return 'manager';
  if (normalizedRoles.includes('staff')) return 'staff';
  if (normalizedRoles.includes('supplier')) return 'supplier';
  if (normalizedRoles.includes('customer')) return 'customer';
  return normalizedRoles[0] || 'staff';
}

function formatRole(role: string) {
  const roleMap: Record<string, string> = {
    admin: 'Quản trị viên',
    manager: 'Quản lý',
    staff: 'Nhân viên',
    supplier: 'Nhà cung cấp',
    customer: 'Khách hàng',
  };

  return roleMap[role] || role;
}

function isInternalPersonnel(user: PersonnelUser) {
  const role = getPrimaryRole(user);
  return role !== 'supplier' && role !== 'customer';
}

function getRoleByName(roleName: string) {
  return (
    DEFAULT_ROLES.find((role) => role.name === roleName) ||
    { id: `role-${roleName}`, name: roleName }
  );
}

function getCurrentUserFallback(): PersonnelUser {
  try {
    const storedUser = JSON.parse(localStorage.getItem('user') || '{}') as {
      email?: string;
      fullName?: string;
      role?: string;
    };

    return {
      id: storedUser.email || 'current-user',
      email: storedUser.email || 'admin@smartwms.vn',
      fullName: storedUser.fullName || 'Dương Ngọc Anh',
      roles: [getRoleByName(storedUser.role || 'admin')],
    };
  } catch {
    return {
      id: 'current-user',
      email: 'admin@smartwms.vn',
      fullName: 'Dương Ngọc Anh',
      roles: [getRoleByName('admin')],
    };
  }
}

function getStoredPersonnelUsers(): PersonnelUser[] {
  try {
    const rawData = localStorage.getItem(PERSONNEL_USERS_KEY);
    if (!rawData) return [];
    const parsedData = JSON.parse(rawData);
    return Array.isArray(parsedData) ? parsedData : [];
  } catch {
    return [];
  }
}

function saveStoredPersonnelUsers(users: PersonnelUser[]) {
  localStorage.setItem(PERSONNEL_USERS_KEY, JSON.stringify(users));
}

function getFallbackPersonnelUsers(): PersonnelUser[] {
  const storedUsers = getStoredPersonnelUsers();
  if (storedUsers.length > 0) return storedUsers;
  
  return [
    getCurrentUserFallback(),
    {
      id: 'user-2',
      email: 'manager.khoa@smartwms.vn',
      fullName: 'Trần Văn Khoa',
      phone: '0912345678',
      roles: [getRoleByName('manager')],
    },
    {
      id: 'user-3',
      email: 'nhanvien.huyen@smartwms.vn',
      fullName: 'Lê Thị Khánh Huyền',
      phone: '0987654321',
      roles: [getRoleByName('staff')],
    },
    {
      id: 'user-4',
      email: 'nhanvien.minh@smartwms.vn',
      fullName: 'Nguyễn Quang Minh',
      phone: '0933445566',
      roles: [getRoleByName('staff')],
    },
    {
      id: 'user-5',
      email: 'nhanvien.tuan@smartwms.vn',
      fullName: 'Phạm Anh Tuấn',
      phone: '0977889900',
      roles: [getRoleByName('staff')],
    },
  ];
}

function getStoredPersonnelProfiles(): Record<string, PersonnelProfile> {
  try {
    const rawData = localStorage.getItem(PERSONNEL_PROFILE_KEY);
    if (!rawData) return {};
    const parsedData = JSON.parse(rawData);
    return parsedData && typeof parsedData === 'object' ? parsedData : {};
  } catch {
    return {};
  }
}

function saveStoredPersonnelProfiles(profiles: Record<string, PersonnelProfile>) {
  localStorage.setItem(PERSONNEL_PROFILE_KEY, JSON.stringify(profiles));
}

function buildEmptyForm(defaultRole = 'staff'): PersonnelForm {
  return {
    email: '',
    fullName: '',
    gender: '',
    phone: '',
    status: 'active',
    password: '',
    role: defaultRole,
    warehouseIds: [],
  };
}

function buildUserForm(user: any, profile?: PersonnelProfile, warehouses: WarehouseRecord[] = getStoredWarehouses()): PersonnelForm {
  return {
    email: user.email,
    fullName: user.fullName || '',
    gender: profile?.gender || '',
    phone: profile?.phone || user.phone || '',
    status: user.status || profile?.status || 'active',
    password: '',
    role: getPrimaryRole(user),
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
        className="flex h-full min-h-[44px] w-full items-center justify-between rounded-xl border-2 border-cyan-500 bg-white px-4 text-left text-sm font-semibold text-slate-700 outline-none transition hover:border-cyan-600 focus:border-cyan-600 focus:ring-4 focus:ring-cyan-500/10 disabled:bg-slate-50 disabled:text-slate-500"
      >
        <span className="truncate">{selectedOption?.label}</span>
        <ChevronDown className={`h-4 w-4 text-cyan-600 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && !disabled && (
        <div className="absolute left-0 right-0 top-[calc(100%+0.35rem)] z-50 max-h-60 overflow-y-auto rounded-xl border-2 border-cyan-500 bg-white p-1 shadow-xl shadow-slate-900/10">
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
                  ? 'bg-cyan-600 text-white'
                  : 'text-slate-700 hover:bg-cyan-50 hover:text-cyan-700'
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

// Calculate account status based on lock state & last login time (inactive if > 7 days ago)
function calculateAccountStatus(user: PersonnelUser, profile?: PersonnelProfile) {
  const isLocked = !!profile?.isLocked;
  if (isLocked) {
    return {
      statusKey: 'locked',
      statusLabel: 'Tài khoản đã khóa',
      isLocked: true,
      lockReason: profile?.lockReason || 'Đã bị khóa tài khoản',
      lastLoginDisplay: profile?.lastLogin
        ? new Date(profile.lastLogin).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
        : 'Chưa từng',
    };
  }

  // Calculate days since last login
  let daysSinceLogin: number | null = null;
  let lastLoginDisplay = 'Chưa từng';

  if (profile?.lastLogin) {
    const lastLoginDate = new Date(profile.lastLogin);
    if (!isNaN(lastLoginDate.getTime())) {
      const diffMs = Date.now() - lastLoginDate.getTime();
      daysSinceLogin = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      lastLoginDisplay = lastLoginDate.toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    }
  }

  // Trạng thái không hoạt động là khi người ấy không đăng nhập tầm 1 tuần lễ (>= 7 ngày)
  const isInactiveByNoLogin = daysSinceLogin !== null ? daysSinceLogin >= 7 : false;
  const isExplicitInactive = profile?.status === 'inactive';

  if (isInactiveByNoLogin || isExplicitInactive) {
    return {
      statusKey: 'inactive',
      statusLabel: 'Không hoạt động',
      isLocked: false,
      lastLoginDisplay: lastLoginDisplay === 'Chưa từng' ? 'Chưa đăng nhập (>7 ngày)' : `${lastLoginDisplay} (${daysSinceLogin} ngày trước)`,
      daysSinceLogin,
    };
  }

  return {
    statusKey: 'active',
    statusLabel: 'Đang hoạt động',
    isLocked: false,
    lastLoginDisplay: lastLoginDisplay === 'Chưa từng' ? 'Mới đăng nhập' : lastLoginDisplay,
    daysSinceLogin,
  };
}

export default function PersonnelManagement() {
  const [users, setUsers] = React.useState<PersonnelUser[]>([]);
  const [roles, setRoles] = React.useState<Role[]>([]);
  const [search, setSearch] = React.useState('');
  const [roleFilter, setRoleFilter] = React.useState('all');
  const [statFilter, setStatFilter] = React.useState<'ALL' | 'LOCKED' | 'MANAGER' | 'STAFF'>('ALL');

  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState('');
  const [success, setSuccess] = React.useState('');
  
  const [modalMode, setModalMode] = React.useState<ModalMode>(null);
  const [selectedUser, setSelectedUser] = React.useState<PersonnelUser | null>(null);
  const [form, setForm] = React.useState<PersonnelForm>(buildEmptyForm());
  const [profiles, setProfiles] = React.useState<Record<string, PersonnelProfile>>(() => getStoredPersonnelProfiles());
  const [warehouses, setWarehouses] = React.useState(() => getStoredWarehouses());
  const [showPassword, setShowPassword] = React.useState(false);
  const importInputRef = React.useRef<HTMLInputElement | null>(null);

  // Lock Account Modal State
  const [lockModalOpen, setLockModalOpen] = React.useState(false);
  const [userToLock, setUserToLock] = React.useState<PersonnelUser | null>(null);
  const [lockReasonInput, setLockReasonInput] = React.useState('');

  // Pagination states
  const [pageSize, setPageSize] = React.useState(20);
  const [currentPage, setCurrentPage] = React.useState(1);

  // Seed default lastLogin dates if profiles are missing lastLogin
  const initializeProfilesDefaults = React.useCallback((personnelList: PersonnelUser[], currentProfiles: Record<string, PersonnelProfile>) => {
    let updated = false;
    const nextProfiles = { ...currentProfiles };
    
    // Provide realistic last login dates for demo if missing
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;

    personnelList.forEach((user, idx) => {
      const existing = nextProfiles[user.id] || { gender: 'Nam', phone: user.phone || '0900000000', status: 'active' };
      if (!existing.lastLogin) {
        updated = true;
        // Seed some users with <7 days login and some with >7 days login
        let mockDaysAgo = 1;
        if (idx === 3) mockDaysAgo = 10; // >7 days => Inactive
        if (idx === 4) mockDaysAgo = 14; // >7 days => Inactive
        
        nextProfiles[user.id] = {
          ...existing,
          lastLogin: new Date(now - mockDaysAgo * dayMs).toISOString(),
          gender: existing.gender || (idx % 2 === 0 ? 'Nam' : 'Nữ'),
          phone: existing.phone || `09012345${idx}9`,
        };
      }
    });

    if (updated) {
      setProfiles(nextProfiles);
      saveStoredPersonnelProfiles(nextProfiles);
    }
  }, []);

  const loadData = React.useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const [usersResponse, rolesResponse, warehousesResponse] = await Promise.all([
        fetch(`${API_BASE_URL}/users`, { headers: authHeaders() }),
        fetch(`${API_BASE_URL}/roles`, { headers: authHeaders() }),
        fetch(`${API_BASE_URL}/warehouses`, { headers: authHeaders() }),
      ]);

      if (
        [401, 403].includes(usersResponse.status) ||
        [401, 403].includes(rolesResponse.status) ||
        [401, 403].includes(warehousesResponse.status)
      ) {
        throw new Error('AUTH_FALLBACK');
      }

      if (!usersResponse.ok) {
        const data = await usersResponse.json().catch(() => null);
        throw new Error(data?.message || 'Không tải được danh sách nhân sự');
      }

      const userData = (await usersResponse.json()) as PersonnelUser[];
      const roleData = rolesResponse.ok ? ((await rolesResponse.json()) as Role[]) : [];
      const warehouseData = warehousesResponse.ok ? ((await warehousesResponse.json()) as WarehouseRecord[]) : [];
      const fallbackWarehouses = getStoredWarehouses();
      const nextWarehouses = (warehouseData.length > 0
        ? mergeStoredWarehouses(warehouseData, fallbackWarehouses)
        : fallbackWarehouses
      ).map(normalizeWarehouseRecord);
      const nextRoles = roleData.length > 0 ? roleData : DEFAULT_ROLES;
      const nextUsers = userData.length > 0 ? userData : getFallbackPersonnelUsers();
      
      setUsers(nextUsers);
      setRoles(nextRoles);
      setWarehouses(nextWarehouses);
      saveStoredWarehouses(nextWarehouses);

      const internalList = nextUsers.filter(isInternalPersonnel);
      initializeProfilesDefaults(internalList, getStoredPersonnelProfiles());

      saveStoredPersonnelUsers(nextUsers);
      setForm((current) => ({
        ...current,
        role: nextRoles.some((role) => role.name === current.role) ? current.role : nextRoles[0]?.name || 'staff',
      }));
    } catch {
      const fallbackUsers = getFallbackPersonnelUsers();
      const fallbackWarehouses = getStoredWarehouses();
      setUsers(fallbackUsers);
      setRoles(DEFAULT_ROLES);
      setWarehouses(fallbackWarehouses);
      
      const internalList = fallbackUsers.filter(isInternalPersonnel);
      initializeProfilesDefaults(internalList, getStoredPersonnelProfiles());

      setForm((current) => ({
        ...current,
        role: DEFAULT_ROLES.some((role) => role.name === current.role) ? current.role : 'staff',
      }));
    } finally {
      setLoading(false);
    }
  }, [initializeProfilesDefaults]);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  React.useEffect(() => {
    const syncWarehouses = () => setWarehouses(getStoredWarehouses());
    window.addEventListener('storage', syncWarehouses);
    return () => window.removeEventListener('storage', syncWarehouses);
  }, []);

  // Reset pagination when filters change
  React.useEffect(() => {
    setCurrentPage(1);
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

  // Compute stat counts for 4 overview buttons
  const totalAccountsCount = personnelUsers.length;
  const lockedAccountsCount = personnelUsers.filter((user) => getProfile(user).isLocked).length;
  const managersCount = personnelUsers.filter((user) => {
    const role = getPrimaryRole(user);
    return role === 'admin' || role === 'manager';
  }).length;
  const staffCount = personnelUsers.filter((user) => getPrimaryRole(user) === 'staff').length;

  // Filter users based on statFilter, roleFilter, search
  const filteredUsers = personnelUsers.filter((user) => {
    const role = getPrimaryRole(user);
    const profile = getProfile(user);
    const userWarehouses = getUserWarehouseNames(user.id, warehouses);
    const keyword = search.trim().toLowerCase();

    const matchesKeyword =
      !keyword ||
      user.email.toLowerCase().includes(keyword) ||
      (user.fullName || '').toLowerCase().includes(keyword) ||
      user.id.toLowerCase().includes(keyword) ||
      profile.phone.toLowerCase().includes(keyword) ||
      userWarehouses.some((warehouseName) => warehouseName.toLowerCase().includes(keyword));

    const matchesRole = roleFilter === 'all' || role === roleFilter;

    let matchesStat = true;
    if (statFilter === 'LOCKED') {
      matchesStat = !!profile.isLocked;
    } else if (statFilter === 'MANAGER') {
      matchesStat = role === 'admin' || role === 'manager';
    } else if (statFilter === 'STAFF') {
      matchesStat = role === 'staff';
    }

    return matchesKeyword && matchesRole && matchesStat;
  });

  // Calculate Pagination
  const totalItems = filteredUsers.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const paginatedUsers = filteredUsers.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const startIndex = totalItems > 0 ? (currentPage - 1) * pageSize + 1 : 0;
  const endIndex = Math.min(currentPage * pageSize, totalItems);

  const mergedRoles = [...roles];
  DEFAULT_ROLES.forEach((defaultRole) => {
    if (!mergedRoles.some((role) => role.name === defaultRole.name)) {
      mergedRoles.push(defaultRole);
    }
  });

  const internalRoleOptions = mergedRoles
    .filter((role) => role.name !== 'supplier' && role.name !== 'customer')
    .map((role) => ({ value: role.name, label: formatRole(role.name) }));

  const roleOptions = [
    { value: 'all', label: 'Tất cả vai trò' },
    ...internalRoleOptions,
  ];

  const genderOptions = [
    { value: 'Nam', label: 'Nam' },
    { value: 'Nữ', label: 'Nữ' },
    { value: 'Khác', label: 'Khác' },
  ];

  const statusOptions = [
    { value: 'active', label: 'Đang hoạt động' },
    { value: 'inactive', label: 'Không hoạt động' },
  ];

  const formRoleOptions = internalRoleOptions;
  const selectedWarehouseNames = warehouses
    .filter((warehouse) => form.warehouseIds.includes(warehouse.id))
    .map((warehouse) => warehouse.name);

  const getWarehouseAssignmentField = (role: string): 'managerIds' | 'staffIds' | undefined => {
    if (role === 'admin' || role === 'manager') return 'managerIds';
    if (role === 'staff') return 'staffIds';
    return undefined;
  };

  const applyWarehouses = (nextWarehouses: WarehouseRecord[]) => {
    const normalizedWarehouses = nextWarehouses.map(normalizeWarehouseRecord);
    setWarehouses(normalizedWarehouses);
    saveStoredWarehouses(normalizedWarehouses);
  };

  const persistWarehouseAssignments = async (nextWarehouses: WarehouseRecord[]) => {
    const currentById = new Map(warehouses.map((warehouse) => [warehouse.id, warehouse]));
    const changedWarehouses = nextWarehouses.filter((warehouse) => {
      const currentWarehouse = currentById.get(warehouse.id);
      return !currentWarehouse || !warehouseListEquals(currentWarehouse, warehouse);
    });

    if (changedWarehouses.length > 0) {
      await Promise.all(changedWarehouses.map((warehouse) => upsertWarehouseToApi(warehouse)));
    }

    applyWarehouses(nextWarehouses);
  };

  const syncWarehouseAssignments = async (userId: string, role: string, warehouseIds: string[]) => {
    const normalizedUserId = String(userId);
    const selectedWarehouseIds = new Set(warehouseIds);
    const assignmentField = getWarehouseAssignmentField(role);

    const nextWarehouses = warehouses.map((warehouse) => {
      const managerIds = warehouse.managerIds.filter((id) => id !== normalizedUserId);
      const staffIds = warehouse.staffIds.filter((id) => id !== normalizedUserId);

      if (!selectedWarehouseIds.has(warehouse.id) || !assignmentField) {
        return normalizeWarehouseRecord({ ...warehouse, managerIds, staffIds });
      }

      return normalizeWarehouseRecord({
        ...warehouse,
        managerIds: assignmentField === 'managerIds' ? [...managerIds, normalizedUserId] : managerIds,
        staffIds: assignmentField === 'staffIds' ? [...staffIds, normalizedUserId] : staffIds,
      });
    });

    await persistWarehouseAssignments(nextWarehouses);
  };

  const syncWarehouseAssignmentsLocally = (userId: string, role: string, warehouseIds: string[]) => {
    const normalizedUserId = String(userId);
    const selectedWarehouseIds = new Set(warehouseIds);
    const assignmentField = getWarehouseAssignmentField(role);

    const nextWarehouses = warehouses.map((warehouse) => {
      const managerIds = warehouse.managerIds.filter((id) => id !== normalizedUserId);
      const staffIds = warehouse.staffIds.filter((id) => id !== normalizedUserId);

      if (!selectedWarehouseIds.has(warehouse.id) || !assignmentField) {
        return normalizeWarehouseRecord({ ...warehouse, managerIds, staffIds });
      }

      return normalizeWarehouseRecord({
        ...warehouse,
        managerIds: assignmentField === 'managerIds' ? [...managerIds, normalizedUserId] : managerIds,
        staffIds: assignmentField === 'staffIds' ? [...staffIds, normalizedUserId] : staffIds,
      });
    });

    applyWarehouses(nextWarehouses);
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
    setForm(buildEmptyForm(roles[0]?.name || 'staff'));
    setModalMode('create');
  };

  const openUserModal = (mode: Exclude<ModalMode, 'create' | null>, user: PersonnelUser) => {
    setError('');
    setSuccess('');
    setSelectedUser(user);
    setShowPassword(false);
    setForm(buildUserForm(user, profiles[user.id], warehouses));
    setModalMode(mode);
  };

  // Lock Account Handling
  const openLockModal = (user: PersonnelUser) => {
    const profile = getProfile(user);
    setUserToLock(user);
    setLockReasonInput(profile.lockReason || '');
    setLockModalOpen(true);
  };

  const handleToggleLockAccount = () => {
    if (!userToLock) return;

    const currentProfile = getProfile(userToLock);
    const willBeLocked = !currentProfile.isLocked;

    if (willBeLocked && !lockReasonInput.trim()) {
      setError('Vui lòng nhập lý do khóa tài khoản.');
      return;
    }

    const updatedProfile: PersonnelProfile = {
      ...currentProfile,
      isLocked: willBeLocked,
      lockReason: willBeLocked ? lockReasonInput.trim() : '',
      lockedAt: willBeLocked ? new Date().toISOString() : undefined,
      status: willBeLocked ? 'inactive' : 'active',
    };

    const nextProfiles = {
      ...profiles,
      [userToLock.id]: updatedProfile,
    };

    setProfiles(nextProfiles);
    saveStoredPersonnelProfiles(nextProfiles);

    setSuccess(
      willBeLocked
        ? `Đã khóa tài khoản của ${userToLock.fullName || userToLock.email}. Lý do: ${lockReasonInput.trim()}`
        : `Đã mở khóa tài khoản cho ${userToLock.fullName || userToLock.email}.`
    );

    setLockModalOpen(false);
    setUserToLock(null);
    setLockReasonInput('');
  };

  const handleImportClick = () => {
    if (!importInputRef.current) return;
    importInputRef.current.value = '';
    importInputRef.current.click();
  };

  const downloadPersonnelImportTemplate = () => {
    const rows = [
      ['Email', 'Họ và Tên', 'Giới tính', 'Vai trò', 'Kho hoạt động', 'Số điện thoại', 'Trạng thái', 'Mật khẩu'],
      ['nhanvien@example.com', 'Nguyễn Văn A', 'Nam', 'staff', 'Kho A; Kho B', '0912345678', 'Đang hoạt động', 'Aa123456'],
    ];
    const csvContent = rows
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'mau-file-nhan-su.csv';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setSuccess('Đã tải mẫu file import nhân sự.');
    setError('');
  };

  const parseCsvLine = (line: string) => {
    const fields: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i += 1) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i += 1;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        fields.push(current);
        current = '';
      } else {
        current += char;
      }
    }

    fields.push(current);
    return fields.map((value) => value.trim());
  };

  const normalizeHeader = (value: string) => value.trim().toLowerCase().replace(/\s+/g, ' ');

  const parsePersonnelCsv = (csvText: string) => {
    const lines = csvText.split(/\r?\n/).filter((line) => line.trim() !== '');
    if (lines.length < 2) {
      throw new Error('Tệp CSV phải có ít nhất một dòng dữ liệu.');
    }

    const headerNames = parseCsvLine(lines[0]);
    const headerMap: Record<string, number> = {};

    headerNames.forEach((header, index) => {
      const normalized = normalizeHeader(header);
      if (['email', 'e-mail'].includes(normalized)) headerMap.email = index;
      if (['họ và tên', 'ho va ten', 'full name', 'fullname'].includes(normalized)) headerMap.fullName = index;
      if (['giới tính', 'gioi tinh', 'gender'].includes(normalized)) headerMap.gender = index;
      if (['vai trò', 'vai tro', 'role'].includes(normalized)) headerMap.role = index;
      if (['kho hoạt động', 'kho hoat dong', 'warehouse', 'warehouses'].includes(normalized)) headerMap.warehouses = index;
      if (['số điện thoại', 'so dien thoai', 'phone', 'mobile'].includes(normalized)) headerMap.phone = index;
      if (['trạng thái', 'trang thai', 'status'].includes(normalized)) headerMap.status = index;
      if (['mật khẩu', 'mat khau', 'password'].includes(normalized)) headerMap.password = index;
    });

    if (headerMap.email === undefined) {
      throw new Error('Thiếu cột Email trong file CSV.');
    }

    return lines.slice(1).map((line, rowIndex) => {
      const values = parseCsvLine(line);
      const email = (values[headerMap.email] || '').trim();
      if (!email) {
        throw new Error(`Dòng ${rowIndex + 2}: Thiếu email.`);
      }

      const roleName = ((values[headerMap.role] || '').trim() || 'staff').toLowerCase();
      const warehouseNames = (values[headerMap.warehouses] || '')
        .split(/;|,|，/)
        .map((name) => name.trim())
        .filter(Boolean);

      const warehouseIds = warehouseNames
        .map((name) => warehouses.find((warehouse) => warehouse.name === name)?.id)
        .filter((id): id is string => Boolean(id));

      const statusValue = (values[headerMap.status] || '').trim().toLowerCase();
      const status: 'active' | 'inactive' = ['active', 'đang hoạt động', 'dang hoat dong'].includes(statusValue)
        ? 'active'
        : 'inactive';

      return {
        user: {
          id: crypto.randomUUID(),
          email,
          fullName: (values[headerMap.fullName] || '').trim(),
          roles: [getRoleByName(roleName || 'staff')],
        },
        profile: {
          gender: (values[headerMap.gender] || '').trim() || 'Nam',
          phone: (values[headerMap.phone] || '').trim() || '0900000000',
          status,
          lastLogin: new Date().toISOString(),
        },
        warehouseIds,
        password: (values[headerMap.password] || '').trim(),
      };
    });
  };

  const handleImportFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setError('');
    setSuccess('');

    try {
      const text = await file.text();
      const parsedRows = parsePersonnelCsv(text);
      const existingByEmail = new Map(users.map((user) => [user.email.toLowerCase(), user]));

      const nextUsers = [...users];
      const nextProfiles = { ...profiles };

      for (const { user, profile, warehouseIds, password } of parsedRows) {
        const existing = existingByEmail.get(user.email.toLowerCase());
        const requestBody: Record<string, string> = {
          email: user.email,
          fullName: user.fullName || '',
          phone: profile.phone,
          role: user.roles?.[0]?.name || 'staff',
        };

        if (existing) {
          if (password) requestBody.password = password;
        } else {
          requestBody.password = password || 'Aa123456';
        }

        let savedUser = existing || user;

        try {
          const response = await fetch(
            existing ? `${API_BASE_URL}/users/${existing.id}` : `${API_BASE_URL}/users`,
            {
              method: existing ? 'PUT' : 'POST',
              headers: authHeaders(),
              body: JSON.stringify(requestBody),
            },
          );

          if (!response.ok) {
            const data = await response.json().catch(() => null);
            throw new Error(data?.message || 'Không lưu được nhân sự từ file CSV');
          }

          savedUser = (await response.json()) as PersonnelUser;
        } catch {
          savedUser = existing
            ? { ...existing, fullName: user.fullName, roles: user.roles }
            : user;
        }

        if (!existing) {
          nextUsers.push(savedUser);
        } else {
          const index = nextUsers.findIndex((item) => item.id === existing.id);
          if (index >= 0) nextUsers[index] = savedUser;
        }

        nextProfiles[savedUser.id] = profile;
        await syncWarehouseAssignments(savedUser.id, savedUser.roles?.[0]?.name || 'staff', warehouseIds);
      }

      setUsers(nextUsers);
      saveStoredPersonnelUsers(nextUsers);
      setProfiles(nextProfiles);
      saveStoredPersonnelProfiles(nextProfiles);
      setSuccess(`Đã import ${parsedRows.length} nhân sự từ file CSV.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không đọc được file import nhân sự.');
    } finally {
      if (importInputRef.current) {
        importInputRef.current.value = '';
      }
    }
  };

  const handleExportClick = () => {
    const rows = filteredUsers.map((user, index) => {
      const profile = getProfile(user);
      const accountStatus = calculateAccountStatus(user, profile);

      return [
        index + 1,
        user.fullName || '',
        profile.gender,
        user.email,
        formatRole(getPrimaryRole(user)),
        getUserWarehouseNames(user.id, warehouses).join('; '),
        profile.phone,
        accountStatus.lastLoginDisplay,
        accountStatus.statusLabel,
        profile.isLocked ? profile.lockReason : '',
      ];
    });
    const csvContent = [
      ['STT', 'Họ và Tên', 'Giới tính', 'Email', 'Vai trò', 'Kho hoạt động', 'Số điện thoại', 'Lần đăng nhập cuối', 'Trạng thái', 'Lý do khóa'],
      ...rows,
    ]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'danh-sach-nhan-su.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const saveProfile = (userId: string) => {
    const existing = profiles[userId] || {};
    const nextProfiles = {
      ...profiles,
      [userId]: {
        ...existing,
        gender: form.gender,
        phone: form.phone,
        status: form.status,
        lastLogin: existing.lastLogin || new Date().toISOString(),
      },
    };
    setProfiles(nextProfiles);
    saveStoredPersonnelProfiles(nextProfiles);
  };

  const savePersonnelLocally = async (isEdit: boolean) => {
    const savedUserId = isEdit && selectedUser ? selectedUser.id : crypto.randomUUID();
    const nextUser: PersonnelUser = {
      id: savedUserId,
      email: form.email,
      fullName: form.fullName,
      phone: form.phone,
      roles: [getRoleByName(form.role)],
    };
    const nextUsers = isEdit
      ? users.map((user) => (user.id === savedUserId ? nextUser : user))
      : [nextUser, ...users];

    setUsers(nextUsers);
    saveStoredPersonnelUsers(nextUsers);
    saveProfile(savedUserId);
    syncWarehouseAssignmentsLocally(savedUserId, form.role, form.warehouseIds);
    setSuccess(isEdit ? 'Đã cập nhật nhân sự.' : 'Đã tạo nhân sự mới.');
    closeModal();
  };

  const deletePersonnelLocally = async (userId: string) => {
    const nextUsers = users.filter((user) => user.id !== userId);
    const nextProfiles = { ...profiles };
    delete nextProfiles[userId];

    setUsers(nextUsers);
    saveStoredPersonnelUsers(nextUsers);
    setProfiles(nextProfiles);
    saveStoredPersonnelProfiles(nextProfiles);
    setSuccess('Đã xóa nhân sự.');
    closeModal();
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
        role: form.role,
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
        if ([401, 403].includes(response.status) || /unauthorized/i.test(data?.message || '')) {
          await savePersonnelLocally(isEdit);
          return;
        }
        throw new Error(data?.message || (isEdit ? 'Không cập nhật được nhân sự' : 'Không tạo được nhân sự'));
      }

      const savedUser = (await response.json()) as PersonnelUser;
      const savedUserId = isEdit && selectedUser ? selectedUser.id : savedUser.id;
      saveProfile(savedUserId);
      await syncWarehouseAssignments(savedUserId, form.role, form.warehouseIds);

      setSuccess(isEdit ? 'Đã cập nhật nhân sự.' : 'Đã tạo nhân sự mới.');
      closeModal();
      await loadData();
    } catch (err) {
      if (err instanceof TypeError) {
        await savePersonnelLocally(modalMode === 'edit');
        return;
      }
      setError(err instanceof Error ? err.message : 'Không lưu được nhân sự');
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
        if ([401, 403].includes(response.status) || /unauthorized/i.test(data?.message || '')) {
          await deletePersonnelLocally(selectedUser.id);
          return;
        }
        throw new Error(data?.message || 'Không xóa được nhân sự');
      }

      setSuccess('Đã xóa nhân sự.');
      const nextProfiles = { ...profiles };
      delete nextProfiles[selectedUser.id];
      setProfiles(nextProfiles);
      saveStoredPersonnelProfiles(nextProfiles);
      closeModal();
      await loadData();
    } catch (err) {
      if (err instanceof TypeError) {
        await deletePersonnelLocally(selectedUser.id);
        return;
      }
      setError(err instanceof Error ? err.message : 'Không xóa được nhân sự');
    } finally {
      setSaving(false);
    }
  }

  const modalTitle =
    modalMode === 'create'
      ? 'Thêm nhân sự mới'
      : modalMode === 'view'
        ? 'Chi tiết nhân sự'
        : modalMode === 'edit'
          ? 'Sửa thông tin nhân sự'
          : 'Xóa nhân sự';

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

      {/* Header design aligned with products/main */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2.5 rounded-xl border-2 border-cyan-500 bg-cyan-600 px-4 py-2 text-white shadow-md">
            <Users className="h-5 w-5 text-cyan-100" />
            <h1 className="text-lg font-bold tracking-tight text-white">Quản lý nhân sự</h1>
          </div>
        </div>

        <div className="flex flex-wrap gap-2.5">
          <button
            type="button"
            onClick={handleImportClick}
            className="inline-flex items-center gap-2 rounded-xl border-2 border-cyan-500 bg-white px-4 py-2 text-sm font-bold text-cyan-600 shadow-sm transition hover:bg-cyan-50 hover:text-cyan-700"
          >
            <Upload className="h-4 w-4" />
            Import
          </button>
          <button
            type="button"
            onClick={downloadPersonnelImportTemplate}
            className="inline-flex items-center gap-2 rounded-xl border-2 border-cyan-500 bg-white px-4 py-2 text-sm font-bold text-cyan-600 shadow-sm transition hover:bg-cyan-50 hover:text-cyan-700"
          >
            <UserPlus className="h-4 w-4" />
            Tải mẫu
          </button>
          <button
            type="button"
            onClick={handleExportClick}
            className="inline-flex items-center gap-2 rounded-xl border-2 border-cyan-500 bg-white px-4 py-2 text-sm font-bold text-cyan-600 shadow-sm transition hover:bg-cyan-50 hover:text-cyan-700"
          >
            <Download className="h-4 w-4" />
            Export
          </button>
          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-cyan-700"
          >
            <PlusCircle className="h-4 w-4" />
            Thêm mới
          </button>
        </div>
        <input
          ref={importInputRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={handleImportFileChange}
        />
      </div>

      {/* 4 Button Tổng quan overview matching products/main design */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <button
          type="button"
          onClick={() => setStatFilter('ALL')}
          className={`flex h-[72px] items-center justify-center rounded-xl border-2 border-cyan-500 px-4 shadow-sm transition text-center ${
            statFilter === 'ALL'
              ? 'bg-cyan-600 text-white'
              : 'bg-white text-cyan-700 hover:bg-cyan-50'
          }`}
        >
          <p className="text-base font-black uppercase">
            {totalAccountsCount} TỔNG TÀI KHOẢN
          </p>
        </button>

        <button
          type="button"
          onClick={() => setStatFilter('LOCKED')}
          className={`flex h-[72px] items-center justify-center rounded-xl border-2 border-cyan-500 px-4 shadow-sm transition text-center ${
            statFilter === 'LOCKED'
              ? 'bg-cyan-600 text-white'
              : 'bg-white text-cyan-700 hover:bg-cyan-50'
          }`}
        >
          <p className="text-base font-black uppercase">
            {lockedAccountsCount} TÀI KHOẢN BỊ KHÓA
          </p>
        </button>

        <button
          type="button"
          onClick={() => setStatFilter('MANAGER')}
          className={`flex h-[72px] items-center justify-center rounded-xl border-2 border-cyan-500 px-4 shadow-sm transition text-center ${
            statFilter === 'MANAGER'
              ? 'bg-cyan-600 text-white'
              : 'bg-white text-cyan-700 hover:bg-cyan-50'
          }`}
        >
          <p className="text-base font-black uppercase">
            {managersCount} QUẢN LÝ
          </p>
        </button>

        <button
          type="button"
          onClick={() => setStatFilter('STAFF')}
          className={`flex h-[72px] items-center justify-center rounded-xl border-2 border-cyan-500 px-4 shadow-sm transition text-center ${
            statFilter === 'STAFF'
              ? 'bg-cyan-600 text-white'
              : 'bg-white text-cyan-700 hover:bg-cyan-50'
          }`}
        >
          <p className="text-base font-black uppercase">
            {staffCount} NHÂN VIÊN
          </p>
        </button>
      </div>

      {/* Search & Filter bar styled matching products/main */}
      <div className="mt-6 flex flex-col gap-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-cyan-500" />
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="h-11 w-full rounded-xl border-2 border-cyan-500 bg-white pl-11 pr-4 text-base outline-none transition focus:border-cyan-600 focus:ring-4 focus:ring-cyan-500/10"
              placeholder="Tìm kiếm nhân sự theo tên, email, SĐT, kho..."
            />
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <StyledSelect
              value={roleFilter}
              options={roleOptions}
              onChange={setRoleFilter}
              className="h-11 min-w-[200px]"
            />
            {statFilter !== 'ALL' && (
              <button
                type="button"
                onClick={() => setStatFilter('ALL')}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border-2 border-cyan-600 bg-cyan-50 px-4 text-sm font-bold text-cyan-700 transition hover:bg-cyan-100"
              >
                Hiển thị tất cả
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Table Section with Cyan headers matching products/main */}
      <div className="mt-5 overflow-hidden rounded-xl border-2 border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1250px] border-collapse bg-white">
            <thead className="bg-cyan-50">
              <tr className="border-b-2 border-slate-200">
                <th className="w-10 border-x border-slate-200 px-3 py-4 text-center">
                  <input type="checkbox" className="h-4 w-4 rounded border-slate-300 accent-cyan-600" />
                </th>
                <th className="w-14 border-x border-slate-200 px-3 py-4 text-center text-sm font-extrabold uppercase text-slate-800">
                  STT
                </th>
                <th className="border-x border-slate-200 px-3 py-4 text-center text-sm font-extrabold uppercase text-slate-800 min-w-[160px]">
                  Họ và Tên
                </th>
                <th className="w-24 border-x border-slate-200 px-3 py-4 text-center text-sm font-extrabold uppercase text-slate-800">
                  Giới tính
                </th>
                <th className="border-x border-slate-200 px-3 py-4 text-center text-sm font-extrabold uppercase text-slate-800 min-w-[180px]">
                  Email
                </th>
                <th className="border-x border-slate-200 px-3 py-4 text-center text-sm font-extrabold uppercase text-slate-800">
                  Vai trò
                </th>
                <th className="border-x border-slate-200 px-3 py-4 text-center text-sm font-extrabold uppercase text-slate-800 min-w-[150px]">
                  Kho hoạt động
                </th>
                <th className="border-x border-slate-200 px-3 py-4 text-center text-sm font-extrabold uppercase text-slate-800">
                  Số điện thoại
                </th>
                <th className="border-x border-slate-200 px-3 py-4 text-center text-sm font-extrabold uppercase text-slate-800 min-w-[160px]">
                  Đăng nhập cuối
                </th>
                <th className="border-x border-slate-200 px-3 py-4 text-center text-sm font-extrabold uppercase text-slate-800 min-w-[150px]">
                  Trạng thái
                </th>
                <th className="sticky right-0 border-l border-slate-200 bg-cyan-50 px-3 py-4 text-center text-sm font-extrabold uppercase text-slate-800 shadow-[-4px_0_12px_rgba(0,0,0,0.03)] min-w-[210px]">
                  THAO TÁC
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={11} className="px-6 py-12 text-center text-sm font-semibold text-slate-500">
                    Đang tải dữ liệu nhân sự...
                  </td>
                </tr>
              ) : paginatedUsers.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-6 py-12 text-center text-sm font-semibold text-slate-500">
                    Không tìm thấy nhân sự phù hợp.
                  </td>
                </tr>
              ) : (
                paginatedUsers.map((user, index) => {
                  const profile = getProfile(user);
                  const userWarehouses = getUserWarehouseNames(user.id, warehouses);
                  const accountStatus = calculateAccountStatus(user, profile);

                  return (
                    <tr key={user.id} className="group border-b border-slate-200 transition hover:bg-cyan-50/50">
                      <td className="border-x border-slate-200 px-3 py-3.5 text-center">
                        <input type="checkbox" className="h-4 w-4 rounded border-slate-300 accent-cyan-600" />
                      </td>

                      <td className="border-x border-slate-200 px-3 py-3.5 text-center text-sm font-semibold text-slate-700">
                        {startIndex + index}
                      </td>

                      <td className="border-x border-slate-200 px-3 py-3.5 text-center text-sm font-bold text-slate-900">
                        {user.fullName || 'Chưa cập nhật'}
                      </td>

                      <td className="border-x border-slate-200 px-3 py-3.5 text-center text-sm text-slate-700">
                        {profile.gender}
                      </td>

                      <td className="border-x border-slate-200 px-3 py-3.5 text-center text-sm font-medium text-slate-700">
                        {user.email}
                      </td>

                      <td className="border-x border-slate-200 px-3 py-3.5 text-center text-sm font-bold text-slate-800">
                        {formatRole(getPrimaryRole(user))}
                      </td>

                      <td className="max-w-[220px] truncate border-x border-slate-200 px-3 py-3.5 text-center text-sm text-slate-700">
                        {userWarehouses.length > 0 ? userWarehouses.join(', ') : '-'}
                      </td>

                      <td className="border-x border-slate-200 px-3 py-3.5 text-center text-sm font-medium text-slate-700">
                        {profile.phone}
                      </td>

                      <td className="border-x border-slate-200 px-3 py-3.5 text-center text-xs font-semibold text-slate-600">
                        <span className="inline-flex items-center gap-1">
                          <Clock size={13} className="text-slate-400" />
                          {accountStatus.lastLoginDisplay}
                        </span>
                      </td>

                      <td className="border-x border-slate-200 px-3 py-3.5 text-center align-middle">
                        {accountStatus.isLocked ? (
                          <span
                            className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-3 py-1 text-xs font-extrabold text-red-700"
                            title={`Lý do: ${profile.lockReason || 'Đã bị khóa'}`}
                          >
                            <Lock size={12} />
                            Đã khóa
                          </span>
                        ) : accountStatus.statusKey === 'inactive' ? (
                          <span
                            className="inline-flex rounded-lg border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-extrabold text-amber-700"
                            title="Tài khoản không hoạt động do chưa đăng nhập tầm 1 tuần"
                          >
                            Không hoạt động
                          </span>
                        ) : (
                          <span className="inline-flex rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-extrabold text-emerald-700">
                            Đang hoạt động
                          </span>
                        )}
                      </td>

                      {/* Icon buttons in action column styled IDENTICALLY */}
                      <td className="sticky right-0 border-l border-slate-200 bg-white px-3 py-3.5 text-center align-middle shadow-[-4px_0_12px_rgba(0,0,0,0.03)] group-hover:bg-cyan-50/50">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            type="button"
                            className="flex h-9 w-9 items-center justify-center rounded-xl border-2 border-cyan-500 bg-white text-cyan-600 shadow-sm transition hover:bg-cyan-50 hover:text-cyan-700"
                            title="Xem chi tiết"
                            onClick={() => openUserModal('view', user)}
                          >
                            <Eye size={18} strokeWidth={2.5} />
                          </button>

                          <button
                            type="button"
                            className="flex h-9 w-9 items-center justify-center rounded-xl border-2 border-cyan-500 bg-white text-cyan-600 shadow-sm transition hover:bg-cyan-50 hover:text-cyan-700"
                            title="Sửa thông tin"
                            onClick={() => openUserModal('edit', user)}
                          >
                            <Pencil size={18} strokeWidth={2.5} />
                          </button>

                          <button
                            type="button"
                            className={`flex h-9 w-9 items-center justify-center rounded-xl border-2 ${
                              profile.isLocked
                                ? 'border-amber-500 text-amber-600 hover:bg-amber-50'
                                : 'border-cyan-500 text-cyan-600 hover:bg-cyan-50 hover:text-cyan-700'
                            } bg-white shadow-sm transition`}
                            title={profile.isLocked ? 'Mở khóa tài khoản' : 'Khóa tài khoản'}
                            onClick={() => openLockModal(user)}
                          >
                            {profile.isLocked ? (
                              <Unlock size={18} strokeWidth={2.5} />
                            ) : (
                              <Lock size={18} strokeWidth={2.5} />
                            )}
                          </button>

                          <button
                            type="button"
                            className="flex h-9 w-9 items-center justify-center rounded-xl border-2 border-cyan-500 bg-white text-cyan-600 shadow-sm transition hover:bg-cyan-50 hover:text-cyan-700"
                            title="Xóa nhân sự"
                            onClick={() => openUserModal('delete', user)}
                          >
                            <Trash2 size={18} strokeWidth={2.5} />
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

        {/* Pagination Section matching products/main */}
        {!loading && totalItems > 0 && (
          <div className="flex flex-col items-center justify-between border-t border-slate-200 bg-slate-50/50 px-6 py-3 sm:flex-row">
            <div className="text-sm font-semibold text-slate-600">
              Tổng số: <b>{totalItems}</b> <span className="ml-2">Hiển thị {startIndex} - {endIndex}</span>
            </div>
            <div className="mt-4 flex items-center gap-2 sm:mt-0">
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="h-8 rounded-lg border border-slate-300 bg-white px-2 text-sm font-bold text-slate-700 outline-none transition focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
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
                <button className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-600 text-sm font-bold text-white shadow-sm">
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

      {/* Lock Account Modal with Reason */}
      {lockModalOpen && userToLock && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm transition-all">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden">
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
                className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
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
                    placeholder="Nhập chi tiết lý do khóa (Ví dụ: Vi phạm chính sách an toàn thông tin, nghỉ việc tạm thời...)"
                    className="w-full rounded-xl border-2 border-slate-200 p-3 text-sm outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10 font-medium"
                    required
                  />
                  <p className="mt-2 text-xs font-medium text-slate-500">
                    Trạng thái tài khoản sẽ chuyển sang 'Tài khoản đã khóa' và không thể đăng nhập hệ thống.
                  </p>
                </div>
              )}

              <div className="mt-6 flex justify-end gap-3 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setLockModalOpen(false);
                    setUserToLock(null);
                  }}
                  className="rounded-xl border-2 border-slate-200 px-5 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50 transition"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={handleToggleLockAccount}
                  className={`rounded-xl px-5 py-2.5 text-sm font-bold text-white shadow-sm transition ${
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
        </div>
      )}

      {/* View / Create / Edit / Delete Modals */}
      {modalMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm transition-all">
          <div className="w-full max-w-3xl rounded-2xl bg-white shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between border-b-2 border-slate-100 px-6 py-4 bg-cyan-50/40">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-cyan-100 p-2 text-cyan-700">
                  {modalMode === 'create' ? <UserPlus className="h-6 w-6" /> : <Users className="h-6 w-6" />}
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-800">{modalTitle}</h2>
                  <p className="text-sm font-medium text-slate-500">
                    {modalMode === 'view' ? 'Thông tin chi tiết nhân sự' : 'Nhập thông tin nhân sự đầy đủ'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
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
                  <button type="button" onClick={closeModal} className="rounded-xl border-2 border-slate-200 px-5 py-2.5 font-bold text-slate-600 hover:bg-slate-50 transition">
                    Hủy
                  </button>
                  <button
                    type="button"
                    onClick={handleDeleteUser}
                    disabled={saving}
                    className="rounded-xl bg-red-600 px-5 py-2.5 font-bold text-white shadow-sm transition hover:bg-red-700 disabled:opacity-60"
                  >
                    {saving ? 'Đang xóa...' : 'Xóa nhân sự'}
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
                      className="h-11 w-full rounded-xl border-2 border-cyan-500 px-4 text-sm font-semibold outline-none transition focus:border-cyan-600 focus:ring-4 focus:ring-cyan-500/10 read-only:bg-slate-50 read-only:border-slate-200 read-only:focus:ring-0"
                      placeholder="Nguyễn Văn A"
                      required
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-bold text-slate-700">Giới tính</label>
                    <StyledSelect
                      value={form.gender}
                      options={genderOptions}
                      onChange={(value) => setForm((current) => ({ ...current, gender: value }))}
                      disabled={modalMode === 'view'}
                      className="h-11 w-full"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-bold text-slate-700">Email</label>
                    <input
                      type="email"
                      value={form.email}
                      onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                      readOnly={modalMode === 'view'}
                      className="h-11 w-full rounded-xl border-2 border-cyan-500 px-4 text-sm font-semibold outline-none transition focus:border-cyan-600 focus:ring-4 focus:ring-cyan-500/10 read-only:bg-slate-50 read-only:border-slate-200 read-only:focus:ring-0"
                      placeholder="staff@example.com"
                      required
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-bold text-slate-700">Vai trò</label>
                    <StyledSelect
                      value={form.role}
                      options={formRoleOptions}
                      onChange={(value) => setForm((current) => ({ ...current, role: value }))}
                      disabled={modalMode === 'view'}
                      className="h-11 w-full"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-bold text-slate-700">Số điện thoại</label>
                    <input
                      value={form.phone}
                      onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
                      readOnly={modalMode === 'view'}
                      className="h-11 w-full rounded-xl border-2 border-cyan-500 px-4 text-sm font-semibold outline-none transition focus:border-cyan-600 focus:ring-4 focus:ring-cyan-500/10 read-only:bg-slate-50 read-only:border-slate-200 read-only:focus:ring-0"
                      placeholder="0901234567"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-bold text-slate-700">Trạng thái</label>
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
                  <div>
                    <label className="mb-2 block text-sm font-bold text-slate-700">
                      {modalMode === 'create' ? 'Mật khẩu' : 'Mật khẩu mới'}
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={form.password}
                        onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
                        readOnly={modalMode === 'view'}
                        className="h-11 w-full rounded-xl border-2 border-cyan-500 px-4 pr-12 text-sm font-semibold outline-none transition focus:border-cyan-600 focus:ring-4 focus:ring-cyan-500/10 read-only:bg-slate-50 read-only:border-slate-200 read-only:focus:ring-0"
                        placeholder={modalMode === 'edit' ? 'Để trống nếu không đổi' : 'Tối thiểu 6 ký tự'}
                        required={modalMode === 'create'}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((current) => !current)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1 text-slate-500 transition hover:bg-slate-100 hover:text-cyan-600"
                        title={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                      >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>

                  <div className="md:col-span-2">
                    <label className="mb-2 block text-sm font-bold text-slate-700">Kho hoạt động</label>
                    <div className="rounded-xl border-2 border-cyan-500 bg-white p-4">
                      <div className="mb-3 rounded-lg bg-cyan-50 px-3 py-2 text-sm font-bold text-cyan-800">
                        {selectedWarehouseNames.length > 0 ? selectedWarehouseNames.join(', ') : 'Chưa chọn kho'}
                      </div>
                      <div className="max-h-44 space-y-2 overflow-y-auto pr-1">
                        {warehouses.length === 0 ? (
                          <p className="text-sm font-medium text-slate-500">
                            Chưa có kho hàng. Tạo kho tại màn Kho hàng trước.
                          </p>
                        ) : (
                          warehouses.map((warehouse) => (
                            <label
                              key={warehouse.id}
                              className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-cyan-50"
                            >
                              <input
                                type="checkbox"
                                checked={form.warehouseIds.includes(warehouse.id)}
                                onChange={() => toggleWarehouse(warehouse.id)}
                                disabled={modalMode === 'view'}
                                className="h-4 w-4 rounded border-slate-300 accent-cyan-600 focus:ring-cyan-600 disabled:opacity-60"
                              />
                              <span className="text-sm font-semibold text-slate-700">
                                {warehouse.name}
                                <span className="ml-2 text-xs font-bold uppercase text-slate-400">{warehouse.code}</span>
                              </span>
                            </label>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-8 flex justify-end gap-3">
                  <button type="button" onClick={closeModal} className="rounded-xl border-2 border-slate-200 px-5 py-2.5 font-bold text-slate-600 hover:bg-slate-50 transition">
                    {modalMode === 'view' ? 'Đóng' : 'Hủy'}
                  </button>
                  {modalMode !== 'view' && (
                    <button
                      type="submit"
                      disabled={saving}
                      className="rounded-xl bg-cyan-600 px-6 py-2.5 font-bold text-white shadow-sm transition hover:bg-cyan-700 disabled:opacity-60"
                    >
                      {saving ? 'Đang lưu...' : modalMode === 'create' ? 'Thêm nhân sự' : 'Lưu thay đổi'}
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
