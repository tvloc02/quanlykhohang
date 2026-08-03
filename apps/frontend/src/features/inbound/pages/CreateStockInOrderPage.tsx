import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Plus,
  Trash2,
  Copy,
  Save,
  Printer,
  X,
  Building2,
  CheckCircle2,
  XCircle,
  FileText,
  DollarSign,
  Package,
  Workflow,
  Warehouse as WarehouseIcon
} from 'lucide-react';
import MainLayout from '../../../shared/components/MainLayout';

type Supplier = {
  id: string;
  supplierCode?: string;
  name: string;
  phone?: string;
  taxCode?: string;
};

type Product = {
  id: string;
  internalSku: string;
  name: string;
  unit?: string;
  purchasePrice?: number;
  salePrice?: number;
};

type Warehouse = {
  id: string;
  code: string;
  name: string;
  address?: string;
};

type OrderItemRow = {
  rowId: string;
  productId: string;
  productName: string;
  sku: string;
  unit: string;
  qty: number;
  price: number;
  discountPercent: number;
  totalAmount: number;
  warehouseCode: string;
  note: string;
};

const API_BASE_URL = 'http://localhost:3000/api';

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
  };
}

function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem('user') || '{}');
  } catch {
    return {};
  }
}

function formatMoney(amount: number) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount || 0);
}

function generateOrderCode() {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  return `PNK${dateStr}-${randomSuffix}`;
}

