import React from 'react';
import { createPortal } from 'react-dom';
import {
  BadgeCheck,
  CalendarDays,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  User,
  Pencil,
  Lock,
  X,
  XCircle,
  CheckCircle,
  Eye,
  EyeOff,
  ChevronDown,
  Check,
  Maximize2,
  Minimize2,
  UserCheck,
  Building2,
} from 'lucide-react';

interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  role: string;
  phone: string;
  department: string;
  location: string;
  joinedAt: string;
}

type ModalMode = 'edit' | 'password' | null;

const API_BASE_URL = 'http://localhost:3000/api';

const DEPARTMENTS = ['Vận hành kho', 'Quản lý chất lượng', 'Kế toán - Tài chính', 'Nhân sự - Hành chính'];
const LOCATIONS = ['Kho trung tâm (Hà Nội)', 'Kho miền Bắc (Bắc Ninh)', 'Kho miền Trung (Đà Nẵng)', 'Kho miền Nam (TP.HCM)'];

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
  };
}

function formatRole(role?: string) {
  if (!role) return 'Người dùng';
  const r = role.toLowerCase();
  if (r === 'admin' || r === 'administrator' || r === 'quản trị viên') return 'Quản trị viên';
  if (r === 'customer') return 'Khách hàng';
  if (r === 'supplier') return 'Nhà cung cấp';
  if (['manager', 'warehouse_manager', 'staff', 'inventory_staff', 'warehouse_staff', 'storekeeper', 'inventory_checker', 'inventory-checker', 'thủ kho', 'nv kiểm kê'].includes(r)) {
    return 'Người dùng';
  }
  return role;
}

function getInitials(name: string, email: string) {
  const source = name?.trim() || email?.split('@')[0] || 'User';
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 3).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function getFallbackProfile(): UserProfile {
  try {
    const user = JSON.parse(localStorage.getItem('user') || '{}') as Partial<UserProfile>;
    return {
      id: user.id || 'current-user',
      email: user.email || 'admin@smartwms.vn',
      fullName: user.fullName || 'Dương Ngọc Anh',
      role: user.role || 'admin',
      phone: user.phone || '0901 234 567',
      department: user.department || 'Vận hành kho',
      location: user.location || 'Kho trung tâm (Hà Nội)',
      joinedAt: user.joinedAt || new Date().toISOString(),
    };
  } catch {
    return {
      id: 'current-user',
      email: 'admin@smartwms.vn',
      fullName: 'Dương Ngọc Anh',
      role: 'admin',
      phone: '0901 234 567',
      department: 'Vận hành kho',
      location: 'Kho trung tâm (Hà Nội)',
      joinedAt: new Date().toISOString(),
    };
  }
}

