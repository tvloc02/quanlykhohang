import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Building2,
  Settings,
  Save,
  CheckCircle,
  XCircle,
  X,
  FileCheck,
  Globe,
  Key,
  CreditCard,
  Phone,
  Mail,
  User,
  MapPin,
  FileText,
  Lock,
} from 'lucide-react';

const VAT_CONFIG_STORAGE_KEY = 'smart-wms-vat-config-data';

export interface VatConfigData {
  taxCode: string;
  companyName: string;
  address: string;
  phone: string;
  email: string;
  representative: string;
  bankAccount: string;
  bankName: string;
  userPass: string;
  invoiceType: string;
  invoiceSeries: string;
  templateCode: string;
  apiLink: string;
}

export const DEFAULT_VAT_CONFIG: VatConfigData = {
  taxCode: '0100109106-623',
  companyName: 'CÔNG TY TNHH MTV PHẦN MỀM RIC',
  address: 'Tập thể Ngân hàng, Tổ dân phố Hoàng 6, P.Cổ Nhuế 1, Q.Bắc Từ Liêm, Tp.Hà Nội',
  phone: '097 247 8383',
  email: 'lienhe@ric.vn',
  representative: 'Đàm Minh Huệ',
  bankAccount: '2201000221363',
  bankName: 'BIDV - CN.Thăng Long',
  userPass: 'ric_viettel_account_2026',
  invoiceType: '01GTKT',
  invoiceSeries: 'AA/19E',
  templateCode: '01GTKT0/001',
  apiLink: 'https://demo.sinvoice.viettel.vn:8443',
};

export function readStoredVatConfig(): VatConfigData {
  try {
    const raw = localStorage.getItem(VAT_CONFIG_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') return { ...DEFAULT_VAT_CONFIG, ...parsed };
    }
  } catch {
    // fallback
  }
  return DEFAULT_VAT_CONFIG;
}

export function saveStoredVatConfig(config: VatConfigData) {
  localStorage.setItem(VAT_CONFIG_STORAGE_KEY, JSON.stringify(config));
  window.dispatchEvent(new Event('storage'));
}

function Toast({ message, type, onClose }: { message: string; type: 'success' | 'error'; onClose: () => void }) {
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => onClose(), 3500);
      return () => clearTimeout(timer);
    }
  }, [message, onClose]);

  if (!message) return null;

  return createPortal(
    <div
      className={`fixed top-6 right-6 z-[9999] pointer-events-auto flex items-center gap-3 rounded-2xl px-5 py-3.5 shadow-2xl transition-all border backdrop-blur-md animate-in slide-in-from-top-4 ${
        type === 'error' ? 'bg-red-50/95 text-red-700 border-red-200' : 'bg-emerald-50/95 text-emerald-800 border-emerald-200'
      }`}
    >
      {type === 'error' ? <XCircle className="h-5 w-5 flex-shrink-0 text-red-600" /> : <CheckCircle className="h-5 w-5 flex-shrink-0 text-emerald-600" />}
      <p className="text-sm font-extrabold">{message}</p>
      <button type="button" onClick={onClose} className="ml-2 rounded-lg p-1 hover:bg-black/5 transition cursor-pointer">
        <X className="h-4 w-4" />
      </button>
    </div>,
    document.body
  );
}

