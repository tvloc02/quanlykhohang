import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { documentsApi, type SalesInvoiceDoc } from '../api/documentsApi';
import MultiWarehouseSelector from '../components/MultiWarehouseSelector';
import DocxEditorPanel from '../components/DocxEditorPanel';
import { parseDocxFile } from '../utils/docxParser';
import {
  FileText,
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
  List,
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  AlertCircle,
  FileDown,
} from 'lucide-react';

export interface InvoiceTemplateItem {
  id: string;
  templateCode: string; // Mã mẫu hóa đơn (ví dụ: 1/001)
  serialSymbol: string; // Kí hiệu hóa đơn (ví dụ: C26MAA)
  cqtStatus: 'APPROVED' | 'PENDING'; // Trạng thái gửi CQT (Đã duyệt | Chưa nộp)
  status: 'ACTIVE' | 'INACTIVE'; // Trạng thái hóa đơn (Đang sử dụng | Ngừng sử dụng)
  invoiceType?: 'MAIN' | 'SUB'; // Loại hóa đơn: Chính / Phụ (Chỉ hiện khi cqtStatus === 'APPROVED')
  appliedWarehouse: string; // Kho áp dụng
  createdDate: string; // Ngày tạo mẫu
  fileName: string;
  fileSize: string;
  companyName: string;
  companyTaxCode: string;
  companyAddress: string;
  invoiceTitle: string;
  sellerName?: string;
  templateContentHtml?: string;
  templateContentText?: string;
}

const INITIAL_TEMPLATES: InvoiceTemplateItem[] = [];

