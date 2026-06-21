import React from 'react';
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
} from 'lucide-react';

// Tích hợp Toast nội bộ để không bị lỗi import
function Toast({ message, type, onClose }: { message: string; type: 'success' | 'error'; onClose: () => void }) {
  React.useEffect(() => {
    if (message) {
      const timer = setTimeout(() => onClose(), 3000);
      return () => clearTimeout(timer);
    }
  }, [message, onClose]);

  if (!message) return null;

  return (
    <div className={`fixed top-4 right-4 z-[60] flex items-center gap-3 rounded-xl px-4 py-3 shadow-lg transition-all ${type === 'error' ? 'bg-red-50 text-red-600 border border-red-200' : 'bg-emerald-50 text-emerald-600 border border-emerald-200'}`}>
      {type === 'error' ? <XCircle size={20} /> : <CheckCircle size={20} />}
      <p className="text-sm font-semibold">{message}</p>
      <button onClick={onClose} className="ml-2 rounded-lg p-1 hover:bg-white/50 transition">
        <X size={16} />
      </button>
    </div>
  );
}

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

// Các lựa chọn mẫu cho Dropdown (bạn có thể thay đổi theo data thực tế của DB)
const DEPARTMENTS = ['Vận hành kho', 'Quản lý chất lượng', 'Kế toán - Tài chính', 'Nhân sự - Hành chính'];
const LOCATIONS = ['Kho trung tâm (Hà Nội)', 'Kho miền Bắc (Bắc Ninh)', 'Kho miền Trung (Đà Nẵng)', 'Kho miền Nam (TP.HCM)'];

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
  };
}

