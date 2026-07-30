import React from 'react';
import {
  X,
  Building2,
  Package,
  PlusCircle,
  Trash2,
  Phone,
  User,
  Calendar,
  FileText,
  Clock,
  CheckCircle2,
  ChevronDown,
  Search,
} from 'lucide-react';
import { createPortal } from 'react-dom';
import type { ScannedProduct } from '../../../shared/components/BarcodeScanner';

type SupplierProduct = {
  id: string;
  supplierSku?: string;
  purchasePrice: string;
  isPrimary: boolean;
  product: {
    id: string;
    internalSku: string;
    name: string;
    unit?: string;
  } | null;
};

type Supplier = {
  id: string;
  supplierCode: string;
  name: string;
  status: 'active' | 'inactive';
  leadTimeDays: number;
  currency: string;
  contactPerson?: string;
  phone?: string;
  taxCode?: string;
  address?: string;
  products?: SupplierProduct[];
};

type WarehouseRecord = {
  id: string;
  code: string;
  name: string;
  address: string;
  status: 'active' | 'inactive';
  managerIds: string[];
  staffIds: string[];
};

type PurchaseOrderUser = {
  id: string;
  email: string;
  fullName?: string;
  roles?: { name: string }[];
};

type FormLine = {
  id?: string;
  rowId: string;
  productId: string;
  warehouseCode: string;
  expectedQty: string;
  receivedQty: string;
  inventoryQty?: string;
  unitPrice: string;
  supplierPrice?: string;
};

type OrderForm = {
  poNumber: string;
  supplierId: string;
  orderDate: string;
  expectedDate: string;
  status: 'CREATED' | 'DRAFT' | 'APPROVED' | 'REJECTED' | 'RECEIVED' | 'CANCELLED' | 'SUPPLIER_APPROVED' | 'PARTIALLY_RECEIVED';
  description: string;
  items: FormLine[];
  creatorName?: string;
  creatorPhone?: string;
  warehouseCode?: string;
  approverId?: string;
};


interface PurchaseOrderFormModalProps {
  isOpen: boolean;
  mode: 'create' | 'edit' | 'view';
  customActions?: React.ReactNode;
  form: OrderForm;
  suppliers: Supplier[];
  warehouses: WarehouseRecord[];
  users: PurchaseOrderUser[];
  scannedProducts: ScannedProduct[];
  saving: boolean;
  onFormChange: (form: OrderForm) => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  onClose: () => void;
  onAddRow: () => void;
  onRemoveRow: (rowId: string) => void;
  onUpdateRow: (rowId: string, patch: Partial<FormLine>) => void;
  onProductChange: (rowId: string, productId: string) => void;
  onScannerOpen: () => void;
  onApproveOrder?: () => void;
  renderRightPanel?: React.ReactNode;
  customWidthClass?: string;
}

const modalSelectClass =
  'h-11 w-full rounded-2xl border-2 border-slate-200 bg-white px-4 pr-10 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10 text-slate-700 font-medium';

