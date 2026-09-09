import React, { useState, useRef } from 'react';
import { documentsApi, type TransferDoc } from '../api/documentsApi';
import {
  Truck,
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
  Save,
} from 'lucide-react';

export interface DocTemplateItem {
  id: string;
  templateCode: string; // Mã mẫu chứng từ (ví dụ: PDC-001)
  serialSymbol: string; // Kí hiệu chứng từ (ví dụ: C26DC)
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

const INITIAL_TRANSFER_TEMPLATES: DocTemplateItem[] = [
  {
    id: 'tpl-tr-001',
    templateCode: 'PDC-001',
    serialSymbol: '6C25NTU',
    cqtStatus: 'APPROVED',
    status: 'ACTIVE',
    invoiceType: 'MAIN',
    appliedWarehouse: 'Tất cả các kho',
    createdDate: '23/02/2025',
    fileName: 'Mau_Phieu_Dieu_Chuyen_Hang_Hoa_Noi_Bo.docx',
    fileSize: '48.5 KB',
    companyName: 'CÔNG TY TNHH ĐÀO TẠO THIÊN ỨNG',
    companyTaxCode: '0110329220',
    companyAddress: 'Nhà lô B11, số 9A, ngõ 181 đường Xuân Thủy, Phường Dịch Vọng Hậu, Quận Cầu Giấy, Hà Nội',
    invoiceTitle: 'PHIẾU ĐIỀU CHUYỂN HÀNG HÓA NỘI BỘ',
    sellerName: 'System Administrator',
  },
  {
    id: 'tpl-tr-002',
    templateCode: 'PDC-002',
    serialSymbol: '6C25NTU-02',
    cqtStatus: 'APPROVED',
    status: 'ACTIVE',
    invoiceType: 'SUB',
    appliedWarehouse: 'Kho Chi Nhánh HCM',
    createdDate: '18/08/2026',
    fileName: 'Mau_Phieu_Luan_Chuyen_Noi_Bo_Chi_Nhanh.docx',
    fileSize: '45.0 KB',
    companyName: 'CÔNG TY TNHH ĐÀO TẠO THIÊN ỨNG',
    companyTaxCode: '0110329220',
    companyAddress: 'Nhà lô B11, số 9A, ngõ 181 đường Xuân Thủy, Phường Dịch Vọng Hậu, Quận Cầu Giấy, Hà Nội',
    invoiceTitle: 'PHIẾU LUÂN CHUYỂN NỘI BỘ CHI NHÁNH',
    sellerName: 'System Administrator',
  },
];

export default function TransferDocPage() {
  const [docs, setDocs] = useState<TransferDoc[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [showAdvancedSearch, setShowAdvancedSearch] = useState<boolean>(false);
  const [previewDoc, setPreviewDoc] = useState<TransferDoc | null>(null);

  // Tab State
  const [activeTab, setActiveTab] = useState<'LIST' | 'TEMPLATE'>('LIST');

  // Pagination states
  const [pageSize, setPageSize] = useState<number>(10);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Template List State
  const [templates, setTemplates] = useState<DocTemplateItem[]>(INITIAL_TRANSFER_TEMPLATES);
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
    invoiceTitle: 'PHIẾU ĐIỀU CHUYỂN KHO NỘI BỘ',
    fileName: 'Mau_Phieu_Dieu_Chuyen_Moi.docx',
    fileSize: '40.0 KB',
  });

  React.useEffect(() => {
    async function loadData() {
      setLoading(true);
      const data = await documentsApi.getTransferNotes();
      setDocs(data);
      setLoading(false);
    }
    loadData();
  }, []);

  const formatMoney = (val: number) => {
    return new Intl.NumberFormat('vi-VN').format(val);
  };

