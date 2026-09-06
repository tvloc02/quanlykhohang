import React, { useState, useRef } from 'react';
import { documentsApi, type StockOutDoc } from '../api/documentsApi';
import {
  TrendingUp,
  Search,
  Eye,
  Printer,
  SlidersHorizontal,
  X,
  CheckCircle2,
  Package,
  FileCheck,
  Upload,
  Pencil,
  FileSpreadsheet,
  FileText,
  List,
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  AlertCircle,
} from 'lucide-react';

export interface DocTemplateItem {
  id: string;
  templateCode: string; // Mã mẫu chứng từ (ví dụ: PXK-001)
  serialSymbol: string; // Kí hiệu chứng từ (ví dụ: C26XK)
  cqtStatus: 'APPROVED' | 'PENDING'; // Trạng thái gửi CQT / Ban Giám Đốc (Đã duyệt | Chưa nộp)
  status: 'ACTIVE' | 'INACTIVE'; // Trạng thái chứng từ (Đang sử dụng | Ngừng sử dụng)
  invoiceType?: 'MAIN' | 'SUB'; // Loại chứng từ (Chính | Phụ nếu đã duyệt, còn nếu Chưa nộp thì không hiện)
  appliedWarehouse: string; // Kho áp dụng
  createdDate: string; // Ngày tạo mẫu
  fileName: string;
  fileSize: string;
  companyName: string;
  companyTaxCode: string;
  companyAddress: string;
  invoiceTitle: string;
  sellerName?: string;
}

const INITIAL_STOCK_OUT_TEMPLATES: DocTemplateItem[] = [
  {
    id: 'tpl-out-001',
    templateCode: 'PXK-001',
    serialSymbol: 'C26XK',
    cqtStatus: 'APPROVED',
    status: 'ACTIVE',
    invoiceType: 'MAIN',
    appliedWarehouse: 'Tất cả các kho',
    createdDate: '19/08/2026',
    fileName: 'Mau_Phieu_Xuat_Kho_Chuan.docx',
    fileSize: '42.1 KB',
    companyName: 'CÔNG TY TNHH HỆ THỐNG QUẢN LÝ KHO SMART WMS',
    companyTaxCode: '0316889988',
    companyAddress: 'Tầng 8, Tòa nhà Innovation, Quận 1, TP. Hồ Chí Minh',
    invoiceTitle: 'PHIẾU XUẤT KHO THÀNH PHẨM & HÀNG HÓA',
    sellerName: 'Nguyễn Văn Quản Lý',
  },
  {
    id: 'tpl-out-002',
    templateCode: 'PXK-002',
    serialSymbol: 'C26XK-SUB',
    cqtStatus: 'APPROVED',
    status: 'ACTIVE',
    invoiceType: 'SUB',
    appliedWarehouse: 'Kho Miền Bắc',
    createdDate: '14/08/2026',
    fileName: 'Mau_Phieu_Xuat_Kho_Noi_Bo.docx',
    fileSize: '39.5 KB',
    companyName: 'CÔNG TY TNHH HỆ THỐNG QUẢN LÝ KHO SMART WMS',
    companyTaxCode: '0316889988',
    companyAddress: 'Tầng 8, Tòa nhà Innovation, Quận 1, TP. Hồ Chí Minh',
    invoiceTitle: 'PHIẾU XUẤT KHO KIÊM VẬN CHUYỂN',
    sellerName: 'Phạm Văn Thủ Kho',
  },
];

