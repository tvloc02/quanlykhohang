import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Plus,
  Trash2,
  Copy,
  Save,
  Printer,
  X,
  XCircle,
  CheckCircle2,
  Building2,
  Package,
  User,
  ScanLine,
  UserPlus,
  FileText,
  DollarSign,
  Warehouse as WarehouseIcon,
  Workflow,
  Maximize2,
  Minimize2,
  ChevronDown,
  Check,
  Scale,
  Box,
  Calculator,
} from 'lucide-react';
import MainLayout from '../../../shared/components/MainLayout';
import BarcodeScanner, { type ScannedProduct } from '../../../shared/components/BarcodeScanner';

// ─── TYPES & INTERFACES ────────────────────────────────────────

export interface ProductOption {
  id: string;
  internalSku: string;
  name: string;
  unit?: string;
  importPrice?: number;
  purchasePrice?: number;
  salePrice?: number;
  price?: number;
}

export interface SupplierOption {
  id: string;
  supplierCode?: string;
  name: string;
  phone?: string;
  address?: string;
  taxCode?: string;
}

export interface UserOption {
  id: string;
  fullName?: string;
  email: string;
  role?: string;
}

export interface WarehouseOption {
  id: string;
  code: string;
  name: string;
}

export interface FormDetailRow {
  rowId: string;
  productId: string;
  productSku: string;
  productName: string;
  unit: string;
  warehouseCode: string;
  qty: number;
  price: number;
  discountPercent: number;
  discountAmount: number;
  vatPercent: number;
  vatAmount: number;
  totalAmount: number;
  weight?: number;
  weightMode?: 'per_unit' | 'total';
  height?: number;
  length?: number;
  width?: number;
  volume?: number;
  volumetricWeight?: number;
  volumetricDivisor?: 5000 | 6000;
  expiryDate?: string;
  note: string;
}

// Format display text for numeric inputs with thousand separators (e.g. 1000 -> "1,000", 1000.5 -> "1,000.5")
function formatNumberWithCommas(value: number | string | undefined | null): string {
  if (value === undefined || value === null || value === '' || Number.isNaN(Number(value))) return '';
  const numStr = value.toString();
  const parts = numStr.split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return parts.join('.');
}

// Parse string formatted with commas back to number (e.g. "1,000.5" -> 1000.5)
function parseFormattedNumber(valueStr: string): number {
  if (!valueStr) return 0;
  const cleanStr = valueStr.replace(/,/g, '');
  const num = parseFloat(cleanStr);
  return Number.isNaN(num) ? 0 : num;
}

export interface InboundTab {
  tabId: string;
  title: string;
  id?: string;
  orderNo: string;
  warehouseCode: string;
  employeeName: string;
  supplierName: string;
  supplierId?: string;
  supplierPhone: string;
  supplierAddress: string;
  orderDate: string;
  expectedDate: string;
  description: string;
  discount: number;
  shippingFee: number;
  vatRate: number;
  paymentMethod: string;
  paymentAccount: string;
  amountPaid: number;
  status: string;
  details: FormDetailRow[];
}

const DEFAULT_ROWS_COUNT = 50;
const API_BASE_URL = 'http://localhost:3000/api';

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
  };
}

function generateOrderCode() {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  return `PNK${dateStr}-${randomSuffix}`;
}

function makeEmptyRow(index: number, defaultWhCode = 'KH006'): FormDetailRow {
  return {
    rowId: `row-${Date.now()}-${index}-${Math.random()}`,
    productId: '',
    productSku: '',
    productName: '',
    unit: 'Cái',
    warehouseCode: defaultWhCode,
    qty: 0,
    price: 0,
    discountPercent: 0,
    discountAmount: 0,
    vatPercent: 0,
    vatAmount: 0,
    totalAmount: 0,
    weight: 0,
    weightMode: 'per_unit',
    length: 0,
    width: 0,
    height: 0,
    volume: 0,
    volumetricWeight: 0,
    volumetricDivisor: 5000,
    expiryDate: '',
    note: '',
  };
}

function makeInitialRows(count = DEFAULT_ROWS_COUNT, defaultWhCode = 'KH006'): FormDetailRow[] {
  return Array.from({ length: count }, (_, i) => makeEmptyRow(i, defaultWhCode));
}

// ─── WEIGHT & VOLUME CALCULATION MODAL ─────────────────────────
interface WeightDimensionsModalProps {
  row: FormDetailRow | null;
  onClose: () => void;
  onSave: (rowId: string, updated: Partial<FormDetailRow>) => void;
}

