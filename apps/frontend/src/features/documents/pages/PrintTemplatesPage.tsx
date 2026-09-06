import React, { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import DocxEditorPanel from '../components/DocxEditorPanel';
import MultiWarehouseSelector from '../components/MultiWarehouseSelector';
import { parseDocxFile } from '../utils/docxParser';
import {
  FileSpreadsheet,
  FileText,
  ArrowDownRight,
  ArrowUpRight,
  ArrowLeftRight,
  Search,
  Plus,
  Eye,
  Pencil,
  Trash2,
  Upload,
  CheckCircle2,
  AlertCircle,
  X,
  Printer,
  FileDown,
} from 'lucide-react';

export interface PrintTemplateItem {
  id: string;
  templateCode: string;
  serialSymbol: string;
  cqtStatus: 'APPROVED' | 'PENDING';
  status: 'ACTIVE' | 'INACTIVE';
  invoiceType?: 'MAIN' | 'SUB';
  appliedWarehouse: string;
  createdDate: string;
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

const INITIAL_SALES_INVOICE_TEMPLATES: PrintTemplateItem[] = [
  {
    id: 'tpl-inv-001',
    templateCode: 'HD-001',
    serialSymbol: 'C26MAA',
    cqtStatus: 'APPROVED',
    status: 'ACTIVE',
    invoiceType: 'MAIN',
    appliedWarehouse: 'Tất cả các kho',
    createdDate: '19/08/2026',
    fileName: 'Mau_Hoa_Don_GTGT_Dien_Tu_Chuan.docx',
    fileSize: '52.4 KB',
    companyName: 'CÔNG TY TNHH HỆ THỐNG QUẢN LÝ KHO SMART WMS',
    companyTaxCode: '0316889988',
    companyAddress: 'Tầng 8, Tòa nhà Innovation, Quận 1, TP. Hồ Chí Minh',
    invoiceTitle: 'HÓA ĐƠN GIÁ TRỊ GIA TĂNG (VAT)',
    sellerName: 'Nguyễn Văn Quản Lý',
  },
  {
    id: 'tpl-inv-002',
    templateCode: 'HD-002',
    serialSymbol: 'C26MBB',
    cqtStatus: 'APPROVED',
    status: 'ACTIVE',
    invoiceType: 'SUB',
    appliedWarehouse: 'Kho Tổng TP.HCM',
    createdDate: '15/08/2026',
    fileName: 'Mau_Hoa_Don_Ban_Hang_Chiet_Khau.docx',
    fileSize: '46.8 KB',
    companyName: 'CÔNG TY TNHH HỆ THỐNG QUẢN LÝ KHO SMART WMS',
    companyTaxCode: '0316889988',
    companyAddress: 'Tầng 8, Tòa nhà Innovation, Quận 1, TP. Hồ Chí Minh',
    invoiceTitle: 'HÓA ĐƠN BÁN HÀNG BÁN BUÔN',
    sellerName: 'Trần Thị Kế Toán',
  },
];

const INITIAL_STOCK_IN_TEMPLATES: PrintTemplateItem[] = [
  {
    id: 'tpl-in-001',
    templateCode: 'PNK-001',
    serialSymbol: 'C26NK',
    cqtStatus: 'APPROVED',
    status: 'ACTIVE',
    invoiceType: 'MAIN',
    appliedWarehouse: 'Tất cả các kho',
    createdDate: '19/08/2026',
    fileName: 'Mau_Phieu_Nhap_Kho_Chuan.docx',
    fileSize: '45.2 KB',
    companyName: 'CÔNG TY TNHH HỆ THỐNG QUẢN LÝ KHO SMART WMS',
    companyTaxCode: '0316889988',
    companyAddress: 'Tầng 8, Tòa nhà Innovation, Quận 1, TP. Hồ Chí Minh',
    invoiceTitle: 'PHIẾU NHẬP KHO NGUYÊN VẬT LIỆU & THÀNH PHẨM',
    sellerName: 'Nguyễn Văn Quản Lý',
  },
  {
    id: 'tpl-in-002',
    templateCode: 'PNK-002',
    serialSymbol: 'C26NK-SUB',
    cqtStatus: 'APPROVED',
    status: 'ACTIVE',
    invoiceType: 'SUB',
    appliedWarehouse: 'Kho Miền Bắc',
    createdDate: '12/08/2026',
    fileName: 'Mau_Phieu_Nhap_Kho_Noi_Bo.docx',
    fileSize: '41.0 KB',
    companyName: 'CÔNG TY TNHH HỆ THỐNG QUẢN LÝ KHO SMART WMS',
    companyTaxCode: '0316889988',
    companyAddress: 'Tầng 8, Tòa nhà Innovation, Quận 1, TP. Hồ Chí Minh',
    invoiceTitle: 'PHIẾU NHẬP KHO ĐIỀU CHUYỂN',
    sellerName: 'Lê Văn Kho',
  },
];

const INITIAL_STOCK_OUT_TEMPLATES: PrintTemplateItem[] = [
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

const INITIAL_TRANSFER_TEMPLATES: PrintTemplateItem[] = [
  {
    id: 'tpl-trans-001',
    templateCode: 'PDC-001',
    serialSymbol: 'C26DC',
    cqtStatus: 'APPROVED',
    status: 'ACTIVE',
    invoiceType: 'MAIN',
    appliedWarehouse: 'Tất cả các kho',
    createdDate: '18/08/2026',
    fileName: 'Mau_Phieu_Dieu_Chuyen_Chuan.docx',
    fileSize: '44.8 KB',
    companyName: 'CÔNG TY TNHH HỆ THỐNG QUẢN LÝ KHO SMART WMS',
    companyTaxCode: '0316889988',
    companyAddress: 'Tầng 8, Tòa nhà Innovation, Quận 1, TP. Hồ Chí Minh',
    invoiceTitle: 'PHIẾU XUẤT KHO KIÊM VẬN CHUYỂN NỘI BỘ',
    sellerName: 'Nguyễn Văn Quản Lý',
  },
];

type DocType = 'sales-invoice' | 'stock-in-note' | 'stock-out-note' | 'transfer-note';

export default function PrintTemplatesPage({ initialType }: { initialType?: DocType }) {
  const location = useLocation();
  const navigate = useNavigate();

  // Determine current active doc type from URL or prop
  const getCurrentDocType = (): DocType => {
    if (initialType) return initialType;
    if (location.pathname.includes('/documents/stock-in-note')) return 'stock-in-note';
    if (location.pathname.includes('/documents/stock-out-note')) return 'stock-out-note';
    if (location.pathname.includes('/documents/transfer-note')) return 'transfer-note';
    return 'sales-invoice';
  };

  const [activeDocType, setActiveDocType] = useState<DocType>(getCurrentDocType());

  useEffect(() => {
    setActiveDocType(getCurrentDocType());
  }, [location.pathname]);

  const handleTabChange = (type: DocType) => {
    setActiveDocType(type);
    navigate(`/documents/${type}`);
  };

  // State maps for each template category
  const [salesTemplates, setSalesTemplates] = useState<PrintTemplateItem[]>(INITIAL_SALES_INVOICE_TEMPLATES);
  const [stockInTemplates, setStockInTemplates] = useState<PrintTemplateItem[]>(INITIAL_STOCK_IN_TEMPLATES);
  const [stockOutTemplates, setStockOutTemplates] = useState<PrintTemplateItem[]>(INITIAL_STOCK_OUT_TEMPLATES);
  const [transferTemplates, setTransferTemplates] = useState<PrintTemplateItem[]>(INITIAL_TRANSFER_TEMPLATES);

  const [search, setSearch] = useState('');
  const [warehouseOptions, setWarehouseOptions] = useState<string[]>([]);

  // Modals state
  const [previewTemplateModal, setPreviewTemplateModal] = useState<PrintTemplateItem | null>(null);
  const [editingTemplate, setEditingTemplate] = useState<PrintTemplateItem | null>(null);
  const [showAddTemplateModal, setShowAddTemplateModal] = useState(false);

  // File upload state for Sửa file
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [targetTemplateIdForFile, setTargetTemplateIdForFile] = useState<string | null>(null);

  // New Template form state
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
  const [newTemplateFileSize, setNewTemplateFileSize] = useState('40.0 KB');
  const [newTemplateDocHtml, setNewTemplateDocHtml] = useState('<p style="margin:0 0 12px; line-height:1.7;">Nhấp để chọn file Word (.docx) và bắt đầu chỉnh sửa nội dung.</p>');
  const [newTemplateDocText, setNewTemplateDocText] = useState('');
  const [newTemplateDocLoading, setNewTemplateDocLoading] = useState(false);
  const [newTemplateDocError, setNewTemplateDocError] = useState<string | null>(null);

  // Edit template form state
  const [templateForm, setTemplateForm] = useState<Partial<PrintTemplateItem> & { appliedWarehouses?: string[] }>({
    templateCode: '',
    serialSymbol: '',
    cqtStatus: 'PENDING',
    status: 'ACTIVE',
    invoiceType: 'MAIN',
    appliedWarehouse: 'Tất cả các kho',
    appliedWarehouses: ['Kho Tổng Hàng Hoá'],
    createdDate: new Date().toLocaleDateString('vi-VN'),
    companyName: 'CÔNG TY TNHH HỆ THỐNG QUẢN LÝ KHO SMART WMS',
    companyTaxCode: '0316889988',
    companyAddress: 'Tầng 8, Tòa nhà Innovation, Quận 1, TP. Hồ Chí Minh',
    invoiceTitle: '',
    fileName: '',
    fileSize: '40.0 KB',
  });

  // Fetch warehouses
  useEffect(() => {
    async function loadWarehouses() {
      try {
        const token = localStorage.getItem('token');
        const response = await fetch('http://localhost:3000/api/warehouses', {
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });
        if (response.ok) {
          const data = await response.json();
          const names = Array.from(
            new Set((Array.isArray(data) ? data : []).map((w: any) => String(w?.name || '').trim()).filter(Boolean))
          );
          setWarehouseOptions(names);
        }
      } catch (err) {
        console.warn('Failed to load warehouses', err);
      }
    }
    loadWarehouses();
  }, []);

  // Get current active templates
  const getCurrentTemplates = () => {
    switch (activeDocType) {
      case 'sales-invoice':
        return { list: salesTemplates, setList: setSalesTemplates, defaultTitle: 'HÓA ĐƠN BÁN HÀNG TÀI CHÍNH', prefix: 'HD' };
      case 'stock-in-note':
        return { list: stockInTemplates, setList: setStockInTemplates, defaultTitle: 'PHIẾU NHẬP KHO HÀNG HÓA', prefix: 'PNK' };
      case 'stock-out-note':
        return { list: stockOutTemplates, setList: setStockOutTemplates, defaultTitle: 'PHIẾU XUẤT KHO HÀNG HÓA', prefix: 'PXK' };
      case 'transfer-note':
        return { list: transferTemplates, setList: setTransferTemplates, defaultTitle: 'PHIẾU ĐIỀU CHUYỂN KHO NỘI BỘ', prefix: 'PDC' };
    }
  };

  const { list: activeList, setList: setActiveList, defaultTitle, prefix } = getCurrentTemplates();

  const filteredTemplates = activeList.filter((tpl) => {
    const kw = search.trim().toLowerCase();
    return (
      !kw ||
      tpl.templateCode.toLowerCase().includes(kw) ||
      tpl.serialSymbol.toLowerCase().includes(kw) ||
      tpl.appliedWarehouse.toLowerCase().includes(kw) ||
      tpl.fileName.toLowerCase().includes(kw) ||
      tpl.invoiceTitle.toLowerCase().includes(kw)
    );
  });

  // Handle direct file update
  const handleTriggerEditFile = (templateId: string) => {
    setTargetTemplateIdForFile(templateId);
    fileInputRef.current?.click();
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && targetTemplateIdForFile) {
      setActiveList((prev) =>
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
      e.target.value = '';
    }
  };

  // Delete Template
  const handleDeleteTemplate = (id: string) => {
    if (window.confirm('Bạn có chắc chắn muốn xóa mẫu biểu in này không?')) {
      setActiveList((prev) => prev.filter((t) => t.id !== id));
    }
  };

  // Open Edit Modal
  const handleOpenEditModal = (tpl: PrintTemplateItem) => {
    setEditingTemplate(tpl);
    const splitWh = tpl.appliedWarehouse ? tpl.appliedWarehouse.split(', ') : ['Kho Tổng Hàng Hoá'];
    setTemplateForm({ ...tpl, appliedWarehouses: splitWh });
  };

  // Save Edit Modal
  const handleSaveEditTemplate = () => {
    if (!editingTemplate) return;
    const whList = templateForm.appliedWarehouses || [];
    const whFormatted =
      whList.length === 0 || whList.includes('Tất cả các kho')
        ? 'Tất cả các kho'
        : whList.join(', ');

    setActiveList((prev) =>
      prev.map((tpl) =>
        tpl.id === editingTemplate.id
          ? ({
              ...tpl,
              templateCode: templateForm.templateCode || tpl.templateCode,
              serialSymbol: templateForm.serialSymbol || tpl.serialSymbol,
              cqtStatus: templateForm.cqtStatus || tpl.cqtStatus,
              status: templateForm.status || tpl.status,
              invoiceType: templateForm.cqtStatus === 'APPROVED' ? templateForm.invoiceType || 'MAIN' : undefined,
              appliedWarehouse: whFormatted,
              companyName: templateForm.companyName || tpl.companyName,
              companyTaxCode: templateForm.companyTaxCode || tpl.companyTaxCode,
              companyAddress: templateForm.companyAddress || tpl.companyAddress,
              invoiceTitle: templateForm.invoiceTitle || tpl.invoiceTitle,
            } as PrintTemplateItem)
          : tpl
      )
    );
    setEditingTemplate(null);
  };

  // Add New Template
  const handleOpenAddModal = () => {
    setNewTemplateForm({
      templateCode: `${prefix}-00${activeList.length + 1}`,
      invoiceTitle: defaultTitle,
      appliedWarehouses: warehouseOptions.length > 0 ? [warehouseOptions[0]] : ['Kho Tổng Hàng Hoá'],
      fileName: '',
    });
    setNewTemplateDocHtml('<p style="margin:0 0 12px; line-height:1.7;">Nhấp để chọn file Word (.docx) và bắt đầu chỉnh sửa nội dung.</p>');
    setNewTemplateDocText('');
    setShowAddTemplateModal(true);
  };

  const handleSaveNewTemplate = () => {
    const code = newTemplateForm.templateCode.trim() || `${prefix}-00${activeList.length + 1}`;
    const whList = newTemplateForm.appliedWarehouses;
    const whFormatted =
      whList.length === 0 || whList.includes('Tất cả các kho')
        ? 'Tất cả các kho'
        : whList.join(', ');

    const newTpl: PrintTemplateItem = {
      id: `tpl-${Date.now()}`,
      templateCode: code,
      serialSymbol: `C26${prefix}`,
      cqtStatus: 'APPROVED',
      status: 'ACTIVE',
      invoiceType: 'MAIN',
      appliedWarehouse: whFormatted,
      createdDate: new Date().toLocaleDateString('vi-VN'),
      fileName: newTemplateForm.fileName || `${code}_MauDocx.docx`,
      fileSize: newTemplateFileSize || '42.0 KB',
      companyName: 'CÔNG TY TNHH HỆ THỐNG QUẢN LÝ KHO SMART WMS',
      companyTaxCode: '0316889988',
      companyAddress: 'Tầng 8, Tòa nhà Innovation, Quận 1, TP. Hồ Chí Minh',
      invoiceTitle: newTemplateForm.invoiceTitle || defaultTitle,
      sellerName: 'Nguyễn Văn Quản Lý',
      templateContentHtml: newTemplateDocHtml,
      templateContentText: newTemplateDocText,
    };

    setActiveList([newTpl, ...activeList]);
    setShowAddTemplateModal(false);
  };

  const handleNewTemplateFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setNewTemplateFileSize(`${(file.size / 1024).toFixed(1)} KB`);
    setNewTemplateForm((prev) => ({ ...prev, fileName: file.name }));
    setNewTemplateDocLoading(true);
    setNewTemplateDocError(null);

    try {
      if (file.name.toLowerCase().endsWith('.docx')) {
        const parsed = await parseDocxFile(file);
        setNewTemplateDocHtml(parsed.html || '<p>Tài liệu trống.</p>');
        setNewTemplateDocText(parsed.text);
      } else {
        setNewTemplateDocError('Vui lòng chọn file định dạng .docx để có chế độ chỉnh sửa online.');
      }
    } catch (err: any) {
      setNewTemplateDocError(err.message || 'Lỗi khi đọc file Word.');
    } finally {
      setNewTemplateDocLoading(false);
      e.target.value = '';
    }
  };

  return (
    <div className="font-sans space-y-4 pb-12">
      {/* Hidden File Input for Direct Word Edit */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        accept=".docx,.doc"
        className="hidden"
      />

      {/* TOP 4 TABS FOR PRINT TEMPLATE CATEGORIES */}
      <div className="flex flex-wrap items-center gap-2.5">
        <button
          type="button"
          onClick={() => handleTabChange('sales-invoice')}
          className={`inline-flex items-center gap-2 rounded-xl border-2 border-cyan-500 px-4 py-2.5 text-sm font-extrabold transition-all cursor-pointer ${
            activeDocType === 'sales-invoice'
              ? 'bg-cyan-600 text-white shadow-md'
              : 'bg-white text-cyan-700 hover:bg-cyan-50'
          }`}
        >
          <FileText size={18} />
          Mẫu Hóa đơn bán hàng
        </button>

        <button
          type="button"
          onClick={() => handleTabChange('stock-in-note')}
          className={`inline-flex items-center gap-2 rounded-xl border-2 border-cyan-500 px-4 py-2.5 text-sm font-extrabold transition-all cursor-pointer ${
            activeDocType === 'stock-in-note'
              ? 'bg-cyan-600 text-white shadow-md'
              : 'bg-white text-cyan-700 hover:bg-cyan-50'
          }`}
        >
          <ArrowDownRight size={18} />
          Mẫu Phiếu nhập kho
        </button>

        <button
          type="button"
          onClick={() => handleTabChange('stock-out-note')}
          className={`inline-flex items-center gap-2 rounded-xl border-2 border-cyan-500 px-4 py-2.5 text-sm font-extrabold transition-all cursor-pointer ${
            activeDocType === 'stock-out-note'
              ? 'bg-cyan-600 text-white shadow-md'
              : 'bg-white text-cyan-700 hover:bg-cyan-50'
          }`}
        >
          <ArrowUpRight size={18} />
          Mẫu Phiếu xuất kho
        </button>

        <button
          type="button"
          onClick={() => handleTabChange('transfer-note')}
          className={`inline-flex items-center gap-2 rounded-xl border-2 border-cyan-500 px-4 py-2.5 text-sm font-extrabold transition-all cursor-pointer ${
            activeDocType === 'transfer-note'
              ? 'bg-cyan-600 text-white shadow-md'
              : 'bg-white text-cyan-700 hover:bg-cyan-50'
          }`}
        >
          <ArrowLeftRight size={18} />
          Mẫu Phiếu điều chuyển
        </button>
      </div>

      {/* TOOLBAR & SEARCH */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-cyan-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-11 w-full rounded-xl border-2 border-cyan-500 bg-white pl-11 pr-4 text-sm font-semibold outline-none transition focus:border-cyan-600 focus:ring-4 focus:ring-cyan-500/10"
            placeholder="Tìm mẫu theo mã mẫu, kí hiệu, kho áp dụng, tên file..."
          />
        </div>

        <button
          type="button"
          onClick={handleOpenAddModal}
          className="inline-flex items-center gap-2 rounded-xl border-2 border-cyan-500 bg-cyan-600 px-5 py-2.5 text-sm font-bold text-white shadow-md transition hover:bg-cyan-700 shrink-0 cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          Thêm mới mẫu
        </button>
      </div>

      {/* TEMPLATES TABLE */}
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
                    Chưa có mẫu in chứng từ nào được tạo.
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

      {/* EDIT TEMPLATE METADATA MODAL */}
      {editingTemplate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl space-y-4 border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-base font-extrabold text-cyan-900 flex items-center gap-2">
                <Pencil className="h-5 w-5 text-cyan-600" />
                Sửa Nội Dung Bản Ghi Mẫu In Chứng Từ
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
                <label className="block mb-1 font-bold text-slate-800">Kho áp dụng:</label>
                <MultiWarehouseSelector
                  options={warehouseOptions}
                  selectedWarehouses={templateForm.appliedWarehouses || []}
                  onChange={(val) => setTemplateForm({ ...templateForm, appliedWarehouses: val })}
                />
              </div>

              <div className="col-span-2">
                <label className="block mb-1 font-bold text-slate-800">Tên đơn vị doanh nghiệp:</label>
                <input
                  type="text"
                  value={templateForm.companyName || ''}
                  onChange={(e) => setTemplateForm({ ...templateForm, companyName: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-xs outline-none focus:border-cyan-500 bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 col-span-2">
                <div>
                  <label className="block mb-1 font-bold text-slate-800">Mã số thuế:</label>
                  <input
                    type="text"
                    value={templateForm.companyTaxCode || ''}
                    onChange={(e) => setTemplateForm({ ...templateForm, companyTaxCode: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 p-2.5 text-xs outline-none focus:border-cyan-500 bg-white"
                  />
                </div>

                <div>
                  <label className="block mb-1 font-bold text-slate-800">Trạng thái hoạt động:</label>
                  <select
                    value={templateForm.status || 'ACTIVE'}
                    onChange={(e) => setTemplateForm({ ...templateForm, status: e.target.value as any })}
                    className="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-bold outline-none focus:border-cyan-500 bg-white"
                  >
                    <option value="ACTIVE">Đang sử dụng</option>
                    <option value="INACTIVE">Ngừng sử dụng</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-slate-200 pt-3">
              <button
                type="button"
                onClick={() => setEditingTemplate(null)}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleSaveEditTemplate}
                className="rounded-xl bg-cyan-600 px-5 py-2 text-xs font-bold text-white hover:bg-cyan-700 transition shadow-sm"
              >
                Lưu thay đổi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADD NEW TEMPLATE MODAL */}
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
                    <h3 className="text-base font-extrabold text-white">Thêm Mẫu In Chứng Từ Mới</h3>
                    <p className="text-xs text-cyan-100 font-medium">Tạo mẫu biểu in và áp dụng cho các kho hàng</p>
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
                {/* Left config form */}
                <div className="space-y-5 border-b border-slate-200 bg-white px-7 py-6 text-sm font-semibold text-slate-700 lg:border-b-0 lg:border-r lg:px-8 lg:py-7">
                  <div>
                    <label className="mb-1.5 block text-sm font-bold text-slate-800">
                      Mã mẫu phiếu <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={newTemplateForm.templateCode}
                      onChange={(e) => setNewTemplateForm((prev) => ({ ...prev, templateCode: e.target.value }))}
                      placeholder={`Ví dụ: ${prefix}-001`}
                      className="w-full rounded-2xl border-2 border-slate-200 p-3 text-sm font-extrabold text-cyan-900 outline-none focus:border-cyan-500 bg-white"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-bold text-slate-800">
                      Tiêu đề mẫu phiếu <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={newTemplateForm.invoiceTitle}
                      onChange={(e) => setNewTemplateForm((prev) => ({ ...prev, invoiceTitle: e.target.value }))}
                      placeholder={defaultTitle}
                      className="w-full rounded-2xl border-2 border-slate-200 p-3 text-sm font-bold text-slate-900 outline-none focus:border-cyan-500 bg-white"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-bold text-slate-800">
                      Kho áp dụng <span className="text-red-500">*</span>
                    </label>
                    <MultiWarehouseSelector
                      options={warehouseOptions}
                      selectedWarehouses={newTemplateForm.appliedWarehouses}
                      onChange={(val) => setNewTemplateForm((prev) => ({ ...prev, appliedWarehouses: val }))}
                    />
                  </div>

                  <div className="pt-2">
                    <label className="mb-1.5 block text-sm font-bold text-slate-800">
                      Tải lên file mẫu Word (.docx)
                    </label>
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleNewTemplateFileUpload}
                      accept=".docx"
                      className="block w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-cyan-50 file:text-cyan-700 hover:file:bg-cyan-100"
                    />
                    {newTemplateDocError && (
                      <p className="mt-1 text-xs text-red-500">{newTemplateDocError}</p>
                    )}
                  </div>
                </div>

                {/* Right word editor online panel */}
                <div className="bg-slate-50 p-6">
                  <DocxEditorPanel
                    fileName={newTemplateForm.fileName || 'Chua_Chon_File.docx'}
                    html={newTemplateDocHtml}
                    loading={newTemplateDocLoading}
                    error={newTemplateDocError}
                    onReplaceFile={() => fileInputRef.current?.click()}
                    onChange={(html) => {
                      setNewTemplateDocHtml(html);
                      const plainText = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
                      setNewTemplateDocText(plainText);
                    }}
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 rounded-b-[34px] border-t border-slate-200 bg-slate-50/90 px-6 py-4">
                <button
                  type="button"
                  onClick={() => setShowAddTemplateModal(false)}
                  className="rounded-2xl border-2 border-slate-300 bg-white px-5 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-100 transition"
                >
                  Hủy bỏ
                </button>
                <button
                  type="button"
                  onClick={handleSaveNewTemplate}
                  className="rounded-2xl bg-cyan-600 px-6 py-2.5 text-sm font-bold text-white hover:bg-cyan-700 transition shadow-md"
                >
                  Lưu & Áp Dụng Mẫu
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* A4 PREVIEW MODAL */}
      {previewTemplateModal &&
        createPortal(
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs overflow-y-auto">
            <div className="w-full max-w-4xl rounded-2xl bg-white shadow-2xl overflow-hidden my-auto animate-in fade-in duration-200">
              <div className="flex items-center justify-between border-b border-slate-200 bg-cyan-50 px-6 py-4">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="h-6 w-6 text-cyan-600" />
                  <div>
                    <h3 className="text-base font-bold text-cyan-900">
                      Xem Trước Mẫu In A4: {previewTemplateModal.templateCode}
                    </h3>
                    <p className="text-xs text-slate-500">{previewTemplateModal.invoiceTitle}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-cyan-500 bg-cyan-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-cyan-700 transition"
                  >
                    <Printer className="h-4 w-4" />
                    In mẫu này
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewTemplateModal(null)}
                    className="rounded-lg p-2 text-slate-400 hover:bg-slate-200 hover:text-slate-600"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>

              {/* A4 Document Preview Body */}
              <div className="p-8 max-h-[80vh] overflow-y-auto bg-slate-100 flex justify-center">
                <div
                  className="w-full max-w-[210mm] bg-white p-8 shadow-md border border-slate-200 text-slate-900 text-sm space-y-6"
                  style={{ fontFamily: '"Times New Roman", Times, serif' }}
                >
                  {/* Company Header */}
                  <div className="flex justify-between items-start border-b border-slate-800 pb-4">
                    <div className="space-y-1 text-xs sm:text-sm">
                      <p className="font-bold uppercase text-base text-cyan-900">{previewTemplateModal.companyName}</p>
                      <p>Mã số thuế: {previewTemplateModal.companyTaxCode}</p>
                      <p>Địa chỉ: {previewTemplateModal.companyAddress}</p>
                      <p>Kho áp dụng: {previewTemplateModal.appliedWarehouse}</p>
                    </div>
                    <div className="text-right text-xs">
                      <p className="font-bold">Mẫu số: {previewTemplateModal.templateCode}</p>
                      <p>Ký hiệu: {previewTemplateModal.serialSymbol}</p>
                      <p>Ngày tạo: {previewTemplateModal.createdDate}</p>
                    </div>
                  </div>

                  {/* Title */}
                  <div className="text-center space-y-1">
                    <h2 className="text-xl font-bold uppercase tracking-wide text-cyan-950">
                      {previewTemplateModal.invoiceTitle}
                    </h2>
                    <p className="text-xs italic">Ngày ... tháng ... năm 2026</p>
                    <p className="text-xs font-mono">Số phiếu: ................................</p>
                  </div>

                  {/* Body Content or Parsed HTML */}
                  {previewTemplateModal.templateContentHtml ? (
                    <div
                      className="border border-slate-200 p-4 rounded-lg bg-slate-50/50"
                      dangerouslySetInnerHTML={{ __html: previewTemplateModal.templateContentHtml }}
                    />
                  ) : (
                    <>
                      <div className="space-y-2 text-sm">
                        <p>- Họ tên người giao / nhận hàng: ........................................................................................</p>
                        <p>- Theo chứng từ / Hợp đồng số: ..........................................................................................</p>
                        <p>- Địa điểm nhập / xuất hàng: ...............................................................................................</p>
                      </div>

                      {/* Mock Table */}
                      <table className="w-full border-collapse border border-slate-900 text-xs sm:text-sm">
                        <thead>
                          <tr className="bg-slate-100 text-center font-bold">
                            <th className="border border-slate-900 p-2">STT</th>
                            <th className="border border-slate-900 p-2">Tên Hàng Hóa, Quy Cách</th>
                            <th className="border border-slate-900 p-2">Mã Hàng</th>
                            <th className="border border-slate-900 p-2">ĐVT</th>
                            <th className="border border-slate-900 p-2">Số Lượng</th>
                            <th className="border border-slate-900 p-2">Đơn Giá (VNĐ)</th>
                            <th className="border border-slate-900 p-2">Thành Tiền (VNĐ)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[1, 2, 3].map((row) => (
                            <tr key={row}>
                              <td className="border border-slate-900 p-2 text-center">{row}</td>
                              <td className="border border-slate-900 p-2">Sản phẩm mẫu biểu thử nghiệm #{row}</td>
                              <td className="border border-slate-900 p-2 text-center">SP00{row}</td>
                              <td className="border border-slate-900 p-2 text-center">Cái</td>
                              <td className="border border-slate-900 p-2 text-center">10</td>
                              <td className="border border-slate-900 p-2 text-right">150.000</td>
                              <td className="border border-slate-900 p-2 text-right font-bold">1.500.000</td>
                            </tr>
                          ))}
                          <tr className="font-bold">
                            <td colSpan={6} className="border border-slate-900 p-2 text-right">
                              Tổng cộng:
                            </td>
                            <td className="border border-slate-900 p-2 text-right">4.500.000 ₫</td>
                          </tr>
                        </tbody>
                      </table>
                    </>
                  )}

                  {/* Signatures */}
                  <div className="grid grid-cols-4 gap-4 text-center text-xs sm:text-sm pt-8">
                    <div>
                      <p className="font-bold">Người Lập Phiếu</p>
                      <p className="italic text-slate-400 text-xs">(Ký, họ tên)</p>
                    </div>
                    <div>
                      <p className="font-bold">Người Giao Hàng</p>
                      <p className="italic text-slate-400 text-xs">(Ký, họ tên)</p>
                    </div>
                    <div>
                      <p className="font-bold">Thủ Kho</p>
                      <p className="italic text-slate-400 text-xs">(Ký, họ tên)</p>
                    </div>
                    <div>
                      <p className="font-bold">Kế Toán Trưởng</p>
                      <p className="italic text-slate-400 text-xs">(Ký, họ tên)</p>
                    </div>
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
