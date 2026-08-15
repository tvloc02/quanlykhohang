import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Plus,
  Trash2,
  Copy,
  Save,
  X,
  CheckCircle2,
  XCircle,
  Package,
  Truck,
  Send,
  ArrowRight,
  Warehouse as WarehouseIcon,
  User,
  FileText,
  DollarSign
} from 'lucide-react';
import { deliveryApi } from '../api/deliveryApi';

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

type TransferRowItem = {
  rowId: string;
  productId: string;
  productName: string;
  sku: string;
  unit: string;
  qty: number;
  price: number;
  totalAmount: number;
  sourceWarehouseCode: string;
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

function generateTransferCode() {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  return `PXCN-${dateStr}-${randomSuffix}`;
}

export default function CreateTransferOrderPage() {
  const navigate = useNavigate();
  const currentUser = getStoredUser();

  // Master Data
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [users, setUsers] = useState<Array<{ id: string; fullName?: string; email: string }>>([]);

  // Form Fields
  const [orderDate, setOrderDate] = useState<string>(() => {
    const d = new Date();
    return d.toISOString().slice(0, 16);
  });
  const [transferCode, setTransferCode] = useState<string>(() => generateTransferCode());
  const [sourceWarehouseCode, setSourceWarehouseCode] = useState<string>('KHO-TONG');
  const [destinationWarehouseCode, setDestinationWarehouseCode] = useState<string>('KHO-CN-HCM');
  const [assignedStaffEmail, setAssignedStaffEmail] = useState<string>(currentUser?.email || '');
  const [generalNote, setGeneralNote] = useState<string>('');

  // Row Generator
  const createEmptyRow = (index: number, defaultSourceWh: string = 'KHO-TONG'): TransferRowItem => ({
    rowId: `row-${Date.now()}-${index}-${Math.random()}`,
    productId: '',
    productName: '',
    sku: '',
    unit: 'Cái',
    qty: 0,
    price: 0,
    totalAmount: 0,
    sourceWarehouseCode: defaultSourceWh,
    note: '',
  });

  // Table items (Initial 50 blank rows by default)
  const [items, setItems] = useState<TransferRowItem[]>(() =>
    Array.from({ length: 50 }, (_, i) => createEmptyRow(i, 'KHO-TONG'))
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
        const [prodRes, userRes, whRes] = await Promise.all([
          fetch(`${API_BASE_URL}/products`, { headers: authHeaders() }).catch(() => null),
          fetch(`${API_BASE_URL}/users`, { headers: authHeaders() }).catch(() => null),
          fetch(`${API_BASE_URL}/warehouses`, { headers: authHeaders() }).catch(() => null),
        ]);

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
          if (list.length >= 2) {
            setSourceWarehouseCode(list[0].code || 'KHO-TONG');
            setDestinationWarehouseCode(list[1].code || 'KHO-CN-HCM');
          } else if (list.length === 1) {
            setSourceWarehouseCode(list[0].code || 'KHO-TONG');
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
        console.error('Error loading master data for transfer:', err);
      }
    }
    loadMasterData();
  }, []);

  const handleSourceWarehouseChange = (newCode: string) => {
    setSourceWarehouseCode(newCode);
    setItems((prev) => prev.map((item) => ({ ...item, sourceWarehouseCode: newCode })));
  };

  const updateRow = (rowId: string, patch: Partial<TransferRowItem>) => {
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

        const lineTotal = updated.qty * updated.price;
        updated.totalAmount = Math.max(0, lineTotal);
        return updated;
      })
    );
  };

  const handleAddBlankRow = () => {
    setItems((prev) => [...prev, createEmptyRow(prev.length, sourceWarehouseCode)]);
  };

  const handleRemoveRow = (rowId: string) => {
    setItems((prev) => prev.filter((item) => item.rowId !== rowId));
  };

  const handleDuplicateRow = (index: number) => {
    setItems((prev) => {
      const source = prev[index];
      if (!source) return prev;
      const duplicated: TransferRowItem = {
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

  const grandTotal = useMemo(() => {
    return items.reduce((sum, item) => sum + (item.totalAmount || 0), 0);
  }, [items]);

  const handleSaveTransfer = async (status: 'DRAFT' | 'APPROVED' | 'IN_TRANSIT') => {
    const validItems = items.filter((it) => (it.productId || it.productName || it.sku) && it.qty > 0);
    if (validItems.length === 0) {
      setToast({ type: 'error', message: 'Vui lòng chọn ít nhất 1 sản phẩm với số lượng > 0' });
      return;
    }

    if (!sourceWarehouseCode || !destinationWarehouseCode) {
      setToast({ type: 'error', message: 'Vui lòng chọn đầy đủ Kho xuất và Kho nhập (Chi nhánh)' });
      return;
    }

    if (sourceWarehouseCode === destinationWarehouseCode) {
      setToast({ type: 'error', message: 'Kho xuất và Kho nhập chi nhánh không được trùng nhau' });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        transferNo: transferCode,
        sourceWarehouse: sourceWarehouseCode,
        destinationWarehouse: destinationWarehouseCode,
        scheduledDate: orderDate,
        status: status,
        note: generalNote || undefined,
        createdBy: assignedStaffEmail || currentUser?.fullName || currentUser?.email || 'NPT_Staff',
        items: validItems.map((it) => ({
          id: it.rowId,
          productCode: it.sku || `SKU-${it.productId}`,
          productName: it.productName || 'Sản phẩm điều chuyển',
          unit: it.unit || 'Cái',
          quantity: Number(it.qty),
          price: Number(it.price || 0),
        })),
      };

      await deliveryApi.createTransferOrder(payload);

      setToast({ type: 'success', message: `Tạo phiếu xuất chuyển chi nhánh thành công: ${transferCode}` });
      setTimeout(() => {
        navigate('/delivery');
      }, 1000);
    } catch (err) {
      setToast({ type: 'error', message: err instanceof Error ? err.message : 'Lỗi khi lưu phiếu xuất chuyển' });
    } finally {
      setSaving(false);
    }
  };

  return (
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
            <Send className="h-4 w-4 text-cyan-100" />
            <h1 className="text-base font-bold tracking-tight text-white uppercase">
              TẠO PHIẾU XUẤT CHUYỂN CHI NHÁNH (LẬP LỆNH ĐIỀU CHUYỂN KHO)
            </h1>
          </div>

          <button
            type="button"
            onClick={() => navigate('/delivery')}
            className="inline-flex items-center gap-2 rounded-xl border-2 border-cyan-500 bg-white px-4 py-1.5 text-xs font-bold text-cyan-700 shadow-sm hover:bg-cyan-50 transition cursor-pointer"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Quay lại</span>
          </button>
        </div>

        {/* Top Information Control Card (5 Columns: Ngày xuất, Mã lệnh, Kho xuất, Kho nhập chi nhánh, Nhân viên) */}
        <div className="rounded-xl border-2 border-slate-200 bg-white p-3 shadow-sm">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {/* Ngày xuất / điều chuyển */}
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-700">Ngày xuất / điều chuyển</label>
              <input
                type="datetime-local"
                value={orderDate}
                onChange={(e) => setOrderDate(e.target.value)}
                className="h-9 w-full rounded-lg border-2 border-slate-200 bg-white px-3 text-xs font-semibold outline-none transition focus:border-cyan-500"
              />
            </div>

            {/* Mã HĐ / Lệnh */}
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-700">Mã phiếu / Lệnh điều chuyển</label>
              <input
                type="text"
                value={transferCode}
                onChange={(e) => setTransferCode(e.target.value)}
                placeholder="Tạo tự động"
                className="h-9 w-full rounded-lg border-2 border-slate-200 bg-slate-50 px-3 text-xs font-bold text-cyan-700 outline-none focus:border-cyan-500"
              />
            </div>

            {/* Kho xuất (Kho nguồn) */}
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-700 flex items-center gap-1">
                <WarehouseIcon className="h-3.5 w-3.5 text-cyan-600" />
                <span>Kho xuất hàng (Kho nguồn)</span>
              </label>
              <select
                value={sourceWarehouseCode}
                onChange={(e) => handleSourceWarehouseChange(e.target.value)}
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
                    <option value="KHO-TONG">KHO-TONG - Kho Tổng Hà Nội</option>
                    <option value="KH001">KH001 - Kho Hàng Hóa HCM</option>
                    <option value="KHO-NVL">KHO-NVL - Kho nguyên vật liệu</option>
                  </>
                )}
              </select>
            </div>

            {/* Kho nhập (Chi nhánh nhận) */}
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-700 flex items-center gap-1">
                <ArrowRight className="h-3.5 w-3.5 text-emerald-600" />
                <span>Kho nhập (Kho nhận)</span>
              </label>
              <select
                value={destinationWarehouseCode}
                onChange={(e) => setDestinationWarehouseCode(e.target.value)}
                className="h-9 w-full rounded-lg border-2 border-emerald-500 bg-emerald-50/50 px-3 text-xs font-bold text-emerald-900 outline-none transition focus:border-emerald-600 cursor-pointer"
              >
                {warehouses.length > 0 ? (
                  warehouses.map((wh) => (
                    <option key={wh.id || wh.code} value={wh.code}>
                      [{wh.code}] {wh.name}
                    </option>
                  ))
                ) : (
                  <>
                    <option value="KHO-CN-HCM">KHO-CN-HCM - Chi nhánh TP.HCM</option>
                    <option value="KHO-CN-DN">KHO-CN-DN - Chi nhánh Đà Nẵng</option>
                    <option value="KH006">KH006 - Kho NVL Tổng hợp</option>
                  </>
                )}
              </select>
            </div>

            {/* Nhân viên phụ trách */}
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-700 flex items-center gap-1">
                <User className="h-3.5 w-3.5 text-cyan-600" />
                <span>Nhân viên điều chuyển</span>
              </label>
              <select
                value={assignedStaffEmail}
                onChange={(e) => setAssignedStaffEmail(e.target.value)}
                className="h-9 w-full rounded-lg border-2 border-slate-200 bg-white px-3 text-xs font-bold text-slate-800 outline-none focus:border-cyan-500 cursor-pointer"
              >
                <option value={currentUser?.email || ''}>{currentUser?.fullName || currentUser?.email || 'Nhân viên phụ trách'}</option>
                {users.map((u) => (
                  <option key={u.id} value={u.email}>
                    {u.fullName || u.email}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* 2-Column Main Section: Left Table (9 Cols) + Right Summary Panel (3 Cols) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
          {/* LEFT COLUMN: Product Table */}
          <div className="lg:col-span-9 flex flex-col rounded-xl border-2 border-slate-200 bg-white shadow-sm overflow-hidden">
            {/* Table Header Strip */}
            <div className="px-3 py-2 border-b-2 border-slate-200 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-2 text-cyan-700 font-bold text-xs">
                <Truck className="h-4 w-4 text-cyan-600" />
                <span>THÔNG TIN HÀNG HÓA XUẤT CHUYỂN ({items.length} DÒNG - TỔNG SL: {totalQty})</span>
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
                    <th className="p-2 w-32 text-center border-r border-slate-200 bg-slate-100">KHO XUẤT</th>
                    <th className="p-2 w-24 text-center border-r border-slate-200 bg-slate-100">SL XUẤT</th>
                    <th className="p-2 w-28 text-center border-r border-slate-200 bg-slate-100">ĐƠN GIÁ (đ)</th>
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
                            value={row.sku || ''}
                            onChange={(e) => updateRow(row.rowId, { sku: e.target.value })}
                            placeholder="SKU"
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

                        {/* KHO XUẤT */}
                        <td className="p-1 border-r border-slate-200">
                          <select
                            value={row.sourceWarehouseCode || sourceWarehouseCode}
                            onChange={(e) => updateRow(row.rowId, { sourceWarehouseCode: e.target.value })}
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
                                <option value="KHO-TONG">KHO-TONG</option>
                                <option value="KH001">KH001</option>
                                <option value="KHO-NVL">KHO-NVL</option>
                              </>
                            )}
                          </select>
                        </td>

                        {/* SỐ LƯỢNG XUẤT */}
                        <td className="p-1 border-r border-slate-200">
                          <input
                            type="number"
                            min="0"
                            value={row.qty || ''}
                            onChange={(e) => updateRow(row.rowId, { qty: Number(e.target.value) })}
                            className="w-full h-8 px-2 text-right rounded border border-slate-300 bg-white font-bold text-slate-900 outline-none focus:border-cyan-500"
                          />
                        </td>

                        {/* ĐƠN GIÁ */}
                        <td className="p-1 border-r border-slate-200">
                          <input
                            type="number"
                            min="0"
                            value={row.price || ''}
                            onChange={(e) => updateRow(row.rowId, { price: Number(e.target.value) })}
                            className="w-full h-8 px-2 text-right rounded border border-slate-300 bg-white font-medium text-slate-800 outline-none focus:border-cyan-500"
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
                            placeholder="Ghi chú dòng..."
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

          {/* RIGHT COLUMN: Payment & Summary Panel (3 Cols) */}
          <div className="lg:col-span-3 rounded-xl border-2 border-slate-200 bg-white p-3 shadow-sm space-y-3 h-fit">
            <div className="flex items-center gap-2 border-b-2 border-slate-100 pb-2 text-cyan-700 font-bold text-xs">
              <DollarSign className="h-4 w-4 text-cyan-600" />
              <span>TỔNG CỘNG & ĐIỀU CHUYỂN</span>
            </div>

            {/* Kho xuất & Kho nhập xem nhanh */}
            <div className="rounded-xl border-2 border-cyan-100 bg-cyan-50/60 p-2.5 space-y-1.5 text-xs">
              <div className="flex items-center justify-between font-bold text-slate-700">
                <span>Kho xuất (Nguồn):</span>
                <span className="text-cyan-800 font-black">{sourceWarehouseCode}</span>
              </div>
              <div className="flex items-center justify-between font-bold text-slate-700">
                <span>Kho nhập (Đích):</span>
                <span className="text-emerald-800 font-black">{destinationWarehouseCode}</span>
              </div>
            </div>

            {/* Ghi chú phiếu xuất chuyển */}
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-700">Ghi chú phiếu xuất chuyển</label>
              <textarea
                rows={3}
                value={generalNote}
                onChange={(e) => setGeneralNote(e.target.value)}
                placeholder="Nhập lý do điều chuyển, ghi chú phương tiện vận chuyển..."
                className="w-full p-2 rounded border-2 border-slate-200 bg-white font-medium text-slate-700 outline-none focus:border-cyan-500 resize-none text-xs"
              />
            </div>

            {/* Highlight Total Card */}
            <div className="bg-gradient-to-br from-cyan-50 to-emerald-50 border-2 border-cyan-200 rounded-xl p-3 space-y-2 text-xs">
              <div className="flex items-center justify-between text-slate-600 font-semibold">
                <span>Số mặt hàng xuất:</span>
                <span className="font-bold text-slate-900">{items.filter(it => it.qty > 0).length}</span>
              </div>
              <div className="flex items-center justify-between text-slate-600 font-semibold">
                <span>Tổng số lượng xuất:</span>
                <span className="font-bold text-slate-900">{totalQty}</span>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-cyan-200">
                <span className="font-black text-slate-900 text-xs">TỔNG GIÁ TRỊ HÀNG:</span>
                <span className="font-black text-cyan-700 text-sm">{formatMoney(grandTotal)}</span>
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
              onClick={() => handleSaveTransfer('APPROVED')}
              className="py-2.5 px-3 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white font-bold shadow-md transition flex items-center justify-center gap-1.5 text-xs cursor-pointer disabled:opacity-50"
            >
              <Save className="h-3.5 w-3.5" />
              <span>Lưu & Duyệt</span>
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => handleSaveTransfer('DRAFT')}
              className="py-2.5 px-3 rounded-xl border-2 border-cyan-500 bg-white hover:bg-cyan-50 text-cyan-700 font-bold shadow-sm transition flex items-center justify-center gap-1.5 text-xs cursor-pointer disabled:opacity-50"
            >
              <Save className="h-3.5 w-3.5" />
              <span>Lưu Nháp</span>
            </button>
          </div>
          <button
            type="button"
            onClick={() => navigate('/delivery')}
            className="w-full py-2 px-3 rounded-xl border border-slate-300 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition text-xs cursor-pointer"
          >
            Quay lại danh sách
          </button>
        </div>
      </div>
  );
}