const WeightDimensionsModal: React.FC<WeightDimensionsModalProps> = ({ row, onClose, onSave }) => {
  if (!row) return null;

  const currentQty = Math.max(1, row.qty || 1);

  // Independent Checkbox Toggles: User can check Section 1 (Loose/Total), Section 2 (Batch Ratio), or BOTH!
  const [enableSection1, setEnableSection1] = useState<boolean>(true);
  const [enableSection2, setEnableSection2] = useState<boolean>(false);

  // ─── MỤC 1: HÀNG HÓA RỜI / TOÀN BỘ PHIẾU (Tất cả số lượng) ───
  const [directWeightTotal, setDirectWeightTotal] = useState<number | ''>(
    row.weightMode === 'total' || !row.weight ? (row.weight || '') : ''
  );
  const [directLength, setDirectLength] = useState<number | ''>(row.length || '');
  const [directWidth, setDirectWidth] = useState<number | ''>(row.width || '');
  const [directHeight, setDirectHeight] = useState<number | ''>(row.height || '');

  // ─── MỤC 2: HÀNG HÓA THEO LÔ QUY ĐỔI / MẪU (N sản phẩm = X kg = D x R x C) ───
  const [batchSampleQty, setBatchSampleQty] = useState<number | ''>(row.qty || 1);
  const [batchSampleWeight, setBatchSampleWeight] = useState<number | ''>(
    row.weightMode === 'per_unit' ? (row.weight || '') : ''
  );
  const [batchLength, setBatchLength] = useState<number | ''>(row.length || '');
  const [batchWidth, setBatchWidth] = useState<number | ''>(row.width || '');
  const [batchHeight, setBatchHeight] = useState<number | ''>(row.height || '');

  // System settings
  const [divisor, setDivisor] = useState<5000 | 6000>(row.volumetricDivisor || 5000);

  // ─── CALCULATIONS ───
  // Section 1 Math (Direct Loose)
  const dWeight = enableSection1 ? (Number(directWeightTotal) || 0) : 0;
  const dL = enableSection1 ? (Number(directLength) || 0) : 0;
  const dW = enableSection1 ? (Number(directWidth) || 0) : 0;
  const dH = enableSection1 ? (Number(directHeight) || 0) : 0;
  const dVolPerUnit = dL * dW * dH;
  const dVolTotal = dVolPerUnit * currentQty;

  // Section 2 Math (Batch Sampling)
  const bSQty = Math.max(1, Number(batchSampleQty) || 1);
  const bSWeight = enableSection2 ? (Number(batchSampleWeight) || 0) : 0;
  const bL = enableSection2 ? (Number(batchLength) || 0) : 0;
  const bW = enableSection2 ? (Number(batchWidth) || 0) : 0;
  const bH = enableSection2 ? (Number(batchHeight) || 0) : 0;

  const bUnitWeight = bSWeight / bSQty;
  const bTotalWeight = bUnitWeight * currentQty;

  const bSampleVol = bL * bW * bH;
  const bUnitVol = bSampleVol / bSQty;
  const bTotalVol = bUnitVol * currentQty;

  // Final Merged Results logic:
  // If Section 2 is active, batch weight/volume takes priority for sampling ratio,
  // or if Section 1 is active, direct total weight/volume is used.
  let finalWeight = 0;
  let finalVolume = 0;
  let finalL = 0;
  let finalW = 0;
  let finalH = 0;

  if (enableSection2 && !enableSection1) {
    finalWeight = bTotalWeight;
    finalVolume = bTotalVol;
    finalL = bL;
    finalW = bW;
    finalH = bH;
  } else if (enableSection1 && !enableSection2) {
    finalWeight = dWeight;
    finalVolume = dVolTotal;
    finalL = dL;
    finalW = dW;
    finalH = dH;
  } else if (enableSection1 && enableSection2) {
    // Both active: Section 2 provides weight ratio if filled, Section 1 provides volume/dimensions if filled
    finalWeight = bTotalWeight > 0 ? bTotalWeight : dWeight;
    finalVolume = dVolTotal > 0 ? dVolTotal : bTotalVol;
    finalL = dL || bL;
    finalW = dW || bW;
    finalH = dH || bH;
  }

  const finalVolumetricWeight = (finalVolume * 1000000) / divisor;
  const finalChargeableWeight = Math.max(finalWeight, finalVolumetricWeight);

  const handleSave = () => {
    onSave(row.rowId, {
      weight: finalWeight,
      weightMode: enableSection2 ? 'per_unit' : 'total',
      length: finalL,
      width: finalW,
      height: finalH,
      volume: finalVolume,
      volumetricWeight: finalVolumetricWeight,
      volumetricDivisor: divisor,
    });
    onClose();
  };

  const handleClear = () => {
    onSave(row.rowId, {
      weight: 0,
      weightMode: 'total',
      length: 0,
      width: 0,
      height: 0,
      volume: 0,
      volumetricWeight: 0,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-[fadeIn_0.15s_ease-out]">
      <div className="w-full max-w-4xl rounded-2xl bg-white shadow-2xl border border-cyan-500/40 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between bg-cyan-700 px-6 py-3.5 text-white">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-800 border border-cyan-500/50 shadow-inner">
              <Scale className="h-5 w-5 text-cyan-200" />
            </div>
            <div>
              <h2 className="text-sm font-black uppercase tracking-wide">Cấu hình Trọng lượng & Thể tích Nhận diện Kho AI</h2>
              <p className="text-[11px] text-cyan-100 font-semibold truncate max-w-[550px]">
                {row.productName || 'Mặt hàng chưa chọn'} {row.productSku ? `(${row.productSku})` : ''} - Số lượng nhập: <span className="font-black text-white">{currentQty} {row.unit}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-cyan-200 hover:bg-cyan-600 hover:text-white transition cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Sub-header Instruction */}
        <div className="bg-cyan-50/80 px-6 py-2 border-b border-cyan-200 flex items-center justify-between text-xs text-cyan-950 font-bold">
          <span>💡 Bạn có thể chọn nhập 1 trong 2 mục hoặc TÍCH CHỌN CẢ 2 MỤC để kết hợp thông số:</span>
          <span className="text-[11px] font-semibold text-cyan-800">Tự động tối ưu không gian sắp xếp kho</span>
        </div>

        {/* Modal Body - 2 Separate Sections Side by Side */}
        <div className="p-6 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-6 text-xs text-slate-800">

          {/* ─────────────────────────────────────────────────────────────
              MỤC 1: TRỌNG LƯỢNG THEO LÔ HÀNG
             ───────────────────────────────────────────────────────────── */}
          <div className={`rounded-2xl border-2 p-4 flex flex-col justify-between transition-all ${
            enableSection1 ? 'border-cyan-500 bg-white shadow-md' : 'border-slate-200 bg-slate-50/70 opacity-60'
          }`}>
            <div className="space-y-3">
              {/* Section Header with Checkbox */}
              <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
                <label className="flex items-center gap-2 font-black text-slate-900 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={enableSection1}
                    onChange={(e) => setEnableSection1(e.target.checked)}
                    className="h-4 w-4 rounded accent-cyan-600 cursor-pointer"
                  />
                  <span className="uppercase text-cyan-900">Trọng lượng theo lô hàng</span>
                </label>
                <span className="text-[10px] font-extrabold bg-cyan-100 text-cyan-800 px-2 py-0.5 rounded-md">
                  Tất cả {currentQty} {row.unit}
                </span>
              </div>

              {/* Direct Weight for All */}
              <div className="space-y-1.5">
                <span className="block font-extrabold text-slate-700">1. Tổng trọng lượng toàn bộ lô (kg):</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  disabled={!enableSection1}
                  value={directWeightTotal}
                  onChange={(e) => setDirectWeightTotal(e.target.value === '' ? '' : parseFloat(e.target.value))}
                  placeholder={`Tổng trọng lượng ${currentQty} ${row.unit} (kg)`}
                  className="w-full h-9 px-3 rounded-xl border border-slate-300 bg-white font-black text-slate-900 outline-none focus:border-cyan-600 text-xs disabled:opacity-50"
                />
              </div>

              {/* Direct Dimensions for All */}
              <div className="space-y-1.5 pt-1">
                <span className="block font-extrabold text-slate-700">2. Kích thước Dài x Rộng x Cao (Mét):</span>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <span className="block text-[10px] text-slate-500 text-center font-bold">Dài (m)</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      disabled={!enableSection1}
                      value={directLength}
                      onChange={(e) => setDirectLength(e.target.value === '' ? '' : parseFloat(e.target.value))}
                      placeholder="Dài"
                      className="w-full h-9 px-2 text-center rounded-lg border border-slate-300 bg-white font-bold text-slate-900 outline-none focus:border-cyan-600 text-xs disabled:opacity-50"
                    />
                  </div>
                  <div>
                    <span className="block text-[10px] text-slate-500 text-center font-bold">Rộng (m)</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      disabled={!enableSection1}
                      value={directWidth}
                      onChange={(e) => setDirectWidth(e.target.value === '' ? '' : parseFloat(e.target.value))}
                      placeholder="Rộng"
                      className="w-full h-9 px-2 text-center rounded-lg border border-slate-300 bg-white font-bold text-slate-900 outline-none focus:border-cyan-600 text-xs disabled:opacity-50"
                    />
                  </div>
                  <div>
                    <span className="block text-[10px] text-slate-500 text-center font-bold">Cao (m)</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      disabled={!enableSection1}
                      value={directHeight}
                      onChange={(e) => setDirectHeight(e.target.value === '' ? '' : parseFloat(e.target.value))}
                      placeholder="Cao"
                      className="w-full h-9 px-2 text-center rounded-lg border border-slate-300 bg-white font-bold text-slate-900 outline-none focus:border-cyan-600 text-xs disabled:opacity-50"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Section 1 Output Badge */}
            <div className="mt-4 rounded-xl bg-slate-100 p-3 flex items-center justify-between text-xs font-bold text-slate-800">
              <span>Thể tích lô hàng:</span>
              <span className="text-cyan-900 font-black">{dVolTotal.toFixed(3)} m³</span>
            </div>
          </div>


          {/* ─────────────────────────────────────────────────────────────
              MỤC 2: TRỌNG LƯỢNG THEO SẢN PHẨM
             ───────────────────────────────────────────────────────────── */}
          <div className={`rounded-2xl border-2 p-4 flex flex-col justify-between transition-all ${
            enableSection2 ? 'border-cyan-500 bg-white shadow-md' : 'border-slate-200 bg-slate-50/70 opacity-60'
          }`}>
            <div className="space-y-3">
              {/* Section Header with Checkbox */}
              <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
                <label className="flex items-center gap-2 font-black text-slate-900 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={enableSection2}
                    onChange={(e) => setEnableSection2(e.target.checked)}
                    className="h-4 w-4 rounded accent-cyan-600 cursor-pointer"
                  />
                  <span className="uppercase text-cyan-900">Trọng lượng theo sản phẩm</span>
                </label>
                <span className="text-[10px] font-extrabold bg-amber-100 text-amber-900 px-2 py-0.5 rounded-md">
                  Quy đổi tỷ lệ
                </span>
              </div>

              {/* Sample Batch Input */}
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <span className="block font-extrabold text-slate-700 mb-1">Số lượng mẫu (SP):</span>
                  <input
                    type="number"
                    min="1"
                    disabled={!enableSection2}
                    value={batchSampleQty}
                    onChange={(e) => setBatchSampleQty(e.target.value === '' ? '' : parseFloat(e.target.value))}
                    placeholder="Số lượng mẫu"
                    className="w-full h-9 px-2.5 text-center rounded-xl border border-slate-300 bg-white font-extrabold text-slate-900 outline-none focus:border-cyan-600 text-xs disabled:opacity-50"
                  />
                </div>
                <div>
                  <span className="block font-extrabold text-slate-700 mb-1">Trọng lượng mẫu (kg):</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    disabled={!enableSection2}
                    value={batchSampleWeight}
                    onChange={(e) => setBatchSampleWeight(e.target.value === '' ? '' : parseFloat(e.target.value))}
                    placeholder="Trọng lượng mẫu (kg)"
                    className="w-full h-9 px-2.5 text-center rounded-xl border border-slate-300 bg-white font-extrabold text-slate-900 outline-none focus:border-cyan-600 text-xs disabled:opacity-50"
                  />
                </div>
              </div>

              {/* Batch Dimensions */}
              <div className="space-y-1.5 pt-1">
                <span className="block font-extrabold text-slate-700">Kích thước Lô mẫu / Thùng mẫu (Mét):</span>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <span className="block text-[10px] text-slate-500 text-center font-bold">Dài (m)</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      disabled={!enableSection2}
                      value={batchLength}
                      onChange={(e) => setBatchLength(e.target.value === '' ? '' : parseFloat(e.target.value))}
                      placeholder="Dài"
                      className="w-full h-9 px-2 text-center rounded-lg border border-slate-300 bg-white font-bold text-slate-900 outline-none focus:border-cyan-600 text-xs disabled:opacity-50"
                    />
                  </div>
                  <div>
                    <span className="block text-[10px] text-slate-500 text-center font-bold">Rộng (m)</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      disabled={!enableSection2}
                      value={batchWidth}
                      onChange={(e) => setBatchWidth(e.target.value === '' ? '' : parseFloat(e.target.value))}
                      placeholder="Rộng"
                      className="w-full h-9 px-2 text-center rounded-lg border border-slate-300 bg-white font-bold text-slate-900 outline-none focus:border-cyan-600 text-xs disabled:opacity-50"
                    />
                  </div>
                  <div>
                    <span className="block text-[10px] text-slate-500 text-center font-bold">Cao (m)</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      disabled={!enableSection2}
                      value={batchHeight}
                      onChange={(e) => setBatchHeight(e.target.value === '' ? '' : parseFloat(e.target.value))}
                      placeholder="Cao"
                      className="w-full h-9 px-2 text-center rounded-lg border border-slate-300 bg-white font-bold text-slate-900 outline-none focus:border-cyan-600 text-xs disabled:opacity-50"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Section 2 Output Badge */}
            <div className="mt-4 rounded-xl bg-slate-100 p-3 flex items-center justify-between text-xs font-bold text-slate-800">
              <span>Quy đổi ({currentQty} {row.unit}):</span>
              <span className="text-cyan-900 font-black">{bTotalWeight.toFixed(2)} kg | {bTotalVol.toFixed(3)} m³</span>
            </div>
          </div>

        </div>

        {/* ─────────────────────────────────────────────────────────────
            TỔNG HỢP THÔNG SỐ AI SẮP XẾP KHO (AI WMS WAREHOUSE METRICS)
           ───────────────────────────────────────────────────────────── */}
        <div className="mx-6 mb-4 bg-cyan-900 text-white p-4 rounded-2xl shadow-md border border-cyan-700 space-y-3">
          <div className="flex items-center justify-between border-b border-cyan-800 pb-2">
            <span className="uppercase text-xs font-black tracking-wide text-cyan-200 flex items-center gap-2">
              <Box className="h-4 w-4 text-cyan-300" />
              Tổng hợp Thông số AI Kho bãi & Vận tải ({currentQty} {row.unit})
            </span>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-cyan-200 font-bold uppercase">Hệ số cước:</span>
              <select
                value={divisor}
                onChange={(e) => setDivisor(Number(e.target.value) as 5000 | 6000)}
                className="h-6 px-2 rounded-md bg-cyan-950 border border-cyan-600 text-[11px] font-bold text-white outline-none cursor-pointer"
              >
                <option value={5000}>5000 (Air / Chuyển phát nhanh)</option>
                <option value={6000}>6000 (Đường bộ / Tiêu chuẩn)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="bg-cyan-800/80 p-2.5 rounded-xl border border-cyan-600/60">
              <span className="block text-[10px] uppercase font-bold text-cyan-200">Trọng lượng tổng</span>
              <span className="text-base font-black text-white">{finalWeight.toFixed(2)} <span className="text-xs font-bold text-cyan-200">kg</span></span>
            </div>
            <div className="bg-cyan-800/80 p-2.5 rounded-xl border border-cyan-600/60">
              <span className="block text-[10px] uppercase font-bold text-emerald-300">Thể tích xếp kho AI</span>
              <span className="text-base font-black text-emerald-300">{finalVolume.toFixed(3)} <span className="text-xs font-bold text-emerald-400">m³</span></span>
            </div>
            <div className="bg-amber-500/20 p-2.5 rounded-xl border border-amber-400/50">
              <span className="block text-[10px] uppercase font-extrabold text-amber-300">TL Quy đổi Thể tích (VW)</span>
              <span className="text-base font-black text-amber-200">{finalVolumetricWeight.toFixed(2)} <span className="text-xs font-bold text-amber-300">kg</span></span>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between bg-slate-100 px-6 py-3 border-t border-slate-200">
          <button
            type="button"
            onClick={handleClear}
            className="px-4 py-2 rounded-xl border border-rose-300 bg-rose-50 text-xs font-bold text-rose-700 hover:bg-rose-600 hover:text-white transition cursor-pointer"
          >
            Xóa dữ liệu
          </button>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-300 bg-white text-xs font-bold text-slate-700 hover:bg-slate-200 transition cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-6 py-2 rounded-xl bg-cyan-600 text-xs font-black text-white uppercase shadow-md hover:bg-cyan-700 transition cursor-pointer active:scale-95"
            >
              Lưu & Áp dụng
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

function createNewInboundTab(tabIndex = 1, currentUserName = 'Quản lý kho'): InboundTab {
  const d = new Date();
  const dateFormatted = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}T${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;

  return {
    tabId: `tab-${Date.now()}-${tabIndex}`,
    title: `# ${tabIndex}`,
    orderNo: generateOrderCode(),
    warehouseCode: 'KH006',
    employeeName: currentUserName || 'Quản lý kho',
    supplierName: '',
    supplierPhone: '',
    supplierAddress: '',
    orderDate: dateFormatted,
    expectedDate: dateFormatted,
    description: '',
    discount: 0,
    shippingFee: 0,
    vatRate: 0,
    paymentMethod: 'Tiền mặt',
    paymentAccount: '',
    amountPaid: 0,
    status: 'READY',
    details: makeInitialRows(DEFAULT_ROWS_COUNT, 'KH006'),
  };
}

export interface CreateStockInOrderPageProps {
  onBack?: () => void;
  standalone?: boolean;
}

export default function CreateStockInOrderPage({
  onBack,
  standalone = true,
}: CreateStockInOrderPageProps) {
  const navigate = useNavigate();

  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
  const currentUserName = currentUser.fullName || currentUser.email?.split('@')[0] || 'Quản lý kho';

  // Master Data
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseOption[]>([]);

  // Toast alert
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Modals & UI States
  const [showScannerModal, setShowScannerModal] = useState(false);
  const [showAddSupplierModal, setShowAddSupplierModal] = useState(false);
  const [newSupplierForm, setNewSupplierForm] = useState({ name: '', phone: '', address: '', supplierCode: '', taxCode: '' });

  // Dropdown states
  const [showSupplierDropdown, setShowSupplierDropdown] = useState(false);
  const [supplierSearch, setSupplierSearch] = useState('');
  const [showWarehouseDropdown, setShowWarehouseDropdown] = useState(false);
  const [showEmployeeDropdown, setShowEmployeeDropdown] = useState(false);
  const [showAccountDropdown, setShowAccountDropdown] = useState(false);
  const [activeProductDropdownRowId, setActiveProductDropdownRowId] = useState<string | null>(null);
  const [activeVolumeRowId, setActiveVolumeRowId] = useState<string | null>(null);
  const [weightModalRow, setWeightModalRow] = useState<FormDetailRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Synchronous Multi-Tab state with Session Storage restoration
  const [tabs, setTabs] = useState<InboundTab[]>(() => {
    try {
      const savedDraft = sessionStorage.getItem('inbound_tabs_draft');
      if (savedDraft) {
        const parsed = JSON.parse(savedDraft);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch { }
    return [createNewInboundTab(1, currentUserName)];
  });

  const [activeTabId, setActiveTabId] = useState<string>(() => {
    try {
      const savedActiveId = sessionStorage.getItem('inbound_active_tab_id');
      if (savedActiveId && tabs.some((t) => t.tabId === savedActiveId)) {
        return savedActiveId;
      }
    } catch { }
    return tabs && tabs[0] ? tabs[0].tabId : '';
  });

  const activeTab = useMemo(() => {
    return tabs.find((t) => t.tabId === activeTabId) || tabs[0];
  }, [tabs, activeTabId]);

  const handleAddNewTab = useCallback(() => {
    const newTabIndex = tabs.length + 1;
    const newTab = createNewInboundTab(newTabIndex, currentUserName);
    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(newTab.tabId);
    setToast({ message: `Đã mở tab tạo phiếu mới (#${newTabIndex})`, type: 'success' });
  }, [tabs.length, currentUserName]);

  const handleCloseTab = useCallback((tabIdToClose: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (tabs.length <= 1) {
      setToast({ message: 'Không thể đóng tab duy nhất', type: 'error' });
      return;
    }
    const nextTabs = tabs.filter((t) => t.tabId !== tabIdToClose);
    setTabs(nextTabs);
    if (activeTabId === tabIdToClose) {
      setActiveTabId(nextTabs[nextTabs.length - 1].tabId);
    }
  }, [tabs, activeTabId]);

  // Sync draft tabs to sessionStorage
  useEffect(() => {
    if (tabs && tabs.length > 0) {
      sessionStorage.setItem('inbound_tabs_draft', JSON.stringify(tabs));
      sessionStorage.setItem('inbound_active_tab_id', activeTabId);
    }
  }, [tabs, activeTabId]);

  // Toast auto-hide
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(timer);
  }, [toast]);

  // Click outside listener for dropdowns
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (
        !target.closest('.supplier-dropdown-box') &&
        !target.closest('.product-table-dropdown') &&
        !target.closest('.warehouse-dropdown-box') &&
        !target.closest('.employee-dropdown-box') &&
        !target.closest('.account-dropdown-box')
      ) {
        setShowSupplierDropdown(false);
        setActiveProductDropdownRowId(null);
        setShowWarehouseDropdown(false);
        setShowEmployeeDropdown(false);
        setShowAccountDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch Master Data
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
          const list = Array.isArray(supData) ? supData : supData.data || [];
          setSuppliers(list);
          if (list.length > 0 && !activeTab.supplierId) {
            updateActiveTab((tab) => ({
              ...tab,
              supplierId: list[0].id,
              supplierName: list[0].name,
              supplierPhone: list[0].phone || '',
              supplierAddress: list[0].address || '',
            }));
          }
        }

        if (prodRes && prodRes.ok) {
          const prodData = await prodRes.json();
          const list = Array.isArray(prodData) ? prodData : prodData.data || [];
          const normalized = list.map((p: any) => ({
            id: String(p.id),
            internalSku: p.internalSku || p.sku || '',
            name: p.name || '',
            unit: p.unit || 'Cái',
            importPrice: Number(p.importPrice || 0),
            purchasePrice: Number(p.importPrice || p.purchasePrice || p.price || 0),
            salePrice: Number(p.retailPrice || p.salePrice || p.price || 0),
            price: Number(p.importPrice || p.purchasePrice || p.price || 0),
          }));
          setProducts(normalized);
        }

        if (userRes && userRes.ok) {
          const userData = await userRes.json();
          const list = Array.isArray(userData) ? userData : userData.data || [];
          setUsers(list);
        }

        if (whRes && whRes.ok) {
          const whData = await whRes.json();
          const list = Array.isArray(whData) ? whData : whData.data || [];
          setWarehouses(list);
          if (list.length > 0) {
            const firstWhCode = list[0].code;
            setTabs((prevTabs) =>
              prevTabs.map((t) => {
                const isInvalid = !list.some((w: any) => w.code === t.warehouseCode);
                if (isInvalid || t.warehouseCode === 'KHO-NVL') {
                  return {
                    ...t,
                    warehouseCode: firstWhCode,
                    details: t.details.map((d) => ({
                      ...d,
                      warehouseCode: d.warehouseCode === 'KHO-NVL' || isInvalid ? firstWhCode : d.warehouseCode,
                    })),
                  };
                }
                return t;
              })
            );
          }
        }
      } catch (err) {
        console.error('Error loading master data:', err);
      }
    }
    loadMasterData();
  }, []);

  const handleBackNavigation = () => {
    sessionStorage.removeItem('inbound_tabs_draft');
    sessionStorage.removeItem('inbound_active_tab_id');
    if (onBack) {
      onBack();
    } else {
      navigate('/inbound/stock-in-orders');
    }
  };

  const updateActiveTab = useCallback(
    (updater: (prevTab: InboundTab) => InboundTab) => {
      setTabs((prevTabs) =>
        prevTabs.map((t) => (t.tabId === activeTabId ? updater(t) : t))
      );
    },
    [activeTabId]
  );

  const handleWarehouseChange = (newCode: string) => {
    updateActiveTab((tab) => ({
      ...tab,
      warehouseCode: newCode,
      details: tab.details.map((item) => ({ ...item, warehouseCode: newCode })),
    }));
  };

  const updateRow = (rowId: string, patch: Partial<FormDetailRow>) => {
    updateActiveTab((tab) => {
      const updatedDetails = tab.details.map((row) => {
        if (row.rowId !== rowId) return row;
        const newRow = { ...row, ...patch };

        if (patch.productId && patch.productId !== row.productId) {
          const p = products.find((prod) => prod.id === patch.productId);
          if (p) {
            newRow.productSku = p.internalSku;
            newRow.productName = p.name;
            newRow.unit = p.unit || 'Cái';
            newRow.price = p.importPrice || p.purchasePrice || p.price || 0;
            if (newRow.qty === 0) newRow.qty = 1;
          }
        }

        const qty = Number(newRow.qty) || 0;
        const price = Number(newRow.price) || 0;
        const discPercent = Number(newRow.discountPercent) || 0;
        const lineTotalBeforeDisc = qty * price;
        const discAmount = (lineTotalBeforeDisc * discPercent) / 100;
        const lineTotalAfterDisc = Math.max(0, lineTotalBeforeDisc - discAmount);
        const vatPercent = Number(newRow.vatPercent) || 0;
        const vatAmount = (lineTotalAfterDisc * vatPercent) / 100;

        newRow.discountAmount = discAmount;
        newRow.vatAmount = vatAmount;
        newRow.totalAmount = lineTotalAfterDisc + vatAmount;

        return newRow;
      });

      return { ...tab, details: updatedDetails };
    });
  };

  const handleAddBlankRow = () => {
    updateActiveTab((tab) => ({
      ...tab,
      details: [...tab.details, makeEmptyRow(tab.details.length, tab.warehouseCode)],
    }));
  };

  const handleDuplicateRow = (index: number) => {
    updateActiveTab((tab) => {
      const source = tab.details[index];
      if (!source) return tab;
      const dup: FormDetailRow = {
        ...source,
        rowId: `row-${Date.now()}-${Math.random()}`,
      };
      const next = [...tab.details];
      next.splice(index + 1, 0, dup);
      return { ...tab, details: next };
    });
    setToast({ message: `Đã nhân đôi dòng số ${index + 1}`, type: 'success' });
  };

  const handleRemoveRow = (rowId: string) => {
    updateActiveTab((tab) => ({
      ...tab,
      details: tab.details.filter((r) => r.rowId !== rowId),
    }));
  };

  const handleBarcodeScanned = (scanned: ScannedProduct) => {
    if (!scanned || !activeTab) return;

    const barcodeVal = scanned.supplierBarcode || scanned.internalSku || '';
    const priceVal = scanned.purchasePrice || scanned.salePrice || 0;

    // 1. Ưu tiên kiểm tra sản phẩm đã có trong bảng chưa, nếu có thì cộng dồn số lượng
    const existingIndex = activeTab.details.findIndex(
      (r) =>
        (r.productId && r.productId === scanned.id) ||
        (r.productSku && barcodeVal && r.productSku.toLowerCase() === barcodeVal.toLowerCase()) ||
        (r.productName && scanned.name && r.productName.toLowerCase() === scanned.name.toLowerCase())
    );

    if (existingIndex >= 0) {
      const existingRow = activeTab.details[existingIndex];
      const newQty = (Number(existingRow.qty) || 0) + 1;
      const unitP = Number(existingRow.price) || priceVal;
      const discPct = Number(existingRow.discountPercent) || 0;
      const totalAmount = newQty * unitP * (1 - discPct / 100);

      updateRow(existingRow.rowId, {
        qty: newQty,
        price: unitP,
        totalAmount: Math.max(0, totalAmount),
      });
      setToast({ message: `Đã tăng số lượng "${scanned.name}": ${newQty} ${existingRow.unit || 'Cái'}`, type: 'success' });
      return;
    }

    // 2. Nếu chưa có, kiểm tra dòng trống có sẵn để điền vào
    const emptyRow = activeTab.details.find((r) => !r.productId && !r.productName);
    if (emptyRow) {
      updateRow(emptyRow.rowId, {
        productId: scanned.id,
        productSku: barcodeVal,
        productName: scanned.name,
        unit: scanned.unit || 'Cái',
        price: priceVal,
        qty: 1,
        totalAmount: priceVal,
      });
    } else {
      // 3. Thêm dòng mới vào bảng
      const newRow = makeEmptyRow(activeTab.details.length, activeTab.warehouseCode);
      newRow.productId = scanned.id;
      newRow.productSku = barcodeVal;
      newRow.productName = scanned.name;
      newRow.unit = scanned.unit || 'Cái';
      newRow.price = priceVal;
      newRow.qty = 1;
      newRow.totalAmount = priceVal;

      updateActiveTab((tab) => ({ ...tab, details: [...tab.details, newRow] }));
    }
    setToast({ message: `Đã thêm sản phẩm: ${scanned.name}`, type: 'success' });
  };

  const handleAddQuickSupplier = async () => {
    if (!newSupplierForm.name.trim()) {
      setToast({ message: 'Vui lòng nhập tên nhà cung cấp', type: 'error' });
      return;
    }
    try {
      const res = await fetch(`${API_BASE_URL}/suppliers`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(newSupplierForm),
      });
      if (res.ok) {
        const created = await res.json();
        setSuppliers((prev) => [created, ...prev]);
        updateActiveTab((tab) => ({
          ...tab,
          supplierName: created.name,
          supplierId: created.id,
          supplierPhone: created.phone || '',
          supplierAddress: created.address || '',
        }));
        setShowAddSupplierModal(false);
        setNewSupplierForm({ name: '', phone: '', address: '', supplierCode: '', taxCode: '' });
        setToast({ message: `Đã thêm nhà cung cấp ${created.name}`, type: 'success' });
      }
    } catch {
      setToast({ message: 'Không thể thêm nhà cung cấp', type: 'error' });
    }
  };

  // Calculations for Active Tab
  const activeValidItems = useMemo(() => {
    if (!activeTab) return [];
    return activeTab.details.filter(
      (r) => (r.productId || r.productName?.trim() || r.productSku?.trim()) && r.qty > 0
    );
  }, [activeTab]);

  const totalQty = useMemo(() => {
    return activeValidItems.reduce((s, r) => s + (Number(r.qty) || 0), 0);
  }, [activeValidItems]);

  const totalVolume = useMemo(() => {
    return activeValidItems.reduce(
      (s, r) => s + (Number(r.volume) || (Number(r.height) || 0) * (Number(r.length) || 0) * (Number(r.width) || 0)),
      0
    );
  }, [activeValidItems]);

  const totalWeight = useMemo(() => {
    return activeValidItems.reduce((s, r) => s + (Number(r.weight) || 0), 0);
  }, [activeValidItems]);

  const totalVolumetricWeight = useMemo(() => {
    return activeValidItems.reduce((s, r) => s + (Number(r.volumetricWeight) || 0), 0);
  }, [activeValidItems]);

  const subtotal = useMemo(() => {
    return activeValidItems.reduce(
      (s, r) => s + (Number(r.totalAmount) || Number(r.qty) * Number(r.price)),
      0
    );
  }, [activeValidItems]);

  const discountAmount = useMemo(() => {
    return (subtotal * (activeTab?.discount || 0)) / 100;
  }, [subtotal, activeTab?.discount]);

  const vatAmount = useMemo(() => {
    const afterDiscount = subtotal - discountAmount;
    return (afterDiscount * (activeTab?.vatRate || 0)) / 100;
  }, [subtotal, discountAmount, activeTab?.vatRate]);

  const grandTotal = useMemo(() => {
    if (!activeTab) return 0;
    return Math.max(
      0,
      subtotal - discountAmount + (activeTab.shippingFee || 0) + vatAmount
    );
  }, [subtotal, discountAmount, activeTab, vatAmount]);

  const remainingDebt = useMemo(() => {
    if (!activeTab) return 0;
    return Math.max(0, grandTotal - (activeTab.amountPaid || 0));
  }, [grandTotal, activeTab]);

  const handleSaveInboundOrder = async (isPrint = false, saveStatus: 'DRAFT' | 'READY' | 'COMPLETED' = 'COMPLETED') => {
    if (!activeTab) return;
    if (activeValidItems.length === 0) {
      setToast({ message: 'Vui lòng chọn ít nhất 1 sản phẩm với số lượng > 0', type: 'error' });
      return;
    }

    setSaving(true);
    const generatedNo = activeTab.orderNo.trim()
      ? activeTab.orderNo.trim().toUpperCase()
      : generateOrderCode();

    const poPayload = {
      poNumber: generatedNo,
      supplierId: activeTab.supplierId || undefined,
      supplierName: activeTab.supplierName || undefined,
      supplierPhone: activeTab.supplierPhone || undefined,
      supplierAddress: activeTab.supplierAddress || undefined,
      warehouseCode: activeTab.warehouseCode || 'KHO-NVL',
      orderDate: activeTab.orderDate,
      expectedDate: activeTab.orderDate,
      status: saveStatus === 'COMPLETED' ? 'RECEIVED' : saveStatus === 'READY' ? 'APPROVED' : 'DRAFT',
      description: activeTab.description?.trim() || 'Tạo phiếu nhập hàng từ nhà cung cấp',
      totalAmount: grandTotal,
      discount: activeTab.discount || 0,
      vatRate: activeTab.vatRate || 0,
      vatAmount,
      shippingFee: activeTab.shippingFee || 0,
      amountPaid: activeTab.amountPaid || grandTotal,
      paymentMethod: activeTab.paymentMethod,
      paymentAccount: activeTab.paymentAccount,
      details: activeValidItems.map((r) => ({
        productId: r.productId,
        productSku: r.productSku,
        productName: r.productName,
        unit: r.unit,
        warehouseCode: r.warehouseCode || activeTab.warehouseCode || 'KHO-NVL',
        expectedQty: Number(r.qty),
        receivedQty: saveStatus === 'COMPLETED' ? Number(r.qty) : 0,
        unitPrice: Number(r.price),
        discountPercent: Number(r.discountPercent || 0),
        vatPercent: Number(r.vatPercent || 0),
        totalAmount: Number(r.totalAmount),
        weight: Number(r.weight || 0),
        length: Number(r.length || 0),
        width: Number(r.width || 0),
        height: Number(r.height || 0),
        volume: Number(r.volume || 0),
        volumetricWeight: Number(r.volumetricWeight || 0),
        note: r.note || '',
      })),
    };

    try {
      const res = await fetch(`${API_BASE_URL}/inbound/purchase-orders`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(poPayload),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.message || 'Không tạo được đơn nhập hàng');
      }

      const createdPO = await res.json();

      const stockInPayload = {
        orderCode: `PNK-${createdPO.poNumber || generatedNo}`,
        note: activeTab.description || undefined,
        currentStepUserEmail: currentUser?.email,
        status: saveStatus,
      };

      await fetch(`${API_BASE_URL}/inbound/stock-in-orders/from-purchase-orders/${createdPO.id}`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(stockInPayload),
      }).catch(() => null);

      setToast({
        message: `Đã lưu thành công phiếu nhập kho ${generatedNo}!`,
        type: 'success',
      });

      if (isPrint) {
        window.print();
      }

      setTimeout(() => {
        handleBackNavigation();
      }, 1000);
    } catch (err: any) {
      setToast({ message: err.message || 'Lỗi khi lưu phiếu nhập hàng', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const getFilteredProductsForRow = (rowText: string) => {
    const kw = (rowText || '').trim().toLowerCase();
    if (!kw) return products;
    const matched = products.filter(
      (p) => p.name.toLowerCase().includes(kw) || (p.internalSku || '').toLowerCase().includes(kw)
    );
    const nonMatched = products.filter((p) => !matched.includes(p));
    return [...matched, ...nonMatched];
  };

  const filteredSuppliers = useMemo(() => {
    const kw = supplierSearch.trim().toLowerCase();
    if (!kw) return suppliers;
    return suppliers.filter(
      (s) =>
        s.name.toLowerCase().includes(kw) ||
        (s.supplierCode || '').toLowerCase().includes(kw) ||
        (s.phone || '').toLowerCase().includes(kw)
    );
  }, [suppliers, supplierSearch]);

  const contentMarkup = (
    <div
      className={`animate-[fadeIn_0.2s_ease-out] flex flex-col gap-2.5 ${isFullscreen
        ? 'fixed inset-0 z-[9999] bg-slate-100 p-2.5 sm:p-3 h-screen overflow-hidden'
        : 'p-3 bg-slate-50 min-h-[calc(100vh-64px)]'
        }`}
    >
      {/* Toast Alert */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-[9999] flex items-center gap-3 rounded-xl px-5 py-3 shadow-xl transition-all border ${toast.type === 'error'
            ? 'bg-red-50 text-red-600 border-red-200'
            : 'bg-emerald-50 text-emerald-600 border-emerald-200'
            }`}
        >
          {toast.type === 'error' ? <XCircle size={20} /> : <CheckCircle2 size={20} />}
          <p className="text-sm font-bold">{toast.message}</p>
          <button onClick={() => setToast(null)} className="ml-2 rounded-lg p-1 hover:bg-white/50 transition cursor-pointer">
            <X size={16} />
          </button>
        </div>
      )}

      {/* Barcode Scanner Modal */}
      {showScannerModal && (
        <BarcodeScanner
          isOpen={showScannerModal}
          onProductFound={handleBarcodeScanned}
          onClose={() => setShowScannerModal(false)}
          title="Quét Mã Barcode Hàng Hóa Nhập Kho"
        />
      )}

      {/* Quick Supplier Add Modal */}
      {showAddSupplierModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl border border-slate-200 animate-[fadeIn_0.2s_ease-out]">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-4">
              <h3 className="text-base font-extrabold text-slate-800 flex items-center gap-2">
                <Building2 className="h-5 w-5 text-cyan-600" />
                <span>Thêm Nhanh Nhà Cung Cấp</span>
              </h3>
              <button onClick={() => setShowAddSupplierModal(false)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
                <X size={18} />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Mã NCC</label>
                <input
                  type="text"
                  placeholder="Tự động nếu để trống (NCC...)"
                  value={newSupplierForm.supplierCode}
                  onChange={(e) => setNewSupplierForm({ ...newSupplierForm, supplierCode: e.target.value })}
                  className="w-full h-9 rounded-lg border-2 border-slate-200 px-3 text-xs font-semibold outline-none focus:border-cyan-600"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Tên nhà cung cấp (*)</label>
                <input
                  type="text"
                  placeholder="Nhập tên nhà cung cấp"
                  value={newSupplierForm.name}
                  onChange={(e) => setNewSupplierForm({ ...newSupplierForm, name: e.target.value })}
                  className="w-full h-9 rounded-lg border-2 border-slate-200 px-3 text-xs font-semibold outline-none focus:border-cyan-600"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Số điện thoại</label>
                <input
                  type="text"
                  placeholder="SĐT liên hệ"
                  value={newSupplierForm.phone}
                  onChange={(e) => setNewSupplierForm({ ...newSupplierForm, phone: e.target.value })}
                  className="w-full h-9 rounded-lg border-2 border-slate-200 px-3 text-xs font-semibold outline-none focus:border-cyan-600"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Địa chỉ</label>
                <input
                  type="text"
                  placeholder="Địa chỉ nhà cung cấp"
                  value={newSupplierForm.address}
                  onChange={(e) => setNewSupplierForm({ ...newSupplierForm, address: e.target.value })}
                  className="w-full h-9 rounded-lg border-2 border-slate-200 px-3 text-xs font-semibold outline-none focus:border-cyan-600"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Mã số thuế</label>
                <input
                  type="text"
                  placeholder="MST nhà cung cấp"
                  value={newSupplierForm.taxCode}
                  onChange={(e) => setNewSupplierForm({ ...newSupplierForm, taxCode: e.target.value })}
                  className="w-full h-9 rounded-lg border-2 border-slate-200 px-3 text-xs font-semibold outline-none focus:border-cyan-600"
                />
              </div>
            </div>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowAddSupplierModal(false)}
                className="rounded-xl border-2 border-slate-300 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleAddQuickSupplier}
                className="rounded-xl bg-cyan-600 px-5 py-2 text-xs font-bold text-white shadow-md hover:bg-cyan-700"
              >
                Lưu Nhà Cung Cấp
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ 1. TOP HEADER BAR: Title (Left) & Tabs + Back (Right) ═══ */}
      {!isFullscreen && (
        <div className="flex items-center justify-between gap-3 flex-wrap flex-shrink-0">
          <div className="inline-flex items-center gap-2.5 rounded-xl bg-cyan-600 px-4 py-2 text-white shadow-sm">
            <Workflow className="h-5 w-5 text-cyan-100" />
            <h1 className="text-base font-black tracking-tight uppercase">TẠO PHIẾU NHẬP HÀNG HÓA</h1>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar">
            {/* MULTI-TAB SWITCHER */}
            {tabs.map((tab, idx) => {
              const isActive = tab.tabId === activeTabId;
              const validItemsCount = tab.details.filter((d) => d.productName && d.qty > 0).length;
              return (
                <div
                  key={tab.tabId}
                  onClick={() => setActiveTabId(tab.tabId)}
                  className={`group inline-flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-bold transition-all cursor-pointer border shadow-xs select-none ${isActive
                    ? 'bg-cyan-600 text-white border-cyan-600 shadow-md ring-2 ring-cyan-200'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-cyan-50 hover:border-cyan-300 hover:text-cyan-800'
                    }`}
                >
                  <FileText className={`h-3.5 w-3.5 ${isActive ? 'text-cyan-100' : 'text-cyan-600'}`} />
                  <span className="max-w-[140px] truncate">
                    {tab.orderNo ? tab.orderNo : `Phiếu #${idx + 1}`}
                  </span>
                  {validItemsCount > 0 && (
                    <span
                      className={`rounded-full px-1.5 py-0.2 text-[10px] font-extrabold ${isActive ? 'bg-white text-cyan-800' : 'bg-cyan-100 text-cyan-800'
                        }`}
                    >
                      {validItemsCount} SP
                    </span>
                  )}
                  {tabs.length > 1 && (
                    <button
                      type="button"
                      onClick={(e) => handleCloseTab(tab.tabId, e)}
                      className={`rounded p-0.5 transition ${isActive
                        ? 'hover:bg-cyan-700 text-cyan-200 hover:text-white'
                        : 'hover:bg-slate-200 text-slate-400 hover:text-red-500'
                        }`}
                      title="Đóng phiếu này"
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>
              );
            })}

            {/* Add New Tab Button */}
            <button
              type="button"
              onClick={handleAddNewTab}
              className="inline-flex items-center gap-1 rounded-xl border-2 border-dashed border-cyan-400 bg-cyan-50/60 px-3 py-1.5 text-xs font-bold text-cyan-700 hover:bg-cyan-100 hover:border-cyan-600 transition cursor-pointer"
              title="Tạo thêm phiếu nhập mới (Tab tiếp theo)"
            >
              <Plus size={14} className="text-cyan-700" />
              <span>+ Thêm phiếu mới</span>
            </button>

            <button
              type="button"
              onClick={handleBackNavigation}
              className="inline-flex items-center gap-1.5 rounded-xl border-2 border-cyan-500 bg-white px-4 py-1.5 text-xs font-bold text-cyan-700 hover:bg-cyan-50 transition shadow-xs cursor-pointer ml-1"
            >
              <ArrowLeft size={16} />
              <span>Quay lại</span>
            </button>
          </div>
        </div>
      )}

      {/* ═══ 2. FULL-WIDTH TOP CONTROL BAR (Horizontal bar spanning full width across page) ═══ */}
      <div className="w-full rounded-2xl border-2 border-cyan-500/30 bg-white p-4 shadow-md flex-shrink-0">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 items-center">
          {/* Ngày nhập hàng */}
          <div>
            <label className="mb-1.5 block text-xs font-black uppercase text-slate-700">Ngày nhập hàng</label>
            <input
              type="datetime-local"
              value={activeTab?.orderDate || ''}
              onChange={(e) => updateActiveTab((t) => ({ ...t, orderDate: e.target.value }))}
              className="h-10 w-full rounded-xl border-2 border-slate-300 bg-white px-3 text-sm font-bold text-slate-800 outline-none transition focus:border-cyan-600 focus:ring-2 focus:ring-cyan-500/20"
            />
          </div>

          {/* Mã phiếu nhập */}
          <div>
            <label className="mb-1.5 block text-xs font-black uppercase text-slate-700">Mã phiếu / Lệnh</label>
            <input
              type="text"
              value={activeTab?.orderNo || ''}
              onChange={(e) => updateActiveTab((t) => ({ ...t, orderNo: e.target.value }))}
              placeholder="TẠO TỰ ĐỘNG (PNK...)"
              className="h-10 w-full rounded-xl border-2 border-slate-300 bg-slate-50 px-3 text-sm font-extrabold text-cyan-900 uppercase outline-none focus:border-cyan-600"
            />
          </div>

          {/* Chọn Nhà cung cấp (Searchable Interactive Dropdown) */}
          <div className="relative supplier-dropdown-box">
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-xs font-black uppercase text-slate-700 flex items-center gap-1">
                <Building2 className="h-4 w-4 text-cyan-600" />
                <span>Nhà cung cấp</span>
              </label>
              <button
                type="button"
                onClick={() => setShowAddSupplierModal(true)}
                className="text-[11px] font-extrabold text-cyan-700 hover:underline flex items-center gap-0.5 cursor-pointer"
              >
                <UserPlus size={13} />
                <span>+ Thêm NCC</span>
              </button>
            </div>
            <input
              type="text"
              value={
                showSupplierDropdown
                  ? supplierSearch
                  : activeTab?.supplierName || ''
              }
              onChange={(e) => {
                setSupplierSearch(e.target.value);
                setShowSupplierDropdown(true);
              }}
              onFocus={() => {
                setSupplierSearch('');
                setShowSupplierDropdown(true);
              }}
              onClick={() => setShowSupplierDropdown(true)}
              placeholder="Tìm theo tên, mã NCC, SĐT..."
              className="h-10 w-full rounded-xl border-2 border-slate-300 bg-white px-3 text-sm font-bold text-slate-800 outline-none transition focus:border-cyan-600 cursor-text"
            />

            {showSupplierDropdown && (
              <div className="absolute left-0 top-full z-[100] mt-1 w-[400px] max-h-60 overflow-y-auto rounded-xl border border-slate-300 bg-white shadow-2xl flex flex-col">
                <div className="flex bg-slate-100 border-b border-slate-300 px-3 py-2 text-xs font-black text-slate-700 sticky top-0 z-10">
                  <span className="w-1/3 uppercase">Mã NCC</span>
                  <span className="w-1/3 uppercase">Tên nhà cung cấp</span>
                  <span className="w-1/3 text-right uppercase">SĐT</span>
                </div>
                <div className="overflow-y-auto flex-1 divide-y divide-slate-100">
                  {filteredSuppliers.length === 0 ? (
                    <div className="p-3 text-center text-xs text-slate-400">Không tìm thấy nhà cung cấp</div>
                  ) : (
                    filteredSuppliers.map((s) => (
                      <div
                        key={s.id}
                        onClick={() => {
                          updateActiveTab((tab) => ({
                            ...tab,
                            supplierName: s.name,
                            supplierId: s.id,
                            supplierPhone: s.phone || '',
                            supplierAddress: s.address || '',
                          }));
                          setShowSupplierDropdown(false);
                        }}
                        className="flex items-center px-3 py-2.5 hover:bg-cyan-50 cursor-pointer text-xs transition"
                      >
                        <span className="w-1/3 font-bold text-cyan-800">{s.supplierCode || 'NCC---'}</span>
                        <span className="w-1/3 font-bold text-slate-800 truncate pr-1">{s.name}</span>
                        <span className="w-1/3 text-right text-slate-500 font-semibold">{s.phone || '-'}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Chọn Kho nhập hàng (Custom Rounded Dropdown) */}
          <div className="relative warehouse-dropdown-box">
            <label className="mb-1.5 block text-xs font-black uppercase text-slate-700 flex items-center gap-1">
              <WarehouseIcon className="h-4 w-4 text-cyan-600" />
              <span>Kho nhập hàng</span>
            </label>
            <div
              onClick={() => setShowWarehouseDropdown((prev) => !prev)}
              className="h-10 w-full rounded-xl border-2 border-cyan-500 bg-cyan-50/70 px-3 text-sm font-bold text-cyan-900 flex items-center justify-between cursor-pointer shadow-xs transition hover:bg-cyan-100/70"
            >
              <span className="truncate">
                {warehouses.find((w) => w.code === activeTab?.warehouseCode)
                  ? `[${activeTab.warehouseCode}] ${warehouses.find((w) => w.code === activeTab.warehouseCode)?.name}`
                  : activeTab?.warehouseCode || 'KHO-NVL'}
              </span>
              <ChevronDown
                size={16}
                className={`text-cyan-700 transition-transform duration-200 ${showWarehouseDropdown ? 'rotate-180' : ''}`}
              />
            </div>

            {showWarehouseDropdown && (
              <div className="absolute left-0 top-full z-[100] mt-1.5 w-full rounded-xl border border-slate-200 bg-white p-1.5 shadow-2xl animate-[fadeIn_0.15s_ease-out]">
                <div className="max-h-60 overflow-y-auto custom-scrollbar space-y-1">
                  {(warehouses.length > 0
                    ? warehouses
                    : [
                        { id: '1', code: 'KHO-NVL', name: 'Kho nguyên vật liệu' },
                        { id: '2', code: 'KH006', name: 'Kho NVL Tổng hợp' },
                        { id: '3', code: 'KH001', name: 'Kho Hàng Hóa HCM' },
                      ]
                  ).map((wh) => {
                    const isSelected = wh.code === activeTab?.warehouseCode;
                    return (
                      <div
                        key={wh.id || wh.code}
                        onClick={() => {
                          handleWarehouseChange(wh.code);
                          setShowWarehouseDropdown(false);
                        }}
                        className={`flex items-center justify-between rounded-lg px-3 py-2.5 text-xs font-bold transition cursor-pointer ${
                          isSelected
                            ? 'bg-cyan-600 text-white shadow-xs'
                            : 'text-slate-700 hover:bg-cyan-50 hover:text-cyan-900'
                        }`}
                      >
                        <span>
                          [{wh.code}] {wh.name}
                        </span>
                        {isSelected && <Check size={14} className="text-white" />}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ═══ 3. MAIN 2-COLUMN BOTTOM LAYOUT (Left Product Table, Right Sleek Payment Panel) ═══ */}
      <div className={`flex flex-col lg:flex-row gap-3 items-stretch ${isFullscreen ? 'flex-1 min-h-0' : 'items-start'}`}>
        {/* ── LEFT COLUMN: PRODUCT TABLE (Expands to fill all remaining width) ── */}
        <div className={`flex-1 min-w-0 flex flex-col ${isFullscreen ? 'h-full' : ''}`}>
          {/* ═══ PRODUCT SELECTION TABLE CARD ═══ */}
          <div className={`flex flex-col rounded-xl border-2 border-slate-200 bg-white shadow-sm overflow-hidden min-h-0 ${isFullscreen ? 'flex-1 h-full' : ''}`}>
            {/* Table Header Controls */}
            <div className="px-3 py-2.5 border-b-2 border-slate-200 bg-slate-50 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-2 text-cyan-900 font-black text-xs sm:text-sm">
                <Package className="h-4 w-4 text-cyan-600" />
                <span>
                  THÔNG TIN HÀNG HÓA NHẬP KHO ({activeValidItems.length} MẶT HÀNG - TỔNG SL: {totalQty})
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowScannerModal(true)}
                  className="inline-flex items-center gap-1 rounded-lg border-2 border-cyan-600 bg-white px-3 py-1.5 text-xs font-bold text-cyan-700 hover:bg-cyan-50 transition cursor-pointer"
                >
                  <ScanLine className="h-4 w-4 text-cyan-600" />
                  <span>Quét Barcode</span>
                </button>

                <button
                  type="button"
                  onClick={handleAddBlankRow}
                  className="inline-flex items-center gap-1 rounded-lg bg-cyan-600 px-3.5 py-1.5 text-xs font-extrabold text-white shadow-sm hover:bg-cyan-700 transition cursor-pointer"
                >
                  <Plus className="h-4 w-4" />
                  <span>Thêm dòng mới</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsFullscreen(!isFullscreen)}
                  className="inline-flex items-center gap-1 rounded-lg border-2 border-cyan-500 bg-cyan-50 px-2.5 py-1.5 text-xs font-bold text-cyan-800 hover:bg-cyan-100 transition cursor-pointer shadow-xs"
                  title={isFullscreen ? 'Thu nhỏ cửa sổ' : 'Phóng to toàn màn hình'}
                >
                  {isFullscreen ? <Minimize2 className="h-4 w-4 text-cyan-700" /> : <Maximize2 className="h-4 w-4 text-cyan-700" />}
                  <span>{isFullscreen ? 'Thu nhỏ' : 'Phóng to'}</span>
                </button>
              </div>
            </div>

            {/* Grid Product Table */}
            <div className={`overflow-x-auto overflow-y-auto custom-scrollbar flex-1 min-h-0 ${isFullscreen ? '' : 'max-h-[calc(100vh-215px)]'}`}>
              <table className="w-full text-left border-collapse text-xs min-w-[1100px]">
                <thead className="bg-slate-100 text-slate-800 font-black border-b-2 border-slate-200 uppercase text-xs sticky top-0 z-10">
                  <tr>
                    <th className="p-2.5 w-12 text-center border-r border-slate-200 bg-slate-100">STT</th>
                    <th className="p-2.5 min-w-[220px] text-center border-r border-slate-200 bg-slate-100">TÊN HÀNG HÓA</th>
                    <th className="p-2.5 w-18 text-center border-r border-slate-200 bg-slate-100">ĐVT</th>
                    <th className="p-2.5 w-24 text-center border-r border-slate-200 bg-slate-100">SỐ LƯỢNG</th>
                    <th className="p-2.5 w-32 text-center border-r border-slate-200 bg-slate-100">ĐƠN GIÁ (đ)</th>
                    <th className="p-2.5 w-16 text-center border-r border-slate-200 bg-slate-100">CK (%)</th>
                    <th className="p-2.5 w-16 text-center border-r border-slate-200 bg-slate-100">VAT (%)</th>
                    <th className="p-2.5 w-32 text-center border-r border-slate-200 bg-slate-100">THÀNH TIỀN</th>
                    <th className="p-2.5 w-36 text-center border-r border-slate-200 bg-slate-100">HẠN SỬ DỤNG</th>
                    <th className="p-2.5 min-w-[130px] text-center border-r border-slate-200 bg-slate-100">GHI CHÚ</th>
                    <th className="p-2.5 w-44 text-center bg-slate-100 min-w-[150px]">THAO TÁC</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {activeTab?.details.map((row, idx) => {
                    const isEven = idx % 2 === 1;
                    const hasWeightOrVol = (row.weight || 0) > 0 || (row.volume || 0) > 0;
                    return (
                      <tr
                        key={row.rowId}
                        className={`${isEven ? 'bg-cyan-50/20' : 'bg-white'} hover:bg-cyan-50/80 transition-colors`}
                      >
                        {/* STT */}
                        <td className="p-2 text-center font-extrabold text-slate-600 border-r border-slate-200">
                          {idx + 1}.
                        </td>

                        {/* TÊN HÀNG HÓA - Searchable Interactive Inline Dropdown */}
                        <td className="p-1 border-r border-slate-200 relative product-table-dropdown">
                          <input
                            type="text"
                            value={row.productName ? `${row.productSku ? row.productSku + ' - ' : ''}${row.productName}` : ''}
                            onChange={(e) => {
                              const val = e.target.value;
                              updateRow(row.rowId, { productName: val });
                              setActiveProductDropdownRowId(row.rowId);
                            }}
                            onFocus={() => setActiveProductDropdownRowId(row.rowId)}
                            onClick={() => setActiveProductDropdownRowId(row.rowId)}
                            placeholder="Chọn hoặc nhập hàng..."
                            className="w-full h-9 px-2.5 rounded-lg border border-slate-300 bg-white font-bold text-slate-800 outline-none focus:border-cyan-600 text-xs sm:text-sm cursor-text"
                          />

                          {/* Interactive Table Dropdown for this row */}
                          {activeProductDropdownRowId === row.rowId && (
                            <div className="absolute left-0 top-full z-[100] mt-1 w-[450px] max-h-60 overflow-y-auto rounded-xl border border-slate-300 bg-white shadow-2xl flex flex-col">
                              <div className="flex bg-slate-100 border-b border-slate-300 px-3 py-2 text-xs font-bold text-slate-700 sticky top-0 z-10">
                                <span className="w-1/3 uppercase">Mã hàng</span>
                                <span className="w-1/2 uppercase">Tên hàng hóa</span>
                                <span className="w-1/4 text-right uppercase">Giá mua</span>
                              </div>
                              <div className="overflow-y-auto flex-1 divide-y divide-slate-100">
                                {getFilteredProductsForRow(row.productName || row.productSku).length === 0 ? (
                                  <div className="p-3 text-center text-xs text-slate-400">Không tìm thấy hàng hóa</div>
                                ) : (
                                  getFilteredProductsForRow(row.productName || row.productSku).map((p) => (
                                    <div
                                      key={p.id}
                                      onClick={() => {
                                        updateRow(row.rowId, {
                                          productId: p.id,
                                          productSku: p.internalSku,
                                          productName: p.name,
                                          unit: p.unit || 'Cái',
                                          price: p.purchasePrice || p.salePrice || p.price || 0,
                                          qty: row.qty === 0 ? 1 : row.qty,
                                        });
                                        setActiveProductDropdownRowId(null);
                                      }}
                                      className="flex items-center px-3 py-2.5 hover:bg-cyan-50 cursor-pointer text-xs text-slate-700 transition"
                                    >
                                      <span className="w-1/3 font-extrabold text-cyan-800">{p.internalSku}</span>
                                      <span className="w-1/2 font-bold text-slate-800 truncate pr-1">{p.name}</span>
                                      <span className="w-1/4 text-right font-extrabold text-slate-800">
                                        {Number(p.purchasePrice || p.salePrice || 0).toLocaleString('vi-VN')}
                                      </span>
                                    </div>
                                  ))
                                )}
                              </div>
                            </div>
                          )}
                        </td>

                        {/* ĐVT */}
                        <td className="p-1 text-center border-r border-slate-200">
                          <input
                            type="text"
                            value={row.unit}
                            onChange={(e) => updateRow(row.rowId, { unit: e.target.value })}
                            className="w-full h-9 text-center rounded-lg border border-slate-300 bg-white font-bold outline-none focus:border-cyan-600 text-xs sm:text-sm text-slate-800"
                          />
                        </td>

                        {/* SỐ LƯỢNG */}
                        <td className="p-1 border-r border-slate-200">
                          <input
                            type="number"
                            min="0"
                            value={row.qty === 0 ? '' : row.qty}
                            onChange={(e) => updateRow(row.rowId, { qty: Number(e.target.value) })}
                            placeholder="0"
                            className="w-full h-9 px-2 text-center rounded-lg border border-slate-300 bg-white font-black text-slate-900 outline-none focus:border-cyan-600 text-xs sm:text-sm"
                          />
                        </td>

                        {/* ĐƠN GIÁ (đ) với tự động thêm dấu phẩy ngàn */}
                        <td className="p-1 border-r border-slate-200">
                          <input
                            type="text"
                            value={row.price === 0 ? '' : formatNumberWithCommas(row.price)}
                            onChange={(e) => {
                              const parsed = parseFormattedNumber(e.target.value);
                              updateRow(row.rowId, { price: parsed });
                            }}
                            placeholder="0"
                            className="w-full h-9 px-2 text-right rounded-lg border border-slate-300 bg-white font-black text-slate-900 outline-none focus:border-cyan-600 text-xs sm:text-sm"
                          />
                        </td>

                        {/* CK (%) */}
                        <td className="p-1 border-r border-slate-200">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={row.discountPercent === 0 ? '' : row.discountPercent}
                            onChange={(e) => updateRow(row.rowId, { discountPercent: Number(e.target.value) })}
                            placeholder="0"
                            className="w-full h-9 text-center rounded-lg border border-slate-300 bg-white font-bold outline-none focus:border-cyan-600 text-xs sm:text-sm"
                          />
                        </td>

                        {/* VAT (%) */}
                        <td className="p-1 border-r border-slate-200">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={row.vatPercent === 0 ? '' : row.vatPercent}
                            onChange={(e) => updateRow(row.rowId, { vatPercent: Number(e.target.value) })}
                            placeholder="0"
                            className="w-full h-9 text-center rounded-lg border border-slate-300 bg-white font-bold outline-none focus:border-cyan-600 text-xs sm:text-sm"
                          />
                        </td>

                        {/* THÀNH TIỀN */}
                        <td className="p-2 text-right font-black text-cyan-900 border-r border-slate-200 bg-cyan-50/50 text-xs sm:text-sm">
                          {row.totalAmount.toLocaleString('vi-VN')}
                        </td>

                        {/* HẠN SỬ DỤNG */}
                        <td className="p-1 border-r border-slate-200">
                          <input
                            type="date"
                            value={row.expiryDate || ''}
                            onChange={(e) => updateRow(row.rowId, { expiryDate: e.target.value })}
                            className="w-full h-9 px-1.5 text-center rounded-lg border border-slate-300 bg-white font-bold text-slate-800 outline-none focus:border-cyan-600 text-xs sm:text-sm"
                          />
                        </td>

                        {/* GHI CHÚ */}
                        <td className="p-1 border-r border-slate-200">
                          <input
                            type="text"
                            value={row.note}
                            onChange={(e) => updateRow(row.rowId, { note: e.target.value })}
                            placeholder="Ghi chú..."
                            className="w-full h-9 px-2 rounded-lg border border-slate-300 bg-white font-medium text-slate-700 outline-none focus:border-cyan-600 text-xs sm:text-sm"
                          />
                        </td>

                        {/* THAO TÁC (Actions: Trọng lượng/Thể tích modal trigger, Duplicate, Delete) */}
                        <td className="p-1.5 text-center pr-2">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => setWeightModalRow(row)}
                              className={`flex h-8 w-8 items-center justify-center rounded-lg border shadow-2xs transition cursor-pointer ${
                                hasWeightOrVol
                                  ? 'border-cyan-600 bg-cyan-600 text-white shadow-xs hover:bg-cyan-700'
                                  : 'border-cyan-400 bg-cyan-50 text-cyan-700 hover:bg-cyan-600 hover:text-white hover:border-cyan-600'
                              }`}
                              title={
                                hasWeightOrVol
                                  ? `Trọng lượng: ${row.weight || 0} kg, Thể tích: ${(row.volume || 0).toFixed(3)} m³`
                                  : 'Cấu hình Trọng lượng & Thể tích'
                              }
                            >
                              <Scale size={16} strokeWidth={2.2} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDuplicateRow(idx)}
                              className="flex h-8 w-8 items-center justify-center rounded-lg border border-cyan-400 bg-cyan-50 text-cyan-700 shadow-2xs transition hover:bg-cyan-600 hover:text-white hover:border-cyan-600 cursor-pointer"
                              title="Nhân đôi dòng"
                            >
                              <Copy size={15} strokeWidth={2.2} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveRow(row.rowId)}
                              className="flex h-8 w-8 items-center justify-center rounded-lg border border-rose-300 bg-rose-50 text-rose-600 shadow-2xs transition hover:bg-rose-600 hover:text-white hover:border-rose-600 cursor-pointer"
                              title="Xóa dòng"
                            >
                              <Trash2 size={15} strokeWidth={2.2} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>

                {/* Professional Table Summary Footer */}
                <tfoot className="bg-cyan-100/90 font-black border-t-2 border-cyan-500 text-cyan-950 sticky bottom-0 z-10 shadow-md">
                  <tr>
                    <td className="p-2.5 text-center border-r border-cyan-200">TỔNG</td>
                    <td className="p-2.5 border-r border-cyan-200 uppercase">
                      <div className="flex items-center justify-between">
                        <span>{activeValidItems.length} MẶT HÀNG</span>
                        {(totalWeight > 0 || totalVolume > 0) && (
                          <span className="rounded-md bg-cyan-800 px-2 py-0.5 text-[10px] text-white font-extrabold shadow-2xs">
                            {totalWeight > 0 ? `${totalWeight.toFixed(2)} kg` : ''} {totalVolume > 0 ? `| ${totalVolume.toFixed(3)} m³` : ''}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-2.5 text-center border-r border-cyan-200">-</td>
                    <td className="p-2.5 text-center border-r border-cyan-200 font-black text-slate-900 text-sm">
                      {totalQty.toLocaleString('vi-VN')}
                    </td>
                    <td className="p-2.5 text-right border-r border-cyan-200">-</td>
                    <td className="p-2.5 text-center border-r border-cyan-200">-</td>
                    <td className="p-2.5 text-center border-r border-cyan-200">-</td>
                    <td className="p-2.5 text-right border-r border-cyan-200 text-sm text-cyan-900 font-black">
                      {subtotal.toLocaleString('vi-VN')} đ
                    </td>
                    <td className="p-2.5 text-center border-r border-cyan-200">-</td>
                    <td className="p-2.5 border-r border-cyan-200">-</td>
                    <td className="p-2.5 text-center font-extrabold text-cyan-900 text-xs">
                      {(totalWeight > 0 || totalVolume > 0) && (
                        <span>
                          TL: {totalWeight.toFixed(1)}kg {totalVolumetricWeight > 0 ? `(VW: ${totalVolumetricWeight.toFixed(1)}kg)` : ''}
                        </span>
                      )}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>

        {/* ── RIGHT COLUMN (Compact Sleek Width 310px): PAYMENT & FINANCIAL METADATA PANEL ── */}
        <div className={`w-full lg:w-[310px] xl:w-[320px] flex-shrink-0 rounded-xl border-2 border-slate-200 bg-white p-3 shadow-sm flex flex-col justify-between text-xs font-semibold text-slate-800 overflow-y-auto custom-scrollbar space-y-2.5 ${isFullscreen ? 'h-full' : 'h-fit sticky top-4'}`}>
          <div className="space-y-2">
            <div className="flex items-center gap-2 border-b-2 border-slate-100 pb-1.5 text-cyan-800 font-extrabold text-xs">
              <DollarSign className="h-4 w-4 text-cyan-600" />
              <span>TỔNG CỘNG & THANH TOÁN</span>
            </div>

            {/* Nhân viên lập phiếu (Custom Dropdown) */}
            <div className="relative employee-dropdown-box">
              <label className="mb-1 block text-xs font-bold text-slate-700">Nhân viên lập phiếu</label>
              <div
                onClick={() => setShowEmployeeDropdown((prev) => !prev)}
                className="h-10 w-full rounded-xl border-2 border-slate-300 bg-white px-3 text-xs sm:text-sm font-bold text-slate-800 flex items-center justify-between cursor-pointer outline-none hover:border-cyan-500 shadow-xs transition"
              >
                <span className="truncate">{activeTab?.employeeName || currentUserName}</span>
                <ChevronDown
                  size={16}
                  className={`text-slate-500 transition-transform duration-200 ${showEmployeeDropdown ? 'rotate-180' : ''}`}
                />
              </div>

              {showEmployeeDropdown && (
                <div className="absolute left-0 top-full z-[100] mt-1 w-full rounded-xl border border-slate-200 bg-white p-1.5 shadow-2xl animate-[fadeIn_0.15s_ease-out]">
                  <div className="max-h-52 overflow-y-auto custom-scrollbar space-y-1">
                    {[
                      { id: 'curr', name: currentUserName },
                      ...users.map((u) => ({ id: u.id, name: u.fullName || u.email })),
                    ]
                      .filter((v, i, a) => a.findIndex((t) => t.name === v.name) === i)
                      .map((userObj) => {
                        const isSelected = (activeTab?.employeeName || currentUserName) === userObj.name;
                        return (
                          <div
                            key={userObj.id}
                            onClick={() => {
                              updateActiveTab((t) => ({ ...t, employeeName: userObj.name }));
                              setShowEmployeeDropdown(false);
                            }}
                            className={`flex items-center justify-between rounded-lg px-3 py-2 text-xs font-bold transition cursor-pointer ${
                              isSelected
                                ? 'bg-cyan-600 text-white shadow-xs'
                                : 'text-slate-700 hover:bg-cyan-50 hover:text-cyan-900'
                            }`}
                          >
                            <span>{userObj.name}</span>
                            {isSelected && <Check size={14} className="text-white" />}
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}
            </div>

            {/* Ghi chú phiếu nhập */}
            <div>
              <label className="mb-0.5 block text-xs font-bold text-slate-700">Ghi chú phiếu nhập</label>
              <textarea
                rows={1}
                value={activeTab?.description || ''}
                onChange={(e) => updateActiveTab((t) => ({ ...t, description: e.target.value }))}
                placeholder="Nhập ghi chú..."
                className="w-full p-1.5 rounded-lg border-2 border-slate-200 bg-white font-medium text-slate-700 outline-none focus:border-cyan-600 resize-none text-xs"
              />
            </div>

            {/* Hình thức thanh toán Radios */}
            <div className="space-y-1.5 text-xs font-semibold text-slate-800 border-t border-slate-200 pt-1.5">
              <label className="block font-bold text-slate-700">Hình thức thanh toán:</label>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-1 cursor-pointer">
                  <input
                    type="radio"
                    name="inboundPaymentMethod"
                    value="Tiền mặt"
                    checked={(activeTab?.paymentMethod || 'Tiền mặt') === 'Tiền mặt'}
                    onChange={(e) => updateActiveTab((t) => ({ ...t, paymentMethod: e.target.value }))}
                    className="h-3.5 w-3.5 text-cyan-600 focus:ring-cyan-500 cursor-pointer"
                  />
                  <span>Tiền mặt</span>
                </label>
                <label className="flex items-center gap-1 cursor-pointer">
                  <input
                    type="radio"
                    name="inboundPaymentMethod"
                    value="Chuyển khoản"
                    checked={activeTab?.paymentMethod === 'Chuyển khoản'}
                    onChange={(e) => updateActiveTab((t) => ({ ...t, paymentMethod: e.target.value }))}
                    className="h-3.5 w-3.5 text-cyan-600 focus:ring-cyan-500 cursor-pointer"
                  />
                  <span>Chuyển khoản</span>
                </label>
                <label className="flex items-center gap-1 cursor-pointer">
                  <input
                    type="radio"
                    name="inboundPaymentMethod"
                    value="ATM"
                    checked={activeTab?.paymentMethod === 'ATM'}
                    onChange={(e) => updateActiveTab((t) => ({ ...t, paymentMethod: e.target.value }))}
                    className="h-3.5 w-3.5 text-cyan-600 focus:ring-cyan-500 cursor-pointer"
                  />
                  <span>ATM</span>
                </label>
              </div>

              {/* Tài khoản thanh toán (Custom Dropdown) */}
              <div className="relative account-dropdown-box mt-2">
                <label className="mb-1 block text-xs font-bold text-slate-700">Tài khoản thanh toán</label>
                <div
                  onClick={() => setShowAccountDropdown((prev) => !prev)}
                  className="h-10 w-full rounded-xl border-2 border-slate-300 bg-white px-3 text-xs sm:text-sm font-bold text-slate-800 flex items-center justify-between cursor-pointer outline-none hover:border-cyan-500 shadow-xs transition"
                >
                  <span className="truncate">
                    {activeTab?.paymentAccount || 'Chọn tài khoản thanh toán...'}
                  </span>
                  <ChevronDown
                    size={16}
                    className={`text-slate-500 transition-transform duration-200 ${showAccountDropdown ? 'rotate-180' : ''}`}
                  />
                </div>

                {showAccountDropdown && (
                  <div className="absolute left-0 top-full z-[100] mt-1 w-full rounded-xl border border-slate-200 bg-white p-1.5 shadow-2xl animate-[fadeIn_0.15s_ease-out]">
                    <div className="max-h-52 overflow-y-auto custom-scrollbar space-y-1">
                      {[
                        { code: '', label: 'Chưa chọn tài khoản' },
                        { code: 'Vietcombank - 1012345678 (Hà Nội)', label: 'Vietcombank - 1012345678 (Hà Nội)' },
                        { code: 'Techcombank - 1903456789 (HCM)', label: 'Techcombank - 1903456789 (HCM)' },
                        { code: 'MBBank - 999988887777 (Công ty)', label: 'MBBank - 999988887777 (Công ty)' },
                      ].map((acc) => {
                        const isSelected = activeTab?.paymentAccount === acc.code;
                        return (
                          <div
                            key={acc.label}
                            onClick={() => {
                              updateActiveTab((t) => ({ ...t, paymentAccount: acc.code }));
                              setShowAccountDropdown(false);
                            }}
                            className={`flex items-center justify-between rounded-lg px-3 py-2 text-xs font-bold transition cursor-pointer ${
                              isSelected
                                ? 'bg-cyan-600 text-white shadow-xs'
                                : 'text-slate-700 hover:bg-cyan-50 hover:text-cyan-900'
                            }`}
                          >
                            <span className="truncate">{acc.label}</span>
                            {isSelected && <Check size={14} className="text-white flex-shrink-0" />}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* ══ Light-Themed Cyan Financial Breakdown Box ══ */}
            <div className="rounded-xl border-2 border-cyan-200 bg-cyan-50/60 p-2.5 shadow-sm space-y-1.5 text-slate-800">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                <span>Thành tiền hàng:</span>
                <span className="font-extrabold text-slate-900">{subtotal.toLocaleString('vi-VN')} đ</span>
              </div>

              <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                <span>Chiết khấu (%):</span>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={activeTab?.discount || ''}
                  onChange={(e) => updateActiveTab((t) => ({ ...t, discount: Number(e.target.value) }))}
                  placeholder="0"
                  className="h-7 w-20 rounded bg-white px-2 text-right font-extrabold text-cyan-900 text-xs outline-none border border-slate-300 focus:border-cyan-600 shadow-xs"
                />
              </div>

              <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                <span>Thuế VAT (%):</span>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={activeTab?.vatRate || ''}
                  onChange={(e) => updateActiveTab((t) => ({ ...t, vatRate: Number(e.target.value) }))}
                  placeholder="0"
                  className="h-7 w-20 rounded bg-white px-2 text-right font-extrabold text-cyan-900 text-xs outline-none border border-slate-300 focus:border-cyan-600 shadow-xs"
                />
              </div>

              <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                <span>Phí vận chuyển:</span>
                <input
                  type="text"
                  value={activeTab?.shippingFee ? formatNumberWithCommas(activeTab.shippingFee) : ''}
                  onChange={(e) => updateActiveTab((t) => ({ ...t, shippingFee: parseFormattedNumber(e.target.value) }))}
                  placeholder="0"
                  className="h-7 w-24 rounded bg-white px-2 text-right font-extrabold text-cyan-900 text-xs outline-none border border-slate-300 focus:border-cyan-600 shadow-xs"
                />
              </div>

              <div className="border-t border-slate-300/80 pt-1.5 flex items-center justify-between">
                <span className="text-xs font-extrabold uppercase tracking-wide text-cyan-900">
                  TỔNG THÀNH TOÁN:
                </span>
                <span className="text-sm font-black text-cyan-700 tracking-tight">
                  {grandTotal.toLocaleString('vi-VN')} đ
                </span>
              </div>

              <div className="flex items-center justify-between text-xs font-semibold text-slate-700 pt-0.5">
                <span>Trả nhà cung cấp:</span>
                <input
                  type="text"
                  value={activeTab?.amountPaid ? formatNumberWithCommas(activeTab.amountPaid) : ''}
                  onChange={(e) => updateActiveTab((t) => ({ ...t, amountPaid: parseFormattedNumber(e.target.value) }))}
                  placeholder={formatNumberWithCommas(grandTotal)}
                  className="h-7 w-24 rounded bg-white px-2 text-right font-extrabold text-emerald-700 text-xs outline-none border border-slate-300 focus:border-cyan-600 shadow-xs"
                />
              </div>

              {remainingDebt > 0 && (
                <div className="flex items-center justify-between text-xs font-bold text-red-600 pt-1 border-t border-slate-200">
                  <span>Còn nợ lại NCC:</span>
                  <span className="font-extrabold">{remainingDebt.toLocaleString('vi-VN')} đ</span>
                </div>
              )}
            </div>
          </div>

          {/* Unified Large Prominent Action Buttons */}
          <div className="space-y-2 pt-2 flex-shrink-0">
            <button
              type="button"
              disabled={saving}
              onClick={() => handleSaveInboundOrder(true, 'COMPLETED')}
              className="w-full h-11 flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs sm:text-sm font-black uppercase tracking-wide text-white shadow-md hover:bg-emerald-700 transition active:scale-95 cursor-pointer disabled:opacity-50"
            >
              <Printer size={18} strokeWidth={2.2} />
              <span>Lưu & In phiếu nhập</span>
            </button>

            <button
              type="button"
              disabled={saving}
              onClick={() => handleSaveInboundOrder(false, 'COMPLETED')}
              className="w-full h-11 flex items-center justify-center gap-2 rounded-xl bg-cyan-700 px-4 py-2.5 text-xs sm:text-sm font-black uppercase tracking-wide text-white shadow-md hover:bg-cyan-800 transition active:scale-95 cursor-pointer disabled:opacity-50"
            >
              <Save size={18} strokeWidth={2.2} />
              <span>Lưu phiếu nhập kho</span>
            </button>

            <button
              type="button"
              disabled={saving}
              onClick={() => handleSaveInboundOrder(false, 'DRAFT')}
              className="w-full h-11 flex items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-xs sm:text-sm font-black uppercase tracking-wide text-white shadow-sm hover:bg-amber-600 transition active:scale-95 cursor-pointer disabled:opacity-50"
            >
              <FileText size={18} strokeWidth={2.2} />
              <span>Lưu tạm phiếu nhập</span>
            </button>

            <button
              type="button"
              onClick={handleBackNavigation}
              className="w-full h-11 flex items-center justify-center gap-2 rounded-xl border-2 border-slate-300 bg-white px-4 py-2.5 text-xs sm:text-sm font-black uppercase tracking-wide text-slate-700 hover:bg-slate-100 transition active:scale-95 cursor-pointer"
            >
              <ArrowLeft size={18} strokeWidth={2.2} />
              <span>Hủy / Quay lại</span>
            </button>
          </div>
        </div>
      </div>

      {/* Weight & Volume Configuration Modal */}
      {weightModalRow && (
        <WeightDimensionsModal
          row={weightModalRow}
          onClose={() => setWeightModalRow(null)}
          onSave={(rowId, updated) => updateRow(rowId, updated)}
        />
      )}
    </div>
  );

  if (standalone) {
    return <MainLayout>{contentMarkup}</MainLayout>;
  }

  return contentMarkup;
}