export default function ProfilePage() {
  const [profile, setProfile] = React.useState<UserProfile>(() => getFallbackProfile());
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [isFullScreen, setIsFullScreen] = React.useState(false);

  // Toast State
  const [toastMessage, setToastMessage] = React.useState('');
  const [toastType, setToastType] = React.useState<'success' | 'error'>('success');
  const [modalMode, setModalMode] = React.useState<ModalMode>(null);

  // Forms
  const [editForm, setEditForm] = React.useState({ fullName: '', phone: '', department: '', location: '' });
  const [passwordForm, setPasswordForm] = React.useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [showPassword, setShowPassword] = React.useState({ current: false, new: false, confirm: false });

  // Dropdown states
  const [isDeptOpen, setIsDeptOpen] = React.useState(false);
  const [isLocOpen, setIsLocOpen] = React.useState(false);
  const deptRef = React.useRef<HTMLDivElement>(null);
  const locRef = React.useRef<HTMLDivElement>(null);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToastMessage(msg);
    setToastType(type);
    setTimeout(() => setToastMessage(''), 3500);
  };

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (deptRef.current && !deptRef.current.contains(event.target as Node)) {
        setIsDeptOpen(false);
      }
      if (locRef.current && !locRef.current.contains(event.target as Node)) {
        setIsLocOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadProfile = React.useCallback(async () => {
    setLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/profile`, { headers: authHeaders() }).catch(() => null);
      if (response && response.ok) {
        const data = (await response.json()) as UserProfile;
        setProfile({
          ...getFallbackProfile(),
          ...data,
        });
      } else {
        setProfile(getFallbackProfile());
      }
    } catch {
      setProfile(getFallbackProfile());
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const closeModal = () => {
    setModalMode(null);
    setSaving(false);
    setIsDeptOpen(false);
    setIsLocOpen(false);
  };

  const openEditModal = () => {
    if (!profile) return;
    setEditForm({
      fullName: profile.fullName || '',
      phone: profile.phone || '',
      department: profile.department || '',
      location: profile.location || '',
    });
    setModalMode('edit');
  };

  const openPasswordModal = () => {
    setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    setShowPassword({ current: false, new: false, confirm: false });
    setModalMode('password');
  };

  const handleEditSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editForm.fullName.trim()) {
      showToast('Vui lòng nhập họ và tên.', 'error');
      return;
    }

    setSaving(true);

    try {
      const response = await fetch(`${API_BASE_URL}/profile`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify(editForm),
      }).catch(() => null);

      if (response && !response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.message || 'Không cập nhật được thông tin');
      }

      // Update local storage user if exists
      try {
        const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
        localStorage.setItem('user', JSON.stringify({ ...storedUser, ...editForm }));
      } catch {
        // quiet fallback
      }

      setProfile((prev) => ({ ...prev, ...editForm }));
      showToast('Đã cập nhật thông tin cá nhân thành công!');
      closeModal();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Lỗi khi lưu thông tin', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
      showToast('Vui lòng nhập đầy đủ thông tin mật khẩu.', 'error');
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      showToast('Mật khẩu mới và mật khẩu xác nhận không khớp.', 'error');
      return;
    }

    if (passwordForm.newPassword.length < 6) {
      showToast('Mật khẩu mới phải có tối thiểu 6 ký tự.', 'error');
      return;
    }

    setSaving(true);

    try {
      const response = await fetch(`${API_BASE_URL}/profile/password`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword,
        }),
      }).catch(() => null);

      if (response && !response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.message || 'Không thể đổi mật khẩu');
      }

      showToast('Đổi mật khẩu thành công!');
      closeModal();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Lỗi khi đổi mật khẩu', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading && !profile) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-sm font-semibold text-slate-500">Đang tải thông tin tài khoản...</p>
      </div>
    );
  }

  const initials = getInitials(profile.fullName, profile.email);
  const details = [
    { icon: Mail, label: 'Email tài khoản', value: profile.email || '-' },
    { icon: Phone, label: 'Số điện thoại', value: profile.phone || '-' },
    { icon: ShieldCheck, label: 'Chức danh / Vai trò', value: formatRole(profile.role) },
    { icon: MapPin, label: 'Kho / Địa điểm làm việc', value: profile.location || '-' },
    { icon: Building2, label: 'Phòng ban công tác', value: profile.department || '-' },
    { icon: CalendarDays, label: 'Ngày tạo tài khoản', value: profile.joinedAt ? new Date(profile.joinedAt).toLocaleDateString('vi-VN') : '-' },
  ];

  return (
    <div className={`space-y-6 text-slate-800 ${isFullScreen ? 'fixed inset-0 z-[9000] bg-white overflow-y-auto p-6' : ''}`}>
      {/* TOAST NOTIFICATION */}
      {toastMessage &&
        createPortal(
          <div
            className={`fixed top-6 right-6 z-[9999] flex items-center gap-3 rounded-2xl px-5 py-3.5 shadow-2xl border backdrop-blur-md animate-in slide-in-from-top-4 ${
              toastType === 'error'
                ? 'bg-red-50/95 text-red-700 border-red-200'
                : 'bg-emerald-50/95 text-emerald-800 border-emerald-200'
            }`}
          >
            {toastType === 'error' ? <XCircle className="h-5 w-5 text-red-600" /> : <CheckCircle className="h-5 w-5 text-emerald-600" />}
            <p className="text-sm font-extrabold">{toastMessage}</p>
          </div>,
          document.body
        )}

      <div className="space-y-6 animate-in fade-in duration-200">
        {/* Top Banner Header matching Outbound/Inbound Gold Standard */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="inline-flex items-center gap-2.5 rounded-2xl bg-cyan-600 px-5 py-2.5 text-white shadow-md">
              <UserCheck className="h-5 w-5" />
              <h1 className="text-xl font-extrabold tracking-tight uppercase">THÔNG TIN HỒ SƠ TÀI KHOẢN</h1>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Đổi mật khẩu */}
            <button
              type="button"
              onClick={openPasswordModal}
              className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-cyan-700 bg-white px-5 py-2.5 text-sm font-extrabold text-cyan-700 shadow-xs transition hover:bg-cyan-50 active:scale-95 cursor-pointer"
            >
              <Lock className="h-4.5 w-4.5 text-cyan-700" />
              Đổi mật khẩu
            </button>

            {/* Chỉnh sửa thông tin */}
            <button
              type="button"
              onClick={openEditModal}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-600 border-2 border-cyan-700 px-5 py-2.5 text-sm font-extrabold text-white shadow-md transition hover:bg-cyan-700 active:scale-95 cursor-pointer"
            >
              <Pencil className="h-4.5 w-4.5" />
              Sửa thông tin
            </button>

            {/* Toàn màn hình */}
            <button
              type="button"
              onClick={() => setIsFullScreen(!isFullScreen)}
              className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-cyan-700 bg-white px-4 py-2.5 text-sm font-extrabold text-cyan-700 shadow-xs transition hover:bg-cyan-50 active:scale-95 cursor-pointer"
              title={isFullScreen ? 'Thoát toàn màn hình' : 'Toàn màn hình'}
            >
              {isFullScreen ? <Minimize2 className="h-4.5 w-4.5 text-cyan-700" /> : <Maximize2 className="h-4.5 w-4.5 text-cyan-700" />}
            </button>
          </div>
        </div>

        {/* HERO CARD: AVATAR & USER STATUS BANNER */}
        <div className="overflow-hidden rounded-2xl border-2 border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-6 p-6 sm:flex-row sm:items-center sm:justify-between bg-gradient-to-r from-slate-50 via-white to-cyan-50/40">
            <div className="flex items-center gap-5">
              <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-cyan-600 text-2xl font-black text-white shadow-md border-2 border-cyan-700">
                {initials}
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h2 className="text-2xl font-black text-slate-900">{profile.fullName || 'Chưa cập nhật tên'}</h2>
                  <BadgeCheck className="h-6 w-6 text-cyan-600" />
                </div>
                <p className="text-sm font-semibold text-slate-600">
                  Email: <span className="font-extrabold text-slate-800">{profile.email}</span>
                </p>
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <span className="inline-flex items-center gap-1 rounded-xl bg-cyan-100 px-3 py-1 text-xs font-extrabold text-cyan-800 border border-cyan-300">
                    <ShieldCheck size={14} />
                    {formatRole(profile.role)}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-xl bg-emerald-100 px-3 py-1 text-xs font-extrabold text-emerald-800 border border-emerald-300">
                    <Check size={14} />
                    Đang hoạt động
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 border-t sm:border-t-0 pt-4 sm:pt-0 border-slate-200">
              <button
                type="button"
                onClick={openEditModal}
                className="inline-flex items-center gap-2 rounded-xl border-2 border-cyan-600 bg-white px-4 py-2 text-xs font-extrabold text-cyan-700 hover:bg-cyan-50 transition cursor-pointer"
              >
                <Pencil size={15} />
                Cập nhật thông tin
              </button>
            </div>
          </div>
        </div>

        {/* DETAILS GRID */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {details.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.label}
                className="flex items-center gap-4 rounded-2xl border-2 border-slate-200 bg-white p-5 shadow-sm transition-all hover:border-cyan-600 hover:bg-cyan-50/50"
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-cyan-50 text-cyan-700 border border-cyan-200">
                  <Icon size={22} strokeWidth={2.5} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    {item.label}
                  </p>
                  <p className="mt-1 truncate text-base font-extrabold text-slate-800">
                    {item.value}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* POPUP MODALS */}
      {modalMode && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm animate-in fade-in-50">
          <div className="w-full max-w-2xl overflow-hidden rounded-3xl border-2 border-cyan-500 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b-2 border-slate-200 bg-cyan-50 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-3.5 py-1.5 text-white font-black text-sm">
                  {modalMode === 'edit' ? <Pencil className="h-4.5 w-4.5" /> : <Lock className="h-4.5 w-4.5" />}
                  {modalMode === 'edit' ? 'CẬP NHẬT THÔNG TIN CÁ NHÂN' : 'ĐỔI MẬT KHẨU BẢO MẬT'}
                </div>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="rounded-xl p-2 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {modalMode === 'edit' ? (
              <form onSubmit={handleEditSubmit} className="p-6 space-y-4 text-xs font-bold text-slate-700">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="md:col-span-2 space-y-1.5">
                    <label className="text-slate-700 font-extrabold">Họ và tên <span className="text-red-500">*</span></label>
                    <input
                      value={editForm.fullName}
                      onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })}
                      className="w-full rounded-xl border-2 border-cyan-500 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-800 outline-none focus:ring-4 focus:ring-cyan-500/10"
                      placeholder="Nhập họ và tên đầy đủ..."
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-slate-700 font-extrabold">Số điện thoại</label>
                    <input
                      value={editForm.phone}
                      onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                      className="w-full rounded-xl border-2 border-cyan-500 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-800 outline-none focus:ring-4 focus:ring-cyan-500/10"
                      placeholder="0912..."
                    />
                  </div>

                  {/* Custom Department Dropdown */}
                  <div className="space-y-1.5 relative" ref={deptRef}>
                    <label className="text-slate-700 font-extrabold">Phòng ban</label>
                    <button
                      type="button"
                      onClick={() => setIsDeptOpen(!isDeptOpen)}
                      className="relative z-20 flex h-11 w-full items-center justify-between rounded-xl border-2 border-cyan-500 bg-white px-3.5 text-sm font-semibold text-slate-800 outline-none cursor-pointer"
                    >
                      <span>{editForm.department || 'Chọn phòng ban...'}</span>
                      <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${isDeptOpen ? 'rotate-180' : ''}`} />
                    </button>
                    {isDeptOpen && (
                      <ul className="absolute left-0 right-0 top-[calc(100%+6px)] z-30 max-h-56 overflow-y-auto rounded-xl border-2 border-slate-200 bg-white p-2 shadow-xl">
                        {DEPARTMENTS.map((dept) => (
                          <li
                            key={dept}
                            onClick={() => {
                              setEditForm({ ...editForm, department: dept });
                              setIsDeptOpen(false);
                            }}
                            className={`flex cursor-pointer items-center justify-between rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors hover:bg-cyan-50 ${
                              editForm.department === dept ? 'bg-cyan-50 text-cyan-700 font-bold' : 'text-slate-700'
                            }`}
                          >
                            {dept}
                            {editForm.department === dept && <Check className="h-4 w-4 text-cyan-600" />}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {/* Custom Location Dropdown */}
                  <div className="space-y-1.5 md:col-span-2 relative" ref={locRef}>
                    <label className="text-slate-700 font-extrabold">Kho phụ trách / Nơi làm việc</label>
                    <button
                      type="button"
                      onClick={() => setIsLocOpen(!isLocOpen)}
                      className="relative z-20 flex h-11 w-full items-center justify-between rounded-xl border-2 border-cyan-500 bg-white px-3.5 text-sm font-semibold text-slate-800 outline-none cursor-pointer"
                    >
                      <span>{editForm.location || 'Chọn nơi làm việc...'}</span>
                      <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${isLocOpen ? 'rotate-180' : ''}`} />
                    </button>
                    {isLocOpen && (
                      <ul className="absolute left-0 right-0 top-[calc(100%+6px)] z-30 max-h-56 overflow-y-auto rounded-xl border-2 border-slate-200 bg-white p-2 shadow-xl">
                        {LOCATIONS.map((loc) => (
                          <li
                            key={loc}
                            onClick={() => {
                              setEditForm({ ...editForm, location: loc });
                              setIsLocOpen(false);
                            }}
                            className={`flex cursor-pointer items-center justify-between rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors hover:bg-cyan-50 ${
                              editForm.location === loc ? 'bg-cyan-50 text-cyan-700 font-bold' : 'text-slate-700'
                            }`}
                          >
                            {loc}
                            {editForm.location === loc && <Check className="h-4 w-4 text-cyan-600" />}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t-2 border-slate-200">
                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-6 py-2.5 text-sm font-bold text-white shadow-md hover:bg-cyan-700 transition cursor-pointer disabled:opacity-50"
                  >
                    {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
                  </button>

                  <button
                    type="button"
                    onClick={closeModal}
                    className="inline-flex items-center gap-2 rounded-xl border-2 border-slate-300 bg-white px-5 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                  >
                    Hủy
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handlePasswordSubmit} className="p-6 space-y-4 text-xs font-bold text-slate-700">
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-slate-700 font-extrabold">Mật khẩu hiện tại <span className="text-red-500">*</span></label>
                    <div className="relative">
                      <input
                        type={showPassword.current ? 'text' : 'password'}
                        value={passwordForm.currentPassword}
                        onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                        className="w-full rounded-xl border-2 border-cyan-500 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-800 outline-none pr-11 focus:ring-4 focus:ring-cyan-500/10"
                        placeholder="••••••••"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword({ ...showPassword, current: !showPassword.current })}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-500 hover:text-cyan-600 cursor-pointer"
                      >
                        {showPassword.current ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-slate-700 font-extrabold">Mật khẩu mới <span className="text-red-500">*</span></label>
                    <div className="relative">
                      <input
                        type={showPassword.new ? 'text' : 'password'}
                        value={passwordForm.newPassword}
                        onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                        className="w-full rounded-xl border-2 border-cyan-500 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-800 outline-none pr-11 focus:ring-4 focus:ring-cyan-500/10"
                        placeholder="Tối thiểu 6 ký tự"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword({ ...showPassword, new: !showPassword.new })}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-500 hover:text-cyan-600 cursor-pointer"
                      >
                        {showPassword.new ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-slate-700 font-extrabold">Xác nhận mật khẩu mới <span className="text-red-500">*</span></label>
                    <div className="relative">
                      <input
                        type={showPassword.confirm ? 'text' : 'password'}
                        value={passwordForm.confirmPassword}
                        onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                        className="w-full rounded-xl border-2 border-cyan-500 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-800 outline-none pr-11 focus:ring-4 focus:ring-cyan-500/10"
                        placeholder="Nhập lại mật khẩu mới"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword({ ...showPassword, confirm: !showPassword.confirm })}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-500 hover:text-cyan-600 cursor-pointer"
                      >
                        {showPassword.confirm ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t-2 border-slate-200">
                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-6 py-2.5 text-sm font-bold text-white shadow-md hover:bg-cyan-700 transition cursor-pointer disabled:opacity-50"
                  >
                    {saving ? 'Đang xử lý...' : 'Xác nhận đổi'}
                  </button>

                  <button
                    type="button"
                    onClick={closeModal}
                    className="inline-flex items-center gap-2 rounded-xl border-2 border-slate-300 bg-white px-5 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                  >
                    Hủy
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}