function formatRole(role?: string) {
  if (role === 'admin') return 'Quản trị viên';
  if (role === 'manager') return 'Quản lý kho';
  if (role === 'staff') return 'Nhân viên kho';
  return role || 'Người dùng';
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
  const [error, setError] = React.useState('');
  const [success, setSuccess] = React.useState('');
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
    setError('');

    try {
      const response = await fetch(`${API_BASE_URL}/profile`, { headers: authHeaders() });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.message || 'Không tải được thông tin cá nhân');
      }

      const data = (await response.json()) as UserProfile;
      setProfile({
        ...getFallbackProfile(),
        ...data,
      });
    } catch (err) {
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
    setError('');
    setSuccess('');
    setEditForm({
      fullName: profile.fullName || '',
      phone: profile.phone || '',
      department: profile.department || '',
      location: profile.location || '',
    });
    setModalMode('edit');
  };

  const openPasswordModal = () => {
    setError('');
    setSuccess('');
    setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    setShowPassword({ current: false, new: false, confirm: false });
    setModalMode('password');
  };

  const handleEditSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editForm.fullName.trim()) {
      setError('Vui lòng nhập họ và tên.');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const response = await fetch(`${API_BASE_URL}/profile`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify(editForm),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.message || 'Không cập nhật được thông tin');
      }

      setSuccess('Đã cập nhật thông tin cá nhân thành công.');
      closeModal();
      await loadProfile();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi khi lưu thông tin');
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
      setError('Vui lòng nhập đầy đủ thông tin mật khẩu.');
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setError('Mật khẩu mới và mật khẩu xác nhận không khớp.');
      return;
    }

    if (passwordForm.newPassword.length < 6) {
      setError('Mật khẩu mới phải có tối thiểu 6 ký tự.');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const response = await fetch(`${API_BASE_URL}/profile/password`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.message || 'Không thể đổi mật khẩu');
      }

      setSuccess('Đổi mật khẩu thành công. Vui lòng sử dụng mật khẩu mới cho lần đăng nhập sau.');
      closeModal();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi khi đổi mật khẩu');
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
    { icon: Mail, label: 'Email', value: profile.email || '-' },
    { icon: Phone, label: 'Số điện thoại', value: profile.phone || '-' },
    { icon: ShieldCheck, label: 'Vai trò', value: formatRole(profile.role) },
    { icon: MapPin, label: 'Kho phụ trách', value: profile.location || '-' },
    { icon: User, label: 'Phòng ban', value: profile.department || '-' },
    { icon: CalendarDays, label: 'Ngày tham gia', value: profile.joinedAt ? new Date(profile.joinedAt).toLocaleDateString('vi-VN') : '-' },
  ];

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

      {/* Header tương tự trang Categories */}
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h1 className="text-2xl font-black text-cyan-950">Thông tin cá nhân</h1>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={openPasswordModal}
            className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-cyan-600 bg-white px-5 py-2.5 text-sm font-bold text-cyan-700 transition hover:bg-cyan-50"
          >
            <Lock size={16} strokeWidth={2.5} />
            Đổi mật khẩu
          </button>
          <button
            type="button"
            onClick={openEditModal}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-cyan-700"
          >
            <Pencil size={16} strokeWidth={2.5} />
            Sửa thông tin
          </button>
        </div>
      </div>

      {/* Nội dung Profile dưới dạng các button/card xếp từ trên xuống dưới */}
      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {/* Khối Thông tin chính (Name & Status) */}
        <div className="col-span-1 flex flex-col gap-5 rounded-3xl border-2 border-slate-200 bg-white p-6 sm:flex-row sm:items-center md:col-span-2 xl:col-span-3">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-3xl bg-cyan-100 text-3xl font-black text-cyan-700 shadow-inner">
            {initials}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-black text-slate-900">{profile.fullName || 'Chưa cập nhật tên'}</h2>
              <BadgeCheck className="h-6 w-6 text-cyan-500" />
            </div>
            <p className="mt-1 font-medium text-slate-500">
              Trạng thái: <span className="font-bold text-emerald-600">Đang hoạt động</span>
            </p>
          </div>
        </div>

        {/* Các khối thông tin chi tiết */}
        {details.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.label}
              type="button"
              className="group flex w-full items-center gap-4 rounded-3xl border-2 border-slate-200 bg-white p-5 text-left transition-all hover:border-cyan-500 hover:bg-cyan-50 hover:shadow-md active:scale-[0.98]"
            >
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-slate-50 text-slate-400 transition-colors group-hover:bg-cyan-100 group-hover:text-cyan-600">
                <Icon size={24} strokeWidth={2.5} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400 transition-colors group-hover:text-cyan-600/70">
                  {item.label}
                </p>
                <p className="mt-1 truncate text-base font-black text-slate-800">
                  {item.value}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Modals */}
      {modalMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm transition-all">
          <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b-2 border-slate-100 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-cyan-50 p-2 text-cyan-600">
                  {modalMode === 'edit' ? <Pencil className="h-6 w-6" /> : <Lock className="h-6 w-6" />}
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-800">
                    {modalMode === 'edit' ? 'Cập nhật thông tin cá nhân' : 'Đổi mật khẩu bảo mật'}
                  </h2>
                  <p className="text-sm font-medium text-slate-500">
                    {modalMode === 'edit' ? 'Chỉnh sửa thông tin liên hệ và phòng ban' : 'Vui lòng nhập mật khẩu cũ để xác thực'}
                  </p>
                </div>
              </div>
              <button type="button" onClick={closeModal} className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            {modalMode === 'edit' ? (
              <form onSubmit={handleEditSubmit} className="px-6 py-5">
                <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                  <div className="md:col-span-2">
                    <label className="mb-2 block text-sm font-bold text-slate-700">Họ và tên <span className="text-red-500">*</span></label>
                    <input
                      value={editForm.fullName}
                      onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })}
                      className="h-11 w-full rounded-xl border-2 border-slate-200 px-4 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
                      placeholder="Nhập họ và tên đầy đủ..."
                      required
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-bold text-slate-700">Số điện thoại</label>
                    <input
                      value={editForm.phone}
                      onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                      className="h-11 w-full rounded-xl border-2 border-slate-200 px-4 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
                      placeholder="0912..."
                    />
                  </div>

                  {/* Dropdown Phòng ban custom */}
                  <div className="relative" ref={deptRef}>
                    <label className="mb-2 block text-sm font-bold text-slate-700">Phòng ban</label>
                    <button
                      type="button"
                      onClick={() => setIsDeptOpen(!isDeptOpen)}
                      className="relative z-20 flex h-11 w-full items-center justify-between rounded-xl border-2 border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 outline-none transition hover:bg-slate-50 focus:border-cyan-500"
                    >
                      <span>{editForm.department || 'Chọn phòng ban...'}</span>
                      <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${isDeptOpen ? 'rotate-180' : ''}`} />
                    </button>
                    {isDeptOpen && (
                      <ul className="absolute left-0 right-0 top-[calc(100%+8px)] z-30 max-h-64 overflow-y-auto rounded-xl border-2 border-slate-100 bg-white p-2 shadow-xl">
                        {DEPARTMENTS.map((dept) => (
                          <li
                            key={dept}
                            onClick={() => {
                              setEditForm({ ...editForm, department: dept });
                              setIsDeptOpen(false);
                            }}
                            className={`flex cursor-pointer items-center justify-between rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors hover:bg-cyan-50 ${
                              editForm.department === dept ? 'bg-cyan-50 text-cyan-700' : 'text-slate-700'
                            }`}
                          >
                            {dept}
                            {editForm.department === dept && <Check className="h-4 w-4 text-cyan-600" />}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {/* Dropdown Kho phụ trách custom */}
                  <div className="relative md:col-span-2" ref={locRef}>
                    <label className="mb-2 block text-sm font-bold text-slate-700">Kho phụ trách / Nơi làm việc</label>
                    <button
                      type="button"
                      onClick={() => setIsLocOpen(!isLocOpen)}
                      className="relative z-20 flex h-11 w-full items-center justify-between rounded-xl border-2 border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 outline-none transition hover:bg-slate-50 focus:border-cyan-500"
                    >
                      <span>{editForm.location || 'Chọn nơi làm việc...'}</span>
                      <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${isLocOpen ? 'rotate-180' : ''}`} />
                    </button>
                    {isLocOpen && (
                      <ul className="absolute left-0 right-0 top-[calc(100%+8px)] z-30 max-h-64 overflow-y-auto rounded-xl border-2 border-slate-100 bg-white p-2 shadow-xl">
                        {LOCATIONS.map((loc) => (
                          <li
                            key={loc}
                            onClick={() => {
                              setEditForm({ ...editForm, location: loc });
                              setIsLocOpen(false);
                            }}
                            className={`flex cursor-pointer items-center justify-between rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors hover:bg-cyan-50 ${
                              editForm.location === loc ? 'bg-cyan-50 text-cyan-700' : 'text-slate-700'
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

                <div className="mt-8 flex justify-end gap-3">
                  <button type="button" onClick={closeModal} className="rounded-xl border-2 border-slate-200 px-5 py-2.5 font-bold text-slate-600 transition hover:bg-slate-50">
                    Hủy
                  </button>
                  <button 
                    type="submit" 
                    disabled={saving}
                    className="rounded-xl bg-cyan-600 px-6 py-2.5 font-bold text-white shadow-sm transition hover:bg-cyan-700 disabled:opacity-60"
                  >
                    {saving ? 'Đang lưu...' : 'Lưu thông tin'}
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handlePasswordSubmit} className="px-6 py-5">
                <div className="space-y-5">
                  <div>
                    <label className="mb-2 block text-sm font-bold text-slate-700">Mật khẩu hiện tại <span className="text-red-500">*</span></label>
                    <div className="relative">
                      <input
                        type={showPassword.current ? 'text' : 'password'}
                        value={passwordForm.currentPassword}
                        onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                        className="h-11 w-full rounded-xl border-2 border-slate-200 px-4 pr-12 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
                        placeholder="••••••••"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword({ ...showPassword, current: !showPassword.current })}
                        className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1 text-slate-500 transition hover:bg-slate-100 hover:text-cyan-600"
                      >
                        {showPassword.current ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-bold text-slate-700">Mật khẩu mới <span className="text-red-500">*</span></label>
                    <div className="relative">
                      <input
                        type={showPassword.new ? 'text' : 'password'}
                        value={passwordForm.newPassword}
                        onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                        className="h-11 w-full rounded-xl border-2 border-slate-200 px-4 pr-12 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
                        placeholder="Tối thiểu 6 ký tự"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword({ ...showPassword, new: !showPassword.new })}
                        className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1 text-slate-500 transition hover:bg-slate-100 hover:text-cyan-600"
                      >
                        {showPassword.new ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-bold text-slate-700">Xác nhận mật khẩu mới <span className="text-red-500">*</span></label>
                    <div className="relative">
                      <input
                        type={showPassword.confirm ? 'text' : 'password'}
                        value={passwordForm.confirmPassword}
                        onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                        className="h-11 w-full rounded-xl border-2 border-slate-200 px-4 pr-12 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
                        placeholder="Nhập lại mật khẩu mới"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword({ ...showPassword, confirm: !showPassword.confirm })}
                        className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1 text-slate-500 transition hover:bg-slate-100 hover:text-cyan-600"
                      >
                        {showPassword.confirm ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="mt-8 flex justify-end gap-3">
                  <button type="button" onClick={closeModal} className="rounded-xl border-2 border-slate-200 px-5 py-2.5 font-bold text-slate-600 transition hover:bg-slate-50">
                    Hủy
                  </button>
                  <button 
                    type="submit" 
                    disabled={saving}
                    className="rounded-xl bg-cyan-600 px-6 py-2.5 font-bold text-white shadow-sm transition hover:bg-cyan-700 disabled:opacity-60"
                  >
                    {saving ? 'Đang xử lý...' : 'Xác nhận đổi'}
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