export default function StockOutDocPage() {
  const [docs, setDocs] = useState<StockOutDoc[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [showAdvancedSearch, setShowAdvancedSearch] = useState<boolean>(false);
  const [previewDoc, setPreviewDoc] = useState<StockOutDoc | null>(null);

  // Tab State
  const [activeTab, setActiveTab] = useState<'LIST' | 'TEMPLATE'>('LIST');

  // Pagination states
  const [pageSize, setPageSize] = useState<number>(10);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Template List State
  const [templates, setTemplates] = useState<DocTemplateItem[]>(INITIAL_STOCK_OUT_TEMPLATES);
  const [templateSearch, setTemplateSearch] = useState<string>('');

  // Modals for Template Tab
  const [previewTemplateModal, setPreviewTemplateModal] = useState<DocTemplateItem | null>(null);
  const [editingTemplate, setEditingTemplate] = useState<DocTemplateItem | null>(null);
  const [showAddTemplateModal, setShowAddTemplateModal] = useState<boolean>(false);

  // File Upload reference for template editing
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [targetTemplateIdForFile, setTargetTemplateIdForFile] = useState<string | null>(null);

  // Simplified New Template Form State
  const [newTemplateForm, setNewTemplateForm] = useState<{
    templateCode: string;
    appliedWarehouse: string;
    fileName: string;
  }>({
    templateCode: '',
    appliedWarehouse: 'Tất cả các kho',
    fileName: '',
  });

  // Form State for Editing Template Metadata
  const [templateForm, setTemplateForm] = useState<Partial<DocTemplateItem>>({
    templateCode: '',
    serialSymbol: '',
    cqtStatus: 'PENDING',
    status: 'ACTIVE',
    invoiceType: 'MAIN',
    appliedWarehouse: 'Tất cả các kho',
    createdDate: new Date().toLocaleDateString('vi-VN'),
    companyName: 'CÔNG TY TNHH HỆ THỐNG QUẢN LÝ KHO SMART WMS',
    companyTaxCode: '0316889988',
    companyAddress: 'Tầng 8, Tòa nhà Innovation, Quận 1, TP. Hồ Chí Minh',
    invoiceTitle: 'PHIẾU XUẤT KHO BÁN HÀNG & PHÁT HÀNH',
    fileName: 'Mau_Phieu_Xuat_Kho_Moi.docx',
    fileSize: '40.0 KB',
  });

  React.useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const data = await documentsApi.getStockOutNotes();
        setDocs(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error('Không tải được danh sách phiếu xuất kho', error);
        setDocs([]);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const formatMoney = (val: number) => {
    return new Intl.NumberFormat('vi-VN').format(val);
  };

  const filteredDocs = docs.filter((doc) => {
    const keyword = search.trim().toLowerCase();
    const noteNo = doc.noteNo || (doc as any).dispatchNo || '';
    const receiver = doc.receiverName || (doc as any).customerName || '';
    const exportWh = doc.exportWarehouse || (doc as any).warehouseName || '';
    const orderCode = (doc as any).orderCode || '';

    const matchesKeyword =
      !keyword ||
      noteNo.toLowerCase().includes(keyword) ||
      receiver.toLowerCase().includes(keyword) ||
      exportWh.toLowerCase().includes(keyword) ||
      orderCode.toLowerCase().includes(keyword) ||
      doc.items.some((item) => item.productName.toLowerCase().includes(keyword) || item.productCode.toLowerCase().includes(keyword));

    if (!matchesKeyword) return false;

    if (showAdvancedSearch) {
      if (statusFilter !== 'ALL' && doc.status !== statusFilter) {
        return false;
      }
    }
    return true;
  });

  // Calculate Pagination
  const totalItems = filteredDocs.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const paginatedDocs = filteredDocs.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const startIndex = totalItems > 0 ? (currentPage - 1) * pageSize + 1 : 0;
  const endIndex = Math.min(currentPage * pageSize, totalItems);

  const totalDispatchValue = docs.reduce((sum, d) => {
    const sub = d.items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
    return sum + sub;
  }, 0);

  const totalItemsCount = docs.reduce((sum, d) => sum + d.items.reduce((s, i) => s + i.quantity, 0), 0);

  // Filter templates list
  const filteredTemplates = templates.filter((tpl) => {
    const kw = templateSearch.trim().toLowerCase();
    return (
      !kw ||
      tpl.templateCode.toLowerCase().includes(kw) ||
      tpl.serialSymbol.toLowerCase().includes(kw) ||
      tpl.invoiceTitle.toLowerCase().includes(kw) ||
      tpl.fileName.toLowerCase().includes(kw)
    );
  });

  const handlePrint = () => {
    window.print();
  };

  // Trigger Sửa File (.docx) for specific template item
  const handleTriggerEditFile = (templateId: string) => {
    setTargetTemplateIdForFile(templateId);
    fileInputRef.current?.click();
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && targetTemplateIdForFile) {
      setTemplates((prev) =>
        prev.map((tpl) =>
          tpl.id === targetTemplateIdForFile
            ? {
                ...tpl,
                fileName: file.name,
                fileSize: `${(file.size / 1024).toFixed(1)} KB`,
              }
            : tpl
        )
      );
      setTargetTemplateIdForFile(null);
    }
  };

  // Delete Template Item
  const handleDeleteTemplate = (id: string) => {
    if (window.confirm('Bạn có chắc chắn muốn xóa mẫu phiếu xuất kho này không?')) {
      setTemplates((prev) => prev.filter((t) => t.id !== id));
    }
  };

  // Open Edit Template Modal
  const handleOpenEditModal = (tpl: DocTemplateItem) => {
    setEditingTemplate(tpl);
    setTemplateForm({ ...tpl });
  };

  // Save Edit Template Form
  const handleSaveEditTemplate = () => {
    if (!editingTemplate) return;
    setTemplates((prev) =>
      prev.map((tpl) =>
        tpl.id === editingTemplate.id
          ? {
              ...tpl,
              ...templateForm,
              invoiceType: templateForm.cqtStatus === 'APPROVED' ? templateForm.invoiceType : undefined,
            }
          : tpl
      )
    );
    setEditingTemplate(null);
  };

  // Save New Template Form (Simplified)
  const handleSaveNewTemplate = () => {
    const newId = `tpl-out-${Date.now()}`;
    const code = newTemplateForm.templateCode.trim() || `PXK/00${templates.length + 1}`;
    const newTpl: DocTemplateItem = {
      id: newId,
      templateCode: code,
      serialSymbol: `C26XK-0${templates.length + 1}`,
      cqtStatus: 'PENDING',
      status: 'ACTIVE',
      invoiceType: undefined,
      appliedWarehouse: newTemplateForm.appliedWarehouse || 'Tất cả các kho',
      createdDate: new Date().toLocaleDateString('vi-VN'),
      fileName: newTemplateForm.fileName || `${code.replace(/[/ ]/g, '_')}_MauDocx.docx`,
      fileSize: '40.0 KB',
      companyName: 'CÔNG TY TNHH HỆ THỐNG QUẢN LÝ KHO SMART WMS',
      companyTaxCode: '0316889988',
      companyAddress: 'Tầng 8, Tòa nhà Innovation, Quận 1, TP. Hồ Chí Minh',
      invoiceTitle: code,
      sellerName: 'Nguyễn Văn Quản Lý',
    };
    setTemplates([newTpl, ...templates]);
    setShowAddTemplateModal(false);
  };

  return (
    <div className="font-sans space-y-4">
      {/* 4 Cards Summary Strip */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex h-[72px] items-center justify-center rounded-xl border-2 border-cyan-500 bg-white px-4 shadow-sm transition hover:bg-cyan-50 text-center">
              <p className="text-base font-black text-cyan-700 uppercase">
                {docs.length} PHIẾU XUẤT KHO
              </p>
            </div>
            <div className="flex h-[72px] items-center justify-center rounded-xl border-2 border-cyan-500 bg-white px-4 shadow-sm transition hover:bg-cyan-50 text-center">
              <p className="text-base font-black text-cyan-700 uppercase">
                {formatMoney(totalItemsCount)} SẢN PHẨM XUẤT
              </p>
            </div>
            <div className="flex h-[72px] items-center justify-center rounded-xl border-2 border-cyan-500 bg-white px-4 shadow-sm transition hover:bg-cyan-50 text-center">
              <p className="text-base font-black text-cyan-700 uppercase">
                {formatMoney(totalDispatchValue)} ₫ TỔNG GIÁ TRỊ XUẤT
              </p>
            </div>
            <div className="flex h-[72px] items-center justify-center rounded-xl border-2 border-cyan-500 bg-white px-4 shadow-sm transition hover:bg-cyan-50 text-center">
              <p className="text-base font-black text-cyan-700 uppercase">
                100% HOÀN TẤT XUẤT KHO
              </p>
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
                  className="h-11 w-full rounded-xl border-2 border-cyan-500 bg-white pl-11 pr-4 text-base outline-none transition focus:border-cyan-600 focus:ring-4 focus:ring-cyan-500/10"
                  placeholder="Tìm kiếm theo số phiếu, khách hàng, kho xuất, mã đơn hàng..."
                />
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowAdvancedSearch((prev) => !prev)}
                  className={`inline-flex h-11 items-center justify-center gap-2 rounded-xl border-2 px-4 text-sm font-bold transition ${
                    showAdvancedSearch
                      ? 'border-cyan-600 bg-cyan-50 text-cyan-700'
                      : 'border-cyan-600 bg-white text-cyan-600 hover:bg-cyan-50'
                  }`}
                >
                  <SlidersHorizontal className="h-4 w-4" />
                  Tìm kiếm nâng cao
                </button>
              </div>
            </div>

            {/* Advanced Search Panel */}
            {showAdvancedSearch && (
              <div className="rounded-2xl border-2 border-cyan-100 bg-cyan-50/40 p-5 space-y-4 shadow-xs">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-black uppercase tracking-wider text-cyan-800">Bộ lọc nâng cao</h3>
                  <button
                    type="button"
                    onClick={() => setStatusFilter('ALL')}
                    className="text-xs font-bold text-slate-500 hover:text-cyan-700 hover:underline"
                  >
                    Xóa bộ lọc
                  </button>
                </div>

                <div>
                  <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-600">Trạng thái phiếu xuất</label>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { key: 'ALL', label: 'Tất cả phiếu xuất' },
                      { key: 'DISPATCHED', label: 'Đã xuất kho' },
                    ].map((item) => (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => setStatusFilter(item.key)}
                        className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition border ${
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
              </div>
            )}
          </div>

          {/* High-density Data Table */}
          <div className="overflow-hidden rounded-2xl border-2 border-cyan-500 bg-white shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="bg-cyan-50 border-b border-slate-200">
                    <th className="w-12 border-r border-slate-200 p-3 text-center text-xs font-extrabold uppercase text-slate-800">STT</th>
                    <th className="border-r border-slate-200 p-3 text-xs font-extrabold uppercase text-slate-800">Số Phiếu Xuất</th>
                    <th className="border-r border-slate-200 p-3 text-xs font-extrabold uppercase text-slate-800">Mã Đơn Hàng</th>
                    <th className="border-r border-slate-200 p-3 text-xs font-extrabold uppercase text-slate-800">Khách Hàng</th>
                    <th className="border-r border-slate-200 p-3 text-xs font-extrabold uppercase text-slate-800">Kho Xuất</th>
                    <th className="border-r border-slate-200 p-3 text-center text-xs font-extrabold uppercase text-slate-800">Ngày Xuất</th>
                    <th className="border-r border-slate-200 p-3 text-right text-xs font-extrabold uppercase text-slate-800">Tổng Giá Trị</th>
                    <th className="border-r border-slate-200 p-3 text-center text-xs font-extrabold uppercase text-slate-800">Trạng Thái</th>
                    <th className="p-3 text-center text-xs font-extrabold uppercase text-slate-800 min-w-[120px]">Thao Tác</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={9} className="p-8 text-center text-slate-500">Đang tải danh sách phiếu xuất kho...</td>
                    </tr>
                  ) : paginatedDocs.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="p-8 text-center text-slate-500">Không tìm thấy phiếu xuất kho phù hợp.</td>
                    </tr>
                  ) : (
                    paginatedDocs.map((doc, index) => {
                      const totalQty = doc.items.reduce((sum, item) => sum + item.quantity, 0);
                      const totalVal = doc.items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
                      const noteNo = doc.noteNo || (doc as any).dispatchNo || '';
                      const receiver = doc.receiverName || (doc as any).customerName || '';
                      const exportWh = doc.exportWarehouse || (doc as any).warehouseName || '';
                      const dateStr = doc.createdDate || (doc as any).dispatchedDate || '';
                      const orderCode = (doc as any).orderCode || 'ORD-2026';

                      return (
                        <tr key={doc.id} className="border-b border-slate-200 hover:bg-cyan-50/50 transition-colors">
                          <td className="border-r border-slate-200 p-3 text-center font-bold text-slate-700 text-xs sm:text-sm">
                            {startIndex + index}
                          </td>
                          <td className="border-r border-slate-200 p-3 font-bold text-cyan-700 text-xs sm:text-sm">
                            {noteNo}
                          </td>
                          <td className="border-r border-slate-200 p-3 text-xs font-mono text-slate-600">
                            {orderCode}
                          </td>
                          <td className="border-r border-slate-200 p-3 text-xs sm:text-sm font-bold text-slate-900">
                            {receiver}
                          </td>
                          <td className="border-r border-slate-200 p-3 text-xs sm:text-sm text-slate-700">
                            {exportWh}
                          </td>
                          <td className="border-r border-slate-200 p-3 text-center text-xs text-slate-600">
                            {dateStr}
                          </td>
                          <td className="border-r border-slate-200 p-3 text-right font-black text-cyan-700 text-xs sm:text-sm">
                            {formatMoney(totalVal)} ₫
                          </td>
                          <td className="border-r border-slate-200 p-3 text-center">
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-extrabold text-emerald-700 border border-emerald-200">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Đã xuất kho
                            </span>
                          </td>
                          <td className="p-3 text-center">
                            <button
                              type="button"
                              onClick={() => setPreviewDoc(doc)}
                              className="inline-flex items-center gap-1.5 rounded-xl border-2 border-cyan-500 bg-white px-3 py-1.5 text-xs font-bold text-cyan-700 shadow-xs transition hover:bg-cyan-50"
                            >
                              <Eye className="h-3.5 w-3.5" />
                              Xem & In
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Footer */}
            {!loading && totalItems > 0 && (
              <div className="flex flex-col items-center justify-between border-t border-slate-200 bg-slate-50/50 px-6 py-3 sm:flex-row">
                <div className="text-sm text-slate-600 font-medium">
                  Tổng số: <b>{totalItems}</b> <span className="ml-2">Hiển thị {startIndex} - {endIndex}</span>
                </div>
                <div className="mt-4 flex items-center gap-2 sm:mt-0">
                  <select
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    className="h-8 rounded-lg border border-slate-300 bg-white px-2 text-sm outline-none transition focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                  >
                    <option value={5}>5</option>
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
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
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <span className="px-3 text-sm font-bold text-slate-700">
                      {currentPage} / {totalPages}
                    </span>
                    <button
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-50"
                    >
                      <ChevronRight className="h-4 w-4" />
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

      {/* Edit Template Content Modal */}
      {editingTemplate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl space-y-4 border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-base font-extrabold text-cyan-900 flex items-center gap-2">
                <Pencil className="h-5 w-5 text-cyan-600" />
                Sửa Nội Dung Bản Ghi Mẫu Phiếu Xuất Kho
              </h3>
              <button
                type="button"
                onClick={() => setEditingTemplate(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs font-semibold text-slate-700">
              <div>
                <label className="block mb-1 font-bold text-slate-800">Mã mẫu phiếu:</label>
                <input
                  type="text"
                  value={templateForm.templateCode || ''}
                  onChange={(e) => setTemplateForm({ ...templateForm, templateCode: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-bold text-cyan-800 outline-none focus:border-cyan-500 bg-white"
                />
              </div>

              <div>
                <label className="block mb-1 font-bold text-slate-800">Kí hiệu phiếu:</label>
                <input
                  type="text"
                  value={templateForm.serialSymbol || ''}
                  onChange={(e) => setTemplateForm({ ...templateForm, serialSymbol: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-mono font-bold text-slate-900 outline-none focus:border-cyan-500 bg-white"
                />
              </div>

              <div>
                <label className="block mb-1 font-bold text-slate-800">Trạng thái gửi CQT:</label>
                <select
                  value={templateForm.cqtStatus || 'PENDING'}
                  onChange={(e) => setTemplateForm({ ...templateForm, cqtStatus: e.target.value as any })}
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-bold outline-none focus:border-cyan-500 bg-white"
                >
                  <option value="APPROVED">Đã duyệt</option>
                  <option value="PENDING">Chưa nộp</option>
                </select>
              </div>

              <div>
                <label className="block mb-1 font-bold text-slate-800">Loại phiếu:</label>
                <select
                  disabled={templateForm.cqtStatus !== 'APPROVED'}
                  value={templateForm.invoiceType || 'MAIN'}
                  onChange={(e) => setTemplateForm({ ...templateForm, invoiceType: e.target.value as any })}
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-bold outline-none focus:border-cyan-500 bg-white disabled:opacity-50 disabled:bg-slate-100"
                >
                  <option value="MAIN">Chính</option>
                  <option value="SUB">Phụ</option>
                </select>
              </div>

              <div className="col-span-2">
                <label className="block mb-1 font-bold text-slate-800">Tiêu đề mẫu phiếu:</label>
                <input
                  type="text"
                  value={templateForm.invoiceTitle || ''}
                  onChange={(e) => setTemplateForm({ ...templateForm, invoiceTitle: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-bold text-slate-900 outline-none focus:border-cyan-500 bg-white"
                />
              </div>

              <div className="col-span-2">
                <label className="block mb-1 font-bold text-slate-800">Tên đơn vị lập phiếu:</label>
                <input
                  type="text"
                  value={templateForm.companyName || ''}
                  onChange={(e) => setTemplateForm({ ...templateForm, companyName: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-xs outline-none focus:border-cyan-500 bg-white"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-slate-200 pt-4">
              <button
                type="button"
                onClick={() => setEditingTemplate(null)}
                className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleSaveEditTemplate}
                className="rounded-xl bg-cyan-600 px-4 py-2 text-xs font-bold text-white hover:bg-cyan-700 transition shadow-xs"
              >
                Lưu Thay Đổi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add New Template Modal (Simplified: Name, Warehouse, File Upload) */}
      {showAddTemplateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4 border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-base font-extrabold text-cyan-900 flex items-center gap-2">
                <Plus className="h-5 w-5 text-cyan-600" />
                Thêm Mẫu Phiếu Xuất Kho Mới
              </h3>
              <button
                type="button"
                onClick={() => setShowAddTemplateModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs font-semibold text-slate-700">
              <div>
                <label className="block mb-1.5 font-bold text-slate-800 text-xs">Tên / Mã Mẫu Phiếu:</label>
                <input
                  type="text"
                  value={newTemplateForm.templateCode}
                  onChange={(e) => setNewTemplateForm({ ...newTemplateForm, templateCode: e.target.value })}
                  placeholder="Ví dụ: Mẫu Phiếu Xuất Kho 004"
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-bold text-slate-900 outline-none focus:border-cyan-500 bg-white"
                />
              </div>

              <div>
                <label className="block mb-1.5 font-bold text-slate-800 text-xs">Kho Áp Dụng:</label>
                <select
                  value={newTemplateForm.appliedWarehouse}
                  onChange={(e) => setNewTemplateForm({ ...newTemplateForm, appliedWarehouse: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-bold text-slate-900 outline-none focus:border-cyan-500 bg-white"
                >
                  <option value="Tất cả các kho">Tất cả các kho</option>
                  <option value="Kho Tổng TP.HCM">Kho Tổng TP.HCM</option>
                  <option value="Kho Miền Bắc">Kho Miền Bắc</option>
                  <option value="Kho Miền Trung">Kho Miền Trung</option>
                </select>
              </div>

              <div>
                <label className="block mb-1.5 font-bold text-slate-800 text-xs">Chọn File Mẫu Word (.docx):</label>
                <input
                  type="file"
                  accept=".docx,.doc"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setNewTemplateForm({ ...newTemplateForm, fileName: file.name });
                    }
                  }}
                  className="w-full rounded-xl border border-slate-300 p-2 text-xs text-slate-700 bg-slate-50 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-cyan-600 file:text-white hover:file:bg-cyan-700 cursor-pointer"
                />
                {newTemplateForm.fileName && (
                  <p className="mt-1.5 text-xs text-cyan-700 font-bold truncate">
                    Đã chọn: {newTemplateForm.fileName}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-slate-200 pt-4">
              <button
                type="button"
                onClick={() => setShowAddTemplateModal(false)}
                className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleSaveNewTemplate}
                className="rounded-xl bg-cyan-600 px-5 py-2 text-xs font-bold text-white hover:bg-cyan-700 transition shadow-xs"
              >
                Tạo Mẫu Mới
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preview Template Printable A4 Canvas Modal */}
      {previewTemplateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs overflow-y-auto">
          <div className="w-full max-w-4xl rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden my-8">
            <div className="flex items-center justify-between bg-cyan-700 px-6 py-4 text-white print:hidden">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5" />
                <h3 className="font-bold text-base">Xem Mẫu Phiếu Xuất Kho: {previewTemplateModal.templateCode} ({previewTemplateModal.serialSymbol})</h3>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handlePrint}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-white px-4 py-2 text-xs font-bold text-cyan-800 shadow-xs hover:bg-cyan-50 transition"
                >
                  <Printer className="h-4 w-4" />
                  In Thử Mẫu
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewTemplateModal(null)}
                  className="rounded-xl p-1.5 text-white/80 hover:bg-white/10 hover:text-white transition"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="p-8 md:p-12 font-serif text-slate-900 space-y-6">
              <div className="text-center border-b-2 border-slate-900 pb-4 space-y-1">
                <h2 className="text-2xl font-black tracking-tight text-slate-900 uppercase">{previewTemplateModal.invoiceTitle}</h2>
                <p className="text-xs font-bold text-slate-700">{previewTemplateModal.companyName}</p>
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs font-medium text-slate-700 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div>
                  <span className="font-bold text-slate-900">Mẫu Số:</span> <span className="font-mono font-bold text-cyan-700">{previewTemplateModal.templateCode}</span>
                </div>
                <div>
                  <span className="font-bold text-slate-900">Kí Hiệu Phiếu:</span> <span className="font-mono font-bold text-cyan-700">{previewTemplateModal.serialSymbol}</span>
                </div>
                <div>
                  <span className="font-bold text-slate-900">Số Phiếu:</span> <span className="font-mono font-bold text-cyan-700">&#123;&#123;dispatchNo&#125;&#125;</span>
                </div>
                <div>
                  <span className="font-bold text-slate-900">Trạng Thái CQT:</span>{' '}
                  <span className="font-bold text-emerald-700">
                    {previewTemplateModal.cqtStatus === 'APPROVED' ? 'Đã duyệt CQT' : 'Chưa nộp'}
                  </span>
                </div>
              </div>

              <table className="w-full border-2 border-slate-900 text-center text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 font-bold border-b-2 border-slate-900">
                    <th className="border border-slate-900 p-2 w-12">STT</th>
                    <th className="border border-slate-900 p-2 text-left">Tên vật tư xuất kho</th>
                    <th className="border border-slate-900 p-2 w-16">ĐVT</th>
                    <th className="border border-slate-900 p-2 w-20">Số lượng</th>
                    <th className="border border-slate-900 p-2 w-28">Đơn giá</th>
                    <th className="border border-slate-900 p-2 w-32">Thành tiền</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border border-slate-900 p-2 font-bold">1</td>
                    <td className="border border-slate-900 p-2 text-left font-mono text-cyan-700">&#123;&#123;productName_1&#125;&#125;</td>
                    <td className="border border-slate-900 p-2 font-mono text-cyan-700">&#123;&#123;unit_1&#125;&#125;</td>
                    <td className="border border-slate-900 p-2 font-mono text-cyan-700">&#123;&#123;quantity_1&#125;&#125;</td>
                    <td className="border border-slate-900 p-2 text-right font-mono text-cyan-700">&#123;&#123;unitPrice_1&#125;&#125;</td>
                    <td className="border border-slate-900 p-2 text-right font-mono text-cyan-700">&#123;&#123;total_1&#125;&#125;</td>
                  </tr>
                </tbody>
              </table>

              <div className="grid grid-cols-2 gap-4 text-center text-xs pt-8">
                <div className="space-y-12">
                  <p className="font-bold uppercase">NGƯỜI NHẬN HÀNG</p>
                  <p className="text-slate-400 font-italic">(Ký, ghi rõ họ tên)</p>
                </div>
                <div className="space-y-12">
                  <p className="font-bold uppercase">THỦ KHO XUẤT</p>
                  <p className="font-bold text-cyan-800">{previewTemplateModal.sellerName || 'Nguyễn Văn Quản Lý'}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stock-Out Printable Detail Modal */}
      {previewDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs overflow-y-auto">
          <div className="w-full max-w-4xl rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden my-8">
            <div className="flex items-center justify-between bg-cyan-700 px-6 py-4 text-white print:hidden">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                <h3 className="font-bold text-base">Chi Tiết Phiếu Xuất Kho: {previewDoc.noteNo || (previewDoc as any).dispatchNo || ''}</h3>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handlePrint}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-white px-4 py-2 text-xs font-bold text-cyan-800 shadow-xs hover:bg-cyan-50 transition"
                >
                  <Printer className="h-4 w-4" />
                  In Phiếu Xuất
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewDoc(null)}
                  className="rounded-xl p-1.5 text-white/80 hover:bg-white/10 hover:text-white transition"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="p-8 font-serif text-slate-900 print:p-0 space-y-6">
              <div className="text-center border-b-2 border-slate-900 pb-4">
                <h1 className="text-2xl font-black uppercase tracking-wide text-slate-900">PHIẾU XUẤT KHO BÁN HÀNG & PHÁT HÀNH</h1>
                <p className="text-xs font-semibold text-slate-600 mt-1">CÔNG TY TNHH HỆ THỐNG QUẢN LÝ KHO SMART WMS</p>
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs sm:text-sm mb-6 border-b border-dashed border-slate-300 pb-4">
                <div><span className="font-semibold text-slate-700">Số phiếu xuất:</span> <span className="font-bold text-cyan-800">{previewDoc.noteNo || (previewDoc as any).dispatchNo || ''}</span></div>
                <div><span className="font-semibold text-slate-700">Mã đơn hàng:</span> <span className="font-bold text-cyan-800">{(previewDoc as any).orderCode || 'ORD-2026'}</span></div>
                <div><span className="font-semibold text-slate-700">Khách hàng nhận:</span> <span className="font-bold text-slate-900">{previewDoc.receiverName || (previewDoc as any).customerName || ''}</span></div>
                <div><span className="font-semibold text-slate-700">Kho xuất:</span> <span className="font-bold text-slate-900">{previewDoc.exportWarehouse || (previewDoc as any).warehouseName || ''}</span></div>
              </div>

              <table className="w-full border-2 border-slate-900 text-center text-xs sm:text-sm border-collapse mb-6">
                <thead>
                  <tr className="bg-slate-100 font-bold border-b-2 border-slate-900">
                    <th className="border border-slate-900 p-2 w-12">STT</th>
                    <th className="border border-slate-900 p-2 text-left">Tên vật tư sản phẩm</th>
                    <th className="border border-slate-900 p-2 w-16">ĐVT</th>
                    <th className="border border-slate-900 p-2 w-20">Số lượng</th>
                    <th className="border border-slate-900 p-2 w-28">Đơn giá xuất</th>
                    <th className="border border-slate-900 p-2 w-32">Thành tiền</th>
                  </tr>
                </thead>
                <tbody>
                  {previewDoc.items.map((item, idx) => (
                    <tr key={item.id || idx} className="border-b border-slate-800">
                      <td className="border border-slate-900 p-2 font-bold">{idx + 1}</td>
                      <td className="border border-slate-900 p-2 text-left font-bold text-slate-900">{item.productName}</td>
                      <td className="border border-slate-900 p-2">{item.unit}</td>
                      <td className="border border-slate-900 p-2 font-bold text-slate-900">{item.quantity}</td>
                      <td className="border border-slate-900 p-2 text-right">{formatMoney(item.unitPrice)}</td>
                      <td className="border border-slate-900 p-2 text-right font-bold">{formatMoney(item.unitPrice * item.quantity)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="flex justify-between items-center text-xs sm:text-sm border-t border-slate-900 pt-3">
                <span className="font-bold">Người lập phiếu: Nguyễn Văn Quản Lý</span>
                <span className="font-black text-cyan-800 text-base">
                  Tổng giá trị xuất: {formatMoney(previewDoc.items.reduce((s, i) => s + i.unitPrice * i.quantity, 0))} ₫
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
