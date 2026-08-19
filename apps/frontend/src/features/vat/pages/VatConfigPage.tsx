import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Eye,
  EyeOff,
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
  Maximize2,
  Minimize2,
  RefreshCw,
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

export default function VatConfigPage() {
  const [formData, setFormData] = useState<VatConfigData>(readStoredVatConfig);
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error'>('success');

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToastMessage(msg);
    setToastType(type);
    setTimeout(() => setToastMessage(''), 3500);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      saveStoredVatConfig(formData);
      showToast('Đã lưu thiết lập thông tin xuất hóa đơn VAT Điện tử thành công!');
    } catch {
      showToast('Có lỗi xảy ra khi lưu cấu hình VAT Điện tử.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleResetDefault = () => {
    if (confirm('Bạn có muốn khôi phục cấu hình VAT về mặc định ban đầu?')) {
      setFormData(DEFAULT_VAT_CONFIG);
      saveStoredVatConfig(DEFAULT_VAT_CONFIG);
      showToast('Đã khôi phục cấu hình mặc định!');
    }
  };

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
        {/* Modern Header Banner Matching Outbound/Inbound Gold Standard */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="inline-flex items-center gap-2.5 rounded-2xl bg-cyan-600 px-5 py-2.5 text-white shadow-md">
              <FileCheck className="h-5 w-5" />
              <h1 className="text-xl font-extrabold tracking-tight uppercase">CẤU HÌNH HÓA ĐƠN VAT ĐIỆN TỬ</h1>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Reset default */}
            <button
              type="button"
              onClick={handleResetDefault}
              className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-cyan-700 bg-white px-5 py-2.5 text-sm font-extrabold text-cyan-700 shadow-xs transition hover:bg-cyan-50 active:scale-95 cursor-pointer"
            >
              <RefreshCw className="h-4.5 w-4.5 text-cyan-700" />
              Khôi phục mặc định
            </button>

            {/* Save Config Button Top Toolbar */}
            <button
              type="button"
              onClick={handleSubmit}
              disabled={saving}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-600 border-2 border-cyan-700 px-6 py-2.5 text-sm font-extrabold text-white shadow-md transition hover:bg-cyan-700 active:scale-95 cursor-pointer disabled:opacity-50"
            >
              <Save className="h-4.5 w-4.5" />
              {saving ? 'Đang lưu...' : 'Lưu cấu hình'}
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

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* SECTION 1: THÔNG TIN XUẤT HÓA ĐƠN DOANH NGHIỆP */}
          <div className="overflow-hidden rounded-2xl border-2 border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b-2 border-slate-200 bg-cyan-50 px-6 py-4">
              <div className="flex items-center gap-2.5">
                <Building2 className="h-5 w-5 text-cyan-700" />
                <h2 className="text-base font-extrabold text-slate-800 uppercase tracking-wide">
                  THÔNG TIN XUẤT HÓA ĐƠN DOANH NGHIỆP
                </h2>
              </div>
              <span className="text-xs font-bold text-slate-500 bg-white px-3 py-1 rounded-lg border border-slate-200">
                Thông tin xuất hiện trên hóa đơn GTGT
              </span>
            </div>

            <div className="p-6">
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                    <FileText size={16} className="text-cyan-600" />
                    Mã số thuế doanh nghiệp <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.taxCode}
                    onChange={(e) => setFormData({ ...formData, taxCode: e.target.value })}
                    className="w-full rounded-xl border-2 border-slate-200 bg-slate-50 px-4 py-3 font-mono text-sm font-bold text-slate-900 outline-none transition focus:border-cyan-600 focus:bg-white focus:ring-4 focus:ring-cyan-500/10"
                    placeholder="Nhập mã số thuế..."
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                    <Building2 size={16} className="text-cyan-600" />
                    Tên công ty / Đơn vị <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.companyName}
                    onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                    className="w-full rounded-xl border-2 border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-900 outline-none transition focus:border-cyan-600 focus:bg-white focus:ring-4 focus:ring-cyan-500/10"
                    placeholder="Nhập tên doanh nghiệp..."
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                    <MapPin size={16} className="text-cyan-600" />
                    Địa chỉ đăng ký kinh doanh <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="w-full rounded-xl border-2 border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-cyan-600 focus:bg-white focus:ring-4 focus:ring-cyan-500/10"
                    placeholder="Nhập địa chỉ đăng ký kinh doanh..."
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                    <Phone size={16} className="text-cyan-600" />
                    Số điện thoại liên hệ
                  </label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full rounded-xl border-2 border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-cyan-600 focus:bg-white focus:ring-4 focus:ring-cyan-500/10"
                    placeholder="Nhập số điện thoại..."
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                    <Mail size={16} className="text-cyan-600" />
                    Email nhận hóa đơn GTGT
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full rounded-xl border-2 border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-cyan-600 focus:bg-white focus:ring-4 focus:ring-cyan-500/10"
                    placeholder="Nhập email doanh nghiệp..."
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                    <User size={16} className="text-cyan-600" />
                    Người đại diện pháp luật
                  </label>
                  <input
                    type="text"
                    value={formData.representative}
                    onChange={(e) => setFormData({ ...formData, representative: e.target.value })}
                    className="w-full rounded-xl border-2 border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-cyan-600 focus:bg-white focus:ring-4 focus:ring-cyan-500/10"
                    placeholder="Nhập tên người đại diện..."
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                    <CreditCard size={16} className="text-cyan-600" />
                    Số tài khoản ngân hàng
                  </label>
                  <input
                    type="text"
                    value={formData.bankAccount}
                    onChange={(e) => setFormData({ ...formData, bankAccount: e.target.value })}
                    className="w-full rounded-xl border-2 border-slate-200 bg-slate-50 px-4 py-3 font-mono text-sm font-bold text-slate-900 outline-none transition focus:border-cyan-600 focus:bg-white focus:ring-4 focus:ring-cyan-500/10"
                    placeholder="Nhập số tài khoản ngân hàng..."
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                    <Building2 size={16} className="text-cyan-600" />
                    Tên ngân hàng mở tài khoản
                  </label>
                  <input
                    type="text"
                    value={formData.bankName}
                    onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
                    className="w-full rounded-xl border-2 border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-cyan-600 focus:bg-white focus:ring-4 focus:ring-cyan-500/10"
                    placeholder="Tên ngân hàng và chi nhánh..."
                  />
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 2: CẤU HÌNH KẾT NỐI VIETTEL S-INVOICE */}
          <div className="overflow-hidden rounded-2xl border-2 border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b-2 border-slate-200 bg-cyan-50 px-6 py-4">
              <div className="flex items-center gap-2.5">
                <Settings className="h-5 w-5 text-emerald-600" />
                <h2 className="text-base font-extrabold text-slate-800 uppercase tracking-wide">
                  THÔNG TIN CẤU HÌNH KẾT NỐI - DO VIETTEL CUNG CẤP
                </h2>
              </div>
              <span className="text-xs font-bold text-emerald-800 bg-emerald-50 px-3 py-1 rounded-lg border border-emerald-200">
                Viettel S-Invoice API Connect
              </span>
            </div>

            <div className="p-6">
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                    <Lock size={16} className="text-emerald-600" />
                    Tài khoản API (User/Pass)
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={formData.userPass}
                      onChange={(e) => setFormData({ ...formData, userPass: e.target.value })}
                      className="w-full rounded-xl border-2 border-slate-200 bg-slate-50 px-4 py-3 font-semibold text-slate-900 outline-none transition focus:border-cyan-600 focus:bg-white focus:ring-4 focus:ring-cyan-500/10 pr-12"
                      placeholder="Mật khẩu kết nối Viettel S-Invoice..."
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                      title={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                    <Key size={16} className="text-emerald-600" />
                    Mẫu số hóa đơn (InvoiceType)
                  </label>
                  <input
                    type="text"
                    value={formData.invoiceType}
                    onChange={(e) => setFormData({ ...formData, invoiceType: e.target.value })}
                    className="w-full rounded-xl border-2 border-slate-200 bg-slate-50 px-4 py-3 font-mono text-sm font-bold text-slate-900 outline-none transition focus:border-cyan-600 focus:bg-white focus:ring-4 focus:ring-cyan-500/10"
                    placeholder="Ví dụ: 01GTKT"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                    <FileText size={16} className="text-emerald-600" />
                    Ký hiệu hóa đơn (InvoiceSeries)
                  </label>
                  <input
                    type="text"
                    value={formData.invoiceSeries}
                    onChange={(e) => setFormData({ ...formData, invoiceSeries: e.target.value })}
                    className="w-full rounded-xl border-2 border-slate-200 bg-slate-50 px-4 py-3 font-mono text-sm font-bold text-slate-900 outline-none transition focus:border-cyan-600 focus:bg-white focus:ring-4 focus:ring-cyan-500/10"
                    placeholder="Ví dụ: AA/19E"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                    <FileCheck size={16} className="text-emerald-600" />
                    Mã mẫu (TemplateCode)
                  </label>
                  <input
                    type="text"
                    value={formData.templateCode}
                    onChange={(e) => setFormData({ ...formData, templateCode: e.target.value })}
                    className="w-full rounded-xl border-2 border-slate-200 bg-slate-50 px-4 py-3 font-mono text-sm font-bold text-slate-900 outline-none transition focus:border-cyan-600 focus:bg-white focus:ring-4 focus:ring-cyan-500/10"
                    placeholder="Ví dụ: 01GTKT0/001"
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                    <Globe size={16} className="text-emerald-600" />
                    Đường dẫn API (APILink)
                  </label>
                  <input
                    type="text"
                    value={formData.apiLink}
                    onChange={(e) => setFormData({ ...formData, apiLink: e.target.value })}
                    className="w-full rounded-xl border-2 border-slate-200 bg-slate-50 px-4 py-3 font-mono text-sm font-bold text-slate-900 outline-none transition focus:border-cyan-600 focus:bg-white focus:ring-4 focus:ring-cyan-500/10"
                    placeholder="Ví dụ: https://demo.sinvoice.viettel.vn:8443"
                  />
                </div>
              </div>

              {/* Form Save Button */}
              <div className="mt-8 flex items-center justify-end gap-3 border-t-2 border-slate-100 pt-6">
                <button
                  type="button"
                  onClick={handleResetDefault}
                  className="inline-flex items-center gap-2 rounded-xl border-2 border-slate-300 bg-white px-5 py-3 text-sm font-bold text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                >
                  <RefreshCw size={16} />
                  Khôi phục mặc định
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-7 py-3 text-sm font-extrabold text-white shadow-md hover:bg-cyan-700 transition active:scale-95 cursor-pointer disabled:opacity-50"
                >
                  <Save size={18} />
                  {saving ? 'Đang lưu cấu hình...' : 'Lưu cấu hình VAT'}
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