  const filteredDocs = docs.filter((doc) => {
    const keyword = search.trim().toLowerCase();
    const sourceWh = doc.sourceWarehouse || (doc as any).fromWarehouse || '';
    const destWh = doc.destinationWarehouse || (doc as any).toWarehouse || '';
    const matchesKeyword =
      !keyword ||
      doc.transferNo.toLowerCase().includes(keyword) ||
      sourceWh.toLowerCase().includes(keyword) ||
      destWh.toLowerCase().includes(keyword) ||
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

  const totalTransferValue = docs.reduce((sum, d) => {
    const sub = d.items.reduce((s, i) => s + (i.price || 0) * (i.quantityExported || 0), 0);
    return sum + sub;
  }, 0);

  const totalItemsCount = docs.reduce((sum, d) => sum + d.items.reduce((s, i) => s + (i.quantityExported || 0), 0), 0);

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
    if (window.confirm('Bạn có chắc chắn muốn xóa mẫu phiếu điều chuyển này không?')) {
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
    const newId = `tpl-tr-${Date.now()}`;
    const code = newTemplateForm.templateCode.trim() || `PDC/00${templates.length + 1}`;
    const newTpl: DocTemplateItem = {
      id: newId,
      templateCode: code,
      serialSymbol: `C26DC-0${templates.length + 1}`,
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
                {docs.length} PHIẾU ĐIỀU CHUYỂN
              </p>
            </div>
            <div className="flex h-[72px] items-center justify-center rounded-xl border-2 border-cyan-500 bg-white px-4 shadow-sm transition hover:bg-cyan-50 text-center">
              <p className="text-base font-black text-cyan-700 uppercase">
                {formatMoney(totalItemsCount)} SẢN PHẨM ĐIỀU CHUYỂN
              </p>
            </div>
            <div className="flex h-[72px] items-center justify-center rounded-xl border-2 border-cyan-500 bg-white px-4 shadow-sm transition hover:bg-cyan-50 text-center">
              <p className="text-base font-black text-cyan-700 uppercase">
                {formatMoney(totalTransferValue)} ₫ TỔNG GIÁ TRỊ LUÂN CHUYỂN
              </p>
            </div>
            <div className="flex h-[72px] items-center justify-center rounded-xl border-2 border-cyan-500 bg-white px-4 shadow-sm transition hover:bg-cyan-50 text-center">
              <p className="text-base font-black text-cyan-700 uppercase">
                100% HOÀN TẤT ĐIỀU CHUYỂN
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
                  placeholder="Tìm kiếm theo số phiếu, kho xuất, kho nhập, sản phẩm..."
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
                  <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-600">Trạng thái phiếu điều chuyển</label>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { key: 'ALL', label: 'Tất cả phiếu điều chuyển' },
                      { key: 'COMPLETED', label: 'Đã nhập kho nhận' },
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
                    <th className="border-r border-slate-200 p-3 text-xs font-extrabold uppercase text-slate-800">Số Phiếu Điều Chuyển</th>
                    <th className="border-r border-slate-200 p-3 text-xs font-extrabold uppercase text-slate-800">Kho Xuất (Nguồn)</th>
                    <th className="border-r border-slate-200 p-3 text-xs font-extrabold uppercase text-slate-800">Kho Nhập (Đích)</th>
                    <th className="border-r border-slate-200 p-3 text-center text-xs font-extrabold uppercase text-slate-800">Ngày Điều Chuyển</th>
                    <th className="border-r border-slate-200 p-3 text-center text-xs font-extrabold uppercase text-slate-800">Số Lượng SP</th>
                    <th className="border-r border-slate-200 p-3 text-right text-xs font-extrabold uppercase text-slate-800">Tổng Giá Trị</th>
                    <th className="border-r border-slate-200 p-3 text-center text-xs font-extrabold uppercase text-slate-800">Trạng Thái</th>
                    <th className="p-3 text-center text-xs font-extrabold uppercase text-slate-800 min-w-[120px]">Thao Tác</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={9} className="p-8 text-center text-slate-500">Đang tải danh sách phiếu điều chuyển...</td>
                    </tr>
                  ) : paginatedDocs.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="p-8 text-center text-slate-500">Không tìm thấy phiếu điều chuyển phù hợp.</td>
                    </tr>
                  ) : (
                    paginatedDocs.map((doc, index) => {
                      const totalQty = doc.items.reduce((sum, item) => sum + (item.quantityExported || (item as any).quantity || 0), 0);
                      const totalVal = doc.items.reduce((sum, item) => sum + (item.price || (item as any).unitPrice || 0) * (item.quantityExported || (item as any).quantity || 0), 0);
                      const sourceWh = doc.sourceWarehouse || (doc as any).fromWarehouse || '';
                      const destWh = doc.destinationWarehouse || (doc as any).toWarehouse || '';
                      const dateStr = doc.createdDate || (doc as any).transferredDate || '';

                      return (
                        <tr key={doc.id} className="border-b border-slate-200 hover:bg-cyan-50/50 transition-colors">
                          <td className="border-r border-slate-200 p-3 text-center font-bold text-slate-700 text-xs sm:text-sm">
                            {startIndex + index}
                          </td>
                          <td className="border-r border-slate-200 p-3 font-bold text-cyan-700 text-xs sm:text-sm">
                            {doc.transferNo}
                          </td>
                          <td className="border-r border-slate-200 p-3 text-xs sm:text-sm font-bold text-slate-800">
                            {sourceWh}
                          </td>
                          <td className="border-r border-slate-200 p-3 text-xs sm:text-sm font-bold text-slate-800">
                            {destWh}
                          </td>
                          <td className="border-r border-slate-200 p-3 text-center text-xs text-slate-600">
                            {dateStr}
                          </td>
                          <td className="border-r border-slate-200 p-3 text-center font-bold text-slate-800 text-xs sm:text-sm">
                            {totalQty}
                          </td>
                          <td className="border-r border-slate-200 p-3 text-right font-black text-cyan-700 text-xs sm:text-sm">
                            {formatMoney(totalVal)} ₫
                          </td>
                          <td className="border-r border-slate-200 p-3 text-center">
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-extrabold text-emerald-700 border border-emerald-200">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Đã hoàn thành
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
                Sửa Nội Dung Bản Ghi Mẫu Phiếu Điều Chuyển
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
                Thêm Mẫu Phiếu Điều Chuyển Mới
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
                  placeholder="Ví dụ: Mẫu Phiếu Điều Chuyển 004"
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

      {/* Official Printable A4 Canvas Modal for Transfer Order Invoice Template */}
      {previewTemplateModal && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-950/80 p-3 sm:p-6 backdrop-blur-xs overflow-y-auto print:p-0 print:bg-white">
          <div className="flex w-full max-w-5xl max-h-[96vh] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl print:max-h-none print:shadow-none print:w-full print:rounded-none">
            {/* Modal Top Bar */}
            <div className="flex items-center justify-between border-b border-slate-200 bg-cyan-600 px-6 py-4 text-white print:hidden">
              <div className="flex items-center gap-3">
                <FileCheck className="h-6 w-6 text-cyan-200" />
                <div>
                  <h2 className="text-lg font-bold">Phiếu Điều Chuyển Hàng Hóa Nội Bộ</h2>
                  <p className="text-xs text-cyan-100">Mẫu in phiếu điều chuyển hàng hóa giữa các kho ({previewTemplateModal.templateCode})</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePrint}
                  className="inline-flex items-center gap-2 rounded-xl bg-white/20 px-4 py-2 text-sm font-bold text-white transition hover:bg-white/30 cursor-pointer"
                >
                  <Printer className="h-4 w-4" />
                  In phiếu
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewTemplateModal(null)}
                  className="rounded-xl p-2 text-white/80 transition hover:bg-white/20 hover:text-white cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Document Content Box */}
            <div className="overflow-y-auto p-6 sm:p-10 text-slate-900 bg-white print:p-4 font-sans text-base leading-relaxed">
              <div className="max-w-4xl mx-auto border-4 border-cyan-500/80 p-6 sm:p-8 rounded-lg shadow-inner print:border-2 print:border-black font-sans">
                
                {/* Header Right */}
                <div className="text-right font-sans font-bold text-slate-800 text-sm mb-4">
                  Mẫu phiếu điều chuyển
                </div>

                {/* Exporter Info */}
                <div className="space-y-1 text-sm font-sans mb-6">
                  <div className="flex items-baseline gap-2">
                    <span className="font-semibold text-slate-700">Tên đơn vị gửi hàng:</span>
                    <span className="font-bold text-slate-900 border-b border-dashed border-slate-300 flex-1 font-sans text-base">
                      {previewTemplateModal.companyName || 'Kho xuất hàng'}
                    </span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="font-semibold text-slate-700">Theo lệnh điều động số</span>
                    <span className="font-bold text-slate-900 border-b border-dashed border-slate-300 w-44 text-center font-sans text-base">
                      12/LDD-PXC202601
                    </span>
                    <span className="font-semibold text-slate-700">về việc vận chuyển điều chuyển hàng hóa</span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="font-semibold text-slate-700 shrink-0">Địa chỉ kho gửi (kho đi):</span>
                    <span className="font-medium text-slate-800 border-b border-dashed border-slate-300 flex-1 font-sans text-base">
                      {previewTemplateModal.companyAddress || 'Nhà số B11, số 9A, ngõ 181 đường Xuân Thủy, Phường Dịch Vọng Hậu, Quận Cầu Giấy, Hà Nội'}
                    </span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="font-semibold text-slate-700">Tên người vận chuyển:</span>
                    <span className="font-medium text-slate-800 border-b border-dashed border-slate-300 flex-1 font-sans text-base">
                      Chưa phân công
                    </span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="font-semibold text-slate-700">Phương tiện vận chuyển:</span>
                    <span className="font-medium text-slate-800 border-b border-dashed border-slate-300 flex-1 font-sans text-base">
                      Chưa cập nhật
                    </span>
                  </div>
                </div>

                {/* Main Title */}
                <div className="text-center my-6 font-sans">
                  <h1 className="text-2xl sm:text-3xl font-extrabold tracking-wider uppercase text-slate-900 font-sans">
                    {previewTemplateModal.invoiceTitle || 'PHIẾU ĐIỀU CHUYỂN HÀNG HÓA NỘI BỘ'}
                  </h1>
                  <div className="flex items-center justify-between text-sm italic mt-2 px-4 font-sans">
                    <div className="flex-1 text-center">
                      <span>Ngày </span>
                      <span className="not-italic font-bold text-slate-800 border-b border-dashed border-slate-300 px-4 inline-block font-sans">
                        {previewTemplateModal.createdDate || '23/02/2025'}
                      </span>
                    </div>
                    <div className="text-right not-italic font-sans text-xs font-semibold text-slate-700 space-y-0.5">
                      <div>Ký hiệu: <span className="font-bold border-b border-dashed border-slate-300 px-2">{previewTemplateModal.serialSymbol || '6C25NTU'}</span></div>
                      <div>Số: <span className="font-bold text-cyan-700 border-b border-dashed border-slate-300 px-2">25</span></div>
                    </div>
                  </div>
                </div>

                {/* Receiver Info */}
                <div className="space-y-1 text-sm font-sans mb-6">
                  <div className="flex items-baseline gap-2">
                    <span className="font-semibold text-slate-700">Tên người nhận hàng:</span>
                    <span className="font-bold text-slate-900 border-b border-dashed border-slate-300 flex-1 font-sans text-base">
                      {previewTemplateModal.sellerName || 'System Administrator'}
                    </span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="font-semibold text-slate-700 shrink-0">Địa điểm kho nhận (kho đến):</span>
                    <span className="font-medium text-slate-800 border-b border-dashed border-slate-300 flex-1 font-sans text-base">
                      Số nhà 1, ngách 327/6 phố Vũ Tông Phan, Phường Khương Đình, Quận Thanh Xuân, Thành phố Hà Nội
                    </span>
                  </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto my-6 font-sans">
                  <table className="w-full border-2 border-slate-900 text-center text-sm font-sans border-collapse">
                    <thead>
                      <tr className="bg-slate-100/80 text-slate-900 font-bold border-b-2 border-slate-900">
                        <th rowSpan={2} className="border border-slate-900 px-2 py-2.5 w-12">STT</th>
                        <th rowSpan={2} className="border border-slate-900 px-3 py-2.5 text-left">
                          Tên nhãn hiệu, quy cách, phẩm chất vật tư (sản phẩm, hàng hóa)
                        </th>
                        <th rowSpan={2} className="border border-slate-900 px-2 py-2.5 w-24">Mã số</th>
                        <th rowSpan={2} className="border border-slate-900 px-2 py-2.5 w-20">Đơn vị tính</th>
                        <th colSpan={2} className="border border-slate-900 px-2 py-1">Số lượng</th>
                        <th rowSpan={2} className="border border-slate-900 px-3 py-2.5 w-28">Đơn giá</th>
                        <th rowSpan={2} className="border border-slate-900 px-3 py-2.5 w-32">Thành tiền</th>
                      </tr>
                      <tr className="bg-slate-100/80 text-slate-900 font-bold border-b-2 border-slate-900">
                        <th className="border border-slate-900 px-2 py-1.5 w-16">Thực xuất</th>
                        <th className="border border-slate-900 px-2 py-1.5 w-16">Thực nhập</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b border-slate-800 font-sans">
                        <td className="border border-slate-900 px-2 py-2 font-sans text-xs font-semibold">01</td>
                        <td className="border border-slate-900 px-3 py-2 text-left font-bold text-slate-900 font-sans">Áo khoác gió</td>
                        <td className="border border-slate-900 px-2 py-2 font-sans font-semibold text-slate-700">HH820235</td>
                        <td className="border border-slate-900 px-2 py-2 text-slate-800 font-sans">Cái</td>
                        <td className="border border-slate-900 px-2 py-2 font-sans font-bold text-slate-900">500</td>
                        <td className="border border-slate-900 px-2 py-2 font-sans font-bold text-slate-900">500</td>
                        <td className="border border-slate-900 px-3 py-2 text-right font-sans">10.000.000</td>
                        <td className="border border-slate-900 px-3 py-2 text-right font-sans font-bold">5.000.000.000</td>
                      </tr>
                      {/* Total Row */}
                      <tr className="font-sans font-extrabold text-slate-900 bg-slate-50">
                        <td colSpan={7} className="border border-slate-900 px-4 py-2.5 text-right uppercase tracking-wider text-sm">
                          TỔNG CỘNG:
                        </td>
                        <td className="border border-slate-900 px-3 py-2.5 text-right text-base text-cyan-900 font-extrabold">
                          5.000.000.000
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Digital Signature */}
                <div className="mt-8 text-center font-sans space-y-2">
                  <div className="font-extrabold text-slate-900 uppercase tracking-widest text-base">
                    THỦ TRƯỞNG ĐƠN VỊ
                  </div>
                  <div className="text-xs italic text-slate-500">(Chữ ký số)</div>
                  
                  <div className="inline-flex flex-col items-center justify-center border-2 border-emerald-500 bg-emerald-50/50 p-4 rounded-xl mt-4 shadow-sm">
                    <div className="flex items-center gap-2 text-emerald-700 font-bold text-sm">
                      <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                      <span>Đã được ký điện tử bởi</span>
                    </div>
                    <div className="font-black text-slate-900 text-center uppercase tracking-wider text-sm mt-1">
                      {previewTemplateModal.companyName || 'CÔNG TY TNHH ĐÀO TẠO THIÊN ỨNG'}
                    </div>
                    <div className="text-xs font-semibold text-emerald-700 mt-1">
                      Ngày: {previewTemplateModal.createdDate || '23/02/2025'}
                    </div>
                  </div>
                </div>

              </div>
            </div>

            {/* Modal Bottom Actions */}
            <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-6 py-4 print:hidden">
              <div className="text-xs font-medium text-slate-500">
                Mẫu phiếu điều chuyển hàng hóa nội bộ giữa các chi nhánh / kho
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setPreviewTemplateModal(null)}
                  className="rounded-xl border-2 border-slate-300 bg-white px-5 py-2.5 text-sm font-bold text-slate-600 transition hover:bg-slate-100 cursor-pointer"
                >
                  Hủy / Đóng
                </button>
                <button
                  type="button"
                  onClick={handlePrint}
                  className="rounded-xl border-2 border-cyan-500 bg-white px-5 py-2.5 text-sm font-bold text-cyan-600 shadow-sm transition hover:bg-cyan-50 flex items-center gap-2 cursor-pointer"
                >
                  <Printer className="h-4 w-4" />
                  In phiếu điều chuyển
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewTemplateModal(null)}
                  className="rounded-xl border-2 border-cyan-500 bg-cyan-600 px-6 py-2.5 text-sm font-bold text-white shadow-md transition hover:bg-cyan-700 flex items-center gap-2 cursor-pointer"
                >
                  <Save className="h-4 w-4" />
                  Lưu phiếu điều chuyển
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Transfer Printable Detail Modal */}
      {previewDoc && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-950/80 p-3 sm:p-6 backdrop-blur-xs overflow-y-auto print:p-0 print:bg-white">
          <div className="flex w-full max-w-5xl max-h-[96vh] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl print:max-h-none print:shadow-none print:w-full print:rounded-none">
            {/* Modal Top Bar */}
            <div className="flex items-center justify-between border-b border-slate-200 bg-cyan-600 px-6 py-4 text-white print:hidden">
              <div className="flex items-center gap-3">
                <FileCheck className="h-6 w-6 text-cyan-200" />
                <div>
                  <h2 className="text-lg font-bold">Phiếu Điều Chuyển Hàng Hóa Nội Bộ</h2>
                  <p className="text-xs text-cyan-100">Chi tiết phiếu điều chuyển: {previewDoc.transferNo}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePrint}
                  className="inline-flex items-center gap-2 rounded-xl bg-white/20 px-4 py-2 text-sm font-bold text-white transition hover:bg-white/30 cursor-pointer"
                >
                  <Printer className="h-4 w-4" />
                  In phiếu
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewDoc(null)}
                  className="rounded-xl p-2 text-white/80 transition hover:bg-white/20 hover:text-white cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Document Content Box */}
            <div className="overflow-y-auto p-6 sm:p-10 text-slate-900 bg-white print:p-4 font-sans text-base leading-relaxed">
              <div className="max-w-4xl mx-auto border-4 border-cyan-500/80 p-6 sm:p-8 rounded-lg shadow-inner print:border-2 print:border-black font-sans">
                
