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
} from 'lucide-react';
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
  renderRightPanel?: React.ReactNode;
  customWidthClass?: string;
}

const modalSelectClass =
  'h-11 w-full rounded-2xl border-2 border-slate-200 bg-white px-4 pr-10 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10 text-slate-700 font-medium';

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
  renderRightPanel,
  customWidthClass,
}: PurchaseOrderFormModalProps) {
  const [selectedRows, setSelectedRows] = React.useState<string[]>([]);

  if (!isOpen) return null;

  const selectedSupplier = suppliers.find((s) => s.id === form.supplierId);
  const supplierProducts = selectedSupplier?.products || [];
  const selectedWarehouse = warehouses.find(
    (w) => w.code === form.warehouseCode || w.id === form.warehouseCode
  );
  const approversForWarehouse = selectedWarehouse
    ? users.filter(
      (user) =>
        (selectedWarehouse.managerIds.includes(user.id) ||
          selectedWarehouse.staffIds.includes(user.id)) &&
        Array.isArray(user.roles) &&
        user.roles.some((role) => String(role?.name).toLowerCase() === 'manager')
    )
    : [];

  const validItems = form.items.filter(item => item.productId);

  const totalAmount = validItems.reduce((sum, item) => {
    const expectedQty = parseMoney(item.expectedQty);
    const unitPrice = parseMoney(item.unitPrice);
    return sum + expectedQty * unitPrice;
  }, 0);

  const totalProducts = validItems.length;
  const totalQuantity = validItems.reduce((sum, item) => sum + parseMoney(item.expectedQty), 0);

  return (
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
                {mode === 'view' ? 'Xem đơn mua hàng' : mode === 'edit' ? 'Sửa đơn mua hàng' : 'Tạo đơn mua hàng'}
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
                    <select
                      value={form.supplierId}
                      onChange={(event) => {
                        onFormChange({
                          ...form,
                          supplierId: event.target.value,
                        });
                      }}
                      className={modalSelectClass}
                    >
                      <option value="">Chọn nhà cung cấp</option>
                      {suppliers.map((supplier) => (
                        <option key={supplier.id} value={supplier.id}>
                          {supplier.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-bold text-slate-700">
                      Mã số thuế
                    </label>
                    <select
                      value={form.supplierId}
                      onChange={(event) => {
                        onFormChange({
                          ...form,
                          supplierId: event.target.value,
                        });
                      }}
                      className={modalSelectClass}
                    >
                      <option value="">Chọn theo mã số thuế</option>
                      {suppliers.map((supplier) => (
                        <option key={supplier.id} value={supplier.id}>
                          {supplier.taxCode || 'Chưa cập nhật'}
                        </option>
                      ))}
                    </select>
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
                    <select
                      value={form.warehouseCode}
                      onChange={(event) => {
                        onFormChange({ ...form, warehouseCode: event.target.value, approverId: '' });
                      }}
                      className={modalSelectClass}
                    >
                      <option value="">Chọn kho</option>
                      {warehouses.map((warehouse) => (
                        <option key={warehouse.id} value={warehouse.code}>
                          {warehouse.name} ({warehouse.code})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-bold text-slate-700">
                      Quản lý (Người duyệt) <span className="text-red-600">*</span>
                    </label>
                    <select
                      value={form.approverId}
                      onChange={(event) =>
                        onFormChange({ ...form, approverId: event.target.value })
                      }
                      className={modalSelectClass}
                    >
                      <option value="">Chọn quản lý</option>
                      {approversForWarehouse.map((user) => (
                        <option key={user.id} value={user.id}>
                          {user.fullName || user.email}
                        </option>
                      ))}
                    </select>
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
                  <select
                    value={form.status || 'CREATED'}
                    onChange={(e) => onFormChange({ ...form, status: e.target.value as any })}
                    className={modalSelectClass}
                    disabled={mode === 'view'}
                  >
                    <option value="DRAFT">Nháp</option>
                    <option value="CREATED">Tạo mới (Chờ duyệt)</option>
                    {(mode === 'view' || mode === ('create_order' as any)) && (
                      <>
                        <option value="APPROVED">Chờ NCC xác nhận</option>
                        <option value="SUPPLIER_APPROVED">NCC đã xác nhận</option>
                        <option value="PARTIALLY_RECEIVED">Nhận một phần</option>
                        <option value="RECEIVED">Hoàn thành</option>
                        <option value="COMPLETED">Hoàn thành</option>
                        <option value="REJECTED">Từ chối</option>
                        <option value="CANCELLED">Đã hủy</option>
                      </>
                    )}
                  </select>
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
                              <select
                                value={item.productId}
                                onChange={(event) =>
                                  onProductChange(item.rowId, event.target.value)
                                }
                                className="h-11 w-full bg-transparent px-2 text-sm outline-none font-medium text-slate-700"
                              >
                                <option value="">Chọn sản phẩm</option>
                                {supplierProducts.map((supplierProduct) => (
                                  <option
                                    key={supplierProduct.id}
                                    value={supplierProduct.product?.id || ''}
                                  >
                                    {supplierProduct.product?.internalSku} -{' '}
                                    {supplierProduct.product?.name}
                                  </option>
                                ))}
                                {scannedProducts.map((sp) => {
                                  if (
                                    !supplierProducts.some(
                                      (p) => p.product?.id === sp.id
                                    )
                                  ) {
                                    return (
                                      <option key={sp.id} value={sp.id}>
                                        {sp.internalSku} - {sp.name} (Mới quét)
                                      </option>
                                    );
                                  }
                                  return null;
                                })}
                              </select>
                            ) : (
                              <div className="text-sm font-medium text-slate-700">
                                {supplierProducts.find((p) => p.product?.id === item.productId)?.product?.name ||
                                  scannedProducts.find((p) => p.id === item.productId)?.name ||
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
        <div className="flex justify-end gap-3 border-t border-slate-100 px-6 py-4 bg-gradient-to-r from-slate-50 to-white">
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl border-2 border-slate-200 px-6 py-2.5 font-bold text-slate-700 hover:bg-slate-100 transition"
          >
            Đóng
          </button>
          {mode === 'view' || mode === ('create_order' as any) ? (
            customActions
          ) : (
            <button
              type="submit"
              disabled={saving}
              className="rounded-2xl bg-cyan-600 px-8 py-2.5 font-bold text-white shadow-lg hover:bg-cyan-700 disabled:opacity-60 transition"
            >
              {saving
                ? 'Đang lưu...'
                : mode === 'edit'
                  ? 'Lưu thay đổi'
                  : 'Tạo đơn mua hàng'}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
