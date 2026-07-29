import React from 'react';
import {
  Building2,
  CheckCircle2,
  Copy,
  Eye,
  EyeOff,
  FileText,
  Globe,
  Hash,
  KeyRound,
  Lock,
  Mail,
  MapPin,
  Phone,
  Save,
  ShieldCheck,
  UserCheck,
  X,
} from 'lucide-react';
import type { ProfileForm, SupplierProfile } from '../types';

const API_BASE_URL = 'http://localhost:3000/api';

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
  };
}

type SupplierInfoWindowProps = {
  profile: SupplierProfile | null;
  form: ProfileForm;
  setForm: React.Dispatch<React.SetStateAction<ProfileForm>>;
  compact?: boolean;
  saving?: boolean;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
};

export default function SupplierInfoWindow({
  profile,
  form,
  setForm,
  compact,
  saving,
  onSubmit,
}: SupplierInfoWindowProps) {
  const [copiedField, setCopiedField] = React.useState<string | null>(null);

  // Change Password Modal state
  const [changePasswordModalOpen, setChangePasswordModalOpen] = React.useState(false);
  const [newPassword, setNewPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [showPassword, setShowPassword] = React.useState(false);
  const [passwordSaving, setPasswordSaving] = React.useState(false);
  const [passwordError, setPasswordError] = React.useState('');
  const [passwordSuccess, setPasswordSuccess] = React.useState('');

  const copyToClipboard = (text: string, fieldName: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const isInactive = profile?.status === 'inactive';

  const handleChangePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');

    if (!newPassword.trim()) {
      setPasswordError('Vui lòng nhập mật khẩu mới.');
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError('Mật khẩu mới phải có ít nhất 6 ký tự.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Mật khẩu xác nhận không khớp với mật khẩu mới.');
      return;
    }

    setPasswordSaving(true);
    try {
      const response = await fetch(
        profile?.id ? `${API_BASE_URL}/suppliers/${profile.id}` : `${API_BASE_URL}/suppliers/me`,
        {
          method: 'PUT',
          headers: authHeaders(),
          body: JSON.stringify({
            accountPassword: newPassword.trim(),
          }),
        },
      );

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.message || 'Không thể đổi mật khẩu. Vui lòng thử lại.');
      }

      setPasswordSuccess('Đã đổi mật khẩu tài khoản thành công!');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => {
        setChangePasswordModalOpen(false);
        setPasswordSuccess('');
      }, 1800);
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : 'Lỗi khi đổi mật khẩu.');
    } finally {
      setPasswordSaving(false);
    }
  };

  if (compact) {
    return (
      <div className="flex h-full flex-col gap-3.5 text-slate-700">
        {/* Compact Mini Hero */}
        <div className="rounded-xl border border-cyan-500/30 bg-gradient-to-r from-cyan-600 via-cyan-700 to-teal-700 p-3.5 text-white shadow-xs">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/15 text-white border border-white/20">
                <Building2 className="h-5 w-5" />
              </div>
              <div>
                <p className="text-base font-bold text-white truncate">{profile?.name || 'Nhà cung cấp'}</p>
                <p className="text-xs font-normal text-cyan-100 flex items-center gap-1 mt-0.5">
                  <Hash className="h-3 w-3" /> Mã NCC: <span className="font-semibold">{profile?.supplierCode || '-'}</span>
                </p>
              </div>
            </div>
            <span
              className={`shrink-0 rounded-lg border px-2.5 py-1 text-xs font-bold ${
                isInactive
                  ? 'border-slate-300 bg-slate-100 text-slate-600'
                  : 'border-emerald-300/40 bg-emerald-400/20 text-emerald-100'
              }`}
            >
              {isInactive ? 'Ngừng hợp tác' : 'Đang hợp tác'}
            </span>
          </div>
        </div>

        {/* Detailed Grid */}
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-2xs">
            <p className="text-xs font-bold text-slate-500 flex items-center gap-1.5">
              <UserCheck className="h-3.5 w-3.5 text-cyan-600" /> Người liên hệ chính
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-800">{profile?.contactPerson || 'Chưa cập nhật'}</p>
            <p className="mt-0.5 text-xs text-slate-500 flex items-center gap-1">
              <Phone className="h-3 w-3 text-slate-400" /> {profile?.phone || '-'}
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-2xs">
            <p className="text-xs font-bold text-slate-500 flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5 text-cyan-600" /> Pháp lý & Đối soát
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-800">MST: {profile?.taxCode || 'Chưa cập nhật'}</p>
            <p className="mt-0.5 text-xs text-slate-500 flex items-center gap-1">
              <ShieldCheck className="h-3 w-3 text-emerald-600" /> Xác minh WMS Master
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-2xs sm:col-span-2">
            <p className="text-xs font-bold text-slate-500 flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5 text-cyan-600" /> Email đơn hàng PO
            </p>
            <p className="mt-1 text-sm font-normal text-slate-800">{profile?.email || 'Chưa cập nhật'}</p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-2xs sm:col-span-2">
            <p className="text-xs font-bold text-slate-500 flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-cyan-600" /> Địa chỉ kho / giao dịch
            </p>
            <p className="mt-1 text-sm font-normal text-slate-800 truncate">{profile?.address || 'Chưa cập nhật'}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {/* Cyan Theme Hero Banner */}
      <div className="relative overflow-hidden rounded-2xl border-2 border-cyan-500/30 bg-gradient-to-r from-cyan-600 via-cyan-700 to-teal-700 p-6 text-white shadow-lg shadow-cyan-700/10">
        <div className="relative z-10 flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-white/30 bg-white/15 text-white backdrop-blur-md shadow-sm">
              <Building2 className="h-7 w-7" />
            </div>
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-white md:text-3xl">
                {profile?.name || 'Chưa cập nhật tên nhà cung cấp'}
              </h2>
              <p className="mt-1 flex items-center gap-1.5 text-xs font-normal text-cyan-100">
                <MapPin className="h-3.5 w-3.5 text-cyan-200 shrink-0" />
                <span>{profile?.address || 'Chưa khai báo địa chỉ kho/giao dịch'}</span>
              </p>
            </div>
          </div>

          {/* Action Buttons on the Right Side of Banner */}
          <div className="flex shrink-0 items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-bold text-cyan-700 shadow-md transition hover:bg-cyan-50 disabled:opacity-60"
            >
              <Save className="h-4 w-4 text-cyan-600" />
              {saving ? 'Đang lưu...' : 'Sửa thông tin'}
            </button>

            <button
              type="button"
              onClick={() => {
                setPasswordError('');
                setPasswordSuccess('');
                setNewPassword('');
                setConfirmPassword('');
                setChangePasswordModalOpen(true);
              }}
              className="inline-flex items-center gap-2 rounded-xl border border-white/30 bg-white/20 px-5 py-2.5 text-sm font-bold text-white backdrop-blur-md transition hover:bg-white/30"
            >
              <KeyRound className="h-4 w-4 text-cyan-100" />
              Đổi mật khẩu
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Cards */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Card 1: Thông tin cơ bản & Pháp lý */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="mb-4 flex items-center gap-2.5 border-b border-slate-100 pb-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-50 text-cyan-600">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Thông tin cơ bản & Pháp lý</h3>
              <p className="text-xs font-normal text-slate-500">Mã doanh nghiệp và mã số thuế đối soát</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-bold text-slate-700">Mã nhà cung cấp</label>
                <div className="relative">
                  <input
                    value={profile?.supplierCode || ''}
                    readOnly
                    className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-sm font-normal uppercase text-slate-800 outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => copyToClipboard(profile?.supplierCode || '', 'supplierCode')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-cyan-600"
                    title="Sao chép mã"
                  >
                    {copiedField === 'supplierCode' ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-bold text-slate-700">Mã số thuế doanh nghiệp</label>
                <div className="relative">
                  <input
                    value={form.taxCode}
                    onChange={(e) => setForm((curr) => ({ ...curr, taxCode: e.target.value }))}
                    className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-normal text-slate-800 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20"
                    placeholder="Nhập mã số thuế..."
                  />
                  <FileText className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                </div>
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-bold text-slate-700">Tên nhà cung cấp đầy đủ</label>
              <div className="relative">
                <input
                  value={profile?.name || ''}
                  readOnly
                  className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-sm font-normal text-slate-800 outline-none"
                />
                <Globe className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              </div>
            </div>
          </div>
        </div>

        {/* Card 2: Thông tin liên hệ & Địa chỉ */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="mb-4 flex items-center gap-2.5 border-b border-slate-100 pb-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-50 text-cyan-600">
              <Phone className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Liên hệ & Địa điểm</h3>
              <p className="text-xs font-normal text-slate-500">Thông tin người đại diện và địa chỉ nhận đơn PO</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-bold text-slate-700">Người liên hệ chính</label>
                <div className="relative">
                  <input
                    value={form.contactPerson}
                    onChange={(e) => setForm((curr) => ({ ...curr, contactPerson: e.target.value }))}
                    className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-normal text-slate-800 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20"
                    placeholder="Tên đại diện kinh doanh..."
                  />
                  <UserCheck className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-bold text-slate-700">Số điện thoại liên hệ</label>
                <div className="relative">
                  <input
                    value={form.phone}
                    onChange={(e) => setForm((curr) => ({ ...curr, phone: e.target.value }))}
                    className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-normal text-slate-800 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20"
                    placeholder="Số điện thoại hotline..."
                  />
                  <Phone className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                </div>
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-bold text-slate-700">Email nhận đơn hàng PO</label>
              <div className="relative">
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((curr) => ({ ...curr, email: e.target.value }))}
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-normal text-slate-800 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20"
                  placeholder="Email nhận đơn hàng PO..."
                />
                <Mail className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-bold text-slate-700">Địa chỉ văn phòng / Kho giao hàng</label>
              <div className="relative">
                <MapPin className="absolute left-3.5 top-3 h-4 w-4 text-cyan-600" />
                <textarea
                  rows={2}
                  value={form.address}
                  onChange={(e) => setForm((curr) => ({ ...curr, address: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3.5 pt-2 text-sm font-normal text-slate-800 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20"
                  placeholder="Địa chỉ giao nhận hàng hóa..."
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Change Password Modal */}
      {changePasswordModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-50 text-cyan-600">
                  <Lock className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Đổi mật khẩu tài khoản</h3>
                  <p className="text-xs font-normal text-slate-500">Cập nhật mật khẩu mới cho NCC</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setChangePasswordModalOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleChangePasswordSubmit} className="p-6 space-y-4">
              {passwordError && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-600">
                  {passwordError}
                </div>
              )}
              {passwordSuccess && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-medium text-emerald-700">
                  {passwordSuccess}
                </div>
              )}

              <div>
                <label className="mb-1.5 block text-xs font-bold text-slate-700">Mật khẩu mới</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3.5 pr-10 text-sm font-normal outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20"
                    placeholder="Ít nhất 6 ký tự..."
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((curr) => !curr)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-bold text-slate-700">Nhập lại mật khẩu mới</label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-normal outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20"
                  placeholder="Nhập lại mật khẩu mới..."
                />
              </div>

              <div className="mt-6 flex justify-end gap-3 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => setChangePasswordModalOpen(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={passwordSaving}
                  className="rounded-xl bg-cyan-600 px-5 py-2 text-sm font-bold text-white shadow-xs transition hover:bg-cyan-700 disabled:opacity-60"
                >
                  {passwordSaving ? 'Đang lưu...' : 'Xác nhận đổi mật khẩu'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </form>
  );
}