export default function CreateStockInOrderPage() {
  const navigate = useNavigate();
  const currentUser = getStoredUser();

  // Master Data
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [users, setUsers] = useState<Array<{ id: string; fullName?: string; email: string }>>([]);

  // Form Fields
  const [orderDate, setOrderDate] = useState<string>(() => {
    const d = new Date();
    return d.toISOString().slice(0, 16);
  });
  const [orderCode, setOrderCode] = useState<string>(() => generateOrderCode());
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');
  const [selectedWarehouseCode, setSelectedWarehouseCode] = useState<string>('KHO-NVL');
  const [assignedStaffEmail, setAssignedStaffEmail] = useState<string>(currentUser?.email || '');
  const [generalNote, setGeneralNote] = useState<string>('');

  // Calculations & Payment
  const [overallDiscountPercent, setOverallDiscountPercent] = useState<number>(0);
  const [vatRate, setVatRate] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'TRANSFER' | 'ATM'>('CASH');
  const [amountPaid, setAmountPaid] = useState<number>(0);

  // Table items (Initial 50 blank rows by default)
  const createEmptyRow = (index: number, defaultWhCode: string = 'KHO-NVL'): OrderItemRow => ({
    rowId: `row-${Date.now()}-${index}-${Math.random()}`,
    productId: '',
    productName: '',
    sku: '',
    unit: 'Cái',
    qty: 0,
    price: 0,
    discountPercent: 0,
    totalAmount: 0,
    warehouseCode: defaultWhCode,
    note: '',
  });

  const [items, setItems] = useState<OrderItemRow[]>(() =>
    Array.from({ length: 50 }, (_, i) => createEmptyRow(i, 'KHO-NVL'))
  );

  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(timer);
  }, [toast]);

  // Load master data
  useEffect(() => {
    async function loadMasterData() {
      try {
        const [supRes, prodRes, userRes, whRes] = await Promise.all([
          fetch(`${API_BASE_URL}/suppliers`, { headers: authHeaders() }).catch(() => null),
          fetch(`${API_BASE_URL}/products`, { headers: authHeaders() }).catch(() => null),
          fetch(`${API_BASE_URL}/users`, { headers: authHeaders() }).catch(() => null),
          fetch(`${API_BASE_URL}/warehouses`, { headers: authHeaders() }).catch(() => null),
        ]);

        if (supRes && supRes.ok) {
          const supData = await supRes.json();
          setSuppliers(Array.isArray(supData) ? supData : []);
          if (Array.isArray(supData) && supData.length > 0) {
            setSelectedSupplierId(supData[0].id);
          }
        }

        if (prodRes && prodRes.ok) {
          const prodData = await prodRes.json();
          setProducts(Array.isArray(prodData) ? prodData : prodData.data || []);
        }

        if (userRes && userRes.ok) {
          const userData = await userRes.json();
          setUsers(Array.isArray(userData) ? userData : userData.data || []);
        }

        if (whRes && whRes.ok) {
          const whData = await whRes.json();
          const list = Array.isArray(whData) ? whData : whData.data || [];
          setWarehouses(list);
          if (list.length > 0) {
            setSelectedWarehouseCode(list[0].code || 'KHO-NVL');
          }
        } else {
          try {
            const stored = JSON.parse(localStorage.getItem('warehouses') || '[]');
            if (Array.isArray(stored) && stored.length > 0) {
              setWarehouses(stored);
            }
          } catch {}
        }
      } catch (err) {
        console.error('Error loading master data:', err);
      }
    }
    loadMasterData();
  }, []);

  const handleWarehouseChange = (newCode: string) => {
    setSelectedWarehouseCode(newCode);
    setItems((prev) => prev.map((item) => ({ ...item, warehouseCode: newCode })));
  };

  const updateRow = (rowId: string, patch: Partial<OrderItemRow>) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.rowId !== rowId) return item;
        const updated = { ...item, ...patch };

        if (patch.productId && patch.productId !== item.productId) {
          const matchedProd = products.find((p) => p.id === patch.productId);
          if (matchedProd) {
            updated.productName = matchedProd.name;
            updated.sku = matchedProd.internalSku;
            updated.unit = matchedProd.unit || 'Cái';
            updated.price = matchedProd.purchasePrice || matchedProd.salePrice || 0;
            if (updated.qty === 0) updated.qty = 1;
          }
        }

        const lineTotal = updated.qty * updated.price * (1 - (updated.discountPercent || 0) / 100);
        updated.totalAmount = Math.max(0, lineTotal);
        return updated;
      })
    );
  };

  const handleAddBlankRow = () => {
    setItems((prev) => [...prev, createEmptyRow(prev.length, selectedWarehouseCode)]);
  };

  const handleRemoveRow = (rowId: string) => {
    setItems((prev) => prev.filter((item) => item.rowId !== rowId));
  };

  const handleDuplicateRow = (index: number) => {
    setItems((prev) => {
      const source = prev[index];
      if (!source) return prev;
      const duplicated: OrderItemRow = {
        ...source,
        rowId: `row-${Date.now()}-${Math.random()}`,
      };
      const next = [...prev];
      next.splice(index + 1, 0, duplicated);
      return next;
    });
    setToast({ type: 'success', message: `Đã nhân đôi dòng số ${index + 1}` });
  };

  const totalQty = useMemo(() => {
    return items.reduce((sum, item) => sum + (Number(item.qty) || 0), 0);
  }, [items]);

  const subTotal = useMemo(() => {
    return items.reduce((sum, item) => sum + (item.totalAmount || 0), 0);
  }, [items]);

  const discountAmount = useMemo(() => {
    return (subTotal * (overallDiscountPercent || 0)) / 100;
  }, [subTotal, overallDiscountPercent]);

  const vatAmount = useMemo(() => {
    const afterDiscount = subTotal - discountAmount;
    return (afterDiscount * (vatRate || 0)) / 100;
  }, [subTotal, discountAmount, vatRate]);

  const grandTotal = useMemo(() => {
    return Math.max(0, subTotal - discountAmount + vatAmount);
  }, [subTotal, discountAmount, vatAmount]);

  const remainingDebt = useMemo(() => {
    return Math.max(0, grandTotal - (amountPaid || 0));
  }, [grandTotal, amountPaid]);

  const handleSaveOrder = async (status: 'DRAFT' | 'READY' | 'COMPLETED') => {
    const validItems = items.filter((it) => it.productId && it.qty > 0);
    if (validItems.length === 0) {
      setToast({ type: 'error', message: 'Vui lòng chọn ít nhất 1 sản phẩm với số lượng > 0' });
      return;
    }

    setSaving(true);
    try {
      const poPayload = {
        poNumber: orderCode,
        supplierId: selectedSupplierId || undefined,
        warehouseCode: selectedWarehouseCode,
        orderDate,
        expectedDate: orderDate,
        status: status === 'COMPLETED' ? 'RECEIVED' : status === 'READY' ? 'APPROVED' : 'DRAFT',
        description: generalNote || 'Tạo phiếu nhập hàng từ nhà cung cấp',
        totalAmount: grandTotal,
        details: validItems.map((it) => ({
          productId: it.productId,
          warehouseCode: it.warehouseCode || selectedWarehouseCode,
          expectedQty: Number(it.qty),
          unitPrice: Number(it.price),
          receivedQty: status === 'COMPLETED' ? Number(it.qty) : 0,
        })),
      };

      const poRes = await fetch(`${API_BASE_URL}/inbound/purchase-orders`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(poPayload),
      });

      if (!poRes.ok) {
        const errData = await poRes.json().catch(() => null);
        throw new Error(errData?.message || 'Không tạo được đơn mua hàng');
      }

      const createdPO = await poRes.json();

      const stockInPayload = {
        orderCode: `PNK-${createdPO.poNumber || orderCode}`,
        note: generalNote || undefined,
        currentStepUserEmail: assignedStaffEmail || currentUser?.email,
        status: status,
      };

      await fetch(`${API_BASE_URL}/inbound/stock-in-orders/from-purchase-orders/${createdPO.id}`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(stockInPayload),
      }).catch(() => null);

      setToast({ type: 'success', message: `Tạo phiếu nhập kho thành công: ${orderCode}` });
      setTimeout(() => {
        navigate('/inbound/stock-in-orders');
      }, 1000);
    } catch (err) {
      setToast({ type: 'error', message: err instanceof Error ? err.message : 'Lỗi khi lưu phiếu nhập hàng' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <MainLayout>
      {/* Direct main page content without extra outer wrappers */}
      <div className="space-y-3 pb-28">
        {/* Toast alert */}
        {toast && (
          <div
            className={`fixed right-4 top-4 z-[9999] flex items-center gap-3 rounded-xl border bg-white px-4 py-3 shadow-2xl ${
              toast.type === 'error' ? 'border-red-200 text-red-600' : 'border-emerald-200 text-emerald-600'
            }`}
          >
            {toast.type === 'error' ? <XCircle className="h-5 w-5" /> : <CheckCircle2 className="h-5 w-5" />}
            <p className="text-sm font-bold">{toast.message}</p>
            <button type="button" onClick={() => setToast(null)} className="rounded-lg p-1 hover:bg-slate-100">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Top Header Strip with Quay lại button */}
        <div className="flex items-center justify-between gap-3">
          <div className="inline-flex items-center gap-2.5 rounded-xl border-2 border-cyan-500 bg-cyan-600 px-3.5 py-1.5 text-white shadow-md">
            <Workflow className="h-4 w-4 text-cyan-100" />
            <h1 className="text-base font-bold tracking-tight text-white uppercase">
              TẠO PHIẾU NHẬP KHO HÀNG HÓA
            </h1>
          </div>

          <button
            type="button"
            onClick={() => navigate('/inbound/stock-in-orders')}
            className="inline-flex items-center gap-2 rounded-xl border-2 border-cyan-500 bg-white px-4 py-1.5 text-xs font-bold text-cyan-700 shadow-sm hover:bg-cyan-50 transition cursor-pointer"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Quay lại</span>
          </button>
        </div>

        {/* Top Information Control Card (4 Columns: Ngày, Mã, Nhà cung cấp, Kho nhập) */}
        <div className="rounded-xl border-2 border-slate-200 bg-white p-3 shadow-sm">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Ngày nhập */}
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-700">Ngày nhập hàng</label>
              <input
                type="datetime-local"
                value={orderDate}
                onChange={(e) => setOrderDate(e.target.value)}
                className="h-9 w-full rounded-lg border-2 border-slate-200 bg-white px-3 text-xs font-semibold outline-none transition focus:border-cyan-500"
              />
            </div>

            {/* Mã HĐ */}
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-700">Mã phiếu / Lệnh</label>
              <input
                type="text"
                value={orderCode}
                onChange={(e) => setOrderCode(e.target.value)}
                placeholder="Tạo tự động"
                className="h-9 w-full rounded-lg border-2 border-slate-200 bg-slate-50 px-3 text-xs font-bold text-cyan-700 outline-none focus:border-cyan-500"
              />
            </div>

            {/* Chọn Nhà cung cấp */}
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-700 flex items-center gap-1">
                <Building2 className="h-3.5 w-3.5 text-cyan-600" />
                <span>Nhà cung cấp</span>
              </label>
              <select
                value={selectedSupplierId}
                onChange={(e) => setSelectedSupplierId(e.target.value)}
                className="h-9 w-full rounded-lg border-2 border-slate-200 bg-white px-3 text-xs font-bold text-slate-800 outline-none focus:border-cyan-500"
              >
                <option value="">-- Chọn nhà cung cấp --</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.supplierCode ? `[${s.supplierCode}] ` : ''}
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Chọn Kho nhập hàng (Button / Dropdown Control) */}
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-700 flex items-center gap-1">
                <WarehouseIcon className="h-3.5 w-3.5 text-cyan-600" />
                <span>Kho nhập hàng</span>
              </label>
              <select
                value={selectedWarehouseCode}
                onChange={(e) => handleWarehouseChange(e.target.value)}
                className="h-9 w-full rounded-lg border-2 border-cyan-500 bg-cyan-50/50 px-3 text-xs font-bold text-cyan-900 outline-none transition focus:border-cyan-600 cursor-pointer"
              >
                {warehouses.length > 0 ? (
                  warehouses.map((wh) => (
                    <option key={wh.id || wh.code} value={wh.code}>
                      [{wh.code}] {wh.name}
                    </option>
                  ))
                ) : (
                  <>
                    <option value="KHO-NVL">KHO-NVL - Kho nguyên vật liệu</option>
                    <option value="KH006">KH006 - Kho NVL Tổng hợp</option>
                    <option value="KH001">KH001 - Kho Hàng Hóa HCM</option>
                  </>
                )}
              </select>
            </div>
          </div>
        </div>

        {/* 2-Column Main Section: Left Table (Wider lg:col-span-9) + Right Payment Panel (Narrower lg:col-span-3) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
          {/* LEFT COLUMN: Product Table (9 Columns out of 12 for wider table) */}
          <div className="lg:col-span-9 flex flex-col rounded-xl border-2 border-slate-200 bg-white shadow-sm overflow-hidden">
            {/* Table Header Strip */}
            <div className="px-3 py-2 border-b-2 border-slate-200 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-2 text-cyan-700 font-bold text-xs">
                <Package className="h-4 w-4 text-cyan-600" />
                <span>THÔNG TIN HÀNG HÓA NHẬP KHO ({items.length} DÒNG - TỔNG SL: {totalQty})</span>
              </div>
              <button
                type="button"
                onClick={handleAddBlankRow}
                className="inline-flex items-center gap-1 rounded-lg bg-cyan-600 px-3 py-1 text-xs font-bold text-white shadow-sm hover:bg-cyan-700 transition cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Thêm dòng mới</span>
              </button>
            </div>

            {/* Product Table Container */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-slate-100 text-slate-700 font-bold border-b-2 border-slate-200 uppercase text-xs">
                  <tr>
                    <th className="p-2 w-10 text-center border-r border-slate-200 bg-slate-100">STT</th>
                    <th className="p-2 w-28 text-center border-r border-slate-200 bg-slate-100">MÃ SKU</th>
                    <th className="p-2 min-w-[200px] text-center border-r border-slate-200 bg-slate-100">TÊN HÀNG HÓA</th>
                    <th className="p-2 w-16 text-center border-r border-slate-200 bg-slate-100">ĐVT</th>
                    <th className="p-2 w-32 text-center border-r border-slate-200 bg-slate-100">KHO NHẬP</th>
                    <th className="p-2 w-20 text-center border-r border-slate-200 bg-slate-100">SỐ LƯỢNG</th>
                    <th className="p-2 w-28 text-center border-r border-slate-200 bg-slate-100">ĐƠN GIÁ (đ)</th>
                    <th className="p-2 w-16 text-center border-r border-slate-200 bg-slate-100">CK (%)</th>
                    <th className="p-2 w-32 text-center border-r border-slate-200 bg-slate-100">THÀNH TIỀN</th>
                    <th className="p-2 min-w-[120px] text-center border-r border-slate-200 bg-slate-100">GHI CHÚ</th>
                    <th className="p-2 w-20 text-center bg-slate-100">TT</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {items.map((row, idx) => {
                    const isEven = idx % 2 === 1;
                    return (
                      <tr
                        key={row.rowId}
                        className={`${
                          isEven ? 'bg-slate-50/50' : 'bg-white'
                        } hover:bg-cyan-50/50 transition-colors`}
                      >
                        {/* STT */}
                        <td className="p-1.5 text-center font-bold text-slate-500 border-r border-slate-200">
                          {idx + 1}.
                        </td>

                        {/* MÃ SKU */}
                        <td className="p-1 text-center font-bold text-cyan-800 border-r border-slate-200 bg-slate-50/50">
                          <input
                            type="text"
                            readOnly
                            value={row.sku || ''}
                            placeholder="Mã SKU"
                            className="w-full h-8 px-1 text-center bg-transparent font-bold text-cyan-800 outline-none text-xs"
                          />
                        </td>

                        {/* TÊN HÀNG HÓA */}
                        <td className="p-1 border-r border-slate-200">
                          <select
                            value={row.productId}
                            onChange={(e) => updateRow(row.rowId, { productId: e.target.value })}
                            className="w-full h-8 px-2 rounded border border-slate-300 bg-white font-medium text-slate-800 outline-none focus:border-cyan-500"
                          >
                            <option value="">-- Chọn sản phẩm --</option>
                            {products.map((p) => (
                              <option key={p.id} value={p.id}>
                                [{p.internalSku}] {p.name}
                              </option>
                            ))}
                          </select>
                        </td>

                        {/* ĐVT */}
                        <td className="p-1 text-center border-r border-slate-200">
                          <input
                            type="text"
                            value={row.unit}
                            onChange={(e) => updateRow(row.rowId, { unit: e.target.value })}
                            className="w-full h-8 text-center rounded border border-slate-300 bg-white font-medium outline-none focus:border-cyan-500"
                          />
                        </td>

                        {/* KHO NHẬP */}
                        <td className="p-1 border-r border-slate-200">
                          <select
                            value={row.warehouseCode || selectedWarehouseCode}
                            onChange={(e) => updateRow(row.rowId, { warehouseCode: e.target.value })}
                            className="w-full h-8 px-1.5 rounded border border-slate-300 bg-white font-semibold text-slate-800 text-xs outline-none focus:border-cyan-500"
                          >
                            {warehouses.length > 0 ? (
                              warehouses.map((wh) => (
                                <option key={wh.id || wh.code} value={wh.code}>
                                  {wh.code}
                                </option>
                              ))
                            ) : (
                              <>
                                <option value="KHO-NVL">KHO-NVL</option>
                                <option value="KH006">KH006</option>
                                <option value="KH001">KH001</option>
                              </>
                            )}
                          </select>
                        </td>

                        {/* SỐ LƯỢNG */}
                        <td className="p-1 border-r border-slate-200">
                          <input
                            type="number"
                            min="0"
                            value={row.qty || ''}
                            onChange={(e) => updateRow(row.rowId, { qty: Number(e.target.value) })}
                            className="w-full h-8 px-2 text-right rounded border border-slate-300 bg-white font-bold text-slate-900 outline-none focus:border-cyan-500"
                          />
                        </td>

                        {/* GIÁ */}
                        <td className="p-1 border-r border-slate-200">
                          <input
                            type="number"
                            min="0"
                            value={row.price || ''}
                            onChange={(e) => updateRow(row.rowId, { price: Number(e.target.value) })}
                            className="w-full h-8 px-2 text-right rounded border border-slate-300 bg-white font-medium text-slate-800 outline-none focus:border-cyan-500"
                          />
                        </td>

                        {/* CK (%) */}
                        <td className="p-1 border-r border-slate-200">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={row.discountPercent || ''}
                            onChange={(e) => updateRow(row.rowId, { discountPercent: Number(e.target.value) })}
                            className="w-full h-8 px-2 text-right rounded border border-slate-300 bg-white font-medium text-slate-700 outline-none focus:border-cyan-500"
                          />
                        </td>

                        {/* THÀNH TIỀN */}
                        <td className="p-1.5 text-right font-black text-cyan-700 border-r border-slate-200">
                          {formatMoney(row.totalAmount)}
                        </td>

                        {/* GHI CHÚ */}
                        <td className="p-1 border-r border-slate-200">
                          <input
                            type="text"
                            value={row.note}
                            onChange={(e) => updateRow(row.rowId, { note: e.target.value })}
                            placeholder="Ghi chú..."
                            className="w-full h-8 px-2 rounded border border-slate-300 bg-white font-normal text-slate-700 outline-none focus:border-cyan-500"
                          />
                        </td>

                        {/* TT (Actions) */}
                        <td className="p-1 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleDuplicateRow(idx)}
                              className="p-1 text-cyan-600 hover:text-cyan-800 hover:bg-cyan-50 rounded transition cursor-pointer"
                              title="Nhân đôi dòng"
                            >
                              <Copy className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveRow(row.rowId)}
                              className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition cursor-pointer"
                              title="Xóa dòng"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* RIGHT COLUMN: Payment & Summary Panel (Narrower lg:col-span-3) */}
          <div className="lg:col-span-3 rounded-xl border-2 border-slate-200 bg-white p-3 shadow-sm space-y-3 h-fit">
            <div className="flex items-center gap-2 border-b-2 border-slate-100 pb-2 text-cyan-700 font-bold text-xs">
              <DollarSign className="h-4 w-4 text-cyan-600" />
              <span>TỔNG CỘNG & THANH TOÁN</span>
            </div>

            {/* Nhân viên lập */}
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-700">Nhân viên lập phiếu</label>
              <select
                value={assignedStaffEmail}
                onChange={(e) => setAssignedStaffEmail(e.target.value)}
                className="h-8 w-full px-2 rounded border-2 border-slate-200 bg-white font-semibold text-slate-800 text-xs outline-none focus:border-cyan-500"
              >
                <option value={currentUser?.email || ''}>{currentUser?.fullName || currentUser?.email || 'NPT_User'}</option>
                {users.map((u) => (
                  <option key={u.id} value={u.email}>
                    {u.fullName || u.email}
                  </option>
                ))}
              </select>
            </div>

            {/* Ghi chú phiếu nhập */}
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-700">Ghi chú phiếu nhập</label>
              <textarea
                rows={2}
                value={generalNote}
                onChange={(e) => setGeneralNote(e.target.value)}
                placeholder="Nhập ghi chú..."
                className="w-full p-2 rounded border-2 border-slate-200 bg-white font-medium text-slate-700 outline-none focus:border-cyan-500 resize-none text-xs"
              />
            </div>

            {/* Chiết khấu & VAT */}
            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-100">
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700">Chiết khấu (%)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={overallDiscountPercent || ''}
                  onChange={(e) => setOverallDiscountPercent(Number(e.target.value))}
                  placeholder="0"
                  className="h-8 w-full text-right px-2 rounded border-2 border-slate-200 bg-white font-bold outline-none focus:border-cyan-500 text-xs"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700">Thuế VAT</label>
                <select
                  value={vatRate}
                  onChange={(e) => setVatRate(Number(e.target.value))}
                  className="h-8 w-full px-2 rounded border-2 border-slate-200 bg-white font-bold text-slate-800 outline-none focus:border-cyan-500 text-xs"
                >
                  <option value={0}>VAT 0%</option>
                  <option value={5}>VAT 5%</option>
                  <option value={8}>VAT 8%</option>
                  <option value={10}>VAT 10%</option>
                </select>
              </div>
            </div>

            {/* Highlight Total Card */}
            <div className="bg-cyan-50 border-2 border-cyan-200 rounded-xl p-2.5 space-y-1.5 text-xs">
              <div className="flex items-center justify-between text-slate-600 font-semibold">
                <span>Tổng SL sản phẩm:</span>
                <span className="font-bold text-slate-900">{totalQty}</span>
              </div>
              <div className="flex items-center justify-between text-slate-600 font-semibold">
                <span>Tiền hàng:</span>
                <span className="font-bold text-slate-900">{formatMoney(subTotal)}</span>
              </div>
              <div className="flex items-center justify-between text-slate-600 font-semibold">
                <span>Chiết khấu:</span>
                <span className="font-bold text-red-600">-{formatMoney(discountAmount)}</span>
              </div>
              <div className="flex items-center justify-between text-slate-600 font-semibold">
                <span>Thuế VAT ({vatRate}%):</span>
                <span className="font-bold text-cyan-800">+{formatMoney(vatAmount)}</span>
              </div>
              <div className="flex items-center justify-between pt-1.5 border-t border-cyan-200">
                <span className="font-black text-slate-900 text-xs">TỔNG THANH TOÁN:</span>
                <span className="font-black text-cyan-700 text-sm">{formatMoney(grandTotal)}</span>
              </div>
            </div>

            {/* Hình thức thanh toán */}
            <div className="space-y-2 pt-1 border-t border-slate-100">
              <label className="block text-xs font-bold text-slate-700">Hình thức thanh toán</label>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <label className="inline-flex items-center gap-1 cursor-pointer font-semibold text-slate-700">
                  <input
                    type="radio"
                    name="paymentMethod"
                    checked={paymentMethod === 'CASH'}
                    onChange={() => setPaymentMethod('CASH')}
                    className="accent-cyan-600"
                  />
                  <span>Tiền mặt</span>
                </label>
                <label className="inline-flex items-center gap-1 cursor-pointer font-semibold text-slate-700">
                  <input
                    type="radio"
                    name="paymentMethod"
                    checked={paymentMethod === 'TRANSFER'}
                    onChange={() => setPaymentMethod('TRANSFER')}
                    className="accent-cyan-600"
                  />
                  <span>Chuyển khoản</span>
                </label>
                <label className="inline-flex items-center gap-1 cursor-pointer font-semibold text-slate-700">
                  <input
                    type="radio"
                    name="paymentMethod"
                    checked={paymentMethod === 'ATM'}
                    onChange={() => setPaymentMethod('ATM')}
                    className="accent-cyan-600"
                  />
                  <span>ATM</span>
                </label>
              </div>

              <div className="space-y-1.5 pt-1">
                <div>
                  <label className="mb-0.5 block text-xs font-semibold text-slate-600">Tiền trả trước</label>
                  <input
                    type="number"
                    min="0"
                    value={amountPaid || ''}
                    onChange={(e) => setAmountPaid(Number(e.target.value))}
                    placeholder="0"
                    className="h-8 w-full text-right px-2 rounded border-2 border-slate-200 bg-white font-bold text-slate-900 outline-none focus:border-cyan-500 text-xs"
                  />
                </div>
                <div>
                  <label className="mb-0.5 block text-xs font-semibold text-slate-600">Còn nợ lại</label>
                  <div className="h-8 flex items-center justify-end px-2 rounded bg-slate-100 border-2 border-slate-200 font-black text-red-600 text-xs">
                    {formatMoney(remainingDebt)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* FLOATING ACTION BUTTONS BAR */}
        <div className="fixed bottom-4 right-6 z-[100] bg-white/95 backdrop-blur-md p-3 rounded-2xl border-2 border-cyan-500 shadow-2xl flex flex-col gap-2 w-80">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={() => handleSaveOrder('COMPLETED')}
              className="py-2.5 px-3 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white font-bold shadow-md transition flex items-center justify-center gap-1.5 text-xs cursor-pointer disabled:opacity-50"
            >
              <Save className="h-3.5 w-3.5" />
              <span>Lưu & Duyệt</span>
            </button>

            <button
              type="button"
              disabled={saving}
              onClick={() => handleSaveOrder('DRAFT')}
              className="py-2.5 px-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold shadow-sm transition flex items-center justify-center gap-1.5 text-xs cursor-pointer disabled:opacity-50"
            >
              <FileText className="h-3.5 w-3.5" />
              <span>Lưu Tạm</span>
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="py-2 px-3 rounded-xl border-2 border-indigo-500 bg-indigo-50 text-indigo-700 font-bold hover:bg-indigo-100 transition flex items-center justify-center gap-1.5 text-xs cursor-pointer"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>In Phiếu</span>
            </button>

            <button
              type="button"
              onClick={() => navigate('/inbound/stock-in-orders')}
              className="py-2 px-3 rounded-xl border-2 border-red-200 bg-red-50 text-red-600 font-bold hover:bg-red-100 transition flex items-center justify-center gap-1.5 text-xs cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
              <span>Hủy bỏ</span>
            </button>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