interface CustomSelectProps {
  value: string;
  onChange: (val: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  disabled?: boolean;
}

export function CustomSelect({
  value,
  onChange,
  options,
  placeholder = 'Chọn...',
  disabled,
}: CustomSelectProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOption = options.find((o) => o.value === value);

  return (
    <div ref={containerRef} className="relative w-full z-[10000]">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className="relative h-11 w-full rounded-2xl border-2 border-slate-200 bg-white px-4 pr-10 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10 text-slate-700 font-bold text-left flex items-center disabled:bg-slate-50 disabled:text-slate-400 cursor-pointer"
      >
        <span className="truncate block pr-2">{selectedOption ? selectedOption.label : placeholder}</span>
        <ChevronDown className={`absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {isOpen && !disabled && (
        <div className="absolute left-0 right-0 mt-2 max-h-60 overflow-y-auto rounded-2xl border-2 border-slate-100 bg-white py-1.5 shadow-2xl z-[99999] animate-in fade-in slide-in-from-top-1 duration-100">
          {options.length === 0 ? (
            <div className="px-4 py-3 text-sm font-semibold text-slate-400 text-center">Không có lựa chọn</div>
          ) : (
            options.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
                className={`w-full px-4 py-2.5 text-left text-sm font-bold transition hover:bg-slate-50 ${
                  option.value === value ? 'bg-cyan-50 text-cyan-700' : 'text-slate-700'
                }`}
              >
                {option.label}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

const modalInputClass =
  'h-11 w-full rounded-2xl border-2 border-slate-200 bg-white px-4 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10 text-slate-700 font-medium';

function parseMoney(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatMoney(value: number) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value || 0);
}

function formatDate(value?: string) {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleDateString('vi-VN');
}

export function PurchaseOrderFormModal({
  isOpen,
  mode,
  form,
  suppliers,
  warehouses,
  users,
  scannedProducts,
  saving,
  customActions,
  onFormChange,
  onSubmit,
  onClose,
  onAddRow,
  onRemoveRow,
  onUpdateRow,
  onProductChange,
  onScannerOpen,
  onApproveOrder,
  renderRightPanel,
  customWidthClass,
}: PurchaseOrderFormModalProps) {
  const [selectedRows, setSelectedRows] = React.useState<string[]>([]);
  const [selectingProductRowId, setSelectingProductRowId] = React.useState<string | null>(null);
  const [productSearch, setProductSearch] = React.useState('');
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    if (isOpen) {
      setMounted(true);
    } else {
      setMounted(false);
    }
  }, [isOpen]);

  const selectedSupplier = form ? (suppliers || []).find((s) => s.id === form.supplierId) : null;
  const supplierProducts = selectedSupplier?.products || [];
 
  const allSelectableProducts = React.useMemo(() => {
    const list: Array<{ id: string; internalSku: string; name: string; unit?: string; price?: string }> = [];
    
    // Add supplier products
    (supplierProducts || []).forEach((sp) => {
      if (sp && sp.product) {
        list.push({
          id: sp.product.id,
          internalSku: sp.product.internalSku,
          name: sp.product.name,
          unit: sp.product.unit,
          price: sp.purchasePrice,
        });
      }
    });

    // Add scanned products that aren't already in list
    (scannedProducts || []).forEach((sp) => {
      if (sp && !list.some((item) => item.id === sp.id)) {
        list.push({
          id: sp.id,
          internalSku: sp.internalSku || '',
          name: sp.name || '',
          unit: sp.unit,
          price: sp.purchasePrice !== undefined ? String(sp.purchasePrice) : '0',
        });
      }
    });

    return list;
  }, [supplierProducts, scannedProducts]);

  const filteredSupplierProducts = React.useMemo(() => {
    const query = productSearch.toLowerCase().trim();
    if (!query) return allSelectableProducts;
    return allSelectableProducts.filter(
      (p) =>
        p &&
        ((p.name || '').toLowerCase().includes(query) ||
          (p.internalSku || '').toLowerCase().includes(query))
    );
  }, [allSelectableProducts, productSearch]);

  const selectedWarehouse = form ? (warehouses || []).find(
    (w) => w && (w.code === form.warehouseCode || w.id === form.warehouseCode)
  ) : null;

  const approversForWarehouse = selectedWarehouse
    ? (users || []).filter(
      (user) =>
        user &&
        selectedWarehouse.managerIds &&
        selectedWarehouse.staffIds &&
        Array.isArray(selectedWarehouse.managerIds) &&
        Array.isArray(selectedWarehouse.staffIds) &&
        (selectedWarehouse.managerIds.includes(user.id) ||
          selectedWarehouse.staffIds.includes(user.id)) &&
        Array.isArray(user.roles) &&
        user.roles.some((role) => role && String(role?.name || '').toLowerCase() === 'manager')
    )
    : [];

  const validItems = form ? (form.items || []).filter(item => item && item.productId) : [];

  const totalAmount = validItems.reduce((sum, item) => {
    const expectedQty = parseMoney(item.expectedQty);
    const unitPrice = parseMoney(item.unitPrice);
    return sum + expectedQty * unitPrice;
  }, 0);

  const totalProducts = validItems.length;
  const totalQuantity = validItems.reduce((sum, item) => sum + parseMoney(item.expectedQty), 0);

  if (!isOpen || !mounted || !form || typeof document === 'undefined' || !document.body) return null;

  return createPortal(
    <>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
      <form
        onSubmit={onSubmit}
        className={`max-h-[94vh] ${customWidthClass || 'w-2/3'} overflow-hidden rounded-3xl bg-white shadow-2xl flex flex-col`}
      >
        {/* HEADER */}
        <div className="flex items-start justify-between border-b-2 border-slate-100 px-6 py-4 bg-gradient-to-r from-slate-50 to-white">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-cyan-100 p-2 text-cyan-700">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900">
                {mode === 'view'
                  ? 'Xem đơn mua hàng'
                  : mode === 'edit'
                  ? form.status === 'REJECTED'
                    ? 'Điều chỉnh giá & Gửi lại đơn hàng'
                    : 'Sửa đơn mua hàng'
                  : 'Tạo đơn mua hàng'}
              </h3>
              <p className="text-sm font-medium text-slate-500">
                {mode === 'view' ? 'Chi tiết thông tin nhà cung cấp, kho và sản phẩm.' : 'Nhập thông tin nhà cung cấp, kho và sản phẩm cần mua.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 hover:bg-slate-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* BODY */}
        <div className="flex flex-1 overflow-hidden min-h-0">
          <fieldset disabled={mode === 'view' || mode === 'create_order' as any} className="overflow-y-auto flex-1 px-8 py-6 space-y-6">
            {/* THÔNG TIN CHUNG + TÍNH TRẠNG */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[2fr_1fr]">
            {/* PHÍA TRÁI: THÔNG TIN NHÀ CUNG CẤP & ĐẶT HÀNG */}
            <div className="rounded-2xl border-2 border-slate-200 bg-gradient-to-br from-slate-50 to-white p-6 flex flex-col h-full">
              {/* KHỐI 1: THÔNG TIN NHÀ CUNG CẤP */}
              <div>
                <h4 className="mb-5 text-sm font-black uppercase text-slate-800">Thông tin nhà cung cấp</h4>

                {/* Row 1: Nhà cung cấp & Mã số thuế */}
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 mb-4">
                  <div>
                    <label className="mb-2 block text-sm font-bold text-slate-700">
                      Nhà cung cấp <span className="text-red-600">*</span>
                    </label>
                    <CustomSelect
                      value={form.supplierId}
                      onChange={(value) => {
                        onFormChange({
                          ...form,
                          supplierId: value,
                        });
                      }}
                      options={suppliers.map((supplier) => ({
                        value: supplier.id,
                        label: supplier.name,
                      }))}
                      placeholder="Chọn nhà cung cấp"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-bold text-slate-700">
                      Mã số thuế
                    </label>
                    <CustomSelect
                      value={form.supplierId}
                      onChange={(value) => {
                        onFormChange({
                          ...form,
                          supplierId: value,
                        });
                      }}
                      options={suppliers.map((supplier) => ({
                        value: supplier.id,
                        label: supplier.taxCode || 'Chưa cập nhật',
                      }))}
                      placeholder="Chọn theo mã số thuế"
                    />
                  </div>
                </div>

                {/* Row 2: Người liên hệ & Số điện thoại */}
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 mb-4">
                  <div>
                    <label className="mb-2 block text-sm font-bold text-slate-700">
                      Người liên hệ
                    </label>
                    <div className="flex h-11 items-center rounded-2xl border-2 border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-700">
                      {selectedSupplier?.contactPerson || '-'}
                    </div>
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-bold text-slate-700">
                      Số điện thoại
                    </label>
                    <div className="flex h-11 items-center rounded-2xl border-2 border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-700">
                      {selectedSupplier?.phone || '-'}
                    </div>
                  </div>
                </div>
              </div>

              {/* KHỐI 2: THÔNG TIN ĐẶT HÀNG */}
              <div className="mt-6 border-t-2 border-slate-100 pt-6">
                <h4 className="mb-5 text-sm font-black uppercase text-slate-800">Thông tin đặt hàng</h4>

                {/* Row 1: Người đặt hàng & SĐT */}
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 mb-4">
                  <div>
                    <label className="mb-2 block text-sm font-bold text-slate-700">
                      Người đặt hàng
                    </label>
                    <input
                      type="text"
                      value={form.creatorName || ''}
                      onChange={(e) => onFormChange({ ...form, creatorName: e.target.value })}
                      className={modalInputClass}
                      placeholder="Nhập tên người đặt..."
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-bold text-slate-700">
                      SĐT người đặt
                    </label>
                    <input
                      type="text"
                      value={form.creatorPhone || ''}
                      onChange={(e) => onFormChange({ ...form, creatorPhone: e.target.value })}
                      className={modalInputClass}
                      placeholder="Nhập SĐT..."
                    />
                  </div>
                </div>

                {/* Row 2: Kho hàng & Quản lý */}
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 mb-4">
                  <div>
                    <label className="mb-2 block text-sm font-bold text-slate-700">
                      Kho hàng <span className="text-red-600">*</span>
                    </label>
                    <CustomSelect
                      value={form.warehouseCode || ''}
                      onChange={(value) => {
                        onFormChange({ ...form, warehouseCode: value, approverId: '' });
                      }}
                      options={warehouses.map((warehouse) => ({
                        value: warehouse.code,
                        label: `${warehouse.name} (${warehouse.code})`,
                      }))}
                      placeholder="Chọn kho"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-bold text-slate-700">
                      Quản lý (Người duyệt) <span className="text-red-600">*</span>
                    </label>
                    <CustomSelect
                      value={form.approverId || ''}
                      onChange={(value) =>
                        onFormChange({ ...form, approverId: value })
                      }
                      options={approversForWarehouse.map((user) => ({
                        value: user.id,
                        label: user.fullName || user.email,
                      }))}
                      placeholder="Chọn quản lý"
                    />
                  </div>
                </div>

                {/* Row 3: Ghi chú */}
                <div className="flex-1 flex flex-col min-h-[120px]">
                  <label className="mb-2 block text-sm font-bold text-slate-700">Ghi chú</label>
                  <textarea
                    value={form.description}
                    onChange={(event) =>
                      onFormChange({ ...form, description: event.target.value })
                    }
                    className="w-full flex-1 rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10 resize-none font-medium text-slate-700"
                    placeholder="Nhập ghi chú hoặc yêu cầu đặc biệt..."
                  />
                </div>
              </div>
            </div>

            {/* PHÍA PHẢI: THÔNG TIN ĐƠN HÀNG */}
            <div className="rounded-2xl border-2 border-slate-200 bg-gradient-to-br from-slate-50 to-white p-6 flex flex-col h-full">
              <h4 className="mb-5 text-sm font-black uppercase text-slate-800">Thông tin đơn hàng</h4>

              <div className="grid grid-cols-1 gap-6">
                {/* Mã đơn hàng */}
                <div>
                  <label className="mb-2 block text-xs font-bold uppercase text-slate-600">
                    Mã đơn hàng
                  </label>
                  <input
                    type="text"
                    value={form.poNumber || ''}
                    onChange={(e) => onFormChange({ ...form, poNumber: e.target.value })}
                    className="h-11 w-full rounded-xl border-2 border-slate-200 bg-white px-3 text-sm font-bold text-slate-900 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
                    placeholder="Nhập mã đơn..."
                  />
                </div>

                {/* Ngày tạo đơn */}
                <div>
                  <label className="mb-2 block text-xs font-bold uppercase text-slate-600">
                    Ngày tạo đơn
                  </label>
                  <input
                    type="datetime-local"
                    value={form.orderDate ? form.orderDate.slice(0, 16) : ''}
                    onChange={(e) => onFormChange({ ...form, orderDate: e.target.value })}
                    className="h-11 w-full rounded-xl border-2 border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
                  />
                </div>

                {/* Ngày giao hàng */}
                <div>
                  <label className="mb-2 block text-xs font-bold uppercase text-slate-600">
                    Ngày giao hàng dự kiến
                  </label>
                  <input
                    type="datetime-local"
                    value={form.expectedDate ? form.expectedDate.slice(0, 16) : ''}
                    onChange={(e) => onFormChange({ ...form, expectedDate: e.target.value })}
                    className="h-11 w-full rounded-xl border-2 border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
                  />
                </div>

                {/* Trạng thái đơn hàng */}
                <div>
                  <label className="mb-2 block text-xs font-bold uppercase text-slate-600">
                    Trạng thái đơn hàng
                  </label>
                  <CustomSelect
                    value={form.status || 'CREATED'}
                    onChange={(value) => onFormChange({ ...form, status: value as any })}
                    disabled={mode === 'view'}
                    placeholder="Chọn trạng thái"
                    options={[
                      { value: 'DRAFT', label: 'Đơn nháp' },
                      { value: 'CREATED', label: 'Đơn đặt hàng mới' },
                      { value: 'REJECTED', label: 'Phản hồi giá' },
                      ...((mode === 'view' || mode === ('create_order' as any))
                        ? [
                            { value: 'APPROVED', label: 'Chờ NCC xác nhận' },
                            { value: 'SUPPLIER_APPROVED', label: 'NCC đã xác nhận' },
                            { value: 'PARTIALLY_RECEIVED', label: 'Nhận một phần' },
                            { value: 'RECEIVED', label: 'Hoàn thành' },
                            { value: 'COMPLETED', label: 'Hoàn thành' },
                            { value: 'CANCELLED', label: 'Đã hủy' },
                          ]
                        : []),
                    ]}
                  />
                </div>
              </div>

              {/* Tổng kết */}
              <div className="mt-auto pt-6">
                <div className="space-y-4 rounded-2xl border-2 border-cyan-200 bg-cyan-50 p-5">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-sm font-bold uppercase text-cyan-800">Tổng sản phẩm</p>
                      <p className="mt-0.5 text-xs font-medium text-cyan-600/80">(Số lượng các mặt hàng khác nhau trong đơn)</p>
                    </div>
                    <p className="text-lg font-black text-cyan-900">{totalProducts}</p>
                  </div>
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-sm font-bold uppercase text-cyan-800">Tổng số lượng</p>
                      <p className="mt-0.5 text-xs font-medium text-cyan-600/80">(Tổng cộng tất cả các sản phẩm)</p>
                    </div>
                    <p className="text-lg font-black text-cyan-900">{totalQuantity}</p>
                  </div>
                  <div className="flex justify-between items-end border-t-2 border-cyan-200/60 pt-4 mt-2">
                    <p className="text-sm font-bold uppercase text-cyan-800 mb-1">Tổng tiền</p>
                    <p className="text-3xl font-black text-cyan-900 tracking-tight">{formatMoney(totalAmount)}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* BẢNG HÀNG HÓA */}
          <section>
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Package className="h-5 w-5 text-cyan-600" />
                <h4 className="font-black text-slate-900">Chi tiết hàng hóa</h4>
              </div>
              <div className="flex gap-2">
                {mode !== 'view' && selectedRows.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      selectedRows.forEach(id => onRemoveRow(id));
                      setSelectedRows([]);
                    }}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-red-200 bg-red-50 px-4 py-2 text-sm font-bold text-red-600 transition hover:bg-red-100"
                  >
                    <Trash2 className="h-4 w-4" />
                    Xóa ({selectedRows.length})
                  </button>
                )}
                {mode !== 'view' && (
                  <>
                    <button
                      type="button"
                      onClick={onScannerOpen}
                      className="inline-flex items-center gap-2 rounded-xl bg-slate-800 px-4 py-2 text-sm font-bold text-white hover:bg-slate-900 transition"
                    >
                      Quét Barcode
                    </button>
                    <button
                      type="button"
                      onClick={onAddRow}
                      className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-cyan-200 bg-cyan-50 px-4 py-2 text-sm font-bold text-cyan-700 transition hover:bg-cyan-100"
                    >
                      <PlusCircle className="h-4 w-4" />
                      Thêm dòng
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border-2 border-slate-200">
              <div className="overflow-x-auto">
                <table className="w-full bg-white">
                  <thead className="bg-slate-50">
                    <tr className="border-b border-slate-200">
                      {(mode === 'create' || mode === 'edit') && (
                        <th className="w-12 border border-slate-200 px-3 py-3 text-center">
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500 cursor-pointer"
                            checked={form.items.length > 0 && selectedRows.length === form.items.length}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedRows(form.items.map(i => i.rowId));
                              } else {
                                setSelectedRows([]);
                              }
                            }}
                          />
                        </th>
                      )}
                      <th className="w-10 border border-slate-200 px-3 py-3 text-center text-xs font-semibold uppercase text-slate-700">
                        STT
                      </th>
                      <th className="w-[30%] border border-slate-200 px-3 py-3 text-center text-xs font-semibold uppercase text-slate-700">
                        Mặt hàng
                      </th>
                      <th className="w-24 border border-slate-200 px-3 py-3 text-center text-xs font-semibold uppercase text-slate-700">
                        SL yêu cầu
                      </th>
                      {(mode === 'view' || mode === ('create_order' as any)) && (
                        <>
                          <th className="w-24 border border-slate-200 px-3 py-3 text-center text-xs font-semibold uppercase text-slate-700">
                            SL đã nhận
                          </th>
                          <th className="w-24 border border-slate-200 px-3 py-3 text-center text-xs font-semibold uppercase text-slate-700">
                            SL kiểm kê
                          </th>
                        </>
                      )}
                      <th className="w-40 border border-slate-200 px-3 py-3 text-center text-xs font-semibold uppercase text-slate-700">
                        Đơn giá
                      </th>
                      {form.items.some((i) => i.supplierPrice) && (
                        <th className="w-40 border border-slate-200 px-3 py-3 text-center text-xs font-semibold uppercase text-slate-700">
                          Giá NCC đề xuất
                        </th>
                      )}
                      <th className="w-32 border border-slate-200 px-3 py-3 text-center text-xs font-semibold uppercase text-slate-700">
                        Thành tiền
                      </th>
                      {(mode === 'create' || mode === 'edit') && (
                        <th className="w-12 border border-slate-200 px-3 py-3 text-center text-xs font-semibold uppercase text-slate-700">
                          Xóa
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {form.items.map((item, index) => {
                      const expectedQty = parseMoney(item.expectedQty);
                      const unitPrice = parseMoney(item.unitPrice);
                      return (
                        <tr key={item.rowId} className="hover:bg-slate-50 transition">
                          {(mode === 'create' || mode === 'edit') && (
                            <td className="border border-slate-200 px-3 py-3 text-center">
                              <input
                                type="checkbox"
                                className="h-4 w-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500 cursor-pointer"
                                checked={selectedRows.includes(item.rowId)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedRows([...selectedRows, item.rowId]);
                                  } else {
                                    setSelectedRows(selectedRows.filter(id => id !== item.rowId));
                                  }
                                }}
                              />
                            </td>
                          )}
                          <td className="border border-slate-200 px-3 py-3 text-center text-sm text-slate-600">
                            {index + 1}
                          </td>
                          <td className="border border-slate-200 px-3 py-3">
                            {mode === 'create' || mode === 'edit' ? (
                              (() => {
                                const selectedProduct = allSelectableProducts.find((p) => p.id === item.productId);
                                return (
                                  <button
                                    type="button"
                                    onClick={() => setSelectingProductRowId(item.rowId)}
                                    className="h-11 w-full bg-transparent px-3 text-left text-sm outline-none font-bold text-slate-700 hover:bg-slate-100/50 rounded-xl transition flex items-center justify-between group border border-dashed border-slate-300 hover:border-cyan-500 cursor-pointer"
                                  >
                                    <span className="truncate">
                                      {selectedProduct ? `${selectedProduct.internalSku} - ${selectedProduct.name}` : 'Chọn sản phẩm...'}
                                    </span>
                                    <Search className="h-4 w-4 text-slate-400 group-hover:text-cyan-600 transition shrink-0 ml-1" />
                                  </button>
                                );
                              })()
                            ) : (
                              <div className="text-sm font-medium text-slate-700">
                                {allSelectableProducts.find((p) => p.id === item.productId)?.name ||
                                  item.productId}
                              </div>
                            )}
                          </td>
                          <td className="border border-slate-200 px-3 py-3 text-center">
                            {mode === 'create' || mode === 'edit' ? (
                              <input
                                type="number"
                                min={0}
                                value={item.expectedQty}
                                onChange={(event) =>
                                  onUpdateRow(item.rowId, {
                                    expectedQty: event.target.value,
                                  })
                                }
                                className="h-11 w-full bg-transparent px-3 text-center text-sm outline-none font-medium text-slate-700 disabled:bg-slate-50 disabled:text-slate-500"
                              />
                            ) : (
                              <span className="text-sm font-medium text-slate-700">{item.expectedQty}</span>
                            )}
                          </td>
                          {(mode === 'view' || mode === ('create_order' as any)) && (
                            <>
                              <td className="border border-slate-200 px-3 py-3 text-center text-sm font-semibold text-slate-700">
                                {item.receivedQty}
                              </td>
                              <td className="border border-slate-200 px-3 py-3 text-center text-sm font-semibold text-slate-700">
                                {item.receivedQty}
                              </td>
                            </>
                          )}
                          <td className="border border-slate-200 px-3 py-3 text-center">
                            {mode === 'create' || mode === 'edit' ? (
                              <input
                                type="number"
                                min={0}
                                value={item.unitPrice}
                                onChange={(event) =>
                                  onUpdateRow(item.rowId, {
                                    unitPrice: event.target.value,
                                  })
                                }
                                className="h-11 w-full bg-transparent px-3 text-center text-sm outline-none font-medium text-slate-700"
                              />
                            ) : (
                              <span className="text-sm font-medium text-slate-700">{formatMoney(parseMoney(item.unitPrice))}</span>
                            )}
                          </td>
                          {form.items.some((i) => i.supplierPrice) && (
                            <td className="border border-slate-200 px-3 py-3 text-center">
                              {item.supplierPrice ? (
                                <span className="text-sm font-bold text-amber-600 bg-amber-50 px-2.5 py-1 rounded-lg">
                                  {formatMoney(parseMoney(item.supplierPrice))}
                                </span>
                              ) : (
                                <span className="text-sm text-slate-400 font-semibold">-</span>
                              )}
                            </td>
                          )}
                          <td className="border border-slate-200 px-3 py-3 text-center text-sm font-semibold text-slate-700">
                            {formatMoney(expectedQty * unitPrice)}
                          </td>
                          {(mode === 'create' || mode === 'edit') && (
                            <td className="border border-slate-200 px-3 py-3 text-center">
                              <button
                                type="button"
                                onClick={() => onRemoveRow(item.rowId)}
                                className="inline-flex h-9 w-9 items-center justify-center rounded-xl border-2 border-red-200 bg-red-50 text-red-600 transition hover:bg-red-100 font-semibold"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </fieldset>
        
        {renderRightPanel && (
          <div className="w-[420px] shrink-0 border-l border-slate-200 bg-slate-50 overflow-y-auto">
            {renderRightPanel}
          </div>
        )}
        </div>

        {/* FOOTER */}
        <div className="flex items-center justify-end gap-3 border-t border-slate-100 px-6 py-4 bg-gradient-to-r from-slate-50 to-white">
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl border-2 border-slate-200 px-6 py-2.5 font-bold text-slate-700 hover:bg-slate-100 transition"
          >
            Hủy
          </button>
          {mode === 'view' || mode === ('create_order' as any) ? (
            customActions
          ) : mode === 'edit' && form.status === 'REJECTED' ? (
            <>
              {onApproveOrder && (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => onApproveOrder()}
                  className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-6 py-2.5 font-bold text-white shadow-lg hover:bg-emerald-700 disabled:opacity-60 transition cursor-pointer"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Đồng ý & Chốt đơn hàng
                </button>
              )}
              <button
                type="button"
                disabled={saving}
                onClick={(e) => {
                  onFormChange({ ...form, status: 'CREATED' });
                  setTimeout(() => {
                    const formEl = (e.target as HTMLElement).closest('form');
                    if (formEl) formEl.requestSubmit();
                  }, 0);
                }}
                className="rounded-2xl bg-cyan-600 px-6 py-2.5 font-bold text-white shadow-lg hover:bg-cyan-700 disabled:opacity-60 transition cursor-pointer"
              >
                {saving ? 'Đang gửi...' : 'Phản hồi lại giá'}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                disabled={saving}
                onClick={(e) => {
                  onFormChange({ ...form, status: 'DRAFT' });
                  setTimeout(() => {
                    const formEl = (e.target as HTMLElement).closest('form');
                    if (formEl) formEl.requestSubmit();
                  }, 0);
                }}
                className="rounded-2xl border-2 border-slate-300 bg-white px-6 py-2.5 font-bold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-60 transition"
              >
                {saving ? 'Đang lưu...' : 'Tạo đơn đặt hàng nháp'}
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={(e) => {
                  onFormChange({ ...form, status: 'CREATED' });
                  setTimeout(() => {
                    const formEl = (e.target as HTMLElement).closest('form');
                    if (formEl) formEl.requestSubmit();
                  }, 0);
                }}
                className="rounded-2xl bg-cyan-600 px-6 py-2.5 font-bold text-white shadow-lg hover:bg-cyan-700 disabled:opacity-60 transition"
              >
                {saving ? 'Đang lưu...' : mode === 'edit' ? 'Lưu thay đổi' : 'Tạo mới đơn đặt hàng'}
              </button>
            </>
          )}
        </div>
      </form>
    </div>

    {/* PRODUCT SEARCH MODAL */}
    {selectingProductRowId && (
      <div className="fixed inset-0 z-[100000] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
        <div className="w-full max-w-xl rounded-3xl bg-white shadow-2xl flex flex-col max-h-[80vh] overflow-hidden border border-slate-100 animate-in fade-in zoom-in duration-200">
          {/* Search Header */}
          <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-slate-50 to-white">
            <div className="flex items-center gap-2.5">
              <div className="rounded-xl bg-cyan-50 p-2 text-cyan-600">
                <Package className="h-5 w-5" />
              </div>
              <div>
                <h4 className="text-base font-black text-slate-900">Tìm kiếm & Chọn sản phẩm</h4>
                <p className="text-xs font-semibold text-slate-500">Tìm nhanh sản phẩm theo tên hoặc mã SKU</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setProductSearch('');
                setSelectingProductRowId(null);
              }}
              className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 transition cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Search Bar */}
          <div className="p-4 border-b border-slate-100 bg-slate-50/50">
            <div className="relative flex items-center rounded-2xl border-2 border-slate-200 bg-white px-4 h-11 transition-all focus-within:border-cyan-500 focus-within:ring-4 focus-within:ring-cyan-500/10">
              <Search className="h-4 w-4 text-slate-400 mr-2.5" />
              <input
                type="text"
                placeholder="Nhập tên sản phẩm hoặc mã SKU..."
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                className="w-full border-none bg-transparent text-sm font-semibold text-slate-700 outline-none placeholder-slate-400"
                autoFocus
              />
              {productSearch && (
                <button
                  type="button"
                  onClick={() => setProductSearch('')}
                  className="text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          {/* Product List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {filteredSupplierProducts.length === 0 ? (
              <div className="text-center py-10 text-slate-400">
                <Package className="h-10 w-10 mx-auto mb-2.5 opacity-40" />
                <p className="text-sm font-bold">Không tìm thấy sản phẩm nào</p>
                <p className="text-xs font-semibold mt-0.5">Vui lòng kiểm tra lại từ khóa tìm kiếm</p>
              </div>
            ) : (
              filteredSupplierProducts.map((p) => {
                const isSelected = form.items.find(item => item.rowId === selectingProductRowId)?.productId === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      onProductChange(selectingProductRowId, p.id);
                      // also update price if it's set on supplierProduct
                      const supProd = supplierProducts.find(sp => sp.product?.id === p.id);
                      if (supProd) {
                        onUpdateRow(selectingProductRowId, {
                          unitPrice: String(parseMoney(supProd.purchasePrice) || 0)
                        });
                      }
                      setProductSearch('');
                      setSelectingProductRowId(null);
                    }}
                    className={`w-full flex items-center justify-between p-3.5 rounded-2xl border-2 text-left transition cursor-pointer ${
                      isSelected
                        ? 'border-cyan-500 bg-cyan-50/50'
                        : 'border-slate-100 bg-white hover:border-slate-300 hover:shadow-sm'
                    }`}
                  >
                    <div>
                      <div className="text-sm font-black text-slate-800">{p.name}</div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                          SKU: {p.internalSku}
                        </span>
                        {p.unit && (
                          <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                            Đơn vị: {p.unit}
                          </span>
                        )}
                        {p.price && (
                          <span className="text-xs font-bold text-cyan-600 bg-cyan-50 px-2 py-0.5 rounded-md">
                            Đơn giá: {formatMoney(parseMoney(p.price))}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className={`h-6 w-6 rounded-full border-2 flex items-center justify-center transition ${
                      isSelected ? 'border-cyan-500 bg-cyan-500 text-white' : 'border-slate-300'
                    }`}>
                      {isSelected && <CheckCircle2 className="h-4 w-4" />}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>
    )}
    </>,
    document.body
  );
}
