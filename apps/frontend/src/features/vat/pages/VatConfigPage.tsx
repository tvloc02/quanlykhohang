import React, { useState } from 'react';
import { Save, CheckCircle2, Home, ChevronRight, Settings, Building2 } from 'lucide-react';

export default function VatConfigPage() {
  const [formData, setFormData] = useState({
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
  });

  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* BREADCRUMB & HEADER BAR */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-1">
            <Home size={14} className="text-slate-400" />
            <span>Home</span>
            <ChevronRight size={12} />
            <span className="font-bold text-slate-800">VAT Config</span>
          </div>
          <h1 className="text-lg font-black tracking-tight text-slate-900 uppercase">
            THIẾT LẬP THÔNG TIN XUẤT HÓA ĐƠN VAT ĐIỆN TỬ
          </h1>
        </div>
      </div>

      {savedSuccess && (
        <div className="flex items-center gap-3 rounded-2xl border-2 border-emerald-500 bg-emerald-50 p-4 text-xs font-bold text-emerald-800 shadow-sm">
          <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
          <span>Lưu thông tin và cấu hình kết nối VAT Điện tử thành công!</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* SECTION 1: THÔNG TIN XUẤT HÓA ĐƠN */}
        <div className="rounded-2xl border-2 border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Building2 className="h-5 w-5 text-cyan-600" />
            <h2 className="text-xs font-black uppercase tracking-wider text-slate-800">
              THÔNG TIN XUẤT HÓA ĐƠN
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 text-xs">
            <div className="space-y-1">
              <label className="font-bold text-slate-700">MÃ SỐ THUẾ:</label>
              <input
                type="text"
                value={formData.taxCode}
                onChange={(e) => setFormData({ ...formData, taxCode: e.target.value })}
                className="w-full rounded-xl border-2 border-slate-200 bg-slate-50 px-3 py-2 font-mono font-bold text-slate-800 outline-none focus:border-cyan-500"
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-700">TÊN CÔNG TY:</label>
              <input
                type="text"
                value={formData.companyName}
                onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                className="w-full rounded-xl border-2 border-slate-200 bg-slate-50 px-3 py-2 font-bold text-slate-800 outline-none focus:border-cyan-500"
              />
            </div>

            <div className="space-y-1 md:col-span-2">
              <label className="font-bold text-slate-700">ĐỊA CHỈ:</label>
              <input
                type="text"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="w-full rounded-xl border-2 border-slate-200 bg-slate-50 px-3 py-2 font-bold text-slate-800 outline-none focus:border-cyan-500"
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-700">ĐIỆN THOẠI:</label>
              <input
                type="text"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full rounded-xl border-2 border-slate-200 bg-slate-50 px-3 py-2 font-bold text-slate-800 outline-none focus:border-cyan-500"
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-700">EMAIL:</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full rounded-xl border-2 border-slate-200 bg-slate-50 px-3 py-2 font-bold text-slate-800 outline-none focus:border-cyan-500"
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-700">NGƯỜI ĐẠI DIỆN:</label>
              <input
                type="text"
                value={formData.representative}
                onChange={(e) => setFormData({ ...formData, representative: e.target.value })}
                className="w-full rounded-xl border-2 border-slate-200 bg-slate-50 px-3 py-2 font-bold text-slate-800 outline-none focus:border-cyan-500"
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-700">TÀI KHOẢN NGÂN HÀNG:</label>
              <input
                type="text"
                value={formData.bankAccount}
                onChange={(e) => setFormData({ ...formData, bankAccount: e.target.value })}
                className="w-full rounded-xl border-2 border-slate-200 bg-slate-50 px-3 py-2 font-mono font-bold text-slate-800 outline-none focus:border-cyan-500"
              />
            </div>

            <div className="space-y-1 md:col-span-2">
              <label className="font-bold text-slate-700">TÊN NGÂN HÀNG:</label>
              <input
                type="text"
                value={formData.bankName}
                onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
                className="w-full rounded-xl border-2 border-slate-200 bg-slate-50 px-3 py-2 font-bold text-slate-800 outline-none focus:border-cyan-500"
              />
            </div>
          </div>
        </div>

        {/* SECTION 2: THÔNG TIN CẤU HÌNH KẾT NỐI - DO VIETTEL CUNG CẤP */}
        <div className="rounded-2xl border-2 border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Settings className="h-5 w-5 text-emerald-600" />
            <h2 className="text-xs font-black uppercase tracking-wider text-slate-800">
              THÔNG TIN CẤU HÌNH KẾT NỐI - DO VIETTEL CUNG CẤP
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 text-xs">
            <div className="space-y-1">
              <label className="font-bold text-slate-700">Tài khoản (User/Pass):</label>
              <input
                type="password"
                value={formData.userPass}
                onChange={(e) => setFormData({ ...formData, userPass: e.target.value })}
                className="w-full rounded-xl border-2 border-slate-200 bg-blue-50/50 px-3 py-2 font-bold text-slate-800 outline-none focus:border-cyan-500"
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-700">InvoiceType:</label>
              <input
                type="text"
                value={formData.invoiceType}
                onChange={(e) => setFormData({ ...formData, invoiceType: e.target.value })}
                className="w-full rounded-xl border-2 border-slate-200 bg-slate-50 px-3 py-2 font-mono font-bold text-slate-800 outline-none focus:border-cyan-500"
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-700">InvoiceSeries:</label>
              <input
                type="text"
                value={formData.invoiceSeries}
                onChange={(e) => setFormData({ ...formData, invoiceSeries: e.target.value })}
                className="w-full rounded-xl border-2 border-slate-200 bg-slate-50 px-3 py-2 font-mono font-bold text-slate-800 outline-none focus:border-cyan-500"
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-700">TemplateCode:</label>
              <input
                type="text"
                value={formData.templateCode}
                onChange={(e) => setFormData({ ...formData, templateCode: e.target.value })}
                className="w-full rounded-xl border-2 border-slate-200 bg-slate-50 px-3 py-2 font-mono font-bold text-slate-800 outline-none focus:border-cyan-500"
              />
            </div>

            <div className="space-y-1 md:col-span-2">
              <label className="font-bold text-slate-700">APILink:</label>
              <input
                type="text"
                value={formData.apiLink}
                onChange={(e) => setFormData({ ...formData, apiLink: e.target.value })}
                className="w-full rounded-xl border-2 border-slate-200 bg-slate-50 px-3 py-2 font-mono font-bold text-slate-800 outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-6 py-2.5 text-xs font-black uppercase text-white shadow-md hover:bg-cyan-700 transition cursor-pointer"
            >
              <Save size={16} />
              Lưu
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