                {/* Header Right */}
                <div className="text-right font-sans font-bold text-slate-800 text-sm mb-4">
                  Mẫu phiếu điều chuyển
                </div>

                {/* Exporter Info */}
                <div className="space-y-1 text-sm font-sans mb-6">
                  <div className="flex items-baseline gap-2">
                    <span className="font-semibold text-slate-700">Tên đơn vị gửi hàng:</span>
                    <span className="font-bold text-slate-900 border-b border-dashed border-slate-300 flex-1 font-sans text-base">
                      {previewDoc.sourceWarehouse || (previewDoc as any).fromWarehouse || 'Kho xuất hàng'}
                    </span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="font-semibold text-slate-700">Theo lệnh điều động số</span>
                    <span className="font-bold text-slate-900 border-b border-dashed border-slate-300 w-44 text-center font-sans text-base">
                      {previewDoc.transferNo || '12/LDD-PXC202601'}
                    </span>
                    <span className="font-semibold text-slate-700">về việc vận chuyển điều chuyển hàng hóa</span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="font-semibold text-slate-700 shrink-0">Địa chỉ kho gửi (kho đi):</span>
                    <span className="font-medium text-slate-800 border-b border-dashed border-slate-300 flex-1 font-sans text-base">
                      Nhà số B11, số 9A, ngõ 181 đường Xuân Thủy, Phường Dịch Vọng Hậu, Quận Cầu Giấy, Hà Nội
                    </span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="font-semibold text-slate-700">Tên người vận chuyển:</span>
                    <span className="font-medium text-slate-800 border-b border-dashed border-slate-300 flex-1 font-sans text-base">
                      {(previewDoc as any).driverName || 'Chưa phân công'}
                    </span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="font-semibold text-slate-700">Phương tiện vận chuyển:</span>
                    <span className="font-medium text-slate-800 border-b border-dashed border-slate-300 flex-1 font-sans text-base">
                      {(previewDoc as any).vehiclePlate || 'Chưa cập nhật'}
                    </span>
                  </div>
                </div>

