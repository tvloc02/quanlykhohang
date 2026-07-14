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
  unitPrice: string;
};

type OrderForm = {
  poNumber: string;
  supplierId: string;
  orderDate: string;
  expectedDate: string;
  status: 'CREATED' | 'APPROVED' | 'SUPPLIER_APPROVED' | 'PARTIALLY_RECEIVED' | 'RECEIVED' | 'CANCELLED';
  description: string;
  items: FormLine[];
  creatorName?: string;
  creatorPhone?: string;
  warehouseCode?: string;
  approverId?: string;
};


interface PurchaseOrderFormModalProps {
  isOpen: boolean;
  mode: 'create' | 'edit';
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
}

const modalSelectClass =
  'h-11 w-full rounded-2xl border-2 border-slate-200 bg-white px-4 pr-10 outline-none appearance-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10 text-slate-700 font-medium';

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
  onFormChange,
  onSubmit,
  onClose,
  onAddRow,
  onRemoveRow,
  onUpdateRow,
  onProductChange,
  onScannerOpen,
}: PurchaseOrderFormModalProps) {
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

  const totalAmount = form.items.reduce((sum, item) => {
    const expectedQty = parseMoney(item.expectedQty);
    const unitPrice = parseMoney(item.unitPrice);
    return sum + expectedQty * unitPrice;
  }, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
      <form
        onSubmit={onSubmit}
        className="max-h-[94vh] w-2/3 overflow-hidden rounded-3xl bg-white shadow-2xl flex flex-col"
      >
        {/* HEADER */}
        <div className="flex items-start justify-between border-b-2 border-slate-100 px-6 py-4 bg-gradient-to-r from-slate-50 to-white">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-cyan-100 p-2 text-cyan-700">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900">
                {mode === 'edit' ? 'Sửa đơn mua hàng' : 'Tạo đơn mua hàng'}
              </h3>
              <p className="text-sm font-medium text-slate-500">
                Nhập thông tin nhà cung cấp, kho và sản phẩm cần mua.
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
        <div className="max-h-[calc(94vh-160px)] overflow-y-auto flex-1 px-8 py-6 space-y-6">
          {/* THÔNG TIN CHUNG + TÍNH TRẠNG */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[2fr_1.5fr]">
            {/* PHÍA TRÁI: THÔNG TIN CHUNG */}
            <div className="rounded-2xl border-2 border-slate-200 bg-gradient-to-br from-slate-50 to-white p-6">
              <h4 className="mb-5 text-sm font-black uppercase text-slate-800">Thông tin chung</h4>

              {/* Row 1: Mã NCC */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 mb-4">
                <div>
                  <label className="mb-2 block text-sm font-bold text-slate-700">
                    Mã nhà cung cấp <span className="text-red-600">*</span>
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
                        {supplier.supplierCode} - {supplier.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Row 2: NCC Info */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 mb-4">
                <div>
                  <label className="mb-2 block text-sm font-bold text-slate-700">
                    Tên nhà cung cấp
                  </label>
                  <div className="flex h-11 items-center rounded-2xl border-2 border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-700">
                    {selectedSupplier?.name || '-'}
                  </div>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-bold text-slate-700">
                    Người liên hệ
                  </label>
                  <div className="flex h-11 items-center rounded-2xl border-2 border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-700">
                    {selectedSupplier?.contactPerson || '-'}
                  </div>
                </div>
              </div>

              {/* Row 3: Phone */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 mb-4">
                <div>
                  <label className="mb-2 block text-sm font-bold text-slate-700">
                    Số điện thoại
                  </label>
                  <div className="flex h-11 items-center rounded-2xl border-2 border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-700">
                    {selectedSupplier?.phone || '-'}
                  </div>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-bold text-slate-700">
                    Kho <span className="text-red-600">*</span>
                  </label>
                  <select
                    value={form.warehouseCode}
                    onChange={(event) => {
                      onFormChange({ ...form, warehouseCode: event.target.value });
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
              </div>

              {/* Row 4: Dates */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 mb-4">
                <div>
                  <label className="mb-2 block text-sm font-bold text-slate-700">
                    Ngày đơn hàng
                  </label>
                  <input
                    type="date"
                    value={form.orderDate}
                    onChange={(event) =>
                      onFormChange({ ...form, orderDate: event.target.value })
                    }
                    className={modalInputClass}
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-bold text-slate-700">
                    Ngày giao hàng
                  </label>
                  <input
                    type="date"
                    value={form.expectedDate}
                    onChange={(event) =>
                      onFormChange({ ...form, expectedDate: event.target.value })
                    }
                    className={modalInputClass}
                  />
                </div>
              </div>

              {/* Row 5: Diễn giải */}
              <div>
                <label className="mb-2 block text-sm font-bold text-slate-700">Diễn giải</label>
                <textarea
                  value={form.description}
                  onChange={(event) =>
                    onFormChange({ ...form, description: event.target.value })
                  }
                  rows={3}
                  className="w-full rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10 resize-none font-medium text-slate-700"
                  placeholder="Nhập ghi chú hoặc yêu cầu đặc biệt..."
                />
              </div>
            </div>

            {/* PHÍA PHẢI: TÍNH TRẠNG */}
            <div className="rounded-2xl border-2 border-slate-200 bg-gradient-to-br from-cyan-50 to-white p-6">
              <h4 className="mb-5 text-sm font-black uppercase text-slate-800">Tính trạng đơn hàng</h4>

              <div className="space-y-3">
                {/* Số đơn hàng */}
                <div>
                  <label className="mb-2 block text-xs font-bold uppercase text-slate-600">
                    Số đơn hàng
                  </label>
                  <div className="flex h-10 items-center rounded-xl border-2 border-slate-200 bg-white px-3 text-sm font-bold text-slate-900">
                    {form.poNumber || '(Tự động sinh)'}
                  </div>
                </div>

                {/* Ngày tạo đơn */}
                <div>
                  <label className="mb-2 block text-xs font-bold uppercase text-slate-600">
                    Ngày tạo đơn
                  </label>
                  <div className="flex h-10 items-center rounded-xl border-2 border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700">
                    {formatDate(form.orderDate)}
                  </div>
                </div>

                {/* Tình trạng nhập kho */}
                <div>
                  <label className="mb-2 block text-xs font-bold uppercase text-slate-600">
                    Tình trạng nhập kho
                  </label>
                  <div className="flex h-10 items-center rounded-xl border-2 border-slate-200 bg-white px-3">
                    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                      <Clock className="h-3 w-3" />
                      Chưa thực hiện
                    </span>
                  </div>
                </div>

                {/* Tình trạng nhận hàng */}
                <div>
                  <label className="mb-2 block text-xs font-bold uppercase text-slate-600">
                    Tình trạng nhận hàng
                  </label>
                  <div className="flex h-10 items-center rounded-xl border-2 border-slate-200 bg-white px-3">
                    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200">
                      Chưa giao
                    </span>
                  </div>
                </div>

                {/* Người duyệt */}
                <div>
                  <label className="mb-2 block text-xs font-bold uppercase text-slate-600">
                    Người duyệt <span className="text-red-600">*</span>
                  </label>
                  <select
                    value={form.approverId}
                    onChange={(event) =>
                      onFormChange({ ...form, approverId: event.target.value })
                    }
                    className="h-10 w-full rounded-xl border-2 border-slate-200 bg-white px-3 text-sm outline-none appearance-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10 font-medium text-slate-700"
                  >
                    <option value="">Chọn người duyệt</option>
                    {approversForWarehouse.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.fullName || user.email}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Tổng tiền */}
                <div className="mt-4 rounded-xl border-2 border-cyan-200 bg-cyan-50 p-3">
                  <p className="text-xs font-bold uppercase text-cyan-700">Tổng tiền dự kiến</p>
                  <p className="mt-1 text-xl font-black text-cyan-900">{formatMoney(totalAmount)}</p>
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
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border-2 border-slate-200">
              <div className="overflow-x-auto">
                <table className="w-full bg-white">
                  <thead className="bg-slate-50">
                    <tr className="border-b border-slate-200">
                      <th className="w-12 px-3 py-3 text-center text-xs font-semibold uppercase text-slate-700">
                        STT
                      </th>
                      <th className="px-3 py-3 text-center text-xs font-semibold uppercase text-slate-700">
                        Mặt hàng
                      </th>
                      <th className="w-24 px-3 py-3 text-center text-xs font-semibold uppercase text-slate-700">
                        SL yêu cầu
                      </th>
                      <th className="w-24 px-3 py-3 text-center text-xs font-semibold uppercase text-slate-700">
                        SL đã nhận
                      </th>
                      <th className="w-32 px-3 py-3 text-center text-xs font-semibold uppercase text-slate-700">
                        Đơn giá
                      </th>
                      <th className="w-24 px-3 py-3 text-center text-xs font-semibold uppercase text-slate-700">
                        Thành tiền
                      </th>
                      <th className="w-12 px-3 py-3 text-center text-xs font-semibold uppercase text-slate-700">
                        Xóa
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {form.items.map((item, index) => {
                      const expectedQty = parseMoney(item.expectedQty);
                      const unitPrice = parseMoney(item.unitPrice);
                      return (
                        <tr key={item.rowId} className="hover:bg-slate-50 transition">
                          <td className="px-3 py-3 text-center text-sm text-slate-600">
                            {index + 1}
                          </td>
                          <td className="px-3 py-3">
                            <select
                              value={item.productId}
                              onChange={(event) =>
                                onProductChange(item.rowId, event.target.value)
                              }
                              className={modalSelectClass}
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
                          </td>
                          <td className="px-3 py-3">
                            <input
                              type="number"
                              min={0}
                              value={item.expectedQty}
                              onChange={(event) =>
                                onUpdateRow(item.rowId, {
                                  expectedQty: event.target.value,
                                })
                              }
                              className="h-10 w-full rounded-xl border-2 border-slate-200 bg-white px-3 text-center text-sm outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10 font-medium"
                            />
                          </td>
                          <td className="px-3 py-3">
                            <input
                              type="number"
                              min={0}
                              value={item.receivedQty}
                              onChange={(event) =>
                                onUpdateRow(item.rowId, {
                                  receivedQty: event.target.value,
                                })
                              }
                              className="h-10 w-full rounded-xl border-2 border-slate-200 bg-white px-3 text-center text-sm outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10 font-medium"
                            />
                          </td>
                          <td className="px-3 py-3">
                            <input
                              type="number"
                              min={0}
                              value={item.unitPrice}
                              onChange={(event) =>
                                onUpdateRow(item.rowId, {
                                  unitPrice: event.target.value,
                                })
                              }
                              className="h-10 w-full rounded-xl border-2 border-slate-200 bg-white px-3 text-center text-sm outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10 font-medium"
                            />
                          </td>
                          <td className="px-3 py-3 text-center text-sm font-semibold text-slate-700">
                            {formatMoney(expectedQty * unitPrice)}
                          </td>
                          <td className="px-3 py-3 text-center">
                            <button
                              type="button"
                              onClick={() => onRemoveRow(item.rowId)}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border-2 border-red-200 bg-red-50 text-red-600 transition hover:bg-red-100 font-semibold"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </div>

        {/* FOOTER */}
        <div className="flex justify-end gap-3 border-t border-slate-100 px-6 py-4 bg-gradient-to-r from-slate-50 to-white">
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl border-2 border-slate-200 px-6 py-2.5 font-bold text-slate-700 hover:bg-slate-100 transition"
          >
            Hủy
          </button>
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
        </div>
      </form>
    </div>
  );
}
