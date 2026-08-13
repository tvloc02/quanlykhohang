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
  ShoppingBag,
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
  createdAt?: string;
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

type CustomerProfile = {
  address?: string;
  phone?: string;
  status?: 'active' | 'inactive';
  isLocked?: boolean;
  lockReason?: string;
  lockedAt?: string;
  lastLogin?: string; // ISO String
  totalOrders?: number;
};

type SelectOption = {
  value: string;
  label: string;
};

const API_BASE_URL = 'http://localhost:3000/api';
const CUSTOMER_PROFILE_KEY = 'smart-wms-customer-profiles';

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

function getStoredCustomerProfiles(): Record<string, CustomerProfile> {
  try {
    const rawData = localStorage.getItem(CUSTOMER_PROFILE_KEY);
    if (!rawData) return {};
    const parsedData = JSON.parse(rawData);
    return parsedData && typeof parsedData === 'object' ? parsedData : {};
  } catch {
    return {};
  }
}

function saveStoredCustomerProfiles(profiles: Record<string, CustomerProfile>) {
  localStorage.setItem(CUSTOMER_PROFILE_KEY, JSON.stringify(profiles));
}

function getFallbackCustomers(): CustomerUser[] {
  return [];
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

// Calculate Customer Account Status based on Lock & 30 days inactivity rule
function calculateCustomerAccountStatus(user: CustomerUser, profile?: CustomerProfile) {
  const isLocked = !!profile?.isLocked;
  if (isLocked) {
    return {
      statusKey: 'locked',
      statusLabel: 'Tài khoản đã khóa',
      isLocked: true,
      lockReason: profile?.lockReason || 'Đã khóa tài khoản khách hàng',
      lastLoginDisplay: profile?.lastLogin
        ? new Date(profile.lastLogin).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
        : 'Chưa từng',
      totalOrders: profile?.totalOrders || 0,
      isNewCustomer: (profile?.totalOrders || 0) === 0,
    };
  }

  // Calculate days since last login/activity
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

  const totalOrders = profile?.totalOrders !== undefined ? profile.totalOrders : 0;
  const isNewCustomer = totalOrders === 0;

  // Trạng thái không hoạt động là không đăng nhập / sử dụng trong 30 ngày (>= 30 ngày)
  const isInactiveByNoLogin = daysSinceLogin !== null ? daysSinceLogin >= 30 : false;
  const isExplicitInactive = profile?.status === 'inactive';

  if (isInactiveByNoLogin || isExplicitInactive) {
    return {
      statusKey: 'inactive',
      statusLabel: 'Không hoạt động',
      isLocked: false,
      lastLoginDisplay: lastLoginDisplay === 'Chưa từng' ? 'Chưa sử dụng (>30 ngày)' : `${lastLoginDisplay} (${daysSinceLogin} ngày trước)`,
      daysSinceLogin,
      totalOrders,
      isNewCustomer,
    };
  }

  return {
    statusKey: 'active',
    statusLabel: 'Đang hoạt động',
    isLocked: false,
    lastLoginDisplay: lastLoginDisplay === 'Chưa từng' ? 'Mới đăng nhập' : lastLoginDisplay,
    daysSinceLogin,
    totalOrders,
    isNewCustomer,
  };
}

export default function CustomersManagement() {
  const [users, setUsers] = React.useState<CustomerUser[]>([]);
  const [search, setSearch] = React.useState('');
  const [statFilter, setStatFilter] = React.useState<'ALL' | 'NEW' | 'LOCKED' | 'INACTIVE'>('ALL');

  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState('');
  const [success, setSuccess] = React.useState('');

  const [modalMode, setModalMode] = React.useState<ModalMode>(null);
  const [selectedUser, setSelectedUser] = React.useState<CustomerUser | null>(null);
  const [form, setForm] = React.useState<CustomerForm>({ email: '', fullName: '', phone: '', status: 'active', password: '', address: '' });
  const [profiles, setProfiles] = React.useState<Record<string, CustomerProfile>>(() => getStoredCustomerProfiles());
  const [showPassword, setShowPassword] = React.useState(false);
  const importInputRef = React.useRef<HTMLInputElement | null>(null);

  // Lock Account Modal State
  const [lockModalOpen, setLockModalOpen] = React.useState(false);
  const [userToLock, setUserToLock] = React.useState<CustomerUser | null>(null);
  const [lockReasonInput, setLockReasonInput] = React.useState('');

  // Pagination states
  const [pageSize, setPageSize] = React.useState(20);
  const [currentPage, setCurrentPage] = React.useState(1);

  // Initialize demo profiles for fallback customers
  const initializeProfilesDefaults = React.useCallback((customerList: CustomerUser[], currentProfiles: Record<string, CustomerProfile>) => {
    let updated = false;
    const nextProfiles = { ...currentProfiles };

    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;

    customerList.forEach((user, idx) => {
      const existing = nextProfiles[user.id] || {
        phone: user.phone || '0901234567',
        address: user.address || 'TP. Hồ Chí Minh',
        status: 'active',
      };

      if (existing.totalOrders === undefined || existing.lastLogin === undefined) {
        updated = true;
        // Demo profile values:
        // idx 0, 1: Active with orders
        // idx 2, 3: New customer (0 orders)
        // idx 4: Inactive (>30 days no login)
        // idx 5: Locked
        let mockDaysAgo = 2;
        let mockOrders = 5;
        let isLocked = false;
        let lockReason = '';

        if (idx === 2 || idx === 3) {
          mockOrders = 0; // Khách hàng mới chưa mua hàng
          mockDaysAgo = 5;
        } else if (idx === 4) {
          mockDaysAgo = 42; // >30 ngày không sử dụng
          mockOrders = 1;
        } else if (idx === 5) {
          isLocked = true;
          lockReason = 'Vi phạm chính sách đặt hàng ảo';
          mockDaysAgo = 15;
          mockOrders = 2;
        }

        nextProfiles[user.id] = {
          ...existing,
          totalOrders: existing.totalOrders !== undefined ? existing.totalOrders : mockOrders,
          lastLogin: existing.lastLogin || new Date(now - mockDaysAgo * dayMs).toISOString(),
          isLocked: existing.isLocked !== undefined ? existing.isLocked : isLocked,
          lockReason: existing.lockReason || lockReason,
        };
      }
    });

    if (updated) {
      setProfiles(nextProfiles);
      saveStoredCustomerProfiles(nextProfiles);
    }
  }, []);

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
      const nextUsers = userData;
      setUsers(nextUsers);

      const customerList = nextUsers.filter(isCustomer);
      initializeProfilesDefaults(customerList, getStoredCustomerProfiles());
    } catch {
      setUsers([]);
      initializeProfilesDefaults([], getStoredCustomerProfiles());
    } fontally: {
      setLoading(false);
    }
  }, [initializeProfilesDefaults]);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  React.useEffect(() => {
    setCurrentPage(1);
  }, [search, statFilter]);

  const getProfile = (user: any): CustomerProfile => ({
    phone: profiles[user.id]?.phone || user.phone || '-',
    address: profiles[user.id]?.address || user.address || '-',
    status: profiles[user.id]?.status || user.status || 'active',
    isLocked: profiles[user.id]?.isLocked || false,
    lockReason: profiles[user.id]?.lockReason || '',
    lockedAt: profiles[user.id]?.lockedAt || '',
    lastLogin: profiles[user.id]?.lastLogin || '',
    totalOrders: profiles[user.id]?.totalOrders !== undefined ? profiles[user.id].totalOrders : 0,
  });

  const customerUsers = users.filter(isCustomer);

  // Compute 4 Overview Stat Counts
  const totalCustomersCount = customerUsers.length;
  
  // Khách hàng mới là khách hàng chưa mua hàng (totalOrders === 0)
  const newCustomersCount = customerUsers.filter((user) => (getProfile(user).totalOrders || 0) === 0).length;
  
  // Tài khoản bị khóa
  const lockedCustomersCount = customerUsers.filter((user) => getProfile(user).isLocked).length;

  // Tài khoản không hoạt động là không đăng nhập / sử dụng trong 30 ngày (>= 30 ngày)
  const inactiveCustomersCount = customerUsers.filter((user) => {
    const accStatus = calculateCustomerAccountStatus(user, getProfile(user));
    return accStatus.statusKey === 'inactive';
  }).length;

  // Filter Customers
  const filteredUsers = customerUsers.filter((user) => {
    const profile = getProfile(user);
    const accStatus = calculateCustomerAccountStatus(user, profile);
    const keyword = search.trim().toLowerCase();

    const matchesKeyword =
      !keyword ||
      user.email.toLowerCase().includes(keyword) ||
      (user.fullName || '').toLowerCase().includes(keyword) ||
      user.id.toLowerCase().includes(keyword) ||
      (profile.phone || '').toLowerCase().includes(keyword) ||
      (profile.address || '').toLowerCase().includes(keyword);

    let matchesStat = true;
    if (statFilter === 'NEW') {
      matchesStat = accStatus.isNewCustomer;
    } else if (statFilter === 'LOCKED') {
      matchesStat = accStatus.isLocked;
    } else if (statFilter === 'INACTIVE') {
      matchesStat = accStatus.statusKey === 'inactive';
    }

    return matchesKeyword && matchesStat;
  });

  // Calculate Pagination
  const totalItems = filteredUsers.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const paginatedUsers = filteredUsers.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const startIndex = totalItems > 0 ? (currentPage - 1) * pageSize + 1 : 0;
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
    const profile = getProfile(user);
    setError('');
    setSuccess('');
    setSelectedUser(user);
    setShowPassword(false);
    setForm({
      email: user.email,
      fullName: user.fullName || '',
      phone: profile.phone || '',
      address: profile.address || '',
      status: profile.status || 'active',
      password: '',
    });
    setModalMode(mode);
  };

  // Lock Account Handling
  const openLockModal = (user: CustomerUser) => {
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
      setError('Vui lòng nhập lý do khóa tài khoản khách hàng.');
      return;
    }

    const updatedProfile: CustomerProfile = {
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
    saveStoredCustomerProfiles(nextProfiles);

    setSuccess(
      willBeLocked
        ? `Đã khóa tài khoản khách hàng ${userToLock.fullName || userToLock.email}. Lý do: ${lockReasonInput.trim()}`
        : `Đã mở khóa tài khoản cho khách hàng ${userToLock.fullName || userToLock.email}.`
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

  const downloadCustomerImportTemplate = () => {
    const rows = [
      ['Email', 'Họ và Tên', 'Số điện thoại', 'Địa chỉ', 'Mật khẩu'],
      ['khachhang@example.com', 'Nguyễn Văn A', '0912345678', '123 Đường ABC, Q1, TP.HCM', 'Aa123456'],
    ];
    const csvContent = rows
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'mau-file-khach-hang.csv';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setSuccess('Đã tải mẫu file import khách hàng.');
    setError('');
  };

  const handleExportClick = () => {
    const rows = filteredUsers.map((user, index) => {
      const profile = getProfile(user);
      const accountStatus = calculateCustomerAccountStatus(user, profile);

      return [
        index + 1,
        user.fullName || '',
        user.email,
        profile.phone,
        profile.address,
        accountStatus.totalOrders,
        accountStatus.lastLoginDisplay,
        accountStatus.statusLabel,
        profile.isLocked ? profile.lockReason : '',
      ];
    });
    const csvContent = [
      ['STT', 'Họ và Tên', 'Email', 'Số điện thoại', 'Địa chỉ', 'Số đơn hàng', 'Đăng nhập gần nhất', 'Trạng thái', 'Lý do khóa'],
      ...rows,
    ]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'danh-sach-khach-hang.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const saveProfile = (userId: string) => {
    const existing = profiles[userId] || {};
    const nextProfiles = {
      ...profiles,
      [userId]: {
        ...existing,
        phone: form.phone,
        address: form.address,
        status: form.status,
        lastLogin: existing.lastLogin || new Date().toISOString(),
        totalOrders: existing.totalOrders !== undefined ? existing.totalOrders : 0,
      },
    };
    setProfiles(nextProfiles);
    saveStoredCustomerProfiles(nextProfiles);
  };

  const saveCustomerLocally = async (isEdit: boolean) => {
    const savedUserId = isEdit && selectedUser ? selectedUser.id : crypto.randomUUID();
    const nextUser: CustomerUser = {
      id: savedUserId,
      email: form.email,
      fullName: form.fullName,
      phone: form.phone,
      address: form.address,
      roles: [{ id: 'role-customer', name: 'customer' }],
    };
    const nextUsers = isEdit
      ? users.map((u) => (u.id === savedUserId ? nextUser : u))
      : [nextUser, ...users];

    setUsers(nextUsers);
    saveProfile(savedUserId);
    setSuccess(isEdit ? 'Đã cập nhật khách hàng.' : 'Đã tạo khách hàng mới.');
    closeModal();
  };

  const deleteCustomerLocally = async (userId: string) => {
    const nextUsers = users.filter((u) => u.id !== userId);
    const nextProfiles = { ...profiles };
    delete nextProfiles[userId];

    setUsers(nextUsers);
    setProfiles(nextProfiles);
    saveStoredCustomerProfiles(nextProfiles);
    setSuccess('Đã xóa khách hàng.');
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
        if ([401, 403].includes(response.status) || /unauthorized/i.test(data?.message || '')) {
          await saveCustomerLocally(isEdit);
          return;
        }
        throw new Error(data?.message || (isEdit ? 'Không cập nhật được khách hàng' : 'Không tạo được khách hàng'));
      }

      const savedUser = (await response.json()) as CustomerUser;
      const savedUserId = isEdit && selectedUser ? selectedUser.id : savedUser.id;
      saveProfile(savedUserId);

      setSuccess(isEdit ? 'Đã cập nhật khách hàng.' : 'Đã tạo khách hàng mới.');
      closeModal();
      await loadData();
    } catch (err) {
      if (err instanceof TypeError) {
        await saveCustomerLocally(modalMode === 'edit');
        return;
      }
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
        if ([401, 403].includes(response.status) || /unauthorized/i.test(data?.message || '')) {
          await deleteCustomerLocally(selectedUser.id);
          return;
        }
        throw new Error(data?.message || 'Không xóa được khách hàng');
      }

      setSuccess('Đã xóa khách hàng.');
      const nextProfiles = { ...profiles };
      delete nextProfiles[selectedUser.id];
      setProfiles(nextProfiles);
      saveStoredCustomerProfiles(nextProfiles);
      closeModal();
      await loadData();
    } catch (err) {
      if (err instanceof TypeError) {
        await deleteCustomerLocally(selectedUser.id);
        return;
      }
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

      {/* Header matching products/main style */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2.5 rounded-xl border-2 border-cyan-500 bg-cyan-600 px-4 py-2 text-white shadow-md">
            <Users className="h-5 w-5 text-cyan-100" />
            <h1 className="text-lg font-bold tracking-tight text-white">Quản lý khách hàng</h1>
          </div>
        </div>

        <div className="flex flex-wrap gap-2.5">
          <button
            type="button"
            onClick={downloadCustomerImportTemplate}
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
            {totalCustomersCount} SỐ LƯỢNG KHÁCH HÀNG
          </p>
        </button>

        <button
          type="button"
          onClick={() => setStatFilter('NEW')}
          className={`flex h-[72px] items-center justify-center rounded-xl border-2 border-cyan-500 px-4 shadow-sm transition text-center ${
            statFilter === 'NEW'
              ? 'bg-cyan-600 text-white'
              : 'bg-white text-cyan-700 hover:bg-cyan-50'
          }`}
        >
          <p className="text-base font-black uppercase">
            {newCustomersCount} KHÁCH HÀNG MỚI (CHƯA MUA)
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
            {lockedCustomersCount} TÀI KHOẢN BỊ KHÓA
          </p>
        </button>

        <button
          type="button"
          onClick={() => setStatFilter('INACTIVE')}
          className={`flex h-[72px] items-center justify-center rounded-xl border-2 border-cyan-500 px-4 shadow-sm transition text-center ${
            statFilter === 'INACTIVE'
              ? 'bg-cyan-600 text-white'
              : 'bg-white text-cyan-700 hover:bg-cyan-50'
          }`}
        >
          <p className="text-base font-black uppercase">
            {inactiveCustomersCount} KHÔNG HOẠT ĐỘNG (&gt;30 NGÀY)
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
              placeholder="Tìm kiếm khách hàng theo tên, email, SĐT, địa chỉ..."
            />
          </div>

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

      {/* Table Section with Cyan headers matching products/main */}
      <div className="mt-5 overflow-hidden rounded-xl border-2 border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1200px] border-collapse bg-white">
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
                <th className="border-x border-slate-200 px-3 py-4 text-center text-sm font-extrabold uppercase text-slate-800 min-w-[180px]">
                  Email
                </th>
                <th className="border-x border-slate-200 px-3 py-4 text-center text-sm font-extrabold uppercase text-slate-800">
                  Số điện thoại
                </th>
                <th className="border-x border-slate-200 px-3 py-4 text-center text-sm font-extrabold uppercase text-slate-800 min-w-[200px]">
                  Địa chỉ
                </th>
                <th className="border-x border-slate-200 px-3 py-4 text-center text-sm font-extrabold uppercase text-slate-800">
                  Đơn hàng
                </th>
                <th className="border-x border-slate-200 px-3 py-4 text-center text-sm font-extrabold uppercase text-slate-800 min-w-[160px]">
                  Sử dụng lần cuối
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
                  <td colSpan={10} className="px-6 py-12 text-center text-sm font-semibold text-slate-500">
                    Đang tải dữ liệu khách hàng...
                  </td>
                </tr>
              ) : paginatedUsers.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-6 py-12 text-center text-sm font-semibold text-slate-500">
                    Không tìm thấy khách hàng phù hợp.
                  </td>
                </tr>
              ) : (
                paginatedUsers.map((user, index) => {
                  const profile = getProfile(user);
                  const accountStatus = calculateCustomerAccountStatus(user, profile);

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

                      <td className="border-x border-slate-200 px-3 py-3.5 text-center text-sm font-medium text-slate-700">
                        {user.email}
                      </td>

                      <td className="border-x border-slate-200 px-3 py-3.5 text-center text-sm font-medium text-slate-700">
                        {profile.phone}
                      </td>

                      <td className="max-w-[240px] truncate border-x border-slate-200 px-3 py-3.5 text-center text-sm text-slate-700" title={profile.address}>
                        {profile.address || '-'}
                      </td>

                      <td className="border-x border-slate-200 px-3 py-3.5 text-center text-sm font-bold text-slate-800">
                        {accountStatus.isNewCustomer ? (
                          <span className="inline-flex items-center gap-1 text-cyan-600 font-extrabold text-xs bg-cyan-50 border border-cyan-200 px-2 py-0.5 rounded-md">
                            <ShoppingBag size={12} />
                            Khách hàng mới (0)
                          </span>
                        ) : (
                          <span className="text-slate-800 font-bold">
                            {accountStatus.totalOrders} đơn
                          </span>
                        )}
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
                            title="Tài khoản không hoạt động do chưa đăng nhập / sử dụng trong 30 ngày"
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
                            title="Xóa khách hàng"
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
                    {getProfile(userToLock).isLocked ? 'Mở khóa tài khoản' : 'Khóa tài khoản khách hàng'}
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
                    Tài khoản khách hàng này hiện đang bị khóa với lý do:
                  </p>
                  <div className="mt-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">
                    "{getProfile(userToLock).lockReason || 'Không ghi rõ lý do'}"
                  </div>
                  <p className="mt-3 text-xs text-slate-500">
                    Bạn có chắc chắn muốn mở khóa tài khoản cho khách hàng này?
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
                    placeholder="Nhập chi tiết lý do khóa (Ví dụ: Vi phạm chính sách đặt hàng, tài khoản giả mạo...)"
                    className="w-full rounded-xl border-2 border-slate-200 p-3 text-sm outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10 font-medium"
                    required
                  />
                  <p className="mt-2 text-xs font-medium text-slate-500">
                    Trạng thái tài khoản sẽ chuyển sang 'Tài khoản đã khóa' và khách hàng không thể đăng nhập mua hàng.
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
                    {modalMode === 'view' ? 'Thông tin chi tiết khách hàng' : 'Nhập thông tin khách hàng đầy đủ'}
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
                  Bạn có chắc muốn xóa khách hàng{' '}
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
                      className="h-11 w-full rounded-xl border-2 border-cyan-500 px-4 text-sm font-semibold outline-none transition focus:border-cyan-600 focus:ring-4 focus:ring-cyan-500/10 read-only:bg-slate-50 read-only:border-slate-200 read-only:focus:ring-0"
                      placeholder="Nguyễn Văn A"
                      required
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
                      className="h-11 w-full rounded-xl border-2 border-cyan-500 px-4 text-sm font-semibold outline-none transition focus:border-cyan-600 focus:ring-4 focus:ring-cyan-500/10 read-only:bg-slate-50 read-only:border-slate-200 read-only:focus:ring-0"
                      placeholder="0901234567"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-bold text-slate-700">Địa chỉ</label>
                    <input
                      value={form.address || ''}
                      onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))}
                      readOnly={modalMode === 'view'}
                      className="h-11 w-full rounded-xl border-2 border-cyan-500 px-4 text-sm font-semibold outline-none transition focus:border-cyan-600 focus:ring-4 focus:ring-cyan-500/10 read-only:bg-slate-50 read-only:border-slate-200 read-only:focus:ring-0"
                      placeholder="Số nhà, tên đường, phường/xã, quận/huyện..."
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