                {/* Main Title */}
                <div className="text-center my-6 font-sans">
                  <h1 className="text-2xl sm:text-3xl font-extrabold tracking-wider uppercase text-slate-900 font-sans">
                    PHIẾU ĐIỀU CHUYỂN HÀNG HÓA NỘI BỘ
                  </h1>
                  <div className="flex items-center justify-between text-sm italic mt-2 px-4 font-sans">
                    <div className="flex-1 text-center">
                      <span>Ngày </span>
                      <span className="not-italic font-bold text-slate-800 border-b border-dashed border-slate-300 px-4 inline-block font-sans">
                        {previewDoc.createdDate || (previewDoc as any).transferredDate || '23/02/2025'}
                      </span>
                    </div>
                    <div className="text-right not-italic font-sans text-xs font-semibold text-slate-700 space-y-0.5">
                      <div>Ký hiệu: <span className="font-bold border-b border-dashed border-slate-300 px-2">6C25NTU</span></div>
                      <div>Số: <span className="font-bold text-cyan-700 border-b border-dashed border-slate-300 px-2">{previewDoc.transferNo ? previewDoc.transferNo.replace(/[^0-9]/g, '') || '25' : '25'}</span></div>
                    </div>
                  </div>
                </div>

                {/* Receiver Info */}
                <div className="space-y-1 text-sm font-sans mb-6">
                  <div className="flex items-baseline gap-2">
                    <span className="font-semibold text-slate-700">Tên người nhận hàng:</span>
                    <span className="font-bold text-slate-900 border-b border-dashed border-slate-300 flex-1 font-sans text-base">
                      {previewDoc.destinationWarehouse || (previewDoc as any).toWarehouse || 'System Administrator'}
                    </span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="font-semibold text-slate-700 shrink-0">Địa điểm kho nhận (kho đến):</span>
                    <span className="font-medium text-slate-800 border-b border-dashed border-slate-300 flex-1 font-sans text-base">
                      Số nhà 1, ngách 327/6 phố Vũ Tông Phan, Phường Khương Đình, Quận Thanh Xuân, Thành phố Hà Nội
                    </span>
                  </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto my-6 font-sans">
                  <table className="w-full border-2 border-slate-900 text-center text-sm font-sans border-collapse">
                    <thead>
                      <tr className="bg-slate-100/80 text-slate-900 font-bold border-b-2 border-slate-900">
                        <th rowSpan={2} className="border border-slate-900 px-2 py-2.5 w-12">STT</th>
                        <th rowSpan={2} className="border border-slate-900 px-3 py-2.5 text-left">
                          Tên nhãn hiệu, quy cách, phẩm chất vật tư (sản phẩm, hàng hóa)
                        </th>
                        <th rowSpan={2} className="border border-slate-900 px-2 py-2.5 w-24">Mã số</th>
                        <th rowSpan={2} className="border border-slate-900 px-2 py-2.5 w-20">Đơn vị tính</th>
                        <th colSpan={2} className="border border-slate-900 px-2 py-1">Số lượng</th>
                        <th rowSpan={2} className="border border-slate-900 px-3 py-2.5 w-28">Đơn giá</th>
                        <th rowSpan={2} className="border border-slate-900 px-3 py-2.5 w-32">Thành tiền</th>
                      </tr>
                      <tr className="bg-slate-100/80 text-slate-900 font-bold border-b-2 border-slate-900">
                        <th className="border border-slate-900 px-2 py-1.5 w-16">Thực xuất</th>
                        <th className="border border-slate-900 px-2 py-1.5 w-16">Thực nhập</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewDoc.items.map((item, idx) => {
                        const qtyExp = item.quantityExported || (item as any).quantity || 0;
                        const qtyImp = (item as any).quantityImported || qtyExp;
                        const pr = item.price || (item as any).unitPrice || 0;
                        return (
                          <tr key={item.id || idx} className="border-b border-slate-800 font-sans">
                            <td className="border border-slate-900 px-2 py-2 font-sans text-xs font-semibold">{String(idx + 1).padStart(2, '0')}</td>
                            <td className="border border-slate-900 px-3 py-2 text-left font-bold text-slate-900 font-sans">{item.productName}</td>
                            <td className="border border-slate-900 px-2 py-2 font-sans font-semibold text-slate-700">{item.productCode}</td>
                            <td className="border border-slate-900 px-2 py-2 text-slate-800 font-sans">{item.unit || 'Cái'}</td>
                            <td className="border border-slate-900 px-2 py-2 font-sans font-bold text-slate-900">{qtyExp}</td>
                            <td className="border border-slate-900 px-2 py-2 font-sans font-bold text-slate-900">{qtyImp}</td>
                            <td className="border border-slate-900 px-3 py-2 text-right font-sans">{formatMoney(pr)}</td>
                            <td className="border border-slate-900 px-3 py-2 text-right font-sans font-bold">{formatMoney(pr * qtyExp)}</td>
                          </tr>
                        );
                      })}
                      {/* Total Row */}
                      <tr className="font-sans font-extrabold text-slate-900 bg-slate-50">
                        <td colSpan={7} className="border border-slate-900 px-4 py-2.5 text-right uppercase tracking-wider text-sm">
                          TỔNG CỘNG:
                        </td>
                        <td className="border border-slate-900 px-3 py-2.5 text-right text-base text-cyan-900 font-extrabold">
                          {formatMoney(previewDoc.items.reduce((s, i) => s + (i.price || (i as any).unitPrice || 0) * (i.quantityExported || (i as any).quantity || 0), 0))}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Digital Signature */}
                <div className="mt-8 text-center font-sans space-y-2">
                  <div className="font-extrabold text-slate-900 uppercase tracking-widest text-base">
                    THỦ TRƯỞNG ĐƠN VỊ
                  </div>
                  <div className="text-xs italic text-slate-500">(Chữ ký số)</div>
                  
                  <div className="inline-flex flex-col items-center justify-center border-2 border-emerald-500 bg-emerald-50/50 p-4 rounded-xl mt-4 shadow-sm">
                    <div className="flex items-center gap-2 text-emerald-700 font-bold text-sm">
                      <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                      <span>Đã được ký điện tử bởi</span>
                    </div>
                    <div className="font-black text-slate-900 text-center uppercase tracking-wider text-sm mt-1">
                      CÔNG TY TNHH ĐÀO TẠO THIÊN ỨNG
                    </div>
                    <div className="text-xs font-semibold text-emerald-700 mt-1">
                      Ngày: {previewDoc.createdDate || (previewDoc as any).transferredDate || '23/02/2025'}
                    </div>
                  </div>
                </div>

              </div>
            </div>

            {/* Modal Bottom Actions */}
            <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-6 py-4 print:hidden">
              <div className="text-xs font-medium text-slate-500">
                Mẫu phiếu điều chuyển hàng hóa nội bộ giữa các chi nhánh / kho
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setPreviewDoc(null)}
                  className="rounded-xl border-2 border-slate-300 bg-white px-5 py-2.5 text-sm font-bold text-slate-600 transition hover:bg-slate-100 cursor-pointer"
                >
                  Hủy / Đóng
                </button>
                <button
                  type="button"
                  onClick={handlePrint}
                  className="rounded-xl border-2 border-cyan-500 bg-white px-5 py-2.5 text-sm font-bold text-cyan-600 shadow-sm transition hover:bg-cyan-50 flex items-center gap-2 cursor-pointer"
                >
                  <Printer className="h-4 w-4" />
                  In phiếu điều chuyển
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewDoc(null)}
                  className="rounded-xl border-2 border-cyan-500 bg-cyan-600 px-6 py-2.5 text-sm font-bold text-white shadow-md transition hover:bg-cyan-700 flex items-center gap-2 cursor-pointer"
                >
                  <Save className="h-4 w-4" />
                  Lưu phiếu điều chuyển
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
