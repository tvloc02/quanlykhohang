import React from 'react';
import { documentsApi, type SalesInvoiceDoc } from '../api/documentsApi';
import {
  FileText,
  Search,
  Eye,
  Printer,
  SlidersHorizontal,
  X,
  CheckCircle2,
  Calendar,
  DollarSign,
  Package,
  Layers,
  FileCheck,
} from 'lucide-react';

export default function SalesInvoiceDocPage() {
  const [invoices, setInvoices] = React.useState<SalesInvoiceDoc[]>([]);
  const [loading, setLoading] = React.useState<boolean>(true);
  const [search, setSearch] = React.useState<string>('');
  const [statusFilter, setStatusFilter] = React.useState<string>('ALL');
  const [showAdvancedSearch, setShowAdvancedSearch] = React.useState<boolean>(false);
  const [template, setTemplate] = React.useState<string>('STANDARD');
  const [previewDoc, setPreviewDoc] = React.useState<SalesInvoiceDoc | null>(null);

  // Pagination states
  const [pageSize, setPageSize] = React.useState<number>(10);
  const [currentPage, setCurrentPage] = React.useState<number>(1);

  React.useEffect(() => {
    async function loadData() {
      setLoading(true);
      const data = await documentsApi.getSalesInvoices();
      setInvoices(data);
      if (data.length > 0) {
        // default preview first doc if needed, or null
      }
      setLoading(false);
    }
    loadData();
  }, []);

  const formatMoney = (val: number) => {
    return new Intl.NumberFormat('vi-VN').format(val);
  };

  const filteredInvoices = invoices.filter((inv) => {
    const keyword = search.trim().toLowerCase();
    const matchesKeyword =
      !keyword ||
      inv.invoiceNo.toLowerCase().includes(keyword) ||
      inv.customerName.toLowerCase().includes(keyword) ||
      inv.orderCode.toLowerCase().includes(keyword) ||
      inv.items.some((item) => item.productName.toLowerCase().includes(keyword) || item.productCode.toLowerCase().includes(keyword));

    if (!matchesKeyword) return false;

    if (showAdvancedSearch) {
      if (statusFilter !== 'ALL' && inv.status !== statusFilter) {
        return false;
      }
    }
    return true;
  });

  // Calculate Pagination
  const totalItems = filteredInvoices.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const paginatedInvoices = filteredInvoices.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const totalInvoiceValue = invoices.reduce((sum, inv) => {
    const sub = inv.items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
    return sum + sub * 1.1; // with 10% tax
  }, 0);

  const totalItemsCount = invoices.reduce((sum, inv) => sum + inv.items.reduce((s, i) => s + i.quantity, 0), 0);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="p-4 sm:p-6 font-sans space-y-6">
      {/* Header Banner matching /products/main style */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-4">
        <div>
          <div className="inline-flex items-center gap-2.5 rounded-xl border-2 border-cyan-500 bg-cyan-600 px-4 py-2 text-white shadow-md">
            <FileText className="h-5 w-5 text-cyan-100" />
            <h1 className="text-lg font-bold tracking-tight text-white uppercase">Lập Hóa Đơn Bán Hàng</h1>
          </div>
          <p className="mt-2 text-xs font-semibold text-slate-500">
            Danh sách hóa đơn tài chính GTGT phát sinh từ các đơn xuất bán hàng hóa
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 shadow-xs">
            <Layers className="h-4 w-4 text-cyan-600" />
            <span className="text-xs font-bold text-slate-600">Đổi Mẫu In:</span>
            <select
              value={template}
              onChange={(e) => setTemplate(e.target.value)}
              className="bg-transparent text-xs font-bold text-slate-800 outline-none cursor-pointer"
            >
              <option value="STANDARD">Mẫu Tiêu Chuẩn (Bộ Tài Chính)</option>
              <option value="DETAILED">Mẫu Chi Tiết Đơn Hàng</option>
              <option value="OFFICIAL">Mẫu Thương Mại Điện Tử</option>
            </select>
          </div>
        </div>
      </div>

      {/* 4 Cards Summary Strip matching /products/main */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex h-[76px] items-center justify-between rounded-xl border-2 border-cyan-500 bg-white px-5 shadow-xs transition hover:bg-cyan-50/50">
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase">TỔNG SỐ HÓA ĐƠN</p>
            <p className="text-xl font-black text-cyan-700 mt-0.5">{invoices.length} Hóa đơn</p>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-100 text-cyan-700 font-bold">
            <FileCheck className="h-5 w-5" />
          </div>
        </div>

        <div className="flex h-[76px] items-center justify-between rounded-xl border-2 border-cyan-500 bg-white px-5 shadow-xs transition hover:bg-cyan-50/50">
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase">TỔNG HÀNG XUẤT BÁN</p>
            <p className="text-xl font-black text-cyan-700 mt-0.5">{formatMoney(totalItemsCount)} SP</p>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-100 text-cyan-700 font-bold">
            <Package className="h-5 w-5" />
          </div>
        </div>

        <div className="flex h-[76px] items-center justify-between rounded-xl border-2 border-cyan-500 bg-white px-5 shadow-xs transition hover:bg-cyan-50/50">
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase">TỔNG GIÁ TRỊ HÓA ĐƠN</p>
            <p className="text-xl font-black text-cyan-700 mt-0.5">{formatMoney(totalInvoiceValue)} đ</p>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-100 text-cyan-700 font-bold">
            <DollarSign className="h-5 w-5" />
          </div>
        </div>

        <div className="flex h-[76px] items-center justify-between rounded-xl border-2 border-cyan-500 bg-white px-5 shadow-xs transition hover:bg-cyan-50/50">
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase">ĐÃ KÝ & TỰ ĐỘNG PHÁT HÀNH</p>
            <p className="text-xl font-black text-emerald-600 mt-0.5">{invoices.length} / {invoices.length} (100%)</p>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 font-bold">
            <CheckCircle2 className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* Search & Toolbar */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-cyan-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-11 w-full rounded-xl border-2 border-cyan-500 bg-white pl-11 pr-4 text-sm font-medium outline-none transition focus:border-cyan-600 focus:ring-4 focus:ring-cyan-500/10"
              placeholder="Tìm hóa đơn theo số HD, tên khách hàng, mã đơn hàng, sản phẩm..."
            />
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setShowAdvancedSearch((prev) => !prev)}
              className={`inline-flex h-11 items-center justify-center gap-2 rounded-xl border-2 px-4 text-xs font-bold transition cursor-pointer ${
                showAdvancedSearch
                  ? 'border-cyan-600 bg-cyan-50 text-cyan-700'
                  : 'border-cyan-600 bg-white text-cyan-600 hover:bg-cyan-50'
              }`}
            >
              <SlidersHorizontal className="h-4 w-4" />
              Bộ lọc nâng cao
            </button>
          </div>
        </div>

        {/* Panel Tìm kiếm nâng cao */}
        {showAdvancedSearch && (
          <div className="rounded-2xl border-2 border-cyan-100 bg-cyan-50/40 p-5 space-y-4 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black uppercase tracking-wider text-cyan-800">Bộ lọc trạng thái</h3>
              <button
                type="button"
                onClick={() => setStatusFilter('ALL')}
                className="text-xs font-bold text-slate-500 hover:text-cyan-700 hover:underline cursor-pointer"
              >
                Xóa bộ lọc
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              {[
                { key: 'ALL', label: 'Tất cả trạng thái' },
                { key: 'PAID', label: 'Đã thanh toán' },
                { key: 'ISSUED', label: 'Đã phát hành' },
                { key: 'DRAFT', label: 'Bản nháp' },
              ].map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setStatusFilter(item.key)}
                  className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition border cursor-pointer ${
                    statusFilter === item.key
                      ? 'bg-cyan-600 text-white border-cyan-600 shadow-xs'
                      : 'bg-white text-slate-700 border-slate-200 hover:border-cyan-300 hover:bg-cyan-50/50'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Main Table Section matching /products/main */}
      <div className="overflow-hidden rounded-xl border-2 border-slate-200 bg-white shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse bg-white">
            <thead className="bg-cyan-50">
              <tr className="border-b-2 border-slate-200 text-center text-xs font-extrabold uppercase text-slate-800">
                <th className="w-10 border-x border-slate-200 px-3 py-3.5">
                  <input type="checkbox" className="h-4 w-4 rounded border-slate-300 accent-cyan-600" />
                </th>
                <th className="w-12 border-x border-slate-200 px-3 py-3.5">STT</th>
                <th className="border-x border-slate-200 px-3 py-3.5">Số Hóa Đơn</th>
                <th className="border-x border-slate-200 px-3 py-3.5">Mã Đơn Hàng</th>
                <th className="min-w-[180px] border-x border-slate-200 px-3 py-3.5">Khách Hàng</th>
                <th className="border-x border-slate-200 px-3 py-3.5">Ngày Phát Hành</th>
                <th className="border-x border-slate-200 px-3 py-3.5">Số SP</th>
                <th className="border-x border-slate-200 px-3 py-3.5">Tổng Tiền (Gồm Thuế)</th>
                <th className="border-x border-slate-200 px-3 py-3.5">Trạng Thái</th>
                <th className="sticky right-0 border-l border-slate-200 bg-cyan-50 px-3 py-3.5 min-w-[160px]">
                  THAO TÁC
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={10} className="px-6 py-12 text-center text-sm font-medium text-slate-500">
                    Đang tải danh sách hóa đơn...
                  </td>
                </tr>
              ) : paginatedInvoices.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-6 py-12 text-center text-sm font-medium text-slate-500">
                    Chưa có hóa đơn nào phù hợp.
                  </td>
                </tr>
              ) : (
                paginatedInvoices.map((inv, idx) => {
                  const subTotal = inv.items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
                  const total = subTotal * 1.1;

                  return (
                    <tr key={inv.id} className="group border-b border-slate-200 transition hover:bg-cyan-50/40 text-center text-xs font-semibold text-slate-700">
                      <td className="border-x border-slate-200 px-3 py-3">
                        <input type="checkbox" className="h-4 w-4 rounded border-slate-300 accent-cyan-600" />
                      </td>
                      <td className="border-x border-slate-200 px-3 py-3 font-extrabold text-slate-800">
                        {(currentPage - 1) * pageSize + idx + 1}
                      </td>
                      <td className="border-x border-slate-200 px-3 py-3 font-extrabold text-cyan-800 font-mono text-sm">
                        {inv.invoiceNo}
                      </td>
                      <td className="border-x border-slate-200 px-3 py-3 font-bold text-slate-800 font-mono">
                        {inv.orderCode}
                      </td>
                      <td className="border-x border-slate-200 px-3 py-3 text-left font-bold text-slate-900">
                        {inv.customerName}
                        <span className="block text-[11px] font-normal text-slate-500">{inv.customerTaxCode}</span>
                      </td>
                      <td className="border-x border-slate-200 px-3 py-3 font-medium">
                        {new Date(inv.issuedDate).toLocaleDateString('vi-VN')}
                      </td>
                      <td className="border-x border-slate-200 px-3 py-3 font-extrabold text-slate-800">
                        {inv.items.length} mặt hàng
                      </td>
                      <td className="border-x border-slate-200 px-3 py-3 font-extrabold text-emerald-700">
                        {formatMoney(total)} đ
                      </td>
                      <td className="border-x border-slate-200 px-3 py-3">
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-bold text-emerald-800 border border-emerald-300">
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                          Đã ký & Phát hành
                        </span>
                      </td>
                      <td className="sticky right-0 border-l border-slate-200 bg-white group-hover:bg-cyan-50/40 px-3 py-3">
                        <button
                          type="button"
                          onClick={() => setPreviewDoc(inv)}
                          className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-cyan-600 bg-cyan-50 px-3 py-1.5 text-xs font-bold text-cyan-700 shadow-2xs hover:bg-cyan-600 hover:text-white transition cursor-pointer"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          <span>Xem & In</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer Pagination */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-t border-slate-200 bg-slate-50/80 px-4 py-3 text-xs font-bold text-slate-600">
          <div>
            Hiển thị <span className="text-cyan-800">{paginatedInvoices.length}</span> / <span className="text-slate-900">{totalItems}</span> hóa đơn
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1 text-slate-700 hover:bg-cyan-50 disabled:opacity-50 cursor-pointer"
            >
              Trang trước
            </button>
            <span className="px-2 font-black text-cyan-900">
              {currentPage} / {totalPages}
            </span>
            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1 text-slate-700 hover:bg-cyan-50 disabled:opacity-50 cursor-pointer"
            >
              Trang sau
            </button>
          </div>
        </div>
      </div>

      {/* DOCUMENT PRINT & PREVIEW MODAL */}
      {previewDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs overflow-y-auto no-print">
          <div className="relative w-full max-w-4xl rounded-2xl bg-white p-6 shadow-2xl space-y-6 max-h-[92vh] overflow-y-auto">
            {/* Modal Top Bar */}
            <div className="flex items-center justify-between border-b border-slate-200 pb-4 no-print">
              <div className="flex items-center gap-2.5 text-cyan-800 font-bold text-base">
                <FileText className="h-5 w-5 text-cyan-600" />
                <span>Chi Tiết Hóa Đơn Bán Hàng GTGT - {previewDoc.invoiceNo}</span>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handlePrint}
                  className="inline-flex items-center gap-2 rounded-xl border-2 border-cyan-500 bg-cyan-600 px-4 py-2 text-xs font-bold text-white shadow-md transition hover:bg-cyan-700 cursor-pointer"
                >
                  <Printer className="h-4 w-4" />
                  In Hóa Đơn
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewDoc(null)}
                  className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Printable Paper Area */}
            <div className="print-area border-4 border-blue-600/80 p-6 sm:p-8 rounded-lg bg-white text-slate-900 font-sans shadow-xs">
              <style>{`
                @media print {
                  body * { visibility: hidden; }
                  .print-area, .print-area * { visibility: visible; }
                  .print-area { position: absolute; left: 0; top: 0; width: 100%; }
                  .no-print { display: none !important; }
                }
              `}</style>

              {/* Header */}
              <div className="flex justify-between items-start border-b-2 border-slate-900 pb-4 mb-6">
                <div>
                  <h2 className="text-base sm:text-lg font-extrabold uppercase text-slate-900">CÔNG TY TNHH QUẢN LÝ KHO THÔNG MINH</h2>
                  <p className="text-xs text-slate-600">Địa chỉ: Số 181 Xuân Thủy, Cầu Giấy, Hà Nội</p>
                  <p className="text-xs text-slate-600">Mã số thuế: 0109988776 - Điện thoại: 024.3838.9999</p>
                </div>
                <div className="text-right text-xs font-semibold text-slate-700">
                  <div>Mẫu số: 01GTKT0/001</div>
                  <div>Ký hiệu: AA/26E</div>
                  <div className="font-extrabold text-blue-700 text-sm">Số: {previewDoc.invoiceNo}</div>
                </div>
              </div>

              {/* Title */}
              <div className="text-center my-6">
                <h1 className="text-2xl sm:text-3xl font-black uppercase text-slate-900 tracking-wider">
                  HÓA ĐƠN BÁN HÀNG GTGT
                </h1>
                <p className="text-xs italic text-slate-500 mt-1">
                  (Liên 2: Giao cho người mua) - Ngày {new Date(previewDoc.issuedDate).getDate()} tháng {new Date(previewDoc.issuedDate).getMonth() + 1} năm {new Date(previewDoc.issuedDate).getFullYear()}
                </p>
              </div>

              {/* Info */}
              <div className="space-y-1.5 text-xs sm:text-sm mb-6 border-b border-dashed border-slate-300 pb-4">
                <div className="flex"><span className="w-40 font-semibold text-slate-700">Tên đơn vị mua hàng:</span> <span className="font-extrabold text-slate-900">{previewDoc.customerName}</span></div>
                <div className="flex"><span className="w-40 font-semibold text-slate-700">Mã số thuế:</span> <span className="font-bold text-slate-900">{previewDoc.customerTaxCode}</span></div>
                <div className="flex"><span className="w-40 font-semibold text-slate-700">Địa chỉ giao hàng:</span> <span className="font-medium text-slate-800">{previewDoc.address}</span></div>
                <div className="flex"><span className="w-40 font-semibold text-slate-700">Hình thức thanh toán:</span> <span className="font-medium text-slate-800">{previewDoc.paymentMethod}</span></div>
                <div className="flex"><span className="w-40 font-semibold text-slate-700">Mã đơn hàng liên kết:</span> <span className="font-extrabold text-blue-800">{previewDoc.orderCode}</span></div>
              </div>

              {/* Items Table */}
              <table className="w-full border-2 border-slate-900 text-center text-xs sm:text-sm border-collapse mb-6">
                <thead>
                  <tr className="bg-slate-100 font-bold border-b-2 border-slate-900">
                    <th className="border border-slate-900 p-2 w-12">STT</th>
                    <th className="border border-slate-900 p-2 text-left">Tên hàng hóa, dịch vụ</th>
                    <th className="border border-slate-900 p-2 w-20">ĐVT</th>
                    <th className="border border-slate-900 p-2 w-20">Số lượng</th>
                    <th className="border border-slate-900 p-2 w-28">Đơn giá</th>
                    <th className="border border-slate-900 p-2 w-32">Thành tiền</th>
                  </tr>
                </thead>
                <tbody>
                  {previewDoc.items.map((item, idx) => (
                    <tr key={item.id || idx} className="border-b border-slate-800">
                      <td className="border border-slate-900 p-2 font-bold">{idx + 1}</td>
                      <td className="border border-slate-900 p-2 text-left font-bold text-slate-900">
                        {item.productName} <span className="text-xs font-normal text-slate-500">({item.productCode})</span>
                      </td>
                      <td className="border border-slate-900 p-2">{item.unit}</td>
                      <td className="border border-slate-900 p-2 font-bold">{item.quantity}</td>
                      <td className="border border-slate-900 p-2 text-right">{formatMoney(item.unitPrice)}</td>
                      <td className="border border-slate-900 p-2 text-right font-bold">{formatMoney(item.unitPrice * item.quantity)}</td>
                    </tr>
                  ))}
                  {(() => {
                    const subTotal = previewDoc.items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
                    const tax = subTotal * 0.1;
                    const grand = subTotal + tax;
                    return (
                      <>
                        <tr className="font-bold bg-slate-50">
                          <td colSpan={5} className="border border-slate-900 p-2 text-right">Cộng tiền hàng:</td>
                          <td className="border border-slate-900 p-2 text-right">{formatMoney(subTotal)} đ</td>
                        </tr>
                        <tr className="font-bold bg-slate-50">
                          <td colSpan={5} className="border border-slate-900 p-2 text-right">Thuế GTGT (10%):</td>
                          <td className="border border-slate-900 p-2 text-right">{formatMoney(tax)} đ</td>
                        </tr>
                        <tr className="font-black bg-blue-50 text-blue-950 text-sm sm:text-base">
                          <td colSpan={5} className="border border-slate-900 p-2.5 text-right uppercase">Tổng cộng thanh toán:</td>
                          <td className="border border-slate-900 p-2.5 text-right">{formatMoney(grand)} đ</td>
                        </tr>
                      </>
                    );
                  })()}
                </tbody>
              </table>

              {/* Signatures */}
              <div className="grid grid-cols-2 text-center mt-10">
                <div>
                  <div className="font-bold uppercase text-slate-900">NGƯỜI MUA HÀNG</div>
                  <div className="text-xs italic text-slate-500">(Ký, ghi rõ họ tên)</div>
                </div>
                <div>
                  <div className="font-bold uppercase text-slate-900">NGƯỜI BÁN HÀNG</div>
                  <div className="text-xs italic text-slate-500">(Ký, đóng dấu, ghi rõ họ tên)</div>
                  <div className="mt-4 inline-flex flex-col items-center border border-emerald-500 bg-emerald-50 p-2.5 rounded-lg">
                    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                    <span className="text-xs font-bold text-emerald-800">Đã ký điện tử bởi Công Ty</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