export default function SalesInvoiceDocPage() {
  const [invoices, setInvoices] = useState<SalesInvoiceDoc[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [showAdvancedSearch, setShowAdvancedSearch] = useState<boolean>(false);
  const [previewDoc, setPreviewDoc] = useState<SalesInvoiceDoc | null>(null);

  // Tab State
  const [activeTab, setActiveTab] = useState<'LIST' | 'TEMPLATE'>('LIST');

  // Pagination states
  const [pageSize, setPageSize] = useState<number>(10);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Template List State
  const [templates, setTemplates] = useState<InvoiceTemplateItem[]>(INITIAL_TEMPLATES);
  const [templateSearch, setTemplateSearch] = useState<string>('');
  const [warehouseOptions, setWarehouseOptions] = useState<string[]>([]);
  const [warehousesLoading, setWarehousesLoading] = useState<boolean>(true);
  const [newTemplateInvoiceTitle, setNewTemplateInvoiceTitle] = useState<string>('Hóa đơn bán hàng tài chính');
  const [newTemplateDocHtml, setNewTemplateDocHtml] = useState<string>('<p style="margin:0 0 12px; line-height:1.7;">Nhấp để chọn file Word (.docx) và bắt đầu chỉnh sửa nội dung.</p>');
  const [newTemplateDocText, setNewTemplateDocText] = useState<string>('');
  const [newTemplateDocLoading, setNewTemplateDocLoading] = useState<boolean>(false);
  const [newTemplateDocError, setNewTemplateDocError] = useState<string | null>(null);
  
  // Modals for Template Tab
  const [previewTemplateModal, setPreviewTemplateModal] = useState<InvoiceTemplateItem | null>(null);
  const [editingTemplate, setEditingTemplate] = useState<InvoiceTemplateItem | null>(null);
  const [showAddTemplateModal, setShowAddTemplateModal] = useState<boolean>(false);

  // File Upload reference for template editing
  const fileInputRef = useRef<HTMLInputElement>(null);
  const newTemplateFileInputRef = useRef<HTMLInputElement>(null);
  const [targetTemplateIdForFile, setTargetTemplateIdForFile] = useState<string | null>(null);

  // Simplified New Template Form State
  const [newTemplateForm, setNewTemplateForm] = useState<{
    templateCode: string;
    invoiceTitle: string;
    appliedWarehouses: string[];
    fileName: string;
  }>({
    templateCode: '',
    invoiceTitle: '',
    appliedWarehouses: [],
    fileName: '',
  });
  const [newTemplateFileSize, setNewTemplateFileSize] = useState<string>('40.0 KB');
  // Form State for Editing Template Metadata
  const [templateForm, setTemplateForm] = useState<Partial<InvoiceTemplateItem> & { appliedWarehouses?: string[] }>({
    templateCode: '',
    serialSymbol: '',
    cqtStatus: 'PENDING',
    status: 'ACTIVE',
    invoiceType: 'MAIN',
    appliedWarehouse: 'Tất cả các kho',
    appliedWarehouses: ['Kho Tổng TP.HCM'],
    createdDate: new Date().toLocaleDateString('vi-VN'),
    companyName: 'CÔNG TY TNHH HỆ THỐNG QUẢN LÝ KHO SMART WMS',
    companyTaxCode: '0316889988',
    companyAddress: 'Tầng 8, Tòa nhà Innovation, Quận 1, TP. Hồ Chí Minh',
    invoiceTitle: 'HÓA ĐƠN BÁN HÀNG TÀI CHÍNH',
    fileName: 'Mau_Hoa_Don_Moi.docx',
    fileSize: '40.0 KB',
    templateContentHtml: '',
    templateContentText: '',
  });

  React.useEffect(() => {
    async function loadData() {
      setLoading(true);
      const data = await documentsApi.getSalesInvoices();
      setInvoices(data);
      setLoading(false);
    }
    loadData();
  }, []);

  React.useEffect(() => {
    async function loadWarehouses() {
      setWarehousesLoading(true);
      try {
        const token = localStorage.getItem('token');
        const response = await fetch('http://localhost:3000/api/warehouses', {
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });

        if (!response.ok) {
          setWarehouseOptions([]);
          return;
        }

        const data = await response.json();
        const names = Array.from(
          new Set(
            (Array.isArray(data) ? data : [])
              .map((warehouse: any) => String(warehouse?.name || '').trim())
              .filter(Boolean),
          ),
        );
        setWarehouseOptions(names);
      } catch (error) {
        console.warn('Failed to load warehouses for invoice templates', error);
        setWarehouseOptions([]);
      } finally {
        setWarehousesLoading(false);
      }
    }

    loadWarehouses();
  }, []);

  React.useEffect(() => {
    if (showAddTemplateModal && warehouseOptions.length > 0) {
      setNewTemplateForm((current) => {
        const valid = current.appliedWarehouses.filter((warehouse) => warehouse === 'Tất cả các kho' || warehouseOptions.includes(warehouse));
        if (valid.length > 0 && valid.length === current.appliedWarehouses.length) {
          return current;
        }

        return {
          ...current,
          appliedWarehouses: valid.length > 0 ? valid : [warehouseOptions[0]],
        };
      });
    }
  }, [showAddTemplateModal, warehouseOptions]);

  const formatMoney = (val: number) => {
    return new Intl.NumberFormat('vi-VN').format(val);
  };

  const filteredInvoices = invoices.filter((inv) => {
    const keyword = search.trim().toLowerCase();
    const matchesKeyword =
      !keyword ||
      inv.invoiceNo.toLowerCase().includes(keyword) ||
      inv.invoiceName.toLowerCase().includes(keyword) ||
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

  // Calculate Pagination for List Tab
  const totalItems = filteredInvoices.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const paginatedInvoices = filteredInvoices.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const startIndex = totalItems > 0 ? (currentPage - 1) * pageSize + 1 : 0;
  const endIndex = Math.min(currentPage * pageSize, totalItems);

  const totalInvoiceValue = invoices.reduce((sum, inv) => {
    const sub = inv.items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
    return sum + sub * 1.1;
  }, 0);

  const totalItemsCount = invoices.reduce((sum, inv) => sum + inv.items.reduce((s, i) => s + i.quantity, 0), 0);

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

  const handleOpenAddTemplateModal = () => {
    setNewTemplateForm({
      templateCode: `1/00${templates.length + 1}`,
      invoiceTitle: newTemplateInvoiceTitle,
      appliedWarehouses: warehouseOptions.length > 0 ? [warehouseOptions[0]] : [],
      fileName: '',
    });
    setNewTemplateFileSize('40.0 KB');
    setNewTemplateDocHtml('<p style="margin:0 0 12px; line-height:1.7;">Nhấp để chọn file Word (.docx) và bắt đầu chỉnh sửa nội dung.</p>');
    setNewTemplateDocText('');
    setNewTemplateDocError(null);
    setNewTemplateDocLoading(false);
    setShowAddTemplateModal(true);
  };

  const handleCloseAddTemplateModal = () => {
    setShowAddTemplateModal(false);
    setNewTemplateDocLoading(false);
    setNewTemplateDocError(null);
  };

  const handleNewTemplateFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setNewTemplateFileSize(`${(file.size / 1024).toFixed(1)} KB`);
    setNewTemplateForm((current) => ({ ...current, fileName: file.name }));
    setNewTemplateDocLoading(true);
    setNewTemplateDocError(null);

    await applyParsedDocxToTemplateState(
      file,
      ({ html, text, fileName, fileSize }) => {
        setNewTemplateForm((current) => ({ ...current, fileName }));
        setNewTemplateFileSize(fileSize);
        setNewTemplateDocHtml(html);
        setNewTemplateDocText(text);
      },
      setNewTemplateDocError,
    );

    setNewTemplateDocLoading(false);
    e.target.value = '';
  };

  const handleNewTemplateEditorChange = (html: string) => {
    const plainText = html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<\/div>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[ \t]+\n/g, '\n')
      .trim();

    setNewTemplateDocHtml(html);
    setNewTemplateDocText(plainText);
  };

  const applyParsedDocxToTemplateState = async (
    file: File,
    onParsed: (payload: { html: string; text: string; fileName: string; fileSize: string }) => void,
    onError?: (message: string) => void,
  ) => {
    const fileSize = `${(file.size / 1024).toFixed(1)} KB`;

    if (!file.name.toLowerCase().endsWith('.docx')) {
      onParsed({
        html: '<p style="margin:0 0 12px; line-height:1.7;">File .doc chưa được hỗ trợ xem/chỉnh nội dung trực tiếp. Vui lòng đổi sang .docx để có chế độ Word online.</p>',
        text: '',
        fileName: file.name,
        fileSize,
      });
      onError?.('Hiện chỉ đọc được nội dung file .docx');
      return;
    }

    try {
      const parsed = await parseDocxFile(file);
      onParsed({
        html: parsed.html || '<p style="margin:0 0 12px; line-height:1.7;">Tài liệu trống.</p>',
        text: parsed.text,
        fileName: file.name,
        fileSize,
      });
    } catch (error) {
      console.error('Failed to parse Word file', error);
      onParsed({
        html: '<p style="margin:0 0 12px; line-height:1.7;">Không đọc được nội dung file Word. Bạn vẫn có thể chỉnh nội dung ở đây.</p>',
        text: '',
        fileName: file.name,
        fileSize,
      });
      onError?.('Không đọc được nội dung file Word này');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && targetTemplateIdForFile) {
      const fileSize = `${(file.size / 1024).toFixed(1)} KB`;
      if (file.name.toLowerCase().endsWith('.docx')) {
        try {
          const parsed = await parseDocxFile(file);
          setTemplates((prev) =>
            prev.map((tpl) =>
              tpl.id === targetTemplateIdForFile
                ? {
                    ...tpl,
                    fileName: file.name,
                    fileSize,
                    templateContentHtml: parsed.html,
                    templateContentText: parsed.text,
                  }
                : tpl
            )
          );
        } catch (error) {
          console.error('Failed to parse uploaded template file', error);
          setTemplates((prev) =>
            prev.map((tpl) =>
              tpl.id === targetTemplateIdForFile
                ? {
                    ...tpl,
                    fileName: file.name,
                    fileSize,
                    templateContentHtml: '<p style="margin:0 0 12px; line-height:1.7;">Không thể đọc nội dung file Word này.</p>',
                    templateContentText: '',
                  }
                : tpl
            )
          );
        }
      } else {
        setTemplates((prev) =>
          prev.map((tpl) =>
            tpl.id === targetTemplateIdForFile
              ? {
                  ...tpl,
                  fileName: file.name,
                  fileSize,
                  templateContentHtml: '<p style="margin:0 0 12px; line-height:1.7;">Hiện chỉ hỗ trợ xem nội dung với file .docx.</p>',
                  templateContentText: '',
                }
              : tpl
          )
        );
      }
      setTargetTemplateIdForFile(null);
      e.target.value = '';
    }
  };

  // Delete Template Item
  const handleDeleteTemplate = (id: string) => {
    if (window.confirm('Bạn có chắc chắn muốn xóa mẫu hóa đơn này không?')) {
      setTemplates((prev) => prev.filter((t) => t.id !== id));
    }
  };

  // Open Edit Template Modal
  const handleOpenEditModal = (tpl: InvoiceTemplateItem) => {
    setEditingTemplate(tpl);
    const splitWarehouses = tpl.appliedWarehouse ? tpl.appliedWarehouse.split(', ') : ['Kho Tổng TP.HCM'];
    setTemplateForm({ ...tpl, appliedWarehouses: splitWarehouses });
  };

  // Save Edit Template Form
  const handleSaveEditTemplate = () => {
    if (!editingTemplate) return;
    const whList = templateForm.appliedWarehouses || [];
    const whFormatted =
      whList.length === 0
        ? 'Tất cả các kho'
        : whList.includes('Tất cả các kho')
        ? 'Tất cả các kho'
        : whList.join(', ');

    setTemplates((prev) =>
      prev.map((tpl) =>
        tpl.id === editingTemplate.id
          ? {
              ...tpl,
              ...templateForm,
              appliedWarehouse: whFormatted,
              invoiceType: templateForm.cqtStatus === 'APPROVED' ? templateForm.invoiceType : undefined,
            }
          : tpl
      )
    );
    setEditingTemplate(null);
  };

  // Save New Template Form
  const handleSaveNewTemplate = () => {
    const newId = `tpl-${Date.now()}`;
    const code = newTemplateForm.templateCode.trim() || `1/00${templates.length + 1}`;
    const whList = newTemplateForm.appliedWarehouses || [];
    const whFormatted =
      whList.length === 0
        ? 'Tất cả các kho'
        : whList.includes('Tất cả các kho')
        ? 'Tất cả các kho'
        : whList.join(', ');

    const newTpl: InvoiceTemplateItem = {
      id: newId,
      templateCode: code,
      serialSymbol: `C26M${String.fromCharCode(65 + (templates.length % 26))}${templates.length + 1}`,
      cqtStatus: 'PENDING',
      status: 'ACTIVE',
      invoiceType: undefined,
      appliedWarehouse: whFormatted,
      createdDate: new Date().toLocaleDateString('vi-VN'),
      fileName: newTemplateForm.fileName || `${code.replace(/[/ ]/g, '_')}_MauDocx.docx`,
      fileSize: newTemplateFileSize || '42.0 KB',
      companyName: templateForm.companyName || 'CÔNG TY TNHH HỆ THỐNG QUẢN LÝ KHO SMART WMS',
      companyTaxCode: templateForm.companyTaxCode || '0316889988',
      companyAddress: templateForm.companyAddress || 'Tầng 8, Tòa nhà Innovation, Quận 1, TP. Hồ Chí Minh',
      invoiceTitle: newTemplateInvoiceTitle || 'HÓA ĐƠN BÁN HÀNG TÀI CHÍNH',
      sellerName: 'Nguyễn Văn Quản Lý',
      templateContentHtml: newTemplateDocHtml,
      templateContentText: newTemplateDocText,
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

      {/* Header Design Aligned with Personnel Layout */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => setActiveTab('LIST')}
            className={`inline-flex items-center gap-2 rounded-xl border-2 border-cyan-500 px-4 py-2.5 text-sm font-extrabold transition-all ${
              activeTab === 'LIST'
                ? 'bg-cyan-600 text-white shadow-md'
                : 'bg-white text-cyan-700 hover:bg-cyan-50'
            }`}
          >
            <List className="h-4.5 w-4.5" />
            Danh sách hóa đơn bán hàng
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('TEMPLATE')}
            className={`inline-flex items-center gap-2 rounded-xl border-2 border-cyan-500 px-4 py-2.5 text-sm font-extrabold transition-all ${
              activeTab === 'TEMPLATE'
                ? 'bg-cyan-600 text-white shadow-md'
                : 'bg-white text-cyan-700 hover:bg-cyan-50'
            }`}
          >
            <FileSpreadsheet className="h-4.5 w-4.5" />
            Mẫu hóa đơn bán hàng
          </button>
        </div>

        {activeTab === 'TEMPLATE' && (
          <button
            type="button"
            onClick={handleOpenAddTemplateModal}
            className="inline-flex items-center gap-2 rounded-xl border-2 border-cyan-500 bg-cyan-600 px-5 py-2.5 text-sm font-bold text-white shadow-md transition hover:bg-cyan-700 shrink-0"
          >
            <Plus className="h-4 w-4" />
            Thêm mới mẫu
          </button>
        )}
      </div>

      {activeTab === 'LIST' ? (
        <>
          {/* 4 Cards Summary Strip */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex h-[72px] items-center justify-center rounded-xl border-2 border-cyan-500 bg-white px-4 shadow-sm transition hover:bg-cyan-50 text-center">
              <p className="text-base font-black text-cyan-700 uppercase">
                {invoices.length} HÓA ĐƠN BÁN HÀNG
              </p>
            </div>
            <div className="flex h-[72px] items-center justify-center rounded-xl border-2 border-cyan-500 bg-white px-4 shadow-sm transition hover:bg-cyan-50 text-center">
              <p className="text-base font-black text-cyan-700 uppercase">
                {formatMoney(totalItemsCount)} SẢN PHẨM BÁN HÀNG
              </p>
            </div>
            <div className="flex h-[72px] items-center justify-center rounded-xl border-2 border-cyan-500 bg-white px-4 shadow-sm transition hover:bg-cyan-50 text-center">
              <p className="text-base font-black text-cyan-700 uppercase">
                {formatMoney(totalInvoiceValue)} ₫ TỔNG DOANH THU (GỒM VAT)
              </p>
            </div>
            <div className="flex h-[72px] items-center justify-center rounded-xl border-2 border-cyan-500 bg-white px-4 shadow-sm transition hover:bg-cyan-50 text-center">
              <p className="text-base font-black text-cyan-700 uppercase">
                100% HOÀN TẤT VẬN HÀNH
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
                  placeholder="Tìm kiếm theo số hóa đơn, tên khách hàng, mã đơn hàng..."
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
                  <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-600">Trạng thái hóa đơn</label>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { key: 'ALL', label: 'Tất cả hóa đơn' },
                      { key: 'PAID', label: 'Đã thanh toán' },
                      { key: 'ISSUED', label: 'Đã phát hành' },
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
                    <th className="border-r border-slate-200 p-3 text-xs font-extrabold uppercase text-slate-800">Số Hóa Đơn</th>
                    <th className="border-r border-slate-200 p-3 text-xs font-extrabold uppercase text-slate-800">Tên Hóa Đơn</th>
                    <th className="border-r border-slate-200 p-3 text-xs font-extrabold uppercase text-slate-800">Mã Đơn Hàng</th>
                    <th className="border-r border-slate-200 p-3 text-xs font-extrabold uppercase text-slate-800">Khách Hàng</th>
                    <th className="border-r border-slate-200 p-3 text-center text-xs font-extrabold uppercase text-slate-800">Ngày Phát Hành</th>
                    <th className="border-r border-slate-200 p-3 text-center text-xs font-extrabold uppercase text-slate-800">Số Lượng SP</th>
                    <th className="border-r border-slate-200 p-3 text-right text-xs font-extrabold uppercase text-slate-800">Tổng Tiền (Gồm VAT)</th>
                    <th className="border-r border-slate-200 p-3 text-center text-xs font-extrabold uppercase text-slate-800">Trạng Thái</th>
                    <th className="p-3 text-center text-xs font-extrabold uppercase text-slate-800 min-w-[120px]">Thao Tác</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={10} className="p-8 text-center text-slate-500">Đang tải danh sách hóa đơn bán hàng...</td>
                    </tr>
                  ) : paginatedInvoices.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="p-8 text-center text-slate-500">Không tìm thấy hóa đơn bán hàng phù hợp.</td>
                    </tr>
                  ) : (
                    paginatedInvoices.map((inv, index) => {
                      const totalQty = inv.items.reduce((sum, item) => sum + item.quantity, 0);
                      const subtotal = inv.items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
                      const grandTotal = subtotal * 1.1;

                      return (
                        <tr key={inv.id} className="border-b border-slate-200 hover:bg-cyan-50/50 transition-colors">
                          <td className="border-r border-slate-200 p-3 text-center font-bold text-slate-700 text-xs sm:text-sm">
                            {startIndex + index}
                          </td>
                          <td className="border-r border-slate-200 p-3 font-bold text-cyan-700 text-xs sm:text-sm">
                            {inv.invoiceNo}
                          </td>
                          <td className="border-r border-slate-200 p-3 text-xs sm:text-sm font-semibold text-slate-900">
                            {inv.invoiceName || 'Hóa đơn bán hàng'}
                          </td>
                          <td className="border-r border-slate-200 p-3 text-xs font-mono text-slate-600">
                            {inv.orderCode}
                          </td>
                          <td className="border-r border-slate-200 p-3 text-xs sm:text-sm font-bold text-slate-900">
                            {inv.customerName}
                          </td>
                          <td className="border-r border-slate-200 p-3 text-center text-xs text-slate-600">
                            {inv.issuedDate || (inv as any).createdDate || ''}
                          </td>
                          <td className="border-r border-slate-200 p-3 text-center font-bold text-slate-800 text-xs sm:text-sm">
                            {totalQty}
                          </td>
                          <td className="border-r border-slate-200 p-3 text-right font-black text-cyan-700 text-xs sm:text-sm">
                            {formatMoney(grandTotal)} ₫
                          </td>
                          <td className="border-r border-slate-200 p-3 text-center">
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-extrabold text-emerald-700 border border-emerald-200">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Đã phát hành
                            </span>
                          </td>
                          <td className="p-3 text-center">
                            <button
                              type="button"
                              onClick={() => setPreviewDoc(inv)}
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
        /* TAB 2: MẪU HÓA ĐƠN BÁN HÀNG (DANH SÁCH MẪU HÓA ĐƠN TỰ ĐỘNG) */
        <div className="space-y-4">
          {/* Search Toolbar for Mẫu hóa đơn (Full Width Search) */}
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
                    <th className="border-x border-slate-200 p-3.5 text-center text-xs font-extrabold uppercase text-slate-800">Mã Mẫu Hóa Đơn</th>
                    <th className="border-x border-slate-200 p-3.5 text-center text-xs font-extrabold uppercase text-slate-800">Tên Hóa Đơn</th>
                    <th className="border-x border-slate-200 p-3.5 text-center text-xs font-extrabold uppercase text-slate-800">Kí Hiệu Hóa Đơn</th>
                    <th className="border-x border-slate-200 p-3.5 text-center text-xs font-extrabold uppercase text-slate-800">Trạng Thái Gửi CQT</th>
                    <th className="border-x border-slate-200 p-3.5 text-center text-xs font-extrabold uppercase text-slate-800">Trạng Thái Hóa Đơn</th>
                    <th className="border-x border-slate-200 p-3.5 text-center text-xs font-extrabold uppercase text-slate-800">Loại Hóa Đơn</th>
                    <th className="border-x border-slate-200 p-3.5 text-center text-xs font-extrabold uppercase text-slate-800">Kho Áp Dụng</th>
                    <th className="border-x border-slate-200 p-3.5 text-center text-xs font-extrabold uppercase text-slate-800">Ngày Tạo Mẫu</th>
                    <th className="border-x border-slate-200 p-3.5 text-center text-xs font-extrabold uppercase text-slate-800 min-w-[290px]">Thao Tác</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTemplates.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="p-8 text-center text-sm font-semibold text-slate-500">
                        Chưa có mẫu hóa đơn nào được tạo.
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
                        <td className="border-x border-slate-200 p-3.5 text-center text-sm font-semibold text-slate-900">
                          {tpl.invoiceTitle || 'Hóa đơn bán hàng'}
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
                              title="Xem mẫu hóa đơn A4"
                            >
                              <Eye className="h-3.5 w-3.5" />
                              Xem mẫu
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDeleteTemplate(tpl.id)}
                              className="inline-flex items-center justify-center rounded-lg border border-red-200 bg-white p-1.5 text-red-600 hover:bg-red-50 transition"
                              title="Xóa mẫu hóa đơn"
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
      {editingTemplate &&
        createPortal(
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs overflow-y-auto">
            <div className="w-full max-w-[760px] rounded-[34px] border border-slate-100 bg-white shadow-[0_40px_100px_rgba(15,23,42,0.28)] ring-1 ring-black/5 space-y-0 overflow-visible my-auto animate-in fade-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between rounded-t-[34px] bg-gradient-to-r from-cyan-600 to-cyan-700 px-6 py-4 text-white">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-white shadow-inner ring-1 ring-white/10">
                    <Pencil className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-white">Sửa Nội Dung Bản Ghi Mẫu Hóa Đơn</h3>
                    <p className="text-xs text-cyan-100 font-medium">Chỉnh sửa thông tin chi tiết mẫu hóa đơn bán hàng</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingTemplate(null)}
                  className="rounded-2xl p-2 text-white/80 hover:bg-white/20 hover:text-white transition"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-4 bg-white px-7 py-6 text-sm font-semibold text-slate-700 sm:px-8 sm:py-7">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block mb-1.5 font-bold text-slate-800 text-sm">Mã mẫu hóa đơn:</label>
                    <input
                      type="text"
                      value={templateForm.templateCode || ''}
                      onChange={(e) => setTemplateForm({ ...templateForm, templateCode: e.target.value })}
                      className="w-full rounded-2xl border border-slate-300 p-2.5 text-sm font-bold text-cyan-800 outline-none focus:border-cyan-500 bg-white"
                    />
                  </div>

                  <div>
                    <label className="block mb-1.5 font-bold text-slate-800 text-sm">Kí hiệu hóa đơn:</label>
                    <input
                      type="text"
                      value={templateForm.serialSymbol || ''}
                      onChange={(e) => setTemplateForm({ ...templateForm, serialSymbol: e.target.value })}
                      className="w-full rounded-2xl border border-slate-300 p-2.5 text-sm font-mono font-bold text-slate-900 outline-none focus:border-cyan-500 bg-white"
                    />
                  </div>

                  <div>
                    <label className="block mb-1.5 font-bold text-slate-800 text-sm">Trạng thái gửi CQT:</label>
                    <select
                      value={templateForm.cqtStatus || 'PENDING'}
                      onChange={(e) => setTemplateForm({ ...templateForm, cqtStatus: e.target.value as any })}
                      className="w-full rounded-2xl border border-slate-300 p-2.5 text-sm font-bold outline-none focus:border-cyan-500 bg-white"
                    >
                      <option value="APPROVED">Đã duyệt</option>
                      <option value="PENDING">Chưa nộp</option>
                    </select>
                  </div>

                  <div>
                    <label className="block mb-1.5 font-bold text-slate-800 text-sm">Loại hóa đơn:</label>
                    <select
                      disabled={templateForm.cqtStatus !== 'APPROVED'}
                      value={templateForm.invoiceType || 'MAIN'}
                      onChange={(e) => setTemplateForm({ ...templateForm, invoiceType: e.target.value as any })}
                      className="w-full rounded-2xl border border-slate-300 p-2.5 text-sm font-bold outline-none focus:border-cyan-500 bg-white disabled:opacity-50 disabled:bg-slate-100"
                    >
                      <option value="MAIN">Chính</option>
                      <option value="SUB">Phụ</option>
                    </select>
                  </div>
                </div>

                <div>
                  <MultiWarehouseSelector
                    selectedWarehouses={templateForm.appliedWarehouses || []}
                    loading={warehousesLoading}
                    options={warehouseOptions}
                    onChange={(selected) => setTemplateForm({ ...templateForm, appliedWarehouses: selected })}
                  />
                </div>

                <div>
                  <label className="block mb-1.5 font-bold text-slate-800 text-sm">Tiêu đề mẫu hóa đơn:</label>
                  <input
                    type="text"
                    value={templateForm.invoiceTitle || ''}
                    onChange={(e) => setTemplateForm({ ...templateForm, invoiceTitle: e.target.value })}
                    className="w-full rounded-2xl border border-slate-300 p-2.5 text-sm font-bold text-slate-900 outline-none focus:border-cyan-500 bg-white"
                  />
                </div>

                <div>
                  <label className="block mb-1.5 font-bold text-slate-800 text-sm">Tên công ty xuất hóa đơn:</label>
                  <input
                    type="text"
                    value={templateForm.companyName || ''}
                    onChange={(e) => setTemplateForm({ ...templateForm, companyName: e.target.value })}
                    className="w-full rounded-2xl border border-slate-300 p-2.5 text-sm outline-none focus:border-cyan-500 bg-white"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block mb-1.5 font-bold text-slate-800 text-sm">Mã số thuế:</label>
                    <input
                      type="text"
                      value={templateForm.companyTaxCode || ''}
                      onChange={(e) => setTemplateForm({ ...templateForm, companyTaxCode: e.target.value })}
                      className="w-full rounded-2xl border border-slate-300 p-2.5 text-sm outline-none focus:border-cyan-500 bg-white"
                    />
                  </div>

                  <div>
                    <label className="block mb-1.5 font-bold text-slate-800 text-sm">Trạng thái hoạt động:</label>
                    <select
                      value={templateForm.status || 'ACTIVE'}
                      onChange={(e) => setTemplateForm({ ...templateForm, status: e.target.value as any })}
                      className="w-full rounded-2xl border border-slate-300 p-2.5 text-sm font-bold outline-none focus:border-cyan-500 bg-white"
                    >
                      <option value="ACTIVE">Đang sử dụng</option>
                      <option value="INACTIVE">Ngừng sử dụng</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 rounded-b-[34px] border-t border-slate-200 bg-slate-50/90 px-6 py-4">
                <button
                  type="button"
                  onClick={() => setEditingTemplate(null)}
                  className="rounded-2xl border-2 border-slate-300 bg-white px-5 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-100 transition"
                >
                  Hủy bỏ
                </button>
                <button
                  type="button"
                  onClick={handleSaveEditTemplate}
                  className="rounded-2xl bg-cyan-600 px-6 py-2.5 text-sm font-bold text-white hover:bg-cyan-700 transition shadow-md"
                >
                  Lưu Thay Đổi
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* Add New Template Modal (Simplified: Name, Warehouse, File Upload) */}
      {showAddTemplateModal &&
        createPortal(
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs overflow-y-auto">
            <div className="w-full max-w-[1440px] rounded-[34px] bg-white shadow-2xl space-y-0 border border-slate-200 overflow-visible my-auto animate-in fade-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between bg-gradient-to-r from-cyan-600 to-cyan-700 px-6 py-4 text-white">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-white shadow-inner ring-1 ring-white/10">
                    <Plus className="h-5 w-5 stroke-[2.5]" />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-white">Thêm Mẫu Hóa Đơn Mới</h3>
                    <p className="text-xs text-cyan-100 font-medium">Tạo bản ghi mẫu biểu và áp dụng cho các kho hàng</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddTemplateModal(false)}
                  className="rounded-xl p-2 text-white/80 hover:bg-white/20 hover:text-white transition"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="grid gap-0 lg:grid-cols-[420px_minmax(0,1fr)]">
                <div className="space-y-5 border-b border-slate-200 bg-white px-7 py-6 text-sm font-semibold text-slate-700 lg:border-b-0 lg:border-r lg:px-8 lg:py-7">
                  <div>
                    <label className="block mb-1.5 font-bold text-slate-800 text-sm">Tên / Mã Mẫu Hóa Đơn:</label>
                    <input
                      type="text"
                      value={newTemplateForm.templateCode}
                      onChange={(e) => setNewTemplateForm({ ...newTemplateForm, templateCode: e.target.value })}
                      placeholder="Ví dụ: Mẫu Hóa Đơn GTGT 1/004"
                      className="w-full rounded-2xl border-2 border-slate-200 p-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-cyan-600 focus:ring-4 focus:ring-cyan-500/10 bg-white"
                    />
                  </div>

                  <div>
                    <label className="block mb-1.5 font-bold text-slate-800 text-sm">Tên Hóa Đơn:</label>
                    <input
                      type="text"
                      value={newTemplateInvoiceTitle}
                      onChange={(e) => setNewTemplateInvoiceTitle(e.target.value)}
                      placeholder="Ví dụ: Hóa đơn bán hàng tài chính"
                      className="w-full rounded-2xl border-2 border-slate-200 p-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-cyan-600 focus:ring-4 focus:ring-cyan-500/10 bg-white"
                    />
                  </div>

                  <div>
                    <MultiWarehouseSelector
                      selectedWarehouses={newTemplateForm.appliedWarehouses}
                      loading={warehousesLoading}
                      options={warehouseOptions}
                      onChange={(selected) => setNewTemplateForm({ ...newTemplateForm, appliedWarehouses: selected })}
                    />
                  </div>

                  <div>
                    <label className="block mb-1.5 font-bold text-slate-800 text-sm">Chọn File Mẫu Word (.docx):</label>
                    <div className="relative rounded-[24px] border-2 border-dashed border-cyan-300 bg-cyan-50/40 p-4 transition hover:bg-cyan-50/80">
                      <input
                        ref={newTemplateFileInputRef}
                        type="file"
                        accept=".docx,.doc"
                        onChange={handleNewTemplateFileUpload}
                        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                      />
                      <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-600 text-white shrink-0 shadow-sm">
                          <Upload className="h-5 w-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-slate-900">
                            {newTemplateForm.fileName || 'Nhấp để chọn file Word (.docx)'}
                          </p>
                          <p className="text-xs text-slate-500">
                            {newTemplateForm.fileName ? `Đã chọn thành công • ${newTemplateFileSize}` : 'Định dạng hỗ trợ: .docx (Tối đa 20MB)'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-[24px] border border-cyan-100 bg-cyan-50/50 p-4">
                    <p className="text-xs font-extrabold uppercase tracking-wider text-cyan-700">Tình trạng nội dung Word</p>
                    <p className="mt-2 text-sm font-semibold text-slate-800">
                      {newTemplateDocLoading
                        ? 'Đang đọc file Word để tạo vùng chỉnh sửa...'
                        : newTemplateDocError || 'Nội dung file Word sẽ hiện ngay ở khung bên phải để chỉnh sửa.'}
                    </p>
                  </div>
                </div>

                <div className="min-w-0 bg-slate-50 px-4 py-4 sm:px-5 sm:py-5 lg:px-5 lg:py-5">
                  <DocxEditorPanel
                    fileName={newTemplateForm.fileName}
                    html={newTemplateDocHtml}
                    loading={newTemplateDocLoading}
                    error={newTemplateDocError}
                    wordCount={newTemplateDocText ? newTemplateDocText.split(/\s+/).filter(Boolean).length : 0}
                    paragraphCount={newTemplateDocText ? newTemplateDocText.split(/\n+/).filter(Boolean).length : 0}
                    tableCount={0}
                    onChange={handleNewTemplateEditorChange}
                    onReplaceFile={() => newTemplateFileInputRef.current?.click()}
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
                <button
                  type="button"
                  onClick={handleCloseAddTemplateModal}
                  className="rounded-2xl border-2 border-slate-300 bg-white px-5 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-100 transition"
                >
                  Hủy bỏ
                </button>
                <button
                  type="button"
                  onClick={handleSaveNewTemplate}
                  className="rounded-2xl bg-cyan-600 px-6 py-2.5 text-sm font-bold text-white hover:bg-cyan-700 transition shadow-md flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Tạo Mẫu Mới
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* Preview Template Printable A4 Canvas Modal */}
      {previewTemplateModal &&
        createPortal(
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs overflow-y-auto">
            <div className="w-full max-w-4xl rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden my-8">
              <div className="flex items-center justify-between bg-cyan-700 px-6 py-4 text-white print:hidden">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="h-5 w-5" />
                  <h3 className="font-bold text-base">Xem Mẫu Hóa Đơn: {previewTemplateModal.templateCode} ({previewTemplateModal.serialSymbol})</h3>
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
                  <p className="text-xs text-slate-500">MST: {previewTemplateModal.companyTaxCode} • ĐC: {previewTemplateModal.companyAddress}</p>
                </div>

                <div className="grid grid-cols-2 gap-4 text-xs font-medium text-slate-700 bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <div>
                    <span className="font-bold text-slate-900">Mẫu Số:</span> <span className="font-mono font-bold text-cyan-700">{previewTemplateModal.templateCode}</span>
                  </div>
                  <div>
                    <span className="font-bold text-slate-900">Kí Hiệu Hóa Đơn:</span> <span className="font-mono font-bold text-cyan-700">{previewTemplateModal.serialSymbol}</span>
                  </div>
                  <div>
                    <span className="font-bold text-slate-900">Số Hóa Đơn:</span> <span className="font-mono font-bold text-cyan-700">&#123;&#123;invoiceNo&#125;&#125;</span>
                  </div>
                  <div>
                    <span className="font-bold text-slate-900">Trạng Thái CQT:</span>{' '}
                    <span className="font-bold text-emerald-700">
                      {previewTemplateModal.cqtStatus === 'APPROVED' ? 'Đã duyệt CQT' : 'Chưa nộp'}
                    </span>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="mb-3 text-sm font-extrabold uppercase tracking-wider text-slate-700">Nội dung mẫu Word</p>
                  {previewTemplateModal.templateContentHtml ? (
                    <div className="max-h-[680px] overflow-auto rounded-[24px] bg-white p-6 shadow-inner ring-1 ring-slate-200">
                      <div
                        className="mx-auto max-w-[760px]"
                        dangerouslySetInnerHTML={{ __html: previewTemplateModal.templateContentHtml }}
                      />
                    </div>
                  ) : (
                    <table className="w-full border-2 border-slate-900 text-center text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-100 font-bold border-b-2 border-slate-900">
                          <th className="border border-slate-900 p-2 w-12">STT</th>
                          <th className="border border-slate-900 p-2 text-left">Tên hàng hóa dịch vụ</th>
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
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4 text-center text-xs pt-8">
                  <div className="space-y-12">
                    <p className="font-bold uppercase">NGƯỜI MUA HÀNG</p>
                    <p className="text-slate-400 font-italic">(Ký, ghi rõ họ tên)</p>
                  </div>
                  <div className="space-y-12">
                    <p className="font-bold uppercase">NGƯỜI BÁN HÀNG</p>
                    <p className="font-bold text-cyan-800">{previewTemplateModal.sellerName || 'Nguyễn Văn Quản Lý'}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* Sales Invoice Printable Detail Modal */}
      {previewDoc &&
        createPortal(
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs overflow-y-auto">
            <div className="w-full max-w-4xl rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden my-8">
              <div className="flex items-center justify-between bg-cyan-700 px-6 py-4 text-white print:hidden">
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  <h3 className="font-bold text-base">Chi Tiết Hóa Đơn Bán Hàng: {previewDoc.invoiceNo}</h3>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handlePrint}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-white px-4 py-2 text-xs font-bold text-cyan-800 shadow-xs hover:bg-cyan-50 transition"
                  >
                    <Printer className="h-4 w-4" />
                    In Hóa Đơn
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
                  <h1 className="text-2xl font-black uppercase tracking-wide text-slate-900">HÓA ĐƠN BÁN HÀNG TÀI CHÍNH</h1>
                  <p className="text-xs font-semibold text-slate-600 mt-1">CÔNG TY TNHH HỆ THỐNG QUẢN LÝ KHO SMART WMS</p>
                  <p className="text-xs text-slate-500">MST: 0316889988 • ĐC: Tầng 8, Tòa nhà Innovation, Quận 1, TP. Hồ Chí Minh</p>
                </div>

                <div className="grid grid-cols-2 gap-4 text-xs sm:text-sm mb-6 border-b border-dashed border-slate-300 pb-4">
                  <div><span className="font-semibold text-slate-700">Mẫu số:</span> <span className="font-bold text-cyan-800">HD-2026/PRO</span></div>
                  <div><span className="font-semibold text-slate-700">Số hóa đơn:</span> <span className="font-bold text-cyan-800">{previewDoc.invoiceNo}</span></div>
                  <div><span className="font-semibold text-slate-700">Tên khách hàng:</span> <span className="font-bold text-slate-900">{previewDoc.customerName}</span></div>
                  <div><span className="font-semibold text-slate-700">Mã số thuế KH:</span> <span className="font-bold text-slate-900">{previewDoc.customerTaxCode || '0399887766'}</span></div>
                </div>

                <table className="w-full border-2 border-slate-900 text-center text-xs sm:text-sm border-collapse mb-6">
                  <thead>
                    <tr className="bg-slate-100 font-bold border-b-2 border-slate-900">
                      <th className="border border-slate-900 p-2 w-12">STT</th>
                      <th className="border border-slate-900 p-2 text-left">Tên hàng hóa dịch vụ</th>
                      <th className="border border-slate-900 p-2 w-16">ĐVT</th>
                      <th className="border border-slate-900 p-2 w-20">Số lượng</th>
                      <th className="border border-slate-900 p-2 w-28">Đơn giá</th>
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
                  <span className="font-bold">Thuế suất GTGT: 10%</span>
                  <span className="font-black text-cyan-800 text-base">
                    Tổng cộng thanh toán: {formatMoney(previewDoc.items.reduce((s, i) => s + i.unitPrice * i.quantity, 0) * 1.1)} ₫
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4 text-center text-xs sm:text-sm pt-6">
                  <div className="space-y-12">
                    <p className="font-bold uppercase">NGƯỜI MUA HÀNG</p>
                    <p className="text-slate-400 font-italic">(Ký, ghi rõ họ tên)</p>
                  </div>
                  <div className="space-y-12">
                    <p className="font-bold uppercase">NGƯỜI BÁN HÀNG</p>
                    <p className="font-bold text-slate-900">Nguyễn Văn Quản Lý</p>
                  </div>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
