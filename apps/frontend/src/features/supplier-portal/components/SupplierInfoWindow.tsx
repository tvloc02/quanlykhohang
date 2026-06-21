import React from 'react';
import { Clock, Mail, MapPin, Phone, Save, ShieldCheck, User } from 'lucide-react';
import type { ProfileForm, SupplierProfile } from '../types';

type SupplierInfoWindowProps = {
  profile: SupplierProfile | null;
  form: ProfileForm;
  setForm: React.Dispatch<React.SetStateAction<ProfileForm>>;
  compact?: boolean;
  saving?: boolean;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
};

function priorityLabel(value?: string) {
  return value === 'strategic' ? 'NCC chiến lược' : 'NCC phụ';
}

export default function SupplierInfoWindow({ profile, form, setForm, compact, saving, onSubmit }: SupplierInfoWindowProps) {
  if (compact) {
    return (
      <div className="grid h-full grid-cols-1 gap-3 text-sm text-slate-700 md:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs font-black uppercase text-slate-500">Mã nhà cung cấp</p>
          <p className="mt-2 text-lg font-black text-slate-900">{profile?.supplierCode || '-'}</p>
          <p className="mt-1 truncate font-bold text-slate-700">{profile?.name || '-'}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs font-black uppercase text-slate-500">Trạng thái</p>
          <span className="mt-2 inline-flex rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">
            {profile?.status === 'inactive' ? 'Ngừng hợp tác' : 'Đang hợp tác'}
          </span>
          <p className="mt-2 text-sm font-bold text-slate-700">{priorityLabel(profile?.priorityLevel)}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="flex items-center gap-2 font-bold">
            <User className="h-4 w-4 text-cyan-600" />
            {profile?.contactPerson || 'Chưa có người liên hệ'}
          </p>
          <p className="mt-2 flex items-center gap-2">
            <Phone className="h-4 w-4 text-slate-400" />
            {profile?.phone || '-'}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-slate-400" />
            {profile?.email || '-'}
          </p>
          <p className="mt-2 flex items-center gap-2">
            <Clock className="h-4 w-4 text-slate-400" />
            Lead time {profile?.leadTimeDays || 0} ngày
          </p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="rounded-xl border-2 border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-black uppercase text-slate-500">Mã NCC</p>
          <p className="mt-2 text-2xl font-black text-slate-900">{profile?.supplierCode || '-'}</p>
        </div>
        <div className="rounded-xl border-2 border-slate-200 bg-slate-50 p-4 md:col-span-2">
          <p className="text-xs font-black uppercase text-slate-500">Tên nhà cung cấp</p>
          <p className="mt-2 text-xl font-black text-slate-900">{profile?.name || '-'}</p>
        </div>
        <div className="rounded-xl border-2 border-emerald-200 bg-emerald-50 p-4">
          <p className="text-xs font-black uppercase text-emerald-600">Tình trạng</p>
          <p className="mt-2 text-lg font-black text-emerald-700">
            {profile?.status === 'inactive' ? 'Ngừng hợp tác' : 'Đang hợp tác'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <div>
          <label className="mb-2 block text-sm font-bold text-slate-700">Mã số thuế</label>
          <input value={form.taxCode} onChange={(event) => setForm((current) => ({ ...current, taxCode: event.target.value }))} className="h-11 w-full rounded-xl border-2 border-slate-200 px-4 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10" />
        </div>
        <div>
          <label className="mb-2 block text-sm font-bold text-slate-700">Người liên hệ chính</label>
          <input value={form.contactPerson} onChange={(event) => setForm((current) => ({ ...current, contactPerson: event.target.value }))} className="h-11 w-full rounded-xl border-2 border-slate-200 px-4 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10" />
        </div>
        <div>
          <label className="mb-2 block text-sm font-bold text-slate-700">Số điện thoại</label>
          <input value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} className="h-11 w-full rounded-xl border-2 border-slate-200 px-4 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10" />
        </div>
        <div>
          <label className="mb-2 block text-sm font-bold text-slate-700">Email nhận PO</label>
          <input type="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} className="h-11 w-full rounded-xl border-2 border-slate-200 px-4 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10" />
        </div>
        <div className="md:col-span-2">
          <label className="mb-2 block text-sm font-bold text-slate-700">Địa chỉ văn phòng/kho</label>
          <div className="relative">
            <MapPin className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <input value={form.address} onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))} className="h-11 w-full rounded-xl border-2 border-slate-200 pl-11 pr-4 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-4">
        <div>
          <label className="mb-2 block text-sm font-bold text-slate-700">Lead time trung bình</label>
          <input type="number" min={0} value={form.leadTimeDays} onChange={(event) => setForm((current) => ({ ...current, leadTimeDays: event.target.value }))} className="h-11 w-full rounded-xl border-2 border-slate-200 px-4 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10" />
        </div>
        <div>
          <label className="mb-2 block text-sm font-bold text-slate-700">Điều khoản thanh toán</label>
          <input value={form.paymentTerms} onChange={(event) => setForm((current) => ({ ...current, paymentTerms: event.target.value }))} className="h-11 w-full rounded-xl border-2 border-slate-200 px-4 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10" />
        </div>
        <div>
          <label className="mb-2 block text-sm font-bold text-slate-700">Tiền tệ</label>
          <input value={form.currency} onChange={(event) => setForm((current) => ({ ...current, currency: event.target.value }))} className="h-11 w-full rounded-xl border-2 border-slate-200 px-4 uppercase outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10" />
        </div>
        <div>
          <label className="mb-2 block text-sm font-bold text-slate-700">Mức ưu tiên</label>
          <select value={form.priorityLevel} onChange={(event) => setForm((current) => ({ ...current, priorityLevel: event.target.value as ProfileForm['priorityLevel'] }))} className="h-11 w-full rounded-xl border-2 border-slate-200 bg-white px-4 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10">
            <option value="strategic">NCC chiến lược</option>
            <option value="secondary">NCC phụ</option>
          </select>
        </div>
      </div>

      <div className="flex items-center justify-between rounded-xl border-2 border-cyan-100 bg-cyan-50 px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-bold text-cyan-800">
          <ShieldCheck className="h-5 w-5" />
          Thông tin này dùng để WMS tính kế hoạch mua hàng, lead time và nhắc đặt hàng.
        </div>
        <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-5 py-2.5 font-bold text-white shadow-sm transition hover:bg-cyan-700 disabled:opacity-60">
          <Save className="h-4 w-4" />
          {saving ? 'Đang lưu...' : 'Lưu hồ sơ'}
        </button>
      </div>
    </form>
  );
}