export default function VatConfigPage() {
  const [formData, setFormData] = useState<VatConfigData>(readStoredVatConfig);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    try {
      saveStoredVatConfig(formData);
      setSuccess('Đã lưu thiết lập thông tin xuất hóa đơn VAT Điện tử thành công!');
    } catch {
      setError('Có lỗi xảy ra khi lưu cấu hình VAT Điện tử.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      <Toast message={success || error} type={error ? 'error' : 'success'} onClose={() => { setSuccess(''); setError(''); }} />

      {/* PAGE TITLE BAR MATCHING PERSONNEL DESIGN */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border-2 border-cyan-500 bg-cyan-600 text-white shadow-md">
            <FileCheck size={26} />
          </div>
          <div>
            <h1 className="text-lg font-black tracking-tight text-slate-900 uppercase">
              THIẾT LẬP THÔNG TIN XUẤT HÓA ĐƠN VAT ĐIỆN TỬ
            </h1>
            <p className="text-xs font-bold text-slate-500">
              Quản lý và cấu hình kết nối phát hành hóa đơn điện tử với dịch vụ Viettel S-Invoice
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleSubmit}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-xl border-2 border-cyan-500 bg-cyan-600 px-5 py-2.5 text-xs font-black uppercase text-white shadow-md hover:bg-cyan-700 transition cursor-pointer disabled:opacity-50"
        >
          <Save size={16} />
          {saving ? 'Đang lưu...' : 'Lưu cấu hình'}
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* SECTION 1: THÔNG TIN XUẤT HÓA ĐƠN */}
        <div className="rounded-2xl border-2 border-slate-200 bg-white p-6 shadow-sm space-y-5">
          <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
            <Building2 className="h-5 w-5 text-cyan-600" />
            <h2 className="text-xs font-black uppercase tracking-wider text-slate-800">
              THÔNG TIN XUẤT HÓA ĐƠN DOANH NGHIỆP
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-4.5 md:grid-cols-2 text-xs">
            <div className="space-y-1.5">
              <label className="font-extrabold text-slate-700 flex items-center gap-1.5">
                <FileText size={14} className="text-slate-400" />
                MÃ SỐ THUẾ:
              </label>
              <input
                type="text"
                value={formData.taxCode}
                onChange={(e) => setFormData({ ...formData, taxCode: e.target.value })}
                className="w-full rounded-xl border-2 border-slate-200 bg-slate-50 px-3.5 py-2.5 font-mono font-extrabold text-slate-900 outline-none transition focus:border-cyan-500 focus:bg-white focus:ring-4 focus:ring-cyan-500/10"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-extrabold text-slate-700 flex items-center gap-1.5">
                <Building2 size={14} className="text-slate-400" />
                TÊN CÔNG TY:
              </label>
              <input
                type="text"
                value={formData.companyName}
                onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                className="w-full rounded-xl border-2 border-slate-200 bg-slate-50 px-3.5 py-2.5 font-extrabold text-slate-900 outline-none transition focus:border-cyan-500 focus:bg-white focus:ring-4 focus:ring-cyan-500/10"
              />
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <label className="font-extrabold text-slate-700 flex items-center gap-1.5">
                <MapPin size={14} className="text-slate-400" />
                ĐỊA CHỈ:
              </label>
              <input
                type="text"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="w-full rounded-xl border-2 border-slate-200 bg-slate-50 px-3.5 py-2.5 font-extrabold text-slate-900 outline-none transition focus:border-cyan-500 focus:bg-white focus:ring-4 focus:ring-cyan-500/10"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-extrabold text-slate-700 flex items-center gap-1.5">
                <Phone size={14} className="text-slate-400" />
                ĐỊA CHỈ ĐIỆN THOẠI:
              </label>
              <input
                type="text"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full rounded-xl border-2 border-slate-200 bg-slate-50 px-3.5 py-2.5 font-extrabold text-slate-900 outline-none transition focus:border-cyan-500 focus:bg-white focus:ring-4 focus:ring-cyan-500/10"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-extrabold text-slate-700 flex items-center gap-1.5">
                <Mail size={14} className="text-slate-400" />
                EMAIL NHẬN HÓA ĐƠN:
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full rounded-xl border-2 border-slate-200 bg-slate-50 px-3.5 py-2.5 font-extrabold text-slate-900 outline-none transition focus:border-cyan-500 focus:bg-white focus:ring-4 focus:ring-cyan-500/10"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-extrabold text-slate-700 flex items-center gap-1.5">
                <User size={14} className="text-slate-400" />
                NGƯỜI ĐẠI DIỆN PHÁP LUẬT:
              </label>
              <input
                type="text"
                value={formData.representative}
                onChange={(e) => setFormData({ ...formData, representative: e.target.value })}
                className="w-full rounded-xl border-2 border-slate-200 bg-slate-50 px-3.5 py-2.5 font-extrabold text-slate-900 outline-none transition focus:border-cyan-500 focus:bg-white focus:ring-4 focus:ring-cyan-500/10"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-extrabold text-slate-700 flex items-center gap-1.5">
                <CreditCard size={14} className="text-slate-400" />
                TÀI KHOẢN NGÂN HÀNG:
              </label>
              <input
                type="text"
                value={formData.bankAccount}
                onChange={(e) => setFormData({ ...formData, bankAccount: e.target.value })}
                className="w-full rounded-xl border-2 border-slate-200 bg-slate-50 px-3.5 py-2.5 font-mono font-extrabold text-slate-900 outline-none transition focus:border-cyan-500 focus:bg-white focus:ring-4 focus:ring-cyan-500/10"
              />
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <label className="font-extrabold text-slate-700 flex items-center gap-1.5">
                <Building2 size={14} className="text-slate-400" />
                TÊN NGÂN HÀNG:
              </label>
              <input
                type="text"
                value={formData.bankName}
                onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
                className="w-full rounded-xl border-2 border-slate-200 bg-slate-50 px-3.5 py-2.5 font-extrabold text-slate-900 outline-none transition focus:border-cyan-500 focus:bg-white focus:ring-4 focus:ring-cyan-500/10"
              />
            </div>
          </div>
        </div>

        {/* SECTION 2: THÔNG TIN CẤU HÌNH KẾT NỐI - DO VIETTEL CUNG CẤP */}
        <div className="rounded-2xl border-2 border-slate-200 bg-white p-6 shadow-sm space-y-5">
          <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
            <Settings className="h-5 w-5 text-emerald-600" />
            <h2 className="text-xs font-black uppercase tracking-wider text-slate-800">
              THÔNG TIN CẤU HÌNH KẾT NỐI - DO VIETTEL CUNG CẤP
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-4.5 md:grid-cols-2 text-xs">
            <div className="space-y-1.5">
              <label className="font-extrabold text-slate-700 flex items-center gap-1.5">
                <Lock size={14} className="text-slate-400" />
                Tài khoản (User/Pass):
              </label>
              <input
                type="password"
                value={formData.userPass}
                onChange={(e) => setFormData({ ...formData, userPass: e.target.value })}
                className="w-full rounded-xl border-2 border-slate-200 bg-blue-50/60 px-3.5 py-2.5 font-extrabold text-slate-900 outline-none transition focus:border-cyan-500 focus:bg-white focus:ring-4 focus:ring-cyan-500/10"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-extrabold text-slate-700 flex items-center gap-1.5">
                <Key size={14} className="text-slate-400" />
                InvoiceType:
              </label>
              <input
                type="text"
                value={formData.invoiceType}
                onChange={(e) => setFormData({ ...formData, invoiceType: e.target.value })}
                className="w-full rounded-xl border-2 border-slate-200 bg-slate-50 px-3.5 py-2.5 font-mono font-extrabold text-slate-900 outline-none transition focus:border-cyan-500 focus:bg-white focus:ring-4 focus:ring-cyan-500/10"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-extrabold text-slate-700 flex items-center gap-1.5">
                <FileText size={14} className="text-slate-400" />
                InvoiceSeries:
              </label>
              <input
                type="text"
                value={formData.invoiceSeries}
                onChange={(e) => setFormData({ ...formData, invoiceSeries: e.target.value })}
                className="w-full rounded-xl border-2 border-slate-200 bg-slate-50 px-3.5 py-2.5 font-mono font-extrabold text-slate-900 outline-none transition focus:border-cyan-500 focus:bg-white focus:ring-4 focus:ring-cyan-500/10"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-extrabold text-slate-700 flex items-center gap-1.5">
                <FileCheck size={14} className="text-slate-400" />
                TemplateCode:
              </label>
              <input
                type="text"
                value={formData.templateCode}
                onChange={(e) => setFormData({ ...formData, templateCode: e.target.value })}
                className="w-full rounded-xl border-2 border-slate-200 bg-slate-50 px-3.5 py-2.5 font-mono font-extrabold text-slate-900 outline-none transition focus:border-cyan-500 focus:bg-white focus:ring-4 focus:ring-cyan-500/10"
              />
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <label className="font-extrabold text-slate-700 flex items-center gap-1.5">
                <Globe size={14} className="text-slate-400" />
                APILink:
              </label>
              <input
                type="text"
                value={formData.apiLink}
                onChange={(e) => setFormData({ ...formData, apiLink: e.target.value })}
                className="w-full rounded-xl border-2 border-slate-200 bg-slate-50 px-3.5 py-2.5 font-mono font-extrabold text-slate-900 outline-none transition focus:border-cyan-500 focus:bg-white focus:ring-4 focus:ring-cyan-500/10"
              />
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-xl border-2 border-cyan-500 bg-cyan-600 px-6 py-2.5 text-xs font-black uppercase text-white shadow-md hover:bg-cyan-700 transition cursor-pointer disabled:opacity-50"
            >
              <Save size={16} />
              {saving ? 'Đang lưu...' : 'Lưu cấu hình'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
