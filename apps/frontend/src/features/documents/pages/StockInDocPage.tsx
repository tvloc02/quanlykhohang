import React, { useState, useRef } from 'react';
import { documentsApi, type StockInDoc } from '../api/documentsApi';
import {
  Warehouse,
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
  templateCode: string; // Mã mẫu chứng từ (ví dụ: PNK-001)
  serialSymbol: string; // Kí hiệu chứng từ (ví dụ: C26NK)
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

const INITIAL_STOCK_IN_TEMPLATES: DocTemplateItem[] = [
  {
    id: 'tpl-in-001',
    templateCode: 'PNK-001',
    serialSymbol: '01-VT',
    cqtStatus: 'APPROVED',
    status: 'ACTIVE',
    invoiceType: 'MAIN',
    appliedWarehouse: 'Tất cả các kho',
    createdDate: '05/01/2026',
    fileName: 'Mau_01_VT_Phieu_Nhap_Kho_Thien_Ung.docx',
    fileSize: '52.0 KB',
    companyName: 'Công ty TNHH Dịch Vụ Kế Toán Thiên Ứng',
    companyTaxCode: '0110329220',
    companyAddress: 'Lô B11, số 9A, ngõ 181 Xuân Thủy, phường Cầu Giấy, Hà Nội',
    invoiceTitle: 'PHIẾU NHẬP KHO',
    sellerName: 'Nguyễn Thị Thúy',
  },
  {
    id: 'tpl-in-002',
    templateCode: 'PNK-002',
    serialSymbol: '02-VT',
    cqtStatus: 'APPROVED',
    status: 'ACTIVE',
    invoiceType: 'SUB',
    appliedWarehouse: 'Kho Hàng Hoá',
    createdDate: '15/01/2026',
    fileName: 'Mau_Phieu_Nhap_Kho_Vat_Tu.docx',
    fileSize: '48.0 KB',
    companyName: 'Công ty TNHH Dịch Vụ Kế Toán Thiên Ứng',
    companyTaxCode: '0110329220',
    companyAddress: 'Lô B11, số 9A, ngõ 181 Xuân Thủy, phường Cầu Giấy, Hà Nội',
    invoiceTitle: 'PHIẾU NHẬP KHO VẬT TƯ & THÀNH PHẨM',
    sellerName: 'Phạm Thu Dũng',
  },
];

export default function StockInDocPage() {
  const [docs, setDocs] = useState<StockInDoc[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [showAdvancedSearch, setShowAdvancedSearch] = useState<boolean>(false);
  const [previewDoc, setPreviewDoc] = useState<StockInDoc | null>(null);

  // Tab State
  const [activeTab, setActiveTab] = useState<'LIST' | 'TEMPLATE'>('LIST');

  // Pagination states
  const [pageSize, setPageSize] = useState<number>(10);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Template List State
  const [templates, setTemplates] = useState<DocTemplateItem[]>(INITIAL_STOCK_IN_TEMPLATES);
  const [templateSearch, setTemplateSearch] = useState<string>('');

  // Modals for Template Tab & Interactive Studio
  const [previewTemplateModal, setPreviewTemplateModal] = useState<DocTemplateItem | null>(null);
  const [editingTemplate, setEditingTemplate] = useState<DocTemplateItem | null>(null);
  const [showAddTemplateModal, setShowAddTemplateModal] = useState<boolean>(false);

  // Studio Editor Active Tab & Configuration
  const [studioTab, setStudioTab] = useState<'HEADER' | 'DETAILS' | 'STYLE' | 'SIGNATURES'>('HEADER');
  const [studioConfig, setStudioConfig] = useState({
    companyName: 'Công ty TNHH Dịch Vụ Kế Toán Thiên Ứng',
    departmentName: 'Bộ phận: mua hàng',
    invoiceTitle: 'PHIẾU NHẬP KHO',
    templateCode: 'PNK001',
    serialSymbol: '01-VT',
    circularNotice: '(Kèm theo Thông tư số 99/2025/TT-BTC ngày 27 tháng 10 năm 2025 của Bộ trưởng Bộ Tài chính)',
    debitAcc: '156',
    creditAcc: '331A',
    documentDate: 'Ngày 05 tháng 01 năm 2026',

    delivererName: 'Vũ Hữu Dũng',
    referenceDoc: 'BB bàn giao hàng hoá',
    referenceNo: '01/BBBG',
    referenceDate: '5/1/2026',
    referenceUnit: 'Công ty TNHH Dịch Vụ Hoa Hồng',
    warehouseName: 'Hàng Hoá',
    warehouseLocation: 'Lô B11, số 9A, ngõ 181 Xuân Thủy, phường Cầu Giấy, Hà Nội',
    totalAmountText: 'Chín mươi triệu đồng chẵn./.',
    attachedOriginalDoc: '01 Hóa đơn GTGT số: 00000385 ngày 05/01/2026',

    watermarkText: 'KẾ TOÁN THIÊN ỨNG',
    showWatermark: true,
    printTheme: 'BW' as 'BW' | 'COLOR',

    signatures: [
      { id: 's1', title: 'NGƯỜI LẬP PHIẾU', subtitle: '(Ký, họ tên)', name: 'Nguyễn Thị Thúy' },
      { id: 's2', title: 'NGƯỜI GIAO HÀNG', subtitle: '(Ký, họ tên)', name: 'Vũ Hữu Dũng' },
      { id: 's3', title: 'THỦ KHO', subtitle: '(Ký, họ tên)', name: 'Phạm Thu Dũng' },
      { id: 's4', title: 'KẾ TOÁN TRƯỞNG', subtitle: '(Hoặc bộ phận có nhu cầu nhập)', name: 'Đoàn Thị Hồng Mơ' },
    ],
  });

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
    invoiceTitle: 'PHIẾU NHẬP KHO THÀNH PHẨM & VẬT TƯ',
    fileName: 'Mau_Phieu_Nhap_Kho_Moi.docx',
    fileSize: '40.0 KB',
  });

  React.useEffect(() => {
    async function loadData() {
      setLoading(true);
      const data = await documentsApi.getStockInNotes();
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
    const orderCode = (doc as any).orderCode || '';
    const matchesKeyword =
      !keyword ||
      doc.receiptNo.toLowerCase().includes(keyword) ||
      doc.supplierName.toLowerCase().includes(keyword) ||
      doc.warehouseName.toLowerCase().includes(keyword) ||
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

  const totalReceiptValue = docs.reduce((sum, d) => {
    const sub = d.items.reduce((s, i) => s + i.unitPrice * (i.quantityActual || (i as any).quantity || 0), 0);
    return sum + sub;
  }, 0);

  const totalItemsCount = docs.reduce((sum, d) => sum + d.items.reduce((s, i) => s + (i.quantityActual || (i as any).quantity || 0), 0), 0);

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
    if (window.confirm('Bạn có chắc chắn muốn xóa mẫu phiếu nhập kho này không?')) {
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
    const newId = `tpl-in-${Date.now()}`;
    const code = newTemplateForm.templateCode.trim() || `PNK/00${templates.length + 1}`;
    const newTpl: DocTemplateItem = {
      id: newId,
      templateCode: code,
      serialSymbol: `C26NK-0${templates.length + 1}`,
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
      {/* Hidden File Input for Editing (.docx) */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        accept=".docx,.doc"
        className="hidden"
      />

      {/* Header Design Aligned with TransferDoc Layout */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border-2 border-slate-200 bg-white p-2 shadow-sm">
          <button
            type="button"
            onClick={() => setActiveTab('LIST')}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition cursor-pointer ${
              activeTab === 'LIST'
                ? 'bg-cyan-600 text-white shadow-sm font-black'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <List className="h-4 w-4" />
            Danh sách phiếu nhập kho
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('TEMPLATE')}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition cursor-pointer ${
              activeTab === 'TEMPLATE'
                ? 'bg-cyan-600 text-white shadow-sm font-black'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <FileSpreadsheet className="h-4 w-4" />
            Mẫu phiếu nhập kho
          </button>
        </div>

        {activeTab === 'TEMPLATE' && (
          <button
            type="button"
            onClick={() => {
              setNewTemplateForm({
                templateCode: `PNK/00${templates.length + 1}`,
                appliedWarehouse: 'Kho Tổng Hàng Hoá',
                fileName: '',
              });
              setShowAddTemplateModal(true);
            }}
            className="inline-flex items-center gap-2 rounded-xl border-2 border-cyan-500 bg-cyan-600 px-5 py-2.5 text-sm font-bold text-white shadow-md transition hover:bg-cyan-700 shrink-0 cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            Thêm mới mẫu
          </button>
        )}
      </div>

      {activeTab === 'LIST' ? (
        <>
          {/* 4 Cards Summary Strip matching /products/main */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex h-[72px] items-center justify-center rounded-xl border-2 border-cyan-500 bg-white px-4 shadow-sm transition hover:bg-cyan-50 text-center">
              <p className="text-base font-black text-cyan-700 uppercase">
                {docs.length} PHIẾU NHẬP KHO
              </p>
            </div>
            <div className="flex h-[72px] items-center justify-center rounded-xl border-2 border-cyan-500 bg-white px-4 shadow-sm transition hover:bg-cyan-50 text-center">
              <p className="text-base font-black text-cyan-700 uppercase">
                {formatMoney(totalItemsCount)} SẢN PHẨM NHẬP
              </p>
            </div>
            <div className="flex h-[72px] items-center justify-center rounded-xl border-2 border-cyan-500 bg-white px-4 shadow-sm transition hover:bg-cyan-50 text-center">
              <p className="text-base font-black text-cyan-700 uppercase">
                {formatMoney(totalReceiptValue)} ₫ TỔNG GIÁ TRỊ NHẬP
              </p>
            </div>
            <div className="flex h-[72px] items-center justify-center rounded-xl border-2 border-cyan-500 bg-white px-4 shadow-sm transition hover:bg-cyan-50 text-center">
              <p className="text-base font-black text-cyan-700 uppercase">
                100% HOÀN TẤT NHẬP KHO
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
                  placeholder="Tìm kiếm theo số phiếu, nhà cung cấp, kho nhận, mã đơn nhập..."
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
                  <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-600">Trạng thái phiếu nhập</label>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { key: 'ALL', label: 'Tất cả phiếu nhập' },
                      { key: 'COMPLETED', label: 'Đã hoàn thành' },
                      { key: 'RECEIVED', label: 'Đã nhận hàng' },
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
                    <th className="border-r border-slate-200 p-3 text-xs font-extrabold uppercase text-slate-800">Số Phiếu Nhập</th>
                    <th className="border-r border-slate-200 p-3 text-xs font-extrabold uppercase text-slate-800">Mã Đơn Hàng</th>
                    <th className="border-r border-slate-200 p-3 text-xs font-extrabold uppercase text-slate-800">Nhà Cung Cấp</th>
                    <th className="border-r border-slate-200 p-3 text-xs font-extrabold uppercase text-slate-800">Kho Nhận</th>
                    <th className="border-r border-slate-200 p-3 text-center text-xs font-extrabold uppercase text-slate-800">Ngày Nhập</th>
                    <th className="border-r border-slate-200 p-3 text-right text-xs font-extrabold uppercase text-slate-800">Tổng Tiền Nhập</th>
                    <th className="border-r border-slate-200 p-3 text-center text-xs font-extrabold uppercase text-slate-800">Trạng Thái</th>
                    <th className="p-3 text-center text-xs font-extrabold uppercase text-slate-800 min-w-[120px]">Thao Tác</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={9} className="p-8 text-center text-slate-500">Đang tải danh sách phiếu nhập kho...</td>
                    </tr>
                  ) : paginatedDocs.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="p-8 text-center text-slate-500">Không tìm thấy phiếu nhập kho phù hợp.</td>
                    </tr>
                  ) : (
                    paginatedDocs.map((doc, index) => {
                      const totalQty = doc.items.reduce((sum, item) => sum + (item.quantityActual || (item as any).quantity || 0), 0);
                      const totalVal = doc.items.reduce((sum, item) => sum + item.unitPrice * (item.quantityActual || (item as any).quantity || 0), 0);
                      const orderCode = (doc as any).orderCode || 'PO-2026';
                      const dateStr = doc.createdDate || (doc as any).receivedDate || '';

                      return (
                        <tr key={doc.id} className="border-b border-slate-200 hover:bg-cyan-50/50 transition-colors">
                          <td className="border-r border-slate-200 p-3 text-center font-bold text-slate-700 text-xs sm:text-sm">
                            {startIndex + index}
                          </td>
                          <td className="border-r border-slate-200 p-3 font-bold text-cyan-700 text-xs sm:text-sm">
                            {doc.receiptNo}
                          </td>
                          <td className="border-r border-slate-200 p-3 text-xs font-mono text-slate-600">
                            {orderCode}
                          </td>
                          <td className="border-r border-slate-200 p-3 text-xs sm:text-sm font-bold text-slate-900">
                            {doc.supplierName}
                          </td>
                          <td className="border-r border-slate-200 p-3 text-xs sm:text-sm text-slate-700">
                            {doc.warehouseName}
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
                              Hoàn thành
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
        </>
      ) : (
        /* TAB 2: MẪU PHIẾU NHẬP KHO (DANH SÁCH MẪU CHỨNG TỪ TỰ ĐỘNG) */
        <div className="space-y-4">
          {/* Search Toolbar for Mẫu phiếu nhập kho (Full Width Search) */}
          <div className="relative w-full">
            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-cyan-500" />
            <input
              type="text"
              value={templateSearch}
              onChange={(e) => setTemplateSearch(e.target.value)}
              className="h-11 w-full rounded-xl border-2 border-cyan-500 bg-white pl-11 pr-4 text-sm font-semibold outline-none transition focus:border-cyan-600 focus:ring-4 focus:ring-cyan-500/10"
              placeholder="Tìm mẫu theo mã mẫu, kí hiệu, kho áp dụng, tên file..."
            />
          </div>

          {/* Table for Templates List (Styling aligned with Personnel) */}
          <div className="overflow-hidden rounded-xl border-2 border-slate-200 bg-white shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse bg-white text-left">
                <thead className="bg-cyan-50">
                  <tr className="border-b-2 border-slate-200">
                    <th className="w-12 border-x border-slate-200 p-3.5 text-center text-xs font-extrabold uppercase text-slate-800">STT</th>
                    <th className="border-x border-slate-200 p-3.5 text-center text-xs font-extrabold uppercase text-slate-800">Mã Mẫu Phiếu</th>
                    <th className="border-x border-slate-200 p-3.5 text-center text-xs font-extrabold uppercase text-slate-800">Kí Hiệu Phiếu</th>
                    <th className="border-x border-slate-200 p-3.5 text-center text-xs font-extrabold uppercase text-slate-800">Trạng Thái Gửi CQT</th>
                    <th className="border-x border-slate-200 p-3.5 text-center text-xs font-extrabold uppercase text-slate-800">Trạng Thái Phiếu</th>
                    <th className="border-x border-slate-200 p-3.5 text-center text-xs font-extrabold uppercase text-slate-800">Loại Phiếu</th>
                    <th className="border-x border-slate-200 p-3.5 text-center text-xs font-extrabold uppercase text-slate-800">Kho Áp Dụng</th>
                    <th className="border-x border-slate-200 p-3.5 text-center text-xs font-extrabold uppercase text-slate-800">Ngày Tạo Mẫu</th>
                    <th className="border-x border-slate-200 p-3.5 text-center text-xs font-extrabold uppercase text-slate-800 min-w-[290px]">Thao Tác</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTemplates.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="p-8 text-center text-sm font-semibold text-slate-500">
                        Chưa có mẫu phiếu nhập kho nào được tạo.
                      </td>
                    </tr>
                  ) : (
                    filteredTemplates.map((tpl, index) => (
                      <tr key={tpl.id} className="border-b border-slate-200 transition-colors hover:bg-cyan-50/40">
                        <td className="border-x border-slate-200 p-3.5 text-center text-sm font-semibold text-slate-700">
                          {index + 1}
                        </td>
                        <td className="border-x border-slate-200 p-3.5 text-center text-sm font-extrabold text-cyan-700">
                          {tpl.templateCode}
                        </td>
                        <td className="border-x border-slate-200 p-3.5 text-center text-sm font-mono font-bold text-slate-800">
                          {tpl.serialSymbol}
                        </td>
                        <td className="border-x border-slate-200 p-3.5 text-center">
                          {tpl.cqtStatus === 'APPROVED' ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-extrabold text-emerald-700 border border-emerald-200">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Đã duyệt
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-extrabold text-amber-700 border border-amber-200">
                              <AlertCircle className="h-3.5 w-3.5" />
                              Chưa nộp
                            </span>
                          )}
                        </td>
                        <td className="border-x border-slate-200 p-3.5 text-center">
                          {tpl.status === 'ACTIVE' ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-cyan-50 px-2.5 py-1 text-xs font-extrabold text-cyan-700 border border-cyan-200">
                              Đang sử dụng
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-extrabold text-slate-600 border border-slate-200">
                              Ngừng sử dụng
                            </span>
                          )}
                        </td>
                        <td className="border-x border-slate-200 p-3.5 text-center text-xs font-extrabold">
                          {tpl.cqtStatus === 'APPROVED' ? (
                            tpl.invoiceType === 'MAIN' ? (
                              <span className="inline-flex rounded-md bg-indigo-50 px-2.5 py-1 text-indigo-700 border border-indigo-200">
                                Chính
                              </span>
                            ) : (
                              <span className="inline-flex rounded-md bg-purple-50 px-2.5 py-1 text-purple-700 border border-purple-200">
                                Phụ
                              </span>
                            )
                          ) : (
                            <span className="text-slate-400 font-bold">-</span>
                          )}
                        </td>
                        <td className="border-x border-slate-200 p-3.5 text-center text-sm font-semibold text-slate-800">
                          {tpl.appliedWarehouse || 'Tất cả các kho'}
                        </td>
                        <td className="border-x border-slate-200 p-3.5 text-center text-xs font-semibold text-slate-600">
                          {tpl.createdDate}
                        </td>
                        <td className="border-x border-slate-200 p-3.5 text-center">
                          <div className="flex items-center justify-center gap-1.5 flex-wrap">
                            <button
                              type="button"
                              onClick={() => handleTriggerEditFile(tpl.id)}
                              className="inline-flex items-center gap-1 rounded-lg border border-cyan-600 bg-white px-2.5 py-1.5 text-xs font-bold text-cyan-700 hover:bg-cyan-50 transition shadow-2xs"
                              title="Tải lên file Word (.docx) mới"
                            >
                              <Upload className="h-3.5 w-3.5" />
                              Sửa file
                            </button>

                            <button
                              type="button"
                              onClick={() => handleOpenEditModal(tpl)}
                              className="inline-flex items-center gap-1 rounded-lg bg-cyan-600 px-2.5 py-1.5 text-xs font-bold text-white hover:bg-cyan-700 transition shadow-2xs"
                              title="Sửa chi tiết thông tin bản ghi mẫu"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                              Sửa nội dung
                            </button>

                            <button
                              type="button"
                              onClick={() => setPreviewTemplateModal(tpl)}
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition shadow-2xs"
                              title="Xem mẫu phiếu A4"
                            >
                              <Eye className="h-3.5 w-3.5" />
                              Xem mẫu
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDeleteTemplate(tpl.id)}
                              className="inline-flex items-center justify-center rounded-lg border border-red-200 bg-white p-1.5 text-red-600 hover:bg-red-50 transition"
                              title="Xóa mẫu phiếu"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Edit Template Content Modal */}
      {editingTemplate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl space-y-4 border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-base font-extrabold text-cyan-900 flex items-center gap-2">
                <Pencil className="h-5 w-5 text-cyan-600" />
                Sửa Nội Dung Bản Ghi Mẫu Phiếu Nhập Kho
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
                Thêm Mẫu Phiếu Nhập Kho Mới
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
                  placeholder="Ví dụ: Mẫu Phiếu Nhập Kho 004"
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

      {/* Interactive Word-Style Template Studio & Live A4 Editor Modal */}
      {previewTemplateModal && (
        <div className="fixed inset-0 z-50 flex flex-col bg-slate-900/80 backdrop-blur-xs overflow-hidden">
          {/* Studio Top Control Header */}
          <div className="flex items-center justify-between bg-cyan-800 px-6 py-3 text-white shadow-md border-b border-cyan-700 shrink-0 print:hidden">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-700 border border-cyan-500 shadow-xs">
                <FileSpreadsheet className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="font-extrabold text-sm sm:text-base flex items-center gap-2">
                  TRÌNH THIẾT KẾ & TÙY CHỈNH MẪU PHIẾU IN (A4 INTERACTIVE STUDIO)
                </h3>
                <p className="text-[11px] text-cyan-200 font-medium">
                  Tùy chỉnh thông số, người ký, chữ in mờ & xem trực tiếp tờ giấy in mẫu
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handlePrint}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-black text-white shadow-md hover:bg-emerald-700 transition cursor-pointer"
              >
                <Printer className="h-4 w-4" />
                In Thử Mẫu
              </button>
              <button
                type="button"
                onClick={() => setPreviewTemplateModal(null)}
                className="rounded-xl p-2 text-white/80 hover:bg-white/10 hover:text-white transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Studio Main Workspace: Dual Pane Left Controls + Right Live A4 Sheet */}
          <div className="flex flex-1 overflow-hidden font-sans">
            {/* LEFT CONTROL SIDEBAR (WORD-STYLE PROPERTY PANEL) */}
            <div className="w-96 bg-white border-r border-slate-200 flex flex-col shrink-0 overflow-hidden shadow-xl print:hidden">
              {/* Toolbar Category Tabs */}
              <div className="grid grid-cols-4 bg-slate-100 p-1.5 border-b border-slate-200 text-xs font-bold gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => setStudioTab('HEADER')}
                  className={`py-2 px-1 text-center rounded-lg transition cursor-pointer ${
                    studioTab === 'HEADER' ? 'bg-cyan-600 text-white font-extrabold shadow-xs' : 'text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  Thông Tin
                </button>
                <button
                  type="button"
                  onClick={() => setStudioTab('DETAILS')}
                  className={`py-2 px-1 text-center rounded-lg transition cursor-pointer ${
                    studioTab === 'DETAILS' ? 'bg-cyan-600 text-white font-extrabold shadow-xs' : 'text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  Chứng Từ
                </button>
                <button
                  type="button"
                  onClick={() => setStudioTab('STYLE')}
                  className={`py-2 px-1 text-center rounded-lg transition cursor-pointer ${
                    studioTab === 'STYLE' ? 'bg-cyan-600 text-white font-extrabold shadow-xs' : 'text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  Chữ Mờ
                </button>
                <button
                  type="button"
                  onClick={() => setStudioTab('SIGNATURES')}
                  className={`py-2 px-1 text-center rounded-lg transition cursor-pointer ${
                    studioTab === 'SIGNATURES' ? 'bg-cyan-600 text-white font-extrabold shadow-xs' : 'text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  Người Ký
                </button>
              </div>

              {/* Sidebar Form Fields */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
                {/* TAB 1: HEADER & CODES */}
                {studioTab === 'HEADER' && (
                  <div className="space-y-3">
                    <h4 className="font-extrabold text-cyan-800 uppercase tracking-wide text-[11px] border-b border-cyan-100 pb-1 flex items-center gap-1.5">
                      <Pencil className="h-3.5 w-3.5" /> Thông Tin Doanh Nghiệp & Tiêu Đề
                    </h4>
                    
                    <div>
                      <label className="block mb-1 font-bold text-slate-700">Tên Doanh Nghiệp / Công Ty:</label>
                      <input
                        type="text"
                        value={studioConfig.companyName}
                        onChange={(e) => setStudioConfig({ ...studioConfig, companyName: e.target.value })}
                        className="w-full rounded-lg border border-slate-300 p-2 text-xs font-semibold focus:border-cyan-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block mb-1 font-bold text-slate-700">Bộ Phận Lập Phiếu:</label>
                      <input
                        type="text"
                        value={studioConfig.departmentName}
                        onChange={(e) => setStudioConfig({ ...studioConfig, departmentName: e.target.value })}
                        className="w-full rounded-lg border border-slate-300 p-2 text-xs font-semibold focus:border-cyan-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block mb-1 font-bold text-slate-700">Tiêu Đề Phiếu In:</label>
                      <input
                        type="text"
                        value={studioConfig.invoiceTitle}
                        onChange={(e) => setStudioConfig({ ...studioConfig, invoiceTitle: e.target.value })}
                        className="w-full rounded-lg border border-slate-300 p-2 text-xs font-semibold focus:border-cyan-500 focus:outline-none uppercase"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block mb-1 font-bold text-slate-700">Mẫu Số:</label>
                        <input
                          type="text"
                          value={studioConfig.serialSymbol}
                          onChange={(e) => setStudioConfig({ ...studioConfig, serialSymbol: e.target.value })}
                          className="w-full rounded-lg border border-slate-300 p-2 text-xs font-semibold focus:border-cyan-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block mb-1 font-bold text-slate-700">Mã / Số Phiếu:</label>
                        <input
                          type="text"
                          value={studioConfig.templateCode}
                          onChange={(e) => setStudioConfig({ ...studioConfig, templateCode: e.target.value })}
                          className="w-full rounded-lg border border-slate-300 p-2 text-xs font-semibold focus:border-cyan-500 focus:outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block mb-1 font-bold text-slate-700">Trích Dẫn Thông Tư:</label>
                      <textarea
                        rows={2}
                        value={studioConfig.circularNotice}
                        onChange={(e) => setStudioConfig({ ...studioConfig, circularNotice: e.target.value })}
                        className="w-full rounded-lg border border-slate-300 p-2 text-xs font-semibold focus:border-cyan-500 focus:outline-none"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block mb-1 font-bold text-slate-700">Tài Khoản Nợ:</label>
                        <input
                          type="text"
                          value={studioConfig.debitAcc}
                          onChange={(e) => setStudioConfig({ ...studioConfig, debitAcc: e.target.value })}
                          className="w-full rounded-lg border border-slate-300 p-2 text-xs font-semibold focus:border-cyan-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block mb-1 font-bold text-slate-700">Tài Khoản Có:</label>
                        <input
                          type="text"
                          value={studioConfig.creditAcc}
                          onChange={(e) => setStudioConfig({ ...studioConfig, creditAcc: e.target.value })}
                          className="w-full rounded-lg border border-slate-300 p-2 text-xs font-semibold focus:border-cyan-500 focus:outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block mb-1 font-bold text-slate-700">Ngày Lập Hiển Thị:</label>
                      <input
                        type="text"
                        value={studioConfig.documentDate}
                        onChange={(e) => setStudioConfig({ ...studioConfig, documentDate: e.target.value })}
                        className="w-full rounded-lg border border-slate-300 p-2 text-xs font-semibold focus:border-cyan-500 focus:outline-none"
                      />
                    </div>
                  </div>
                )}

                {/* TAB 2: DETAILS & LOCATION */}
                {studioTab === 'DETAILS' && (
                  <div className="space-y-3">
                    <h4 className="font-extrabold text-cyan-800 uppercase tracking-wide text-[11px] border-b border-cyan-100 pb-1 flex items-center gap-1.5">
                      <Pencil className="h-3.5 w-3.5" /> Thông Tin Giao Nhận & Địa Điểm Kho
                    </h4>

                    <div>
                      <label className="block mb-1 font-bold text-slate-700">Họ và Tên Người Giao Hàng:</label>
                      <input
                        type="text"
                        value={studioConfig.delivererName}
                        onChange={(e) => setStudioConfig({ ...studioConfig, delivererName: e.target.value })}
                        className="w-full rounded-lg border border-slate-300 p-2 text-xs font-semibold focus:border-cyan-500 focus:outline-none"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block mb-1 font-bold text-slate-700">Theo Chứng Từ:</label>
                        <input
                          type="text"
                          value={studioConfig.referenceDoc}
                          onChange={(e) => setStudioConfig({ ...studioConfig, referenceDoc: e.target.value })}
                          className="w-full rounded-lg border border-slate-300 p-2 text-xs font-semibold focus:border-cyan-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block mb-1 font-bold text-slate-700">Số BBBG:</label>
                        <input
                          type="text"
                          value={studioConfig.referenceNo}
                          onChange={(e) => setStudioConfig({ ...studioConfig, referenceNo: e.target.value })}
                          className="w-full rounded-lg border border-slate-300 p-2 text-xs font-semibold focus:border-cyan-500 focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block mb-1 font-bold text-slate-700">Ngày BBBG:</label>
                        <input
                          type="text"
                          value={studioConfig.referenceDate}
                          onChange={(e) => setStudioConfig({ ...studioConfig, referenceDate: e.target.value })}
                          className="w-full rounded-lg border border-slate-300 p-2 text-xs font-semibold focus:border-cyan-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block mb-1 font-bold text-slate-700">Của Đơn Vị:</label>
                        <input
                          type="text"
                          value={studioConfig.referenceUnit}
                          onChange={(e) => setStudioConfig({ ...studioConfig, referenceUnit: e.target.value })}
                          className="w-full rounded-lg border border-slate-300 p-2 text-xs font-semibold focus:border-cyan-500 focus:outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block mb-1 font-bold text-slate-700">Nhập Tại Kho:</label>
                      <input
                        type="text"
                        value={studioConfig.warehouseName}
                        onChange={(e) => setStudioConfig({ ...studioConfig, warehouseName: e.target.value })}
                        className="w-full rounded-lg border border-slate-300 p-2 text-xs font-semibold focus:border-cyan-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block mb-1 font-bold text-slate-700">Địa Điểm Kho:</label>
                      <textarea
                        rows={2}
                        value={studioConfig.warehouseLocation}
                        onChange={(e) => setStudioConfig({ ...studioConfig, warehouseLocation: e.target.value })}
                        className="w-full rounded-lg border border-slate-300 p-2 text-xs font-semibold focus:border-cyan-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block mb-1 font-bold text-slate-700">Tổng Số Tiền (Viết Bằng Chữ):</label>
                      <input
                        type="text"
                        value={studioConfig.totalAmountText}
                        onChange={(e) => setStudioConfig({ ...studioConfig, totalAmountText: e.target.value })}
                        className="w-full rounded-lg border border-slate-300 p-2 text-xs font-semibold focus:border-cyan-500 focus:outline-none italic"
                      />
                    </div>

                    <div>
                      <label className="block mb-1 font-bold text-slate-700">Số Chứng Từ Gốc Kèm Theo:</label>
                      <input
                        type="text"
                        value={studioConfig.attachedOriginalDoc}
                        onChange={(e) => setStudioConfig({ ...studioConfig, attachedOriginalDoc: e.target.value })}
                        className="w-full rounded-lg border border-slate-300 p-2 text-xs font-semibold focus:border-cyan-500 focus:outline-none"
                      />
                    </div>
                  </div>
                )}

                {/* TAB 3: WATERMARK & COLOR THEME */}
                {studioTab === 'STYLE' && (
                  <div className="space-y-4">
                    <h4 className="font-extrabold text-cyan-800 uppercase tracking-wide text-[11px] border-b border-cyan-100 pb-1 flex items-center gap-1.5">
                      <Pencil className="h-3.5 w-3.5" /> Chữ In Mờ (Watermark) & Chế Độ Màu In
                    </h4>

                    <div>
                      <label className="block mb-1 font-bold text-slate-700">Nội Dung Chữ In Mờ Chìm:</label>
                      <input
                        type="text"
                        value={studioConfig.watermarkText}
                        onChange={(e) => setStudioConfig({ ...studioConfig, watermarkText: e.target.value })}
                        className="w-full rounded-lg border border-slate-300 p-2 text-xs font-semibold focus:border-cyan-500 focus:outline-none uppercase"
                        placeholder="Ví dụ: KẾ TOÁN THIÊN ỨNG"
                      />
                    </div>

                    <div className="flex items-center justify-between rounded-xl bg-slate-50 p-3 border border-slate-200">
                      <div>
                        <p className="font-bold text-slate-800">Hiển Thị Chữ In Mờ</p>
                        <p className="text-[11px] text-slate-500">In chữ chìm xuyên qua bảng dữ liệu</p>
                      </div>
                      <input
                        type="checkbox"
                        checked={studioConfig.showWatermark}
                        onChange={(e) => setStudioConfig({ ...studioConfig, showWatermark: e.target.checked })}
                        className="h-5 w-5 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500 cursor-pointer"
                      />
                    </div>

                    <div className="space-y-2 pt-2">
                      <label className="block font-bold text-slate-700">Chế Độ Màu Sắc Khi In:</label>
                      
                      <div
                        onClick={() => setStudioConfig({ ...studioConfig, printTheme: 'BW' })}
                        className={`p-3 rounded-xl border-2 flex items-center gap-3 cursor-pointer transition ${
                          studioConfig.printTheme === 'BW' ? 'border-cyan-600 bg-cyan-50/50' : 'border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <div className="h-4 w-4 rounded-full border-2 border-slate-400 flex items-center justify-center">
                          {studioConfig.printTheme === 'BW' && <div className="h-2 w-2 rounded-full bg-cyan-600" />}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900">In Đen Trắng Chuẩn (Tiết Kiệm Mực / Giấy Trắng)</p>
                          <p className="text-[11px] text-slate-500">Viền đen nhạt, không tô màu sắc tiêu đề</p>
                        </div>
                      </div>

                      <div
                        onClick={() => setStudioConfig({ ...studioConfig, printTheme: 'COLOR' })}
                        className={`p-3 rounded-xl border-2 flex items-center gap-3 cursor-pointer transition ${
                          studioConfig.printTheme === 'COLOR' ? 'border-cyan-600 bg-cyan-50/50' : 'border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <div className="h-4 w-4 rounded-full border-2 border-slate-400 flex items-center justify-center">
                          {studioConfig.printTheme === 'COLOR' && <div className="h-2 w-2 rounded-full bg-cyan-600" />}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900">In Màu Nổi Bật (Yellow & Green Accent)</p>
                          <p className="text-[11px] text-slate-500">Tô màu tiêu đề vàng & tổng cộng xanh lá</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 4: DYNAMIC SIGNATURES CUSTOMIZATION */}
                {studioTab === 'SIGNATURES' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between border-b border-cyan-100 pb-1">
                      <h4 className="font-extrabold text-cyan-800 uppercase tracking-wide text-[11px] flex items-center gap-1.5">
                        <Pencil className="h-3.5 w-3.5" /> Cấu Hình Vị Trí Người Ký ({studioConfig.signatures.length})
                      </h4>
                      <button
                        type="button"
                        onClick={() => {
                          const newSig = {
                            id: `sig-${Date.now()}`,
                            title: 'NGƯỜI KÝ MỚI',
                            subtitle: '(Ký, họ tên)',
                            name: 'Tên Người Ký',
                          };
                          setStudioConfig({ ...studioConfig, signatures: [...studioConfig.signatures, newSig] });
                        }}
                        className="inline-flex items-center gap-1 rounded-lg bg-cyan-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-cyan-700 transition cursor-pointer"
                      >
                        <Plus className="h-3 w-3" /> Thêm
                      </button>
                    </div>

                    <div className="space-y-3">
                      {studioConfig.signatures.map((sig, idx) => (
                        <div key={sig.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2 relative">
                          <div className="flex items-center justify-between">
                            <span className="font-extrabold text-slate-700 text-[11px]">Cột ký số #{idx + 1}</span>
                            {studioConfig.signatures.length > 1 && (
                              <button
                                type="button"
                                onClick={() => {
                                  setStudioConfig({
                                    ...studioConfig,
                                    signatures: studioConfig.signatures.filter((s) => s.id !== sig.id),
                                  });
                                }}
                                className="text-rose-600 hover:text-rose-800 p-1 cursor-pointer"
                                title="Xóa cột người ký này"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>

                          <div>
                            <label className="block mb-0.5 text-[11px] font-bold text-slate-600">Chức Danh (IN HOA):</label>
                            <input
                              type="text"
                              value={sig.title}
                              onChange={(e) => {
                                const val = e.target.value;
                                setStudioConfig({
                                  ...studioConfig,
                                  signatures: studioConfig.signatures.map((s) => (s.id === sig.id ? { ...s, title: val } : s)),
                                });
                              }}
                              className="w-full rounded-md border border-slate-300 p-1.5 text-xs font-bold focus:border-cyan-500 uppercase"
                            />
                          </div>

                          <div>
                            <label className="block mb-0.5 text-[11px] font-semibold text-slate-600">Ghi Chú Ký:</label>
                            <input
                              type="text"
                              value={sig.subtitle}
                              onChange={(e) => {
                                const val = e.target.value;
                                setStudioConfig({
                                  ...studioConfig,
                                  signatures: studioConfig.signatures.map((s) => (s.id === sig.id ? { ...s, subtitle: val } : s)),
                                });
                              }}
                              className="w-full rounded-md border border-slate-300 p-1.5 text-xs italic focus:border-cyan-500"
                            />
                          </div>

                          <div>
                            <label className="block mb-0.5 text-[11px] font-bold text-slate-600">Họ và Tên Người Ký:</label>
                            <input
                              type="text"
                              value={sig.name}
                              onChange={(e) => {
                                const val = e.target.value;
                                setStudioConfig({
                                  ...studioConfig,
                                  signatures: studioConfig.signatures.map((s) => (s.id === sig.id ? { ...s, name: val } : s)),
                                });
                              }}
                              className="w-full rounded-md border border-slate-300 p-1.5 text-xs font-bold text-cyan-900 focus:border-cyan-500"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* RIGHT PANEL: LIVE A4 SHEET CANVAS WITH UNIFIED FONT-SANS TO FIX ALL ACCENT GLITCHES */}
            <div className="flex-1 bg-slate-300 p-4 sm:p-8 overflow-y-auto flex justify-center items-start print:p-0 print:bg-white">
              <div className="w-[820px] min-h-[1060px] bg-white p-10 shadow-2xl rounded-xs font-sans text-slate-900 space-y-4 relative print:w-full print:shadow-none print:p-0">
                {/* TOP HEADER SECTION */}
                <div className="flex items-start justify-between border-b border-slate-300 pb-3">
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-slate-900">{studioConfig.companyName || 'Công ty TNHH Dịch Vụ Kế Toán Thiên Ứng'}</p>
                    <p className="text-xs font-semibold text-slate-700">{studioConfig.departmentName || 'Bộ phận: mua hàng'}</p>
                    <div className="pt-1 flex items-center gap-2">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-indigo-700 via-purple-700 to-cyan-600 text-white font-black text-xs shadow-xs border border-white">
                        TU
                      </div>
                      <span className="text-[11px] font-extrabold text-cyan-900 tracking-wider">KẾ TOÁN THIÊN ỨNG</span>
                    </div>
                  </div>

                  <div className="text-right space-y-0.5">
                    <p className="text-sm font-black text-slate-900">Mẫu số {studioConfig.serialSymbol || '01-VT'}</p>
                    <p className="text-[11px] font-semibold italic text-slate-600 max-w-[280px]">
                      {studioConfig.circularNotice || '(Kèm theo Thông tư số 99/2025/TT-BTC ngày 27 tháng 10 năm 2025)'}
                    </p>
                  </div>
                </div>

                {/* TITLE & CODES */}
                <div className="relative text-center py-2">
                  <h1 className="text-2xl font-black tracking-wide text-slate-900 uppercase">
                    {studioConfig.invoiceTitle || 'PHIẾU NHẬP KHO'}
                  </h1>
                  <p className="text-xs font-semibold italic text-slate-700 mt-1">{studioConfig.documentDate || 'Ngày 05 tháng 01 năm 2026'}</p>
                  
                  <div className="absolute right-0 top-0 text-right text-xs font-bold text-slate-800 space-y-0.5">
                    <p>Số: <span className="font-mono text-cyan-800 font-extrabold">{studioConfig.templateCode || 'PNK001'}</span></p>
                    <p>Nợ: <span className="font-mono text-slate-900">{studioConfig.debitAcc || '156'}</span></p>
                    <p>Có: <span className="font-mono text-slate-900">{studioConfig.creditAcc || '331A'}</span></p>
                  </div>
                </div>

                {/* DETAILS METADATA */}
                <div className="space-y-1.5 text-xs text-slate-800 font-semibold pt-1">
                  <p>
                    <span className="font-normal text-slate-700">Họ và tên người giao:</span> <span className="font-bold text-slate-900">{studioConfig.delivererName || 'Vũ Hữu Dũng'}</span>
                  </p>
                  <p>
                    <span className="font-normal text-slate-700">Theo:</span> <span className="font-bold text-slate-900">{studioConfig.referenceDoc || 'BB bàn giao hàng hoá'}</span>
                    <span className="ml-3 font-normal text-slate-700">số:</span> <span className="font-bold text-slate-900">{studioConfig.referenceNo || '01/BBBG'}</span>
                    <span className="ml-3 font-normal text-slate-700">ngày:</span> <span className="font-bold text-slate-900">{studioConfig.referenceDate || '5/1/2026'}</span>
                    <span className="ml-3 font-normal text-slate-700">của:</span> <span className="font-bold text-slate-900">{studioConfig.referenceUnit || 'Công ty TNHH Dịch Vụ Hoa Hồng'}</span>
                  </p>
                  <div className="flex items-center justify-between">
                    <p><span className="font-normal text-slate-700">Nhập tại kho:</span> <span className="font-bold text-slate-900">{studioConfig.warehouseName || 'Hàng Hoá'}</span></p>
                    <p><span className="font-normal text-slate-700">Địa điểm:</span> <span className="font-bold text-slate-900">{studioConfig.warehouseLocation || 'Lô B11, số 9A, ngõ 181 Xuân Thủy, Cầu Giấy, Hà Nội'}</span></p>
                  </div>
                </div>

                {/* TABLE CANVAS WITH OPTIONAL WATERMARK & THEMED HEADERS */}
                <div className="relative overflow-hidden border-2 border-slate-900">
                  {/* WATERMARK */}
                  {studioConfig.showWatermark && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-10 select-none">
                      <span className="text-5xl font-black text-slate-900 tracking-widest uppercase rotate-[-12deg]">
                        {studioConfig.watermarkText || 'KẾ TOÁN THIÊN ỨNG'}
                      </span>
                    </div>
                  )}

                  <table className="w-full text-center text-xs border-collapse font-sans">
                    <thead>
                      <tr className={`${studioConfig.printTheme === 'COLOR' ? 'bg-yellow-200 text-slate-900' : 'bg-slate-100 text-slate-900'} font-extrabold border-b-2 border-slate-900`}>
                        <th className="border border-slate-900 p-2 w-10" rowSpan={2}>STT</th>
                        <th className="border border-slate-900 p-2 text-center" rowSpan={2}>
                          Tên, nhãn hiệu, quy cách, phẩm chất vật tư, dụng cụ sản phẩm, hàng hóa
                        </th>
                        <th className="border border-slate-900 p-2 w-20" rowSpan={2}>Mã số</th>
                        <th className="border border-slate-900 p-2 w-16" rowSpan={2}>Đơn vị tính</th>
                        <th className="border border-slate-900 p-1" colSpan={2}>Số lượng</th>
                        <th className="border border-slate-900 p-2 w-24" rowSpan={2}>Đơn giá</th>
                        <th className="border border-slate-900 p-2 w-28" rowSpan={2}>Thành tiền</th>
                      </tr>
                      <tr className={`${studioConfig.printTheme === 'COLOR' ? 'bg-yellow-200 text-slate-900' : 'bg-slate-100 text-slate-900'} font-extrabold border-b-2 border-slate-900`}>
                        <th className="border border-slate-900 p-1 w-16">Theo chứng từ</th>
                        <th className="border border-slate-900 p-1 w-16">Thực nhập</th>
                      </tr>
                      <tr className={`${studioConfig.printTheme === 'COLOR' ? 'bg-yellow-100' : 'bg-slate-50'} font-bold border-b border-slate-900 text-slate-800 text-[11px]`}>
                        <td className="border border-slate-900 py-0.5">A</td>
                        <td className="border border-slate-900 py-0.5">B</td>
                        <td className="border border-slate-900 py-0.5">C</td>
                        <td className="border border-slate-900 py-0.5">D</td>
                        <td className="border border-slate-900 py-0.5">1</td>
                        <td className="border border-slate-900 py-0.5">2</td>
                        <td className="border border-slate-900 py-0.5">3</td>
                        <td className="border border-slate-900 py-0.5">4</td>
                      </tr>
                    </thead>
                    <tbody className="font-semibold text-slate-900">
                      <tr className="border-b border-slate-800">
                        <td className="border border-slate-900 p-2 font-bold">1</td>
                        <td className="border border-slate-900 p-2 text-left font-bold text-slate-900">
                          Máy Điều hoà Sam sung 12000BTU
                        </td>
                        <td className="border border-slate-900 p-2 font-mono font-bold text-cyan-800">ĐH-SS12</td>
                        <td className="border border-slate-900 p-2">Bộ</td>
                        <td className="border border-slate-900 p-2 font-bold">9</td>
                        <td className="border border-slate-900 p-2 font-bold">9</td>
                        <td className="border border-slate-900 p-2 text-right font-mono">10.000.000</td>
                        <td className="border border-slate-900 p-2 text-right font-mono font-extrabold text-slate-900">90.000.000</td>
                      </tr>
                      <tr className={`${studioConfig.printTheme === 'COLOR' ? 'bg-lime-500' : 'bg-slate-200'} font-extrabold border-t-2 border-slate-900 text-slate-900`}>
                        <td className="border border-slate-900 p-2 text-center" colSpan={2}>Cộng</td>
                        <td className="border border-slate-900 p-2">X</td>
                        <td className="border border-slate-900 p-2">X</td>
                        <td className="border border-slate-900 p-2">X</td>
                        <td className="border border-slate-900 p-2">X</td>
                        <td className="border border-slate-900 p-2">X</td>
                        <td className="border border-slate-900 p-2 text-right font-mono font-black text-sm">90.000.000</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* FOOTER SUMMARY & DYNAMIC SIGNATURES */}
                <div className="space-y-2 text-xs font-semibold text-slate-800 pt-1">
                  <p>
                    <span className="font-normal italic text-slate-700">Tổng số tiền (Viết bằng chữ):</span>{' '}
                    <span className="font-bold italic text-slate-900">{studioConfig.totalAmountText || 'Chín mươi triệu đồng chẵn./.'}</span>
                  </p>
                  <p>
                    <span className="font-normal italic text-slate-700">Số chứng từ gốc kèm theo:</span>{' '}
                    <span className="font-bold text-slate-900">{studioConfig.attachedOriginalDoc || '01 Hóa đơn GTGT số: 00000385 ngày 05/01/2026'}</span>
                  </p>

                  <div className="text-right pt-2">
                    <p className="font-semibold italic text-slate-800">{studioConfig.documentDate || 'Ngày 05 tháng 01 năm 2026'}</p>
                  </div>

                  {/* DYNAMIC SIGNATURE COLUMNS GRID */}
                  <div
                    className="grid gap-2 text-center text-xs pt-2 font-sans"
                    style={{
                      gridTemplateColumns: `repeat(${Math.min(studioConfig.signatures.length, 6)}, minmax(0, 1fr))`,
                    }}
                  >
                    {studioConfig.signatures.map((sig) => (
                      <div key={sig.id} className="space-y-1">
                        <p className="font-black text-slate-900 uppercase">{sig.title}</p>
                        <p className="text-[11px] italic text-slate-500">{sig.subtitle}</p>
                        <div className="h-16 flex items-end justify-center">
                          <span className="font-bold italic text-cyan-900 text-sm font-sans">{sig.name}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stock-In Printable Detail Modal */}
      {previewDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs overflow-y-auto">
          <div className="w-full max-w-4xl rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden my-8">
            <div className="flex items-center justify-between bg-cyan-700 px-6 py-4 text-white print:hidden">
              <div className="flex items-center gap-2">
                <Warehouse className="h-5 w-5" />
                <h3 className="font-bold text-base">Chi Tiết Phiếu Nhập Kho: {previewDoc.receiptNo}</h3>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handlePrint}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-white px-4 py-2 text-xs font-bold text-cyan-800 shadow-xs hover:bg-cyan-50 transition"
                >
                  <Printer className="h-4 w-4" />
                  In Phiếu Nhập
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
                <h1 className="text-2xl font-black uppercase tracking-wide text-slate-900">PHIẾU NHẬP KHO THÀNH PHẨM & VẬT TƯ</h1>
                <p className="text-xs font-semibold text-slate-600 mt-1">CÔNG TY TNHH HỆ THỐNG QUẢN LÝ KHO SMART WMS</p>
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs sm:text-sm mb-6 border-b border-dashed border-slate-300 pb-4">
                <div><span className="font-semibold text-slate-700">Số phiếu nhập:</span> <span className="font-bold text-cyan-800">{previewDoc.receiptNo}</span></div>
                <div><span className="font-semibold text-slate-700">Mã đơn hàng:</span> <span className="font-bold text-cyan-800">{(previewDoc as any).orderCode || 'PO-2026'}</span></div>
                <div><span className="font-semibold text-slate-700">Nhà cung cấp:</span> <span className="font-bold text-slate-900">{previewDoc.supplierName}</span></div>
                <div><span className="font-semibold text-slate-700">Kho nhận:</span> <span className="font-bold text-slate-900">{previewDoc.warehouseName}</span></div>
              </div>

              <table className="w-full border-2 border-slate-900 text-center text-xs sm:text-sm border-collapse mb-6">
                <thead>
                  <tr className="bg-slate-100 font-bold border-b-2 border-slate-900">
                    <th className="border border-slate-900 p-2 w-12">STT</th>
                    <th className="border border-slate-900 p-2 text-left">Tên vật tư sản phẩm</th>
                    <th className="border border-slate-900 p-2 w-16">ĐVT</th>
                    <th className="border border-slate-900 p-2 w-20">Số lượng</th>
                    <th className="border border-slate-900 p-2 w-28">Đơn giá nhập</th>
                    <th className="border border-slate-900 p-2 w-32">Thành tiền</th>
                  </tr>
                </thead>
                <tbody>
                  {previewDoc.items.map((item, idx) => {
                    const qty = item.quantityActual || (item as any).quantity || 0;
                    return (
                      <tr key={item.id || idx} className="border-b border-slate-800">
                        <td className="border border-slate-900 p-2 font-bold">{idx + 1}</td>
                        <td className="border border-slate-900 p-2 text-left font-bold text-slate-900">{item.productName}</td>
                        <td className="border border-slate-900 p-2">{item.unit}</td>
                        <td className="border border-slate-900 p-2 font-bold text-slate-900">{qty}</td>
                        <td className="border border-slate-900 p-2 text-right">{formatMoney(item.unitPrice)}</td>
                        <td className="border border-slate-900 p-2 text-right font-bold">{formatMoney(item.unitPrice * qty)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <div className="flex justify-between items-center text-xs sm:text-sm border-t border-slate-900 pt-3">
                <span className="font-bold">Người lập phiếu: Nguyễn Văn Quản Lý</span>
                <span className="font-black text-cyan-800 text-base">
                  Tổng giá trị nhập: {formatMoney(previewDoc.items.reduce((s, i) => s + i.unitPrice * (i.quantityActual || (i as any).quantity || 0), 0))} ₫
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
