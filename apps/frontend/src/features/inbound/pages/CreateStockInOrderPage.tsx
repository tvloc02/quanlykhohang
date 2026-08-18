import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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
  Sparkles,
  Bot,
  Send,
  MapPin,
  Layers,
  AlertCircle,
  Eye,
} from 'lucide-react';
import MainLayout from '../../../shared/components/MainLayout';
import BarcodeScanner, { type ScannedProduct } from '../../../shared/components/BarcodeScanner';
import { getStoredWarehouses, mergeStoredWarehouses, saveStoredWarehouses } from '../../../shared/utils/warehouseAssignments';
import { filterOutDeletedProducts } from '../../../shared/utils/productUtils';

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
  packageWeight?: number;
  weightMode?: 'per_unit' | 'total' | 'both';
  packageQty?: number;
  height?: number;
  length?: number;
  width?: number;
  volume?: number;
  volumetricWeight?: number;
  volumetricDivisor?: 5000 | 6000;
  expiryDate?: string;
  note: string;
  assignedBins?: string[];
  locationBin?: string;
}

export function formatLocationDisplay(row: { note?: string; assignedBins?: string[]; locationBin?: string }, idx: number) {
  if (row.assignedBins && row.assignedBins.length > 0) {
    const first = row.assignedBins[0];
    const isCold = first.startsWith('ZC') || first.includes('R03');
    const rackName = first.includes('R02') ? 'Dãy Kệ R02' : first.includes('R03') ? 'Dãy Kệ R03' : 'Dãy Kệ R01';
    return {
      zone: isCold ? 'Khu C (Kho Lạnh -18°C)' : 'Khu A (Kho Thường)',
      rack: rackName,
      bins: row.assignedBins.map((b) => b.split('-').pop() || b).join(', '),
      full: row.assignedBins.join(', '),
      isAssigned: true,
    };
  }
  if (row.locationBin && row.locationBin.trim()) {
    const binsArr = row.locationBin.split(',').map((s) => s.trim());
    const first = binsArr[0];
    const isCold = first.startsWith('ZC') || first.includes('R03');
    const rackName = first.includes('R02') ? 'Dãy Kệ R02' : first.includes('R03') ? 'Dãy Kệ R03' : 'Dãy Kệ R01';
    return {
      zone: isCold ? 'Khu C (Kho Lạnh -18°C)' : 'Khu A (Kho Thường)',
      rack: rackName,
      bins: binsArr.map((b) => b.split('-').pop() || b).join(', '),
      full: row.locationBin,
      isAssigned: true,
    };
  }
  if (row.note && row.note.includes('Vị trí Ô:')) {
    const match = row.note.match(/\[Vị trí Ô:\s*([^\]]+)\]/);
    if (match && match[1]) {
      const binsStr = match[1];
      const binsArr = binsStr.split(',').map((s) => s.trim());
      const first = binsArr[0];
      const isCold = first.startsWith('ZC') || first.includes('R03');
      const rackName = first.includes('R02') ? 'Dãy Kệ R02' : first.includes('R03') ? 'Dãy Kệ R03' : 'Dãy Kệ R01';
      return {
        zone: isCold ? 'Khu C (Kho Lạnh -18°C)' : 'Khu A (Kho Thường)',
        rack: rackName,
        bins: binsArr.map((b) => b.split('-').pop() || b).join(', '),
        full: binsStr,
        isAssigned: true,
      };
    }
  }
  const rackId = idx % 2 === 0 ? 'R01' : 'R02';
  const binNum = ((idx % 10) + 1).toString().padStart(2, '0');
  return {
    zone: 'Khu A (Kho Thường)',
    rack: `Dãy Kệ ${rackId}`,
    bins: `Tầng S04 - Ô C${binNum}`,
    full: `ZA-${rackId}-S04-C${binNum}`,
    isAssigned: false,
  };
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
  const cleanStr = String(valueStr).replace(/,/g, '');
  const num = parseFloat(cleanStr);
  return Number.isNaN(num) ? 0 : num;
}

interface FormattedNumberInputProps {
  value: number | undefined | null;
  disabled?: boolean;
  onChange: (val: number) => void;
  placeholder?: string;
  className?: string;
}

function FormattedNumberInput({
  value,
  disabled,
  onChange,
  placeholder = '0',
  className,
}: FormattedNumberInputProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [localStr, setLocalStr] = useState<string>('');

  useEffect(() => {
    if (!isFocused) {
      if (value === undefined || value === null || value === 0) {
        setLocalStr('');
      } else {
        setLocalStr(formatNumberWithCommas(value));
      }
    }
  }, [value, isFocused]);

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(true);
    if (value === undefined || value === null || value === 0) {
      setLocalStr('');
    } else {
      setLocalStr(String(value));
    }
    e.target.select();
  };

  const handleBlur = () => {
    setIsFocused(false);
    if (!localStr.trim()) {
      onChange(0);
      setLocalStr('');
      return;
    }
    const cleanStr = localStr.replace(/,/g, '');
    const parsed = parseFloat(cleanStr);
    if (Number.isNaN(parsed) || parsed === 0) {
      onChange(0);
      setLocalStr('');
    } else {
      onChange(parsed);
      setLocalStr(formatNumberWithCommas(parsed));
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const cleaned = raw.replace(/[^0-9.]/g, '');
    setLocalStr(cleaned);

    if (!cleaned) {
      onChange(0);
      return;
    }

    const parsed = parseFloat(cleaned);
    onChange(Number.isNaN(parsed) ? 0 : parsed);
  };

  return (
    <input
      type="text"
      disabled={disabled}
      value={isFocused ? localStr : (value && value !== 0 ? formatNumberWithCommas(value) : '')}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onChange={handleChange}
      placeholder={placeholder}
      className={className}
    />
  );
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
    assignedBins: [],
    locationBin: '',
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

  // The total import quantity from table (e.g. 1000 items)
  const totalImportQty = Math.max(1, row.qty || 1);

  // Loose packaging / sample batch size (e.g. 100 items per box)
  const [batchSampleQty, setBatchSampleQty] = useState<number | ''>(row.packageQty || 100);

  // Independent Checkbox Toggles: User can check Section 1 (Loose/Total), Section 2 (Batch Ratio), or BOTH!
  const [enableSection1, setEnableSection1] = useState<boolean>(() => {
    if (row.weightMode === 'per_unit') return false;
    return true;
  });
  const [enableSection2, setEnableSection2] = useState<boolean>(() => {
    if (row.weightMode === 'per_unit' || row.weightMode === 'both') return true;
    return false;
  });

  // ─── MỤC 1: HÀNG HÓA RỜI / TOÀN BỘ PHIẾU (Tất cả số lượng) ───
  const [directWeightTotal, setDirectWeightTotal] = useState<number | ''>(
    row.weightMode === 'total' || !row.weightMode || row.weightMode === 'both' ? (row.weight || '') : ''
  );
  const [directLength, setDirectLength] = useState<number | ''>(row.length || '');
  const [directWidth, setDirectWidth] = useState<number | ''>(row.width || '');
  const [directHeight, setDirectHeight] = useState<number | ''>(row.height || '');

  // ─── MỤC 2: HÀNG HÓA THEO LÔ QUY ĐỔI / MẪU (N sản phẩm = X kg = D x R x C) ───
  const [batchSampleWeight, setBatchSampleWeight] = useState<number | ''>(() => {
    if (row.packageWeight && row.packageWeight > 0) return row.packageWeight;
    if (row.weightMode === 'per_unit' && row.weight && row.packageQty) {
      const pkgs = Math.ceil(totalImportQty / row.packageQty);
      return pkgs > 0 ? Number((row.weight / pkgs).toFixed(2)) : row.weight;
    }
    return '';
  });
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
  const dVolTotal = dVolPerUnit * totalImportQty;

  // Section 2 Math (Batch Sampling / Loose Packaging)
  const bSQty = Math.max(1, Number(batchSampleQty) || 1);
  const totalPackages = Math.ceil(totalImportQty / bSQty);
  const bSWeight = enableSection2 ? (Number(batchSampleWeight) || 0) : 0;
  const bL = enableSection2 ? (Number(batchLength) || 0) : 0;
  const bW = enableSection2 ? (Number(batchWidth) || 0) : 0;
  const bH = enableSection2 ? (Number(batchHeight) || 0) : 0;

  const bUnitWeight = bSWeight / bSQty;
  const bTotalWeight = bSWeight * totalPackages;

  const bSampleVol = bL * bW * bH;
  const bUnitVol = bSampleVol / bSQty;
  const bTotalVol = bUnitVol * totalImportQty;

  // Final Merged Results logic:
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

  const handleSave = () => {
    onSave(row.rowId, {
      weight: finalWeight,
      packageWeight: enableSection2 ? (Number(batchSampleWeight) || 0) : 0,
      packageQty: bSQty,
      weightMode: enableSection1 && enableSection2 ? 'both' : enableSection2 ? 'per_unit' : 'total',
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
                {row.productName || 'Mặt hàng chưa chọn'} {row.productSku ? `(${row.productSku})` : ''} - Số lượng nhập trên đơn: <span className="font-black text-white">{totalImportQty.toLocaleString('vi-VN')} {row.unit}</span>
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
                  Tất cả {totalImportQty.toLocaleString('vi-VN')} {row.unit}
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
                  placeholder={`Tổng trọng lượng ${totalImportQty} ${row.unit} (kg)`}
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
              MỤC 2: TRỌNG LƯỢNG & KÍCH THƯỚC THEO KIỆN LẺ / MẪU SẢN PHẨM
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
                  <span className="uppercase text-cyan-900">Xếp lẻ theo kiện / Mẫu SP</span>
                </label>
                <span className="text-[10px] font-extrabold bg-amber-100 text-amber-900 px-2 py-0.5 rounded-md">
                  {totalPackages} Kiện/Thùng lẻ
                </span>
              </div>

              {/* Sample Batch Input */}
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <span className="block font-extrabold text-slate-700 mb-1">SL 1 Kiện/Mẫu ({row.unit}/Kiện):</span>
                  <input
                    type="number"
                    min="1"
                    disabled={!enableSection2}
                    value={batchSampleQty}
                    onChange={(e) => setBatchSampleQty(e.target.value === '' ? '' : parseFloat(e.target.value))}
                    placeholder="SL 1 kiện lẻ"
                    className="w-full h-9 px-2.5 text-center rounded-xl border border-slate-300 bg-white font-extrabold text-slate-900 outline-none focus:border-cyan-600 text-xs disabled:opacity-50"
                  />
                </div>
                <div>
                  <span className="block font-extrabold text-slate-700 mb-1">TL 1 Kiện/Mẫu (kg):</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    disabled={!enableSection2}
                    value={batchSampleWeight}
                    onChange={(e) => setBatchSampleWeight(e.target.value === '' ? '' : parseFloat(e.target.value))}
                    placeholder="TL 1 kiện (kg)"
                    className="w-full h-9 px-2.5 text-center rounded-xl border border-slate-300 bg-white font-extrabold text-slate-900 outline-none focus:border-cyan-600 text-xs disabled:opacity-50"
                  />
                </div>
              </div>

              {/* Batch Dimensions */}
              <div className="space-y-1.5 pt-1">
                <span className="block font-extrabold text-slate-700">Kích thước 1 Kiện/Thùng mẫu (Mét):</span>
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
              <span>Quy đổi cho ({totalImportQty.toLocaleString('vi-VN')} {row.unit}):</span>
              <div className="text-right">
                <span className="text-cyan-900 font-black block">
                  1 Kiện = {bSWeight} kg ➔ Tổng {totalPackages} Kiện = {bTotalWeight.toFixed(2)} kg
                </span>
                <span className="text-[11px] text-cyan-700 font-bold">Tổng thể tích: {bTotalVol.toFixed(3)} m³</span>
              </div>
            </div>
          </div>

        </div>

        {/* ─────────────────────────────────────────────────────────────
            TỔNG HỢP THÔNG SỐ AI SẮP XẾP KHO (AI WMS WAREHOUSE METRICS) - CYAN & WHITE THEME
           ───────────────────────────────────────────────────────────── */}
        <div className="mx-6 mb-4 bg-gradient-to-r from-cyan-50 via-white to-cyan-50 text-slate-800 p-4 rounded-2xl shadow-sm border-2 border-cyan-400 space-y-3">
          <div className="flex items-center justify-between border-b border-cyan-200 pb-2.5">
            <span className="uppercase text-xs font-black tracking-wide text-cyan-900 flex items-center gap-2">
              <Box className="h-4 w-4 text-cyan-600" />
              Tổng hợp Thông số AI Kho bãi & Vận tải ({totalImportQty.toLocaleString('vi-VN')} {row.unit})
            </span>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-cyan-800 font-extrabold uppercase">Hệ số cước:</span>
              <select
                value={divisor}
                onChange={(e) => setDivisor(Number(e.target.value) as 5000 | 6000)}
                className="h-7 px-2.5 rounded-lg bg-white border-2 border-cyan-300 text-[11px] font-extrabold text-cyan-900 outline-none cursor-pointer hover:border-cyan-500 shadow-2xs"
              >
                <option value={5000}>5000 (Air / Chuyển phát nhanh)</option>
                <option value={6000}>6000 (Đường bộ / Tiêu chuẩn)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="bg-white p-3 rounded-xl border-2 border-cyan-200 shadow-2xs">
              <span className="block text-[10px] uppercase font-bold text-cyan-800 mb-0.5">Trọng lượng tổng ({totalImportQty.toLocaleString('vi-VN')} {row.unit})</span>
              <span className="text-base font-black text-cyan-950">{finalWeight.toFixed(2)} <span className="text-xs font-bold text-cyan-700">kg</span></span>
              {enableSection2 && bSWeight > 0 && (
                <span className="block text-[10px] text-cyan-700 font-black mt-0.5">
                  ({bSWeight} kg/kiện {bSQty} {row.unit})
                </span>
              )}
            </div>
            <div className="bg-cyan-100/60 p-3 rounded-xl border-2 border-cyan-300 shadow-2xs">
              <span className="block text-[10px] uppercase font-bold text-cyan-900 mb-0.5">Thể tích xếp kho AI</span>
              <span className="text-base font-black text-cyan-900">{finalVolume.toFixed(3)} <span className="text-xs font-bold text-cyan-800">m³</span></span>
              {enableSection2 && bSampleVol > 0 && (
                <span className="block text-[10px] text-cyan-800 font-black mt-0.5">
                  ({bSampleVol.toFixed(3)} m³/kiện {bSQty} {row.unit})
                </span>
              )}
            </div>
            <div className="bg-amber-50 p-3 rounded-xl border-2 border-amber-300 shadow-2xs">
              <span className="block text-[10px] uppercase font-extrabold text-amber-900 mb-0.5">TL Quy đổi Thể tích (VW)</span>
              <span className="text-base font-black text-amber-900">{finalVolumetricWeight.toFixed(2)} <span className="text-xs font-bold text-amber-700">kg</span></span>
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

// ─── AI SLOTTING CHAT & WAREHOUSE RECOMMENDATION MODAL ─────────────
interface BinCell {
  binCode: string;
  cellCode: string;
  bayCode: string;
  maxWeight: number;
  freeVol: number;
  isOccupied?: boolean;
}

interface ShelfFloor {
  floorId: string;
  floorName: string;
  floorDesc: string;
  cells: BinCell[];
}

interface RackStructure {
  rackId: string;
  rackName: string;
  dimensions: string;
  spec: string;
  zoneName: string;
  floors: ShelfFloor[];
}

interface AiChatMessage {
  id: string;
  sender: 'ai' | 'user';
  text: string;
  time: string;
}

function calculateEffectiveBinCapacity(
  item: FormDetailRow,
  rackDim?: { rackLength?: number; binsPerShelf?: number; shelvesCount?: number; rackWidth?: number; rackHeight?: number; maxWeight?: number }
): { capacity: number; isDefault: boolean; note: string } {
  if (item.packageQty && item.packageQty > 0) {
    return {
      capacity: item.packageQty,
      isDefault: false,
      note: `Theo quy cách thùng/lô mẫu đã chọn: ${item.packageQty} ${item.unit || 'Cái'}/ô`,
    };
  }

  // Calculate dynamic bin volume based on actual warehouse rack structure (e.g., 48m rack length / 7 bins = 6.86m long)
  const rackLength = rackDim?.rackLength || 48; // 48m length default
  const binsPerShelf = rackDim?.binsPerShelf || 7; // 7 bins per shelf level (8 vertical dividers)
  const shelvesCount = rackDim?.shelvesCount || 4; // 4 levels (5 horizontal dividers)
  const rackWidth = rackDim?.rackWidth || 1.2; // 1.2m width
  const rackHeight = rackDim?.rackHeight || 5.0; // 5.0m height

  const binLength = rackLength / binsPerShelf; // ~6.857m long
  const binWidth = rackWidth; // 1.2m wide
  const binHeight = rackHeight / shelvesCount; // 1.25m high
  const binMaxVol = binLength * binWidth * binHeight; // ~10.285 m³ (10,285 liters per bin!)
  const binMaxWeight = rackDim?.maxWeight || 400; // 400 kg per bin

  const qty = Number(item.qty) || 1;
  const weightPerUnit = (item.weight && item.weight > 0) ? item.weight / qty : 0;
  let volumePerUnit = (item.volume && item.volume > 0) ? item.volume / qty : 0;

  if (volumePerUnit === 0 && (item as any).length && (item as any).width && (item as any).height) {
    const l = Number((item as any).length) > 10 ? Number((item as any).length) / 100 : Number((item as any).length);
    const w = Number((item as any).width) > 10 ? Number((item as any).width) / 100 : Number((item as any).width);
    const h = Number((item as any).height) > 10 ? Number((item as any).height) / 100 : Number((item as any).height);
    const boxVol = l * w * h;
    volumePerUnit = boxVol / qty;
  }

  let capWeight = Infinity;
  let capVol = Infinity;

  if (weightPerUnit > 0) {
    capWeight = Math.floor(binMaxWeight / weightPerUnit);
  }
  if (volumePerUnit > 0) {
    capVol = Math.floor(binMaxVol / volumePerUnit);
  }

  const physicalCap = Math.min(capWeight, capVol);
  if (physicalCap > 0 && physicalCap !== Infinity) {
    return {
      capacity: physicalCap,
      isDefault: false,
      note: `Tính từ Ô kệ 3D (${binLength.toFixed(1)}m × ${binWidth}m × ${binHeight.toFixed(2)}m = ${binMaxVol.toFixed(2)}m³) & Kích thước SP (${physicalCap.toLocaleString('vi-VN')} ${item.unit || 'Cái'}/ô)`,
    };
  }

  return {
    capacity: 100,
    isDefault: true,
    note: `Định mức mặc định tạm tính (Chưa nhập TL/Kích thước: 100 ${item.unit || 'Cái'}/ô)`,
  };
}

interface AiSlottingChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: FormDetailRow[];
  targetRowId?: string | null;
  warehouseCode: string;
  onConfirmAll: (updatedRows: FormDetailRow[]) => void;
  onSkipAi: () => void;
  isFinalSaving?: boolean;
}

function normalizeBinKey(binCode: string): string {
  if (!binCode) return '';
  const trimmed = binCode.trim().toUpperCase();
  const match = trimmed.match(/(R\d+[-_]S\d+[-_]C\d+)/);
  if (match) return match[1].replace(/_/g, '-');
  return trimmed;
}

const AiSlottingChatModal: React.FC<AiSlottingChatModalProps> = ({
  isOpen,
  onClose,
  items,
  targetRowId,
  warehouseCode,
  onConfirmAll,
  onSkipAi,
  isFinalSaving = false,
}) => {
  const [activeRowId, setActiveRowId] = useState<string>('');
  const [activeRackId, setActiveRackId] = useState<string>('R01');
  const [selectedBinsMap, setSelectedBinsMap] = useState<Record<string, string[]>>({});
  const [messages, setMessages] = useState<AiChatMessage[]>([]);
  const [inputMsg, setInputMsg] = useState('');
  const [dbOccupiedBinsMap, setDbOccupiedBinsMap] = useState<Map<string, number>>(new Map());

  // Fetch real occupied bin codes from database
  useEffect(() => {
    if (!isOpen) return;
    let isMounted = true;
    async function loadOccupied() {
      try {
        const occMap = new Map<string, number>();
        const headers = authHeaders();

        // Direct real stock_balances from CSDL (Single Source of Truth)
        const balRes = await fetch(`${API_BASE_URL}/inventory/balances`, { headers }).catch(() => null);
        if (balRes && balRes.ok) {
          const balances: any[] = await balRes.json();
          balances.forEach((b) => {
            const lc = String(b.locationCode || '').trim();
            const physical = Number(b.totalPhysical || b.available || 0);
            if (lc && physical > 0 && (lc.includes('-S0') || lc.includes('-R0') || lc.includes('-C') || lc.includes('-ZA') || lc.includes('-ZB'))) {
              occMap.set(lc, physical);
              const norm = normalizeBinKey(lc);
              if (norm) occMap.set(norm, physical);
            }
          });
        }

        if (isMounted) setDbOccupiedBinsMap(occMap);
      } catch (err) {
        console.error('Lỗi tải dữ liệu ô kệ đã có hàng:', err);
      }
    }
    loadOccupied();
    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  // Set of bins already assigned to items in this order
  const currentOrderAssignedBins = useMemo(() => {
    const set = new Set<string>();
    items.forEach((it) => {
      (it.assignedBins || []).forEach((b) => {
        if (b && (b.includes('-S0') || b.includes('-R0') || b.includes('-C')) && b !== it.warehouseCode) {
          set.add(b);
          const norm = normalizeBinKey(b);
          if (norm) set.add(norm);
        }
      });
      if (it.locationBin && it.locationBin !== it.warehouseCode) {
        it.locationBin.split(',').forEach((s) => {
          const trimmed = s.trim();
          if (trimmed && (trimmed.includes('-S0') || trimmed.includes('-R0') || trimmed.includes('-C'))) {
            set.add(trimmed);
            const norm = normalizeBinKey(trimmed);
            if (norm) set.add(norm);
          }
        });
      }
    });
    return set;
  }, [items]);

  // 1. Generate Racks Visual Grid Topology dynamically for the selected warehouse
  const racksTopology: RackStructure[] = useMemo(() => {
    const whList = getStoredWarehouses();
    const currentWh = whList.find(
      (w) => w.code === warehouseCode || w.id === warehouseCode
    );

    const createFloorCells = (
      zonePrefix: string,
      rackId: string,
      floorId: string,
      cellsCount = 10
    ): BinCell[] => {
      return Array.from({ length: cellsCount }).map((_, idx) => {
        const cellNum = (idx + 1).toString().padStart(2, '0');
        const binCode = `${zonePrefix}-${rackId}-${floorId}-C${cellNum}`;
        const normKey = normalizeBinKey(binCode);

        let isOccupied = false;
        // Bins belonging to the current order items are NOT marked as occupied by outside stock
        if (!currentOrderAssignedBins.has(binCode) && !currentOrderAssignedBins.has(normKey)) {
          if (dbOccupiedBinsMap.has(binCode) || dbOccupiedBinsMap.has(normKey)) {
            isOccupied = true;
          }
        }

        return {
          binCode,
          cellCode: `Ô C${cellNum}`,
          bayCode: `Khoang B${Math.ceil((idx + 1) / 2).toString().padStart(2, '0')}`,
          maxWeight: 500,
          freeVol: 450,
          isOccupied,
        };
      });
    };

    // Case A: Warehouse has custom subWarehouses (Phân khu) & Racks created in /warehouses
    if (currentWh && Array.isArray(currentWh.subWarehouses) && currentWh.subWarehouses.length > 0) {
      const dynamicTopology: RackStructure[] = [];

      currentWh.subWarehouses.forEach((sub) => {
        const zoneCode = sub.code || 'ZONE';
        const zoneName = sub.name || `Phân khu ${zoneCode}`;
        const racks = Array.isArray(sub.racks) && sub.racks.length > 0
          ? sub.racks
          : [
              {
                id: `rack_${sub.id}_1`,
                rackCode: 'R01',
                name: 'Dãy Kệ R01',
                length: sub.length || 15,
                width: 1.2,
                height: 6,
                shelvesCount: sub.shelvesPerRack || 4,
                binsPerShelf: sub.binsPerShelf || 10,
              },
            ];

        racks.forEach((rk) => {
          const rId = rk.rackCode || rk.id || 'R01';
          const numShelves = rk.shelvesCount || (rk as any).horizontalPartitions ? (rk as any).horizontalPartitions - 1 : sub.shelvesPerRack || 4;
          const numBins = (rk as any).verticalPartitions
            ? (rk as any).verticalPartitions - 1
            : rk.binsPerShelf && rk.binsPerShelf > 2
              ? rk.binsPerShelf - 1
              : sub.binsPerShelf && sub.binsPerShelf > 2
                ? sub.binsPerShelf - 1
                : 6;

          const floors = Array.from({ length: numShelves }).map((_, flIdx) => {
            const floorNum = numShelves - flIdx;
            const floorId = `S${floorNum.toString().padStart(2, '0')}`;
            return {
              floorId,
              floorName: `Tầng ${floorId}`,
              floorDesc: `Mâm kệ tầng ${floorNum}`,
              cells: createFloorCells(zoneCode, rId, floorId, numBins),
            };
          });

          dynamicTopology.push({
            rackId: rId,
            rackName: rk.name || `Dãy Kệ ${rId}`,
            dimensions: `${rk.length || 15}m Dài × ${rk.width || 1.2}m Rộng`,
            spec: `${numShelves} Tầng × ${numBins} Ô`,
            zoneName: `${zoneName} (${sub.zoneType === 'COLD' ? 'Kho Lạnh' : 'Kho Thường'})`,
            floors,
          });
        });
      });

      if (dynamicTopology.length > 0) return dynamicTopology;
    }

    // Case B: Warehouse has no custom subWarehouses yet -> generate topology scoped specifically to this warehouse code
    const whPrefix = warehouseCode ? warehouseCode.toUpperCase() : 'KH';
    return [
      {
        rackId: 'R01',
        rackName: `Dãy Kệ R01 (${whPrefix})`,
        dimensions: '18m Dài × 1.2m Rộng',
        spec: '4 Tầng × 10 Ô',
        zoneName: `Khu A - ${currentWh?.name || whPrefix} (Kho Thường)`,
        floors: [
          { floorId: 'S04', floorName: 'Tầng S04', floorDesc: 'Mâm kệ tầng 4', cells: createFloorCells(`${whPrefix}-ZA`, 'R01', 'S04') },
          { floorId: 'S03', floorName: 'Tầng S03', floorDesc: 'Mâm kệ tầng 3', cells: createFloorCells(`${whPrefix}-ZA`, 'R01', 'S03') },
          { floorId: 'S02', floorName: 'Tầng S02', floorDesc: 'Mâm kệ tầng 2', cells: createFloorCells(`${whPrefix}-ZA`, 'R01', 'S02') },
          { floorId: 'S01', floorName: 'Tầng S01', floorDesc: 'Mâm kệ tầng 1 (Tầng Trệt)', cells: createFloorCells(`${whPrefix}-ZA`, 'R01', 'S01') },
        ],
      },
      {
        rackId: 'R02',
        rackName: `Dãy Kệ R02 (${whPrefix})`,
        dimensions: '18m Dài × 1.2m Rộng',
        spec: '4 Tầng × 10 Ô',
        zoneName: `Khu B - ${currentWh?.name || whPrefix} (Kho Thường)`,
        floors: [
          { floorId: 'S04', floorName: 'Tầng S04', floorDesc: 'Mâm kệ tầng 4', cells: createFloorCells(`${whPrefix}-ZB`, 'R02', 'S04') },
          { floorId: 'S03', floorName: 'Tầng S03', floorDesc: 'Mâm kệ tầng 3', cells: createFloorCells(`${whPrefix}-ZB`, 'R02', 'S03') },
          { floorId: 'S02', floorName: 'Tầng S02', floorDesc: 'Mâm kệ tầng 2', cells: createFloorCells(`${whPrefix}-ZB`, 'R02', 'S02') },
          { floorId: 'S01', floorName: 'Tầng S01', floorDesc: 'Mâm kệ tầng 1 (Tầng Trệt)', cells: createFloorCells(`${whPrefix}-ZB`, 'R02', 'S01') },
        ],
      },
    ];
  }, [warehouseCode, dbOccupiedBinsMap, currentOrderAssignedBins]);

  // 2. Initialize selections and AI chat when modal opens
  useEffect(() => {
    if (!isOpen || !items || items.length === 0) return;

    const initialTargetId = targetRowId && items.some((i) => i.rowId === targetRowId)
      ? targetRowId
      : items[0].rowId;

    setActiveRowId(initialTargetId);

    // Build list of all available cells in order from topology
    const allAvailableCells: string[] = [];
    racksTopology.forEach((rk) => {
      rk.floors.forEach((fl) => {
        fl.cells.forEach((cl) => {
          if (!cl.isOccupied) {
            allAvailableCells.push(cl.binCode);
          }
        });
      });
    });

    const initialMap: Record<string, string[]> = {};
    const usedBinsSet = new Set<string>();

    // Pass 1: Keep already assigned bins (from assignedBins, locationBin, or note)
    items.forEach((item) => {
      let validBins = (item.assignedBins || []).filter(
        (b) => b && (b.includes('-S0') || b.includes('-R0') || b.includes('-C')) && b !== item.warehouseCode
      );
      if (validBins.length === 0 && item.locationBin && item.locationBin !== item.warehouseCode) {
        validBins = item.locationBin.split(',').map((s) => s.trim()).filter(
          (b) => b && (b.includes('-S0') || b.includes('-R0') || b.includes('-C'))
        );
      }
      if (validBins.length === 0 && item.note) {
        const match = item.note.match(/\[Vị trí Ô:\s*([^\]]+)\]/);
        if (match) {
          validBins = match[1].split(',').map((s) => s.trim()).filter(
            (b) => b && (b.includes('-S0') || b.includes('-R0') || b.includes('-C'))
          );
        }
      }
      if (validBins.length > 0) {
        initialMap[item.rowId] = [...validBins];
        validBins.forEach((b) => usedBinsSet.add(b));
      }
    });

    // Pass 2: Auto-assign ALL remaining items sequentially from FREE cells without overlapping
    items.forEach((item) => {
      if (!initialMap[item.rowId] || initialMap[item.rowId].length === 0) {
        const capInfo = calculateEffectiveBinCapacity(item);
        const itemPackSize = capInfo.capacity;
        const requiredCount = Math.max(1, Math.ceil((item.qty || 1) / itemPackSize));
        const preselected: string[] = [];

        for (const binCode of allAvailableCells) {
          if (preselected.length >= requiredCount) break;
          if (!usedBinsSet.has(binCode)) {
            preselected.push(binCode);
            usedBinsSet.add(binCode);
          }
        }
        initialMap[item.rowId] = preselected;
      }
    });

    setSelectedBinsMap(initialMap);

    // Auto-switch rack view to active item's first bin
    const activeItemBins = initialMap[initialTargetId] || [];
    if (activeItemBins.length > 0) {
      const firstBin = activeItemBins[0];
      const matchRack = racksTopology.find((rk) => firstBin.includes(rk.rackId));
      if (matchRack) {
        setActiveRackId(matchRack.rackId);
      }
    }

    const activeItem = items.find((i) => i.rowId === initialTargetId) || items[0];
    const itemQty = activeItem?.qty || 0;
    const capInfo = calculateEffectiveBinCapacity(activeItem);
    const itemPackSize = capInfo.capacity;
    const totalBinsNeeded = Math.max(1, Math.ceil(itemQty / itemPackSize));
    const maxQtyPerBin = itemPackSize;
    const maxQtyPerRack = 40 * maxQtyPerBin;
    const totalRacksNeeded = Math.max(1, Math.ceil(totalBinsNeeded / 40));

    const itemSelectedBins = initialMap[initialTargetId] || [];
    const firstBinName = itemSelectedBins[0] || 'ZA-R01-S04-C01';
    const lastBinName = itemSelectedBins[itemSelectedBins.length - 1] || 'ZA-R01-S04-C10';

    const capacityNotice = capInfo.isDefault
      ? `\nChú ý: Do mặt hàng này CHƯA NHẬP Trọng lượng & Kích thước, AI đang áp dụng định mức MẶC ĐỊNH TẠM TÍNH (100 ${activeItem?.unit || 'Cái'}/ô). Hãy bấm nút [TL & KÍCH THƯỚC] ở giao diện nhập kho để AI tự động tính lại sức chứa m³/kg chính xác!`
      : `\nSức chứa ô chứa đã được AI tính toán tự động dựa trên Kích thước & Trọng lượng thực tế của sản phẩm.`;

    const now = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    setMessages([
      {
        id: 'msg-1',
        sender: 'ai',
        text: `CHỈ DẪN SẮP XẾP KHO AI SMART WMS\n\nMặt hàng: ${activeItem?.productName || 'Hàng hóa'} (Tổng nhập: ${itemQty.toLocaleString('vi-VN')} ${activeItem?.unit || 'Cái'})\n\n1. Thông số Sức chứa Kệ & Ô chứa:\n• Sức chứa 1 Ô chứa (Bin Capacity): Tối đa ${maxQtyPerBin} ${activeItem?.unit || 'Cái'}/ô (${capInfo.note}).\n• Sức chứa 1 Dãy kệ (Rack Capacity): 4 Tầng x 10 Ô = 40 Ô chứa (Chứa tối đa ${maxQtyPerRack.toLocaleString('vi-VN')} ${activeItem?.unit || 'Cái'}/dãy kệ).${capacityNotice}\n\n2. Chỉ dẫn Phân bổ Vị trí AI:\n• Số lượng Ô kệ cần dùng: ${totalBinsNeeded} Ô chứa (Trực thuộc ${totalRacksNeeded} Dãy kệ R01).\n• Vị trí gợi ý: Đã tự động đề xuất ${totalBinsNeeded} ô trống từ ${firstBinName} ➔ ${lastBinName} giúp di chuyển tối ưu và tránh trùng lặp với mặt hàng khác.`,
        time: now,
      },
    ]);
  }, [isOpen, items, targetRowId, racksTopology]);

  if (!isOpen) return null;

  const currentItem = items.find((i) => i.rowId === activeRowId) || items[0];
  const capInfo = calculateEffectiveBinCapacity(currentItem);
  const packSize = capInfo.capacity;
  const requiredCount = currentItem ? Math.max(1, Math.ceil((currentItem.qty || 1) / packSize)) : 1;
  const currentSelectedBins = selectedBinsMap[currentItem?.rowId || ''] || [];
  const currentRack = racksTopology.find((r) => r.rackId === activeRackId) || racksTopology[0];

  const handleSwitchActiveItem = (rowId: string) => {
    setActiveRowId(rowId);

    const itemToAssign = items.find((i) => i.rowId === rowId);
    if (!itemToAssign) return;

    let targetBins = selectedBinsMap[rowId] || [];

    // If item has no bins assigned in map yet, auto-assign from free cells
    if (targetBins.length === 0) {
      const itemPackSize = calculateEffectiveBinCapacity(itemToAssign).capacity;
      const requiredCount = Math.max(1, Math.ceil((itemToAssign.qty || 1) / itemPackSize));

      const usedBins = new Set<string>();
      Object.values(selectedBinsMap).forEach((binsArr) => {
        binsArr.forEach((b) => usedBins.add(b));
      });

      const freeCells: string[] = [];
      racksTopology.forEach((rk) => {
        rk.floors.forEach((fl) => {
          fl.cells.forEach((cl) => {
            if (!cl.isOccupied && !usedBins.has(cl.binCode)) {
              freeCells.push(cl.binCode);
            }
          });
        });
      });

      targetBins = freeCells.slice(0, requiredCount);
      if (targetBins.length > 0) {
        setSelectedBinsMap((prev) => ({
          ...prev,
          [rowId]: targetBins,
        }));
      }
    }

    if (targetBins.length > 0) {
      const firstBin = targetBins[0];
      const matchRack = racksTopology.find((rk) => firstBin.includes(rk.rackId));
      if (matchRack) {
        setActiveRackId(matchRack.rackId);
      }
    }

    // Add new AI Chat message for newly selected item
    const itemQty = itemToAssign.qty || 0;
    const capInfo = calculateEffectiveBinCapacity(itemToAssign);
    const itemPackSize = capInfo.capacity;
    const totalBinsNeeded = Math.max(1, Math.ceil(itemQty / itemPackSize));
    const maxQtyPerBin = itemPackSize;
    const maxQtyPerRack = 40 * maxQtyPerBin;
    const totalRacksNeeded = Math.max(1, Math.ceil(totalBinsNeeded / 40));

    const firstBinName = targetBins[0] || 'ZA-R01-S04-C01';
    const lastBinName = targetBins[targetBins.length - 1] || firstBinName;

    const capacityNotice = capInfo.isDefault
      ? `\nChú ý: Do mặt hàng này CHƯA NHẬP Trọng lượng & Kích thước, AI đang áp dụng định mức MẶC ĐỊNH TẠM TÍNH (100 ${itemToAssign.unit || 'Cái'}/ô). Hãy bấm nút [TL & KÍCH THƯỚC] ở giao diện nhập kho để AI tự động tính lại sức chứa m³/kg chính xác!`
      : `\nSức chứa ô chứa đã được AI tính toán tự động dựa trên Kích thước & Trọng lượng thực tế của sản phẩm.`;

    const now = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

    setMessages((prev) => [
      ...prev,
      {
        id: `switch-${Date.now()}`,
        sender: 'ai',
        text: `CHỈ DẪN SẮP XẾP KHO AI SMART WMS CHO MẶT HÀNG MỚI\n\nMặt hàng: ${itemToAssign.productName} (Tổng nhập: ${itemQty.toLocaleString('vi-VN')} ${itemToAssign.unit || 'Cái'})\n\n1. Thông số Sức chứa Kệ & Ô chứa:\n• Sức chứa 1 Ô chứa (Bin Capacity): Tối đa ${maxQtyPerBin} ${itemToAssign.unit || 'Cái'}/ô (${capInfo.note}).\n• Sức chứa 1 Dãy kệ (Rack Capacity): 4 Tầng x 10 Ô = 40 Ô chứa (Chứa tối đa ${maxQtyPerRack.toLocaleString('vi-VN')} ${itemToAssign.unit || 'Cái'}/dãy kệ).${capacityNotice}\n\n2. Chỉ dẫn Phân bổ Vị trí AI:\n• Số lượng Ô kệ cần dùng: ${totalBinsNeeded} Ô chứa (Trực thuộc ${totalRacksNeeded} Dãy kệ R01).\n• Vị trí gợi ý: Đã tự động đề xuất ${totalBinsNeeded} ô trống từ ${firstBinName} ➔ ${lastBinName} giúp di chuyển tối ưu và tránh trùng lặp với mặt hàng khác.`,
        time: now,
      },
    ]);
  };

  const handleSendMessage = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputMsg.trim()) return;

    const userText = inputMsg.trim();
    const now = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

    setMessages((prev) => [
      ...prev,
      { id: `user-${Date.now()}`, sender: 'user', text: userText, time: now },
    ]);
    setInputMsg('');

    setTimeout(() => {
      let aiReply = '';
      const lower = userText.toLowerCase();

      // Extract numbers & dimensions from prompt if present
      const batchQtyMatch = userText.match(/(\d+)\s*(?:cái|sản phẩm|sp|thùng|hộp)?\s*(?:mỗi|một|\/)?\s*(?:lô|thùng|kiện)/i)
                         || userText.match(/bọc\s*(\d+)/i)
                         || userText.match(/lô\s*(\d+)/i);
      const extractedBatchQty = batchQtyMatch ? parseInt(batchQtyMatch[1], 10) : 100;

      const totalQtyMatch = userText.match(/(\d+)\s*(?:sản phẩm|cái|áo|kiện)/i);
      const targetQty = totalQtyMatch ? parseInt(totalQtyMatch[1], 10) : (currentItem?.qty || 500);

      const dimCmMatches = [...userText.matchAll(/(\d+(?:[\.,]\d+)?)\s*(?:cm|m)?/gi)].map((m) => parseFloat(m[1].replace(',', '.')));
      let lCm = 80, wCm = 50, hCm = 60;
      if (dimCmMatches.length >= 3 && (userText.includes('cm') || userText.includes('kích thước'))) {
        const cmFiltered = dimCmMatches.filter((n) => n > 1 && n <= 500);
        if (cmFiltered.length >= 3) {
          [lCm, wCm, hCm] = cmFiltered.slice(0, 3);
        }
      }

      const lM = lCm > 10 ? lCm / 100 : lCm;
      const wM = wCm > 10 ? wCm / 100 : wCm;
      const hM = hCm > 10 ? hCm / 100 : hCm;
      const batchVolM3 = Number((lM * wM * hM).toFixed(4)); // 0.8 * 0.5 * 0.6 = 0.24 m³

      const rackLenMatch = userText.match(/kệ\s*dài\s*(\d+)/i) || userText.match(/dãy\s*kệ\s*(\d+)m/i);
      const rackLen = rackLenMatch ? parseFloat(rackLenMatch[1]) : 48;
      const binCountMatch = userText.match(/(\d+)\s*ô/i) || userText.match(/chia\s*(\d+)/i);
      const binCount = binCountMatch ? parseInt(binCountMatch[1], 10) : 7;

      const binLength = Number((rackLen / binCount).toFixed(2)); // 48 / 7 = 6.86m
      const binWidth = 1.2;
      const binHeight = 1.25; // 5m / 4 floors
      const binVol = Number((binLength * binWidth * binHeight).toFixed(2)); // ~10.28 m³

      const numBatches = Math.ceil(targetQty / extractedBatchQty); // 500 / 100 = 5 batches
      const totalVolume = Number((numBatches * batchVolM3).toFixed(2)); // 5 * 0.24 = 1.2 m³

      const maxRowsL = Math.max(1, Math.floor(binLength / lM)); // e.g. 6.86 / 0.8 = 8 rows
      const maxColsW = Math.max(1, Math.floor(binWidth / wM)); // e.g. 1.2 / 0.5 = 2 cols
      const maxTiersH = Math.max(1, Math.floor(binHeight / hM)); // e.g. 1.25 / 0.6 = 2 tiers
      const maxBatchesPerBin = maxRowsL * maxColsW * maxTiersH; // 32 batches
      const maxItemsPerBin = maxBatchesPerBin * extractedBatchQty; // 3,200 items

      const actualRowsL = Math.min(numBatches, maxRowsL); // 5 rows
      const actualColsW = 1;
      const actualTiersH = 1;
      const lengthUsed = (actualRowsL * lM).toFixed(2); // 4.00m
      const widthUsed = (actualColsW * wM).toFixed(2); // 0.50m
      const heightUsed = (actualTiersH * hM).toFixed(2); // 0.60m

      const lenRemain = Math.max(0, binLength - actualRowsL * lM).toFixed(2); // 2.86m
      const widRemain = Math.max(0, binWidth - actualColsW * wM).toFixed(2); // 0.70m
      const heiRemain = Math.max(0, binHeight - actualTiersH * hM).toFixed(2); // 0.65m

      const actualBinsRequired = Math.max(1, Math.ceil(targetQty / maxItemsPerBin));
      const fillPercentage = Number(((totalVolume / binVol) * 100).toFixed(1));

      if (
        lower.includes('48m') ||
        lower.includes('lô') ||
        lower.includes('cm') ||
        lower.includes('7 ô') ||
        lower.includes('toán') ||
        lower.includes('xếp') ||
        lower.includes('hướng dẫn') ||
        lower.includes('đủ') ||
        lower.includes('mấy ô') ||
        lower.includes('số lượng') ||
        lower.includes('sức chứa')
      ) {
        aiReply = `HƯỚNG DẪN XẾP KHO THỰC TẾ 3D (SMART 3D BIN PACKING & STACKING GUIDE)\n\n1. Ma trận Kích thước Ô Kệ Kho:\n• Kích thước Ô Kệ: Dài ~${binLength}m (${Math.round(binLength * 100)}cm) x Rộng ${binWidth}m (${Math.round(binWidth * 100)}cm) x Cao ${binHeight}m (${Math.round(binHeight * 100)}cm).\n• Thể tích 1 Ô chứa: ${binVol} m³ (${(binVol * 1000).toLocaleString('vi-VN')} Lít), Tải trọng: 400 kg.\n\n2. Ma trận Xếp Hàng Hóa Vừa Khít (Sức chứa tối đa 1 Ô):\n• Quy cách Lô/Thùng: 1 Lô (${extractedBatchQty} cái) = Dài ${lCm}cm x Rộng ${wCm}cm x Cao ${hCm}cm (${batchVolM3} m³).\n• Sắp xếp theo Dài (Length): Xếp tối đa ${maxRowsL} Thùng dọc chiều dài (${maxRowsL} x ${lCm}cm = ${maxRowsL * lCm}cm, chừa khe bốc xếp).\n• Sắp xếp theo Rộng (Width): Xếp tối đa ${maxColsW} Thùng theo chiều rộng (${maxColsW} x ${wCm}cm = ${maxColsW * wCm}cm).\n• Sắp xếp theo Cao (Height): Chồng tối đa ${maxTiersH} Lớp/Tầng (${maxTiersH} x ${hCm}cm = ${maxTiersH * hCm}cm).\n-> Sức chứa vừa khít 1 Ô Kệ: ${maxRowsL} Dài x ${maxColsW} Rộng x ${maxTiersH} Cao = ${maxBatchesPerBin} Lô/Thùng (tương đương ${maxItemsPerBin.toLocaleString('vi-VN')} sản phẩm/Ô).\n\n3. HƯỚNG DẪN THỦ KHO XẾP THỰC TẾ CHO ${targetQty} SẢN PHẨM (${numBatches} LÔ HÀNG):\n1) Vị trí mâm: Đặt tại Mâm kệ tầng trệt S01 hoặc tầng S02 để thao tác luồn tay bốc xếp nhẹ nhàng nhất.\n2) Bố trí mặt sàn ô kệ (Floor Layout):\n   - Xếp 1 Hàng duy nhất sát mép vách trong bên trái: ${actualRowsL} Thùng nối tiếp dọc theo chiều dài (${actualRowsL} x ${lM}m = ${lengthUsed}m).\n   - Chiều rộng chiếm ${widthUsed}m (sát mép vách), Chiều cao chiếm ${heightUsed}m (chỉ đặt 1 tầng mâm phẳng, KHÔNG cần chồng tầng 2 để tránh nguy cơ đổ vỡ).\n3) Tận dụng diện tích dư & An toàn bốc xếp:\n   - Khoảng trống đã dùng: Chiếm ${fillPercentage}% thể tích ô kệ (${totalVolume} m³ / ${binVol} m³).\n   - Khoảng trống còn thừa trong Ô: Dài dư ${lenRemain}m, Rộng dư ${widRemain}m, Cao dư ${heiRemain}m.\n   - Khuyên dùng từ AI: Chiều dài dư ${lenRemain}m rất rộng rãi, đủ chứa thêm tới ${maxBatchesPerBin - numBatches} Lô hàng nữa (~${(maxBatchesPerBin - numBatches) * extractedBatchQty} sản phẩm) hoặc ghép chung với SKU khác mà không lo lãng phí diện tích kho!\n\nAI đã tự động tối ưu sơ đồ: Đã chọn chính xác 1 Ô chứa cho đơn hàng này!`;

        // Update active item's bin assignment in selectedBinsMap without overlapping other items
        if (currentItem) {
          setSelectedBinsMap((prev) => {
            const usedByOtherItems = new Set<string>();
            Object.entries(prev).forEach(([rId, bArr]) => {
              if (rId !== currentItem.rowId) {
                (bArr || []).forEach((b) => usedByOtherItems.add(b));
              }
            });

            const freeCells: string[] = [];
            racksTopology.forEach((rk) => {
              rk.floors.forEach((fl) => {
                fl.cells.forEach((cl) => {
                  if (!cl.isOccupied && !usedByOtherItems.has(cl.binCode)) {
                    freeCells.push(cl.binCode);
                  }
                });
              });
            });
            const chosen = freeCells.slice(0, actualBinsRequired);
            return {
              ...prev,
              [currentItem.rowId]: chosen,
            };
          });
        }
      } else if (lower.includes('kho lạnh') || lower.includes('nhiệt độ')) {
        aiReply = `Bạn hãy đổi tab Dãy Kệ sang "Dãy Kệ Lạnh R03 (Khu C)" ở phía trên sơ đồ để tích chọn các ô chứa lạnh -18°C.`;
      } else {
        aiReply = `Đã ghi nhận yêu cầu. AI đã tự động tính toán ma trận xếp kho 3D theo kích thước ô kệ. Bạn có thể chọn/bỏ chọn thêm ô trực tiếp trên sơ đồ 2D bên phải.`;
      }

      setMessages((prev) => [
        ...prev,
        { id: `ai-${Date.now()}`, sender: 'ai', text: aiReply, time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) },
      ]);
    }, 400);
  };

  // Toggle selection of a specific cell in the grid
  const toggleBinSelection = (binCode: string) => {
    if (!activeRowId) return;

    const isUsedByOther = items.some(
      (it) => it.rowId !== activeRowId && (selectedBinsMap[it.rowId] || []).includes(binCode)
    );
    if (isUsedByOther) return;

    setSelectedBinsMap((prev) => {
      const currentList = prev[activeRowId] || [];
      if (currentList.includes(binCode)) {
        return { ...prev, [activeRowId]: currentList.filter((b) => b !== binCode) };
      } else {
        return { ...prev, [activeRowId]: [...currentList, binCode] };
      }
    });
  };

  const handleConfirmSelections = () => {
    const updatedRows = items.map((r) => {
      const chosenBins = selectedBinsMap[r.rowId] || [];
      if (chosenBins.length > 0) {
        const cleanNote = (r.note || '').replace(/\[Vị trí Ô:\s*[^\]]+\]/g, '').trim();
        return {
          ...r,
          assignedBins: chosenBins,
          locationBin: chosenBins.join(', '),
          note: cleanNote ? `${cleanNote} [Vị trí Ô: ${chosenBins.join(', ')}]` : `[Vị trí Ô: ${chosenBins.join(', ')}]`,
        };
      } else {
        const cleanNote = (r.note || '').replace(/\[Vị trí Ô:\s*[^\]]+\]/g, '').trim();
        return {
          ...r,
          assignedBins: [],
          locationBin: '',
          note: cleanNote,
        };
      }
    });
    onConfirmAll(updatedRows);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-1.5 sm:p-3 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl border-2 border-cyan-500 w-full max-w-[98vw] h-[97vh] flex flex-col overflow-hidden">
        
        {/* Modal Header - Master Cyan Theme */}
        <div className="bg-cyan-700 text-white px-6 py-3.5 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-cyan-800 border border-cyan-500/50 flex items-center justify-center text-cyan-200 shadow-inner">
              <Sparkles className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-base font-black uppercase tracking-wide flex items-center gap-2">
                Trợ lý AI Chỉ dẫn Vị trí & Sơ đồ Ô Kệ Nhập Kho (Smart WMS Slotting Grid)
              </h3>
              <p className="text-xs text-cyan-100 font-medium">
                Tự động tính toán sức chứa ô/kệ • Click chọn các Ô trống trên sơ đồ 2D kệ kho để gán nhập kho
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-2xl bg-cyan-800/60 hover:bg-cyan-600 text-cyan-100 flex items-center justify-center transition cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-0 flex-1 overflow-hidden bg-slate-50">
          
          {/* Left Column: AI Interactive Chat */}
          <div className="md:col-span-5 lg:col-span-5 border-r border-cyan-200 bg-cyan-50/30 flex flex-col h-full overflow-hidden">
            <div className="p-3 bg-white border-b border-cyan-100 flex items-center justify-between text-xs font-black text-cyan-900 shadow-2xs">
              <span className="flex items-center gap-2">
                <Bot className="h-5 w-5 text-cyan-600" /> Trợ lý AI Hỏi Đáp Slotting & Hướng Dẫn 3D
              </span>
              <span className="bg-cyan-100 text-cyan-900 text-[10px] px-2.5 py-0.5 rounded-full font-black uppercase border border-cyan-300">
                Online
              </span>
            </div>

            {/* Chat Messages */}
            <div className="flex-1 p-3 overflow-y-auto space-y-3 text-xs">
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`flex flex-col ${m.sender === 'user' ? 'items-end' : 'items-start'}`}
                >
                  <div className="flex items-center gap-1.5 mb-1 text-[10px] text-slate-400 font-bold">
                    <span>{m.sender === 'user' ? 'Thủ kho' : 'AI Assistant'}</span>
                    <span>•</span>
                    <span>{m.time}</span>
                  </div>
                  <div
                    className={`max-w-[95%] p-3 rounded-2xl shadow-xs leading-relaxed whitespace-pre-wrap ${
                      m.sender === 'user'
                        ? 'bg-cyan-600 text-white rounded-br-none font-medium'
                        : 'bg-white text-slate-800 border border-cyan-200 rounded-bl-none font-normal shadow-2xs'
                    }`}
                  >
                    {m.text}
                  </div>
                </div>
              ))}
            </div>

            {/* Quick Prompts */}
            <div className="px-3 py-2 bg-white border-t border-cyan-100 flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setInputMsg('Mặt hàng này cần mấy ô kệ và sức chứa như thế nào?')}
                className="text-[10px] bg-cyan-50 hover:bg-cyan-100 border border-cyan-200 text-cyan-900 px-2.5 py-1 rounded-lg font-bold transition cursor-pointer"
              >
                Cần mấy ô & sức chứa?
              </button>
              <button
                type="button"
                onClick={() => setInputMsg('Chuyển sang Kho Lạnh -18°C?')}
                className="text-[10px] bg-cyan-50 hover:bg-cyan-100 border border-cyan-200 text-cyan-900 px-2.5 py-1 rounded-lg font-bold transition cursor-pointer"
              >
                Chọn Kệ Lạnh R03?
              </button>
            </div>

            {/* Chat Input */}
            <form onSubmit={handleSendMessage} className="p-3 bg-white border-t border-cyan-200 flex items-center gap-2">
              <input
                type="text"
                value={inputMsg}
                onChange={(e) => setInputMsg(e.target.value)}
                placeholder="Hỏi AI về vị trí ô, sức chứa..."
                className="flex-1 h-9 px-3 text-xs border border-slate-300 rounded-xl outline-none focus:border-cyan-600 bg-white font-medium text-slate-800"
              />
              <button
                type="submit"
                className="h-9 px-3.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl flex items-center justify-center transition cursor-pointer shadow-sm active:scale-95"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          </div>

          {/* Right Column: Interactive Visual Rack Topology Grid */}
          <div className="md:col-span-7 lg:col-span-7 p-4 flex flex-col h-full overflow-hidden bg-white">
            
            {/* 1. Item Switcher Bar */}
            <div className="mb-3 bg-cyan-50/80 p-2.5 rounded-2xl border border-cyan-200 flex items-center justify-between">
              <div className="flex items-center gap-2 overflow-x-auto">
                <span className="text-xs font-black uppercase text-cyan-950 flex items-center gap-1.5 shrink-0">
                  <Layers className="h-4 w-4 text-cyan-600" /> Đơn hàng:
                </span>
                {items.map((it, idx) => {
                  const isActive = it.rowId === activeRowId;
                  const itemCap = calculateEffectiveBinCapacity(it).capacity;
                  const countReq = Math.max(1, Math.ceil((it.qty || 1) / itemCap));
                  const selectedCount = (selectedBinsMap[it.rowId] || []).length;
                  return (
                    <button
                      key={it.rowId}
                      type="button"
                      onClick={() => handleSwitchActiveItem(it.rowId)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 cursor-pointer ${
                        isActive
                          ? 'bg-cyan-600 text-white shadow-sm'
                          : 'bg-white hover:bg-cyan-100 text-slate-700 border border-cyan-200'
                      }`}
                    >
                      <span>#{idx + 1} {it.productName || `Mặt hàng ${idx + 1}`}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-black ${
                        isActive ? 'bg-cyan-800 text-white' : 'bg-cyan-100 text-cyan-900'
                      }`}>
                        {selectedCount}/{countReq} Ô
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Status Indicator */}
              <div className="shrink-0">
                {currentSelectedBins.length >= requiredCount ? (
                  <span className="bg-cyan-100 text-cyan-900 text-[11px] font-black px-2.5 py-1 rounded-xl border border-cyan-300 flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5 text-cyan-700" /> Đã chọn đủ {currentSelectedBins.length} ô
                  </span>
                ) : (
                  <span className="bg-amber-100 text-amber-900 text-[11px] font-black px-2.5 py-1 rounded-xl border border-amber-300 flex items-center gap-1 animate-pulse">
                    <AlertCircle className="h-3.5 w-3.5 text-amber-600" /> Thiếu {requiredCount - currentSelectedBins.length} ô nữa
                  </span>
                )}
              </div>
            </div>

            {/* 2. Rack Selection Tabs */}
            <div className="flex items-center justify-between mb-3 border-b border-slate-200 pb-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-500">Chọn Dãy Kệ:</span>
                {racksTopology.map((rk) => (
                  <button
                    key={rk.rackId}
                    type="button"
                    onClick={() => setActiveRackId(rk.rackId)}
                    className={`px-3 py-1 rounded-xl text-xs font-extrabold transition cursor-pointer ${
                      activeRackId === rk.rackId
                        ? 'bg-cyan-700 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {rk.rackId} ({rk.zoneName.split(' ')[0]} {rk.zoneName.split(' ')[1]})
                  </button>
                ))}
              </div>

              <div className="text-[11px] font-bold text-cyan-900 bg-cyan-100/70 px-2.5 py-0.5 rounded-lg border border-cyan-200">
                {currentRack.zoneName}
              </div>
            </div>

            {/* 3. Main Visual Rack Topology Card */}
            <div className="flex-1 overflow-y-auto space-y-4 pr-1">
              <div className="bg-white rounded-2xl border-2 border-cyan-200 p-4 shadow-sm">
                
                {/* Rack Topology Header Banner */}
                <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-200">
                  <div className="flex items-center gap-3">
                    <span className="bg-cyan-700 text-white font-black text-xs font-mono px-3 py-1 rounded-xl shadow-xs">
                      {currentRack.rackId}
                    </span>
                    <h4 className="text-sm font-black text-slate-900 tracking-wide">
                      {currentRack.rackName} <span className="text-xs font-bold text-slate-500">({currentRack.dimensions})</span>
                    </h4>
                  </div>
                  <span className="bg-cyan-50 border border-cyan-200 text-cyan-900 text-[11px] font-bold px-3 py-1 rounded-full">
                    {currentRack.spec}
                  </span>
                </div>

                {/* Floors List & Bins Matrix */}
                <div className="space-y-4">
                  {currentRack.floors.map((floor) => (
                    <div key={floor.floorId} className="bg-cyan-50/30 rounded-2xl border border-cyan-200 p-3">
                      
                      {/* Floor Header */}
                      <div className="flex items-center justify-between mb-2.5">
                        <div className="flex items-center gap-2">
                          <span className="bg-cyan-700 text-white text-[11px] font-black px-2.5 py-0.5 rounded-lg shadow-2xs">
                            {floor.floorName}
                          </span>
                          <span className="text-xs font-bold text-slate-600">({floor.floorDesc})</span>
                        </div>
                        <span className="text-[11px] font-bold text-cyan-900">
                          10 Ô / Hộc chứa hàng (Chứa tối đa 1,000 SP/Tầng)
                        </span>
                      </div>

                      {/* Interactive 2D Cells Grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                        {floor.cells.map((cell) => {
                          const isSelected = currentSelectedBins.includes(cell.binCode);
                          const otherItemOccupying = items.find(
                            (it) => it.rowId !== activeRowId && (selectedBinsMap[it.rowId] || []).includes(cell.binCode)
                          );
                          const isOccupiedByOther = !!otherItemOccupying;
                          const isCellDisabled = cell.isOccupied || isOccupiedByOther;

                          return (
                            <div
                              key={cell.binCode}
                              onClick={() => !isCellDisabled && toggleBinSelection(cell.binCode)}
                              className={`p-2.5 rounded-xl border transition-all flex flex-col justify-between ${
                                cell.isOccupied
                                  ? 'bg-amber-100/90 border-2 border-amber-500 text-amber-950 font-black shadow-xs opacity-90 cursor-not-allowed'
                                  : isOccupiedByOther
                                  ? 'bg-amber-50/70 border-amber-300 opacity-75 cursor-not-allowed'
                                  : isSelected
                                  ? 'bg-cyan-600 text-white border-2 border-cyan-700 shadow-md scale-102 cursor-pointer'
                                  : 'bg-white hover:bg-cyan-50 text-slate-800 border-slate-200 hover:border-cyan-400 shadow-2xs cursor-pointer'
                              }`}
                            >
                              <div className="flex items-center justify-between mb-1">
                                <span className={`text-xs font-black ${cell.isOccupied ? 'text-amber-950' : isSelected ? 'text-white' : isOccupiedByOther ? 'text-amber-900' : 'text-slate-900'}`}>
                                  {cell.cellCode}
                                </span>
                                {cell.isOccupied && (
                                  <span className="bg-amber-500 text-white text-[9px] font-black px-1.5 py-0.2 rounded-md shadow-2xs">
                                    🔒 Đã có hàng
                                  </span>
                                )}
                                {isSelected && (
                                  <span className="bg-white text-cyan-900 text-[9px] font-black px-1.5 py-0.2 rounded-md shadow-2xs">
                                    ✓ Đã chọn
                                  </span>
                                )}
                                {isOccupiedByOther && (
                                  <span className="bg-amber-200 text-amber-950 text-[8px] font-black px-1 py-0.2 rounded-md border border-amber-400">
                                    🔒 MH#{items.indexOf(otherItemOccupying) + 1}
                                  </span>
                                )}
                              </div>

                              <span className={`text-[10px] font-bold block mb-1.5 ${isSelected ? 'text-cyan-100' : isOccupiedByOther ? 'text-amber-800' : 'text-slate-500'}`}>
                                {cell.bayCode}
                              </span>

                              <div className="flex items-center justify-between pt-1 border-t border-black/10">
                                <span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${
                                  isSelected ? 'bg-cyan-800 text-white' : isOccupiedByOther ? 'bg-amber-100 text-amber-900' : 'bg-slate-100 text-slate-700'
                                }`}>
                                  {cell.maxWeight}kg
                                </span>
                                <span className={`text-[9px] font-bold ${isSelected ? 'text-cyan-100' : isOccupiedByOther ? 'text-amber-900' : 'text-cyan-900'}`}>
                                  {cell.freeVol}m³
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                    </div>
                  ))}
                </div>

              </div>
            </div>

            {/* Footer Summary & Action Buttons */}
            <div className="mt-3 pt-3 border-t border-slate-200 flex items-center justify-between gap-3">
              <div className="text-xs font-bold text-slate-700 flex items-center gap-2">
                <span className="text-slate-500">Các Ô đang tích chọn:</span>
                <span className="text-cyan-900 font-black bg-cyan-100 px-2.5 py-1 rounded-lg border border-cyan-300">
                  {currentSelectedBins.length > 0 ? currentSelectedBins.join(', ') : 'Chưa chọn ô nào'}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onSkipAi}
                  className="px-5 py-2.5 rounded-xl border border-slate-300 bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700 transition cursor-pointer"
                >
                  {isFinalSaving ? 'Bỏ qua & Lưu phiếu' : 'Đóng'}
                </button>
                <button
                  type="button"
                  onClick={handleConfirmSelections}
                  className="px-6 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-xs font-black text-white uppercase tracking-wide shadow-md transition cursor-pointer active:scale-95 flex items-center gap-1.5"
                >
                  <Sparkles className="h-4 w-4 text-cyan-100" />
                  {isFinalSaving ? 'Lưu phiếu nhập' : 'Lưu'}
                </button>
              </div>
            </div>

          </div>

        </div>
      </div>
    </div>
  );
};

// ─── DRAFT / SAVE PUTAWAY SUMMARY REPORT MODAL ─────────────────────
interface PutawaySummaryReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmSave: () => void;
  orderNo: string;
  supplierName: string;
  warehouseCode: string;
  orderDate: string;
  items: FormDetailRow[];
  totalQty: number;
  totalWeight: number;
  totalVolume: number;
  grandTotal: number;
  saving?: boolean;
}

const PutawaySummaryReportModal: React.FC<PutawaySummaryReportModalProps> = ({
  isOpen,
  onClose,
  onConfirmSave,
  orderNo,
  supplierName,
  warehouseCode,
  orderDate,
  items,
  totalQty,
  totalWeight,
  totalVolume,
  grandTotal,
  saving = false,
}) => {
  if (!isOpen) return null;

  const validItems = items.filter((i) => (i.productId || i.productName?.trim()) && i.qty > 0);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-5 animate-[fadeIn_0.15s_ease-out]">
      <div className="w-full max-w-5xl rounded-3xl bg-white shadow-2xl border-2 border-cyan-500 overflow-hidden flex flex-col max-h-[95vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between bg-gradient-to-r from-cyan-700 via-cyan-600 to-teal-600 px-6 py-4 text-white">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/20 border border-white/30 shadow-inner">
              <Workflow className="h-6 w-6 text-cyan-100" />
            </div>
            <div>
              <h2 className="text-base font-black uppercase tracking-wide">
                BẢNG THỐNG KÊ PHÂN KHU & Ô KỆ HÀNG HÓA NHẬP KHO
              </h2>
              <p className="text-xs text-cyan-100 font-medium">
                Mã phiếu: <span className="font-extrabold text-white">{orderNo || 'PNK---'}</span> • Nhà cung cấp: <span className="font-extrabold text-white">{supplierName || 'NCC Chưa chọn'}</span> • Kho: <span className="font-extrabold text-white">{warehouseCode}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-1.5 text-cyan-200 hover:bg-cyan-600 hover:text-white transition cursor-pointer"
          >
            <X size={22} />
          </button>
        </div>

        {/* Printable Body Content */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1 bg-slate-50/50">
          
          {/* Executive Summary Cards Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-slate-800">
            <div className="bg-white p-3.5 rounded-2xl border-2 border-cyan-200 shadow-2xs">
              <span className="block text-[11px] uppercase font-bold text-slate-500 mb-0.5">Tổng số mặt hàng</span>
              <span className="text-lg font-black text-cyan-900">{validItems.length} <span className="text-xs font-bold text-slate-500">sản phẩm</span></span>
            </div>
            <div className="bg-white p-3.5 rounded-2xl border-2 border-cyan-200 shadow-2xs">
              <span className="block text-[11px] uppercase font-bold text-slate-500 mb-0.5">Tổng số lượng nhập</span>
              <span className="text-lg font-black text-cyan-900">{totalQty.toLocaleString('vi-VN')} <span className="text-xs font-bold text-slate-500">đơn vị</span></span>
            </div>
            <div className="bg-white p-3.5 rounded-2xl border-2 border-cyan-200 shadow-2xs">
              <span className="block text-[11px] uppercase font-bold text-slate-500 mb-0.5">Trọng lượng / Thể tích</span>
              <span className="text-sm font-black text-cyan-900">{totalWeight.toFixed(1)} kg <span className="text-slate-400">|</span> {totalVolume.toFixed(3)} m³</span>
            </div>
            <div className="bg-cyan-50 p-3.5 rounded-2xl border-2 border-cyan-400 shadow-2xs">
              <span className="block text-[11px] uppercase font-extrabold text-cyan-800 mb-0.5">Tổng giá trị đơn nhập</span>
              <span className="text-base font-black text-cyan-950">{grandTotal.toLocaleString('vi-VN')} đ</span>
            </div>
          </div>

          {/* Details Table: Product Putaway Statistics & Location Breakdown */}
          <div className="rounded-2xl border-2 border-slate-200 bg-white overflow-hidden shadow-sm">
            <div className="px-4 py-3 bg-slate-100 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-xs font-black uppercase tracking-wide text-slate-800 flex items-center gap-2">
                <Package className="h-4 w-4 text-cyan-600" />
                Chi tiết Danh mục Hàng hóa & Vị trí Phân khu Ô kệ gán lưu kho
              </h3>
              <span className="text-[11px] font-bold text-cyan-800 bg-cyan-100 px-2.5 py-0.5 rounded-full border border-cyan-300">
                Sắp xếp kho AI chuẩn hóa
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-cyan-50 text-slate-900 font-black border-b-2 border-cyan-200 uppercase text-[11px]">
                  <tr>
                    <th className="p-3 w-12 text-center border-r border-cyan-200">STT</th>
                    <th className="p-3 min-w-[200px] border-r border-cyan-200">MẶT HÀNG / SKU</th>
                    <th className="p-3 w-28 text-center border-r border-cyan-200">SỐ LƯỢNG</th>
                    <th className="p-3 w-36 text-center border-r border-cyan-200">TL (KG) / TT (M³)</th>
                    <th className="p-3 min-w-[160px] border-r border-cyan-200">PHÂN KHU & DÃY KỆ</th>
                    <th className="p-3 min-w-[180px] border-r border-cyan-200">VỊ TRÍ Ô KỆ GÁN KHO</th>
                    <th className="p-3 w-32 text-center">TRẠNG THÁI</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {validItems.map((item, idx) => {
                    const loc = formatLocationDisplay(item, idx);
                    return (
                      <tr key={item.rowId} className={idx % 2 === 1 ? 'bg-cyan-50/20' : 'bg-white'}>
                        <td className="p-3 text-center font-extrabold text-slate-600 border-r border-slate-200">
                          {idx + 1}
                        </td>
                        <td className="p-3 border-r border-slate-200 font-bold text-slate-900">
                          <div className="font-extrabold text-cyan-900">{item.productName}</div>
                          {item.productSku && (
                            <span className="text-[10px] text-slate-500 font-mono">SKU: {item.productSku}</span>
                          )}
                        </td>
                        <td className="p-3 text-center border-r border-slate-200 font-black text-slate-900">
                          {item.qty.toLocaleString('vi-VN')} {item.unit}
                        </td>
                        <td className="p-3 text-center border-r border-slate-200 font-bold text-slate-700">
                          {(item.weight || 0) > 0 ? `${(item.weight || 0).toFixed(1)} kg` : '-'}
                          {(item.volume || 0) > 0 ? ` | ${(item.volume || 0).toFixed(3)} m³` : ''}
                        </td>
                        <td className="p-3 border-r border-slate-200 font-bold text-slate-800">
                          <div className="text-cyan-900 font-extrabold">{loc.zone}</div>
                          <span className="text-[11px] text-slate-500 font-semibold">{loc.rack}</span>
                        </td>
                        <td className="p-3 border-r border-slate-200 font-extrabold text-emerald-800">
                          <span className="bg-emerald-50 text-emerald-900 border border-emerald-300 px-2.5 py-1 rounded-lg inline-block">
                            {loc.bins}
                          </span>
                        </td>
                        <td className="p-3 text-center">
                          {loc.isAssigned ? (
                            <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black px-2.5 py-1 rounded-lg border border-emerald-300 inline-flex items-center gap-1">
                              <CheckCircle2 size={12} className="text-emerald-600" /> Đã xếp kho
                            </span>
                          ) : (
                            <span className="bg-cyan-100 text-cyan-800 text-[10px] font-bold px-2.5 py-1 rounded-lg border border-cyan-300 inline-flex items-center gap-1">
                              <Sparkles size={12} className="text-cyan-600" /> Gợi ý tự động
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Footer Action Buttons */}
        <div className="flex items-center justify-between bg-slate-100 px-6 py-3.5 border-t border-slate-200">
          <button
            type="button"
            onClick={handlePrint}
            className="px-5 py-2.5 rounded-xl border-2 border-cyan-600 bg-white text-xs font-black text-cyan-800 hover:bg-cyan-50 transition cursor-pointer flex items-center gap-2 shadow-xs"
          >
            <Printer size={16} className="text-cyan-700" />
            <span>In Báo Cáo Thống Kê Xếp Kho</span>
          </button>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-xs font-bold text-slate-700 hover:bg-slate-200 transition cursor-pointer"
            >
              Hủy / Sửa lại
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={onConfirmSave}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-700 hover:to-teal-700 text-xs font-black text-white uppercase tracking-wide shadow-md transition cursor-pointer active:scale-95 flex items-center gap-2 disabled:opacity-50"
            >
              <Save size={16} className="text-white" />
              <span>Xác Nhận & Hoàn Tất Lưu Phiếu</span>
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
  const [searchParams] = useSearchParams();
  const actionParam = searchParams.get('action');
  const editId = searchParams.get('id') || searchParams.get('orderId');
  const sourcePoIdParam = searchParams.get('sourcePurchaseOrderId') || searchParams.get('poId');

  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
  const currentUserName = currentUser.fullName || currentUser.email?.split('@')[0] || 'Quản lý kho';

  // Storage info modal states
  const [storageInfoProduct, setStorageInfoProduct] = useState<{
    productId: string;
    productSku: string;
    productName: string;
    unit: string;
  } | null>(null);
  const [storageInfoBalances, setStorageInfoBalances] = useState<any[]>([]);
  const [loadingStorageInfo, setLoadingStorageInfo] = useState(false);

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
  const [showAiSlottingModal, setShowAiSlottingModal] = useState(false);
  const [aiSlottingTargetRowId, setAiSlottingTargetRowId] = useState<string | null>(null);
  const [pendingSaveConfig, setPendingSaveConfig] = useState<{ isPrint: boolean; saveStatus: 'DRAFT' | 'READY' | 'COMPLETED' } | null>(null);

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

  const isViewMode = actionParam === 'view';
  const isTabDraft = !activeTab?.id || ['DRAFT', 'draft', 'Đơn nháp'].includes(activeTab?.status || 'DRAFT');
  const isReadOnly = isViewMode || !isTabDraft;

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
          setProducts(filterOutDeletedProducts(normalized));
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
          try {
            const merged = mergeStoredWarehouses(list);
            saveStoredWarehouses(merged);
          } catch {}
          if (list.length > 0) {
            const firstWhCode = list[0].code;
            setTabs((prevTabs) =>
              prevTabs.map((t) => {
                if (!t.warehouseCode || t.warehouseCode === 'KHO-NVL') {
                  return {
                    ...t,
                    warehouseCode: firstWhCode,
                    details: t.details.map((d) => ({
                      ...d,
                      warehouseCode: !d.warehouseCode || d.warehouseCode === 'KHO-NVL' ? firstWhCode : d.warehouseCode,
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

  // Hydrate order details when editId or orderId is in URL query parameters
  useEffect(() => {
    const targetId = editId || sourcePoIdParam;
    if (!targetId) return;

    async function loadExistingOrder() {
      try {
        let orderData: any = null;

        if (sourcePoIdParam && !editId) {
          const poRes = await fetch(`${API_BASE_URL}/inbound/purchase-orders/${sourcePoIdParam}`, {
            headers: authHeaders(),
          }).catch(() => null);
          if (poRes && poRes.ok) {
            orderData = await poRes.json();
          } else {
            const stockInRes = await fetch(`${API_BASE_URL}/inbound/stock-in-orders/${sourcePoIdParam}`, {
              headers: authHeaders(),
            }).catch(() => null);
            if (stockInRes && stockInRes.ok) {
              orderData = await stockInRes.json();
            }
          }
        } else {
          const stockInRes = await fetch(`${API_BASE_URL}/inbound/stock-in-orders/${targetId}`, {
            headers: authHeaders(),
          }).catch(() => null);

          if (stockInRes && stockInRes.ok) {
            orderData = await stockInRes.json();
          } else {
            const poRes = await fetch(`${API_BASE_URL}/inbound/purchase-orders/${targetId}`, {
              headers: authHeaders(),
            }).catch(() => null);
            if (poRes && poRes.ok) {
              orderData = await poRes.json();
            }
          }
        }

        if (!orderData) return;

        const orderWhCode = orderData.warehouseCode || orderData.details?.[0]?.warehouseCode || 'KH006';

        const detailsList: FormDetailRow[] = (orderData.details || []).map((d: any, idx: number) => {
          const p = d.product || {};
          const reqQty = Number(d.requestedQty || d.actualQty || d.expectedQty || d.receivedQty || 0);
          const uPrice = Number(d.unitPrice || p.importPrice || p.purchasePrice || p.price || 0);
          const discP = Number(d.discountPercent || 0);
          const vatP = Number(d.vatPercent || 0);
          const sub = reqQty * uPrice;
          const afterDisc = sub * (1 - discP / 100);
          const tot = Number(d.totalLineAmount || d.totalAmount || afterDisc * (1 + vatP / 100));
          const rowWhCode = d.warehouseCode || orderWhCode;
          const rawAssignedBins = Array.isArray(d.assignedBins) ? d.assignedBins : [];
          let parsedBins: string[] = rawAssignedBins.filter((b: string) => b && (b.includes('-S0') || b.includes('-R0') || b.includes('-C')));

          if (parsedBins.length === 0 && d.locationBin && typeof d.locationBin === 'string' && d.locationBin !== rowWhCode) {
            parsedBins = d.locationBin.split(',').map((b: string) => b.trim()).filter((b: string) => b && (b.includes('-S0') || b.includes('-R0') || b.includes('-C')));
          }

          if (parsedBins.length === 0 && d.note && typeof d.note === 'string' && d.note.includes('[Vị trí Ô:')) {
            const match = d.note.match(/\[Vị trí Ô:\s*([^\]]+)\]/);
            if (match && match[1]) {
              parsedBins = match[1].split(',').map((b: string) => b.trim()).filter((b: string) => b && b.length > 2);
            }
          }

          return {
            rowId: d.id || `row-loaded-${idx}`,
            productId: p.id || String(d.productId || ''),
            productSku: p.internalSku || d.productSku || d.sku || '',
            productName: p.name || d.productName || '',
            unit: p.unit || d.unit || 'Cái',
            qty: reqQty,
            price: uPrice,
            discountPercent: discP,
            vatPercent: vatP,
            totalAmount: tot,
            expiryDate: d.expiryDate ? d.expiryDate.split('T')[0] : '',
            note: d.note || '',
            weight: Number(d.weight || 0),
            length: Number(d.length || 0),
            width: Number(d.width || 0),
            height: Number(d.height || 0),
            volume: Number(d.volume || 0),
            volumetricWeight: Number(d.volumetricWeight || 0),
            warehouseCode: rowWhCode,
            locationBin: parsedBins.join(', ') || rowWhCode,
            assignedBins: parsedBins.length > 0 ? parsedBins : [rowWhCode],
          };
        });

        while (detailsList.length < DEFAULT_ROWS_COUNT) {
          detailsList.push(makeEmptyRow(detailsList.length + 1, orderWhCode));
        }

        const loadedTab: InboundTab = {
          tabId: `tab-edit-${orderData.id}`,
          title: `${actionParam === 'edit' ? 'Sửa' : 'Xem'} ${orderData.orderCode || orderData.poNumber || 'Phiếu nhập'}`,
          id: String(orderData.id),
          orderNo: orderData.orderCode || orderData.poNumber || `PNK-${orderData.id}`,
          orderDate: orderData.createdAt
            ? new Date(orderData.createdAt).toISOString().slice(0, 16)
            : new Date().toISOString().slice(0, 16),
          expectedDate: orderData.expectedDate
            ? new Date(orderData.expectedDate).toISOString().slice(0, 16)
            : orderData.createdAt
            ? new Date(orderData.createdAt).toISOString().slice(0, 16)
            : new Date().toISOString().slice(0, 16),
          supplierId: orderData.sourcePurchaseOrder?.supplier?.id || orderData.supplier?.id || orderData.supplierId || '',
          supplierName: orderData.sourcePurchaseOrder?.supplier?.name || orderData.supplier?.name || orderData.supplierName || 'Nhà cung cấp',
          supplierPhone: orderData.sourcePurchaseOrder?.supplier?.phone || orderData.supplier?.phone || orderData.supplierPhone || '',
          supplierAddress: orderData.sourcePurchaseOrder?.supplier?.address || orderData.supplier?.address || orderData.supplierAddress || '',
          warehouseCode: orderWhCode,
          employeeName: orderData.currentStepUserEmail || orderData.creatorName || currentUserName,
          paymentMethod: orderData.paymentMethod || 'Tiền mặt',
          paymentAccount: orderData.paymentAccount || '',
          description: orderData.note || orderData.description || '',
          discount: Number(orderData.discount || 0),
          vatRate: Number(orderData.vatRate || (orderData.vatAmount ? 10 : 0)),
          shippingFee: Number(orderData.shippingFee || 0),
          amountPaid: Number(orderData.amountPaid || orderData.totalAmount || 0),
          status: orderData.status || 'DRAFT',
          details: detailsList,
        };

        setTabs([loadedTab]);
        setActiveTabId(loadedTab.tabId);
      } catch (err) {
        console.error('Lỗi tải thông tin phiếu nhập kho:', err);
      }
    }

    loadExistingOrder();
  }, [editId, actionParam]);

  const handleOpenStorageInfo = async (row: FormDetailRow) => {
    if (!row.productId) {
      setToast({ message: 'Vui lòng chọn hàng hóa trước khi xem thông tin lưu trữ', type: 'error' });
      return;
    }
    setStorageInfoProduct({
      productId: row.productId,
      productSku: row.productSku || 'SKU',
      productName: row.productName || 'Hàng hóa',
      unit: row.unit || 'Cái',
    });
    setLoadingStorageInfo(true);
    try {
      const res = await fetch(`${API_BASE_URL}/products/${row.productId}`, {
        headers: authHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setStorageInfoBalances(data.stockBalances || []);
      } else {
        setStorageInfoBalances([]);
      }
    } catch {
      setStorageInfoBalances([]);
    } finally {
      setLoadingStorageInfo(false);
    }
  };

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

  const rawGoodsSubtotal = useMemo(() => {
    return activeValidItems.reduce(
      (s, r) => s + (Number(r.qty) || 0) * (Number(r.price) || 0),
      0
    );
  }, [activeValidItems]);

  const totalRowDiscount = useMemo(() => {
    return activeValidItems.reduce((s, r) => {
      const qty = Number(r.qty) || 0;
      const price = Number(r.price) || 0;
      const discPercent = Number(r.discountPercent) || 0;
      return s + (qty * price * discPercent) / 100;
    }, 0);
  }, [activeValidItems]);

  const subtotalAfterRowDiscount = useMemo(() => {
    return Math.max(0, rawGoodsSubtotal - totalRowDiscount);
  }, [rawGoodsSubtotal, totalRowDiscount]);

  const orderDiscountAmount = useMemo(() => {
    return (subtotalAfterRowDiscount * (activeTab?.discount || 0)) / 100;
  }, [subtotalAfterRowDiscount, activeTab?.discount]);

  const totalDiscount = useMemo(() => {
    return totalRowDiscount + orderDiscountAmount;
  }, [totalRowDiscount, orderDiscountAmount]);

  const subtotalAfterAllDiscount = useMemo(() => {
    return Math.max(0, subtotalAfterRowDiscount - orderDiscountAmount);
  }, [subtotalAfterRowDiscount, orderDiscountAmount]);

  const totalRowVat = useMemo(() => {
    return activeValidItems.reduce((s, r) => {
      const qty = Number(r.qty) || 0;
      const price = Number(r.price) || 0;
      const discPercent = Number(r.discountPercent) || 0;
      const lineBeforeDisc = qty * price;
      const discAmt = (lineBeforeDisc * discPercent) / 100;
      const lineAfterDisc = Math.max(0, lineBeforeDisc - discAmt);
      const vatPercent = Number(r.vatPercent) || 0;
      return s + (lineAfterDisc * vatPercent) / 100;
    }, 0);
  }, [activeValidItems]);

  const orderVatAmount = useMemo(() => {
    return (subtotalAfterAllDiscount * (activeTab?.vatRate || 0)) / 100;
  }, [subtotalAfterAllDiscount, activeTab?.vatRate]);

  const totalVat = useMemo(() => {
    return totalRowVat + orderVatAmount;
  }, [totalRowVat, orderVatAmount]);

  const grandTotal = useMemo(() => {
    if (!activeTab) return 0;
    return Math.max(
      0,
      subtotalAfterAllDiscount + totalVat + (activeTab.shippingFee || 0)
    );
  }, [subtotalAfterAllDiscount, totalVat, activeTab]);

  const subtotal = rawGoodsSubtotal;
  const vatAmount = totalVat;

  const remainingDebt = useMemo(() => {
    if (!activeTab) return 0;
    const paid = activeTab.amountPaid !== undefined && activeTab.amountPaid !== null ? activeTab.amountPaid : grandTotal;
    return Math.max(0, grandTotal - paid);
  }, [grandTotal, activeTab]);

  const handleConfirmAiSlotting = (updatedRows: FormDetailRow[]) => {
    setShowAiSlottingModal(false);

    updateActiveTab((tab) => {
      const updatedMap = new Map(updatedRows.map((r) => [r.rowId, r]));
      const mergedDetails = tab.details.map((row) => {
        if (updatedMap.has(row.rowId)) {
          return updatedMap.get(row.rowId)!;
        }
        return row;
      });

      const hasEmptyRow = mergedDetails.some((r) => !r.productId && !r.productName?.trim());
      if (!hasEmptyRow) {
        mergedDetails.push(makeEmptyRow(mergedDetails.length + 1, tab.warehouseCode || 'KH006'));
      }

      return {
        ...tab,
        details: mergedDetails,
      };
    });

    if (pendingSaveConfig) {
      // Flow 1: Triggered from "Lưu/Hoàn thành phiếu nhập" button at bottom of page
      const cfg = pendingSaveConfig;
      setPendingSaveConfig(null);
      setTimeout(() => {
        handleSaveInboundOrder(cfg.isPrint, cfg.saveStatus, true);
      }, 100);
    } else {
      // Flow 2: Triggered from individual item action button in table
      setToast({ message: 'Đã lưu vị trí ô kệ cho sản phẩm trong danh sách!', type: 'success' });
      setAiSlottingTargetRowId(null);
    }
  };

  const handleSkipAiSlotting = () => {
    setShowAiSlottingModal(false);
    if (pendingSaveConfig) {
      const cfg = pendingSaveConfig;
      setPendingSaveConfig(null);
      handleSaveInboundOrder(cfg.isPrint, cfg.saveStatus, true);
    } else {
      setAiSlottingTargetRowId(null);
    }
  };

  const handleSaveInboundOrder = async (
    isPrint = false,
    saveStatus: 'DRAFT' | 'READY' | 'COMPLETED' = 'COMPLETED',
    bypassAi = false
  ) => {
    if (!activeTab) return;

    const isTabDraft = !activeTab.id || ['DRAFT', 'draft', 'Đơn nháp'].includes(activeTab.status || 'DRAFT');
    if (!isTabDraft) {
      setToast({
        message: 'Phiếu nhập kho này đã lưu chính thức và không thể chỉnh sửa lại!',
        type: 'error',
      });
      return;
    }

    if (activeValidItems.length === 0) {
      setToast({ message: 'Vui lòng chọn ít nhất 1 sản phẩm với số lượng > 0', type: 'error' });
      return;
    }

    if (!bypassAi) {
      setPendingSaveConfig({ isPrint, saveStatus });
      setShowAiSlottingModal(true);
      return;
    }

    const safeNum = (v: any, max = 99999.999) => {
      const n = Number(v);
      if (!Number.isFinite(n) || n < 0) return 0;
      return Math.min(n, max);
    };

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
      subtotal,
      discount: activeTab.discount || 0,
      vatRate: activeTab.vatRate || 0,
      vatAmount,
      shippingFee: activeTab.shippingFee || 0,
      totalAmount: grandTotal,
      amountPaid: activeTab.amountPaid ?? grandTotal,
      debtAmount: Math.max(0, grandTotal - (activeTab.amountPaid ?? grandTotal)),
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
        discountPercent: safeNum(r.discountPercent),
        vatPercent: safeNum(r.vatPercent),
        totalAmount: safeNum(r.totalAmount, 99999999.99),
        weight: safeNum(r.weight),
        length: safeNum(r.length),
        width: safeNum(r.width),
        height: safeNum(r.height),
        volume: safeNum(r.volume, 99999.9999),
        volumetricWeight: safeNum(r.volumetricWeight),
        note: r.note || '',
      })),
    };

    try {
      const isEditing = Boolean(activeTab.id);
      const endpoint = isEditing
        ? `${API_BASE_URL}/inbound/purchase-orders/${activeTab.id}`
        : `${API_BASE_URL}/inbound/purchase-orders`;
      const httpMethod = isEditing ? 'PUT' : 'POST';

      const res = await fetch(endpoint, {
        method: httpMethod,
        headers: authHeaders(),
        body: JSON.stringify(poPayload),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.message || 'Không thể lưu đơn nhập hàng');
      }

      const savedPO = await res.json();

      if (!isEditing) {
        const stockInPayload = {
          orderCode: `PNK-${savedPO.poNumber || generatedNo}`,
          note: activeTab.description || undefined,
          currentStepUserEmail: currentUser?.email,
          status: saveStatus,
        };

        await fetch(`${API_BASE_URL}/inbound/stock-in-orders/from-purchase-orders/${savedPO.id}`, {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify(stockInPayload),
        }).catch(() => null);
      }

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
    return products.filter(
      (p) => p.name.toLowerCase().includes(kw) || (p.internalSku || '').toLowerCase().includes(kw)
    );
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
            <h1 className="text-base font-black tracking-tight uppercase">
              {isViewMode
                ? 'XEM CHI TIẾT PHIẾU NHẬP HÀNG HÓA'
                : actionParam === 'edit'
                ? 'CHỈNH SỬA PHIẾU NHẬP HÀNG HÓA'
                : 'TẠO PHIẾU NHẬP HÀNG HÓA'}
            </h1>
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
              disabled={isReadOnly}
              value={activeTab?.orderDate || ''}
              onChange={(e) => updateActiveTab((t) => ({ ...t, orderDate: e.target.value }))}
              className="h-10 w-full rounded-xl border-2 border-slate-300 bg-white px-3 text-sm font-bold text-slate-800 outline-none transition focus:border-cyan-600 focus:ring-2 focus:ring-cyan-500/20 disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
            />
          </div>

          {/* Mã phiếu nhập */}
          <div>
            <label className="mb-1.5 block text-xs font-black uppercase text-slate-700">Mã phiếu / Lệnh</label>
            <input
              type="text"
              disabled={isReadOnly}
              value={activeTab?.orderNo || ''}
              onChange={(e) => updateActiveTab((t) => ({ ...t, orderNo: e.target.value }))}
              placeholder="TẠO TỰ ĐỘNG (PNK...)"
              className="h-10 w-full rounded-xl border-2 border-slate-300 bg-slate-50 px-3 text-sm font-extrabold text-cyan-900 uppercase outline-none focus:border-cyan-600 disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
            />
          </div>

          {/* Chọn Nhà cung cấp (Searchable Interactive Dropdown) */}
          <div className="relative supplier-dropdown-box">
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-xs font-black uppercase text-slate-700 flex items-center gap-1">
                <Building2 className="h-4 w-4 text-cyan-600" />
                <span>Nhà cung cấp</span>
              </label>
              {!isReadOnly && (
                <button
                  type="button"
                  onClick={() => setShowAddSupplierModal(true)}
                  className="text-[11px] font-extrabold text-cyan-700 hover:underline flex items-center gap-0.5 cursor-pointer"
                >
                  <UserPlus size={13} />
                  <span>+ Thêm NCC</span>
                </button>
              )}
            </div>
            <input
              type="text"
              disabled={isReadOnly}
              value={
                showSupplierDropdown
                  ? supplierSearch
                  : activeTab?.supplierName || ''
              }
              onChange={(e) => {
                if (isReadOnly) return;
                setSupplierSearch(e.target.value);
                setShowSupplierDropdown(true);
              }}
              onFocus={() => {
                if (isReadOnly) return;
                setSupplierSearch('');
                setShowSupplierDropdown(true);
              }}
              onClick={() => {
                if (isReadOnly) return;
                setShowSupplierDropdown(true);
              }}
              placeholder="Tìm theo tên, mã NCC, SĐT..."
              className="h-10 w-full rounded-xl border-2 border-slate-300 bg-white px-3 text-sm font-bold text-slate-800 outline-none transition focus:border-cyan-600 cursor-text disabled:bg-slate-100 disabled:text-slate-600 disabled:cursor-not-allowed"
            />

            {!isReadOnly && showSupplierDropdown && (
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
              onClick={() => {
                if (isReadOnly) return;
                setShowWarehouseDropdown((prev) => !prev);
              }}
              className={`h-10 w-full rounded-xl border-2 border-cyan-500 bg-cyan-50/70 px-3 text-sm font-bold text-cyan-900 flex items-center justify-between shadow-xs transition ${
                isReadOnly ? 'bg-slate-100 border-slate-300 text-slate-600 cursor-not-allowed' : 'cursor-pointer hover:bg-cyan-100/70'
              }`}
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

            {!isReadOnly && showWarehouseDropdown && (
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
                {!isReadOnly && (
                  <>
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
                  </>
                )}

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
                            disabled={isReadOnly}
                            value={row.productName ? `${row.productSku ? row.productSku + ' - ' : ''}${row.productName}` : ''}
                            onChange={(e) => {
                              if (isReadOnly) return;
                              const val = e.target.value;
                              updateRow(row.rowId, { productName: val });
                              setActiveProductDropdownRowId(row.rowId);
                            }}
                            onFocus={() => {
                              if (!isReadOnly) setActiveProductDropdownRowId(row.rowId);
                            }}
                            onClick={() => {
                              if (!isReadOnly) setActiveProductDropdownRowId(row.rowId);
                            }}
                            placeholder="Chọn hoặc nhập hàng..."
                            className="w-full h-9 px-2.5 rounded-lg border border-slate-300 bg-white font-bold text-slate-800 outline-none focus:border-cyan-600 text-xs sm:text-sm cursor-text disabled:bg-slate-100 disabled:text-slate-700 disabled:cursor-not-allowed"
                          />

                          {/* Interactive Table Dropdown for this row */}
                          {!isReadOnly && activeProductDropdownRowId === row.rowId && (
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
                            disabled={isReadOnly}
                            value={row.unit}
                            onChange={(e) => updateRow(row.rowId, { unit: e.target.value })}
                            className="w-full h-9 text-center rounded-lg border border-slate-300 bg-white font-bold outline-none focus:border-cyan-600 text-xs sm:text-sm text-slate-800 disabled:bg-slate-100 disabled:text-slate-700 disabled:cursor-not-allowed"
                          />
                        </td>

                        {/* SỐ LƯỢNG */}
                        <td className="p-1 border-r border-slate-200">
                          <input
                            type="number"
                            min="0"
                            disabled={isReadOnly}
                            value={row.qty === 0 ? '' : row.qty}
                            onChange={(e) => updateRow(row.rowId, { qty: Number(e.target.value) })}
                            placeholder="0"
                            className="w-full h-9 px-2 text-center rounded-lg border border-slate-300 bg-white font-black text-slate-900 outline-none focus:border-cyan-600 text-xs sm:text-sm disabled:bg-slate-100 disabled:text-slate-700 disabled:cursor-not-allowed"
                          />
                        </td>

                        {/* ĐƠN GIÁ (đ) với tự động thêm dấu phẩy ngàn */}
                        <td className="p-1 border-r border-slate-200">
                          <FormattedNumberInput
                            disabled={isReadOnly}
                            value={row.price}
                            onChange={(parsed) => updateRow(row.rowId, { price: parsed })}
                            placeholder="0"
                            className="w-full h-9 px-2 text-right rounded-lg border border-slate-300 bg-white font-black text-slate-900 outline-none focus:border-cyan-600 text-xs sm:text-sm disabled:bg-slate-100 disabled:text-slate-700 disabled:cursor-not-allowed"
                          />
                        </td>

                        {/* CK (%) */}
                        <td className="p-1 border-r border-slate-200">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            disabled={isReadOnly}
                            value={row.discountPercent === 0 ? '' : row.discountPercent}
                            onChange={(e) => updateRow(row.rowId, { discountPercent: Number(e.target.value) })}
                            placeholder="0"
                            className="w-full h-9 text-center rounded-lg border border-slate-300 bg-white font-bold outline-none focus:border-cyan-600 text-xs sm:text-sm disabled:bg-slate-100 disabled:text-slate-700 disabled:cursor-not-allowed"
                          />
                        </td>

                        {/* VAT (%) */}
                        <td className="p-1 border-r border-slate-200">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            disabled={isReadOnly}
                            value={row.vatPercent === 0 ? '' : row.vatPercent}
                            onChange={(e) => updateRow(row.rowId, { vatPercent: Number(e.target.value) })}
                            placeholder="0"
                            className="w-full h-9 text-center rounded-lg border border-slate-300 bg-white font-bold outline-none focus:border-cyan-600 text-xs sm:text-sm disabled:bg-slate-100 disabled:text-slate-700 disabled:cursor-not-allowed"
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
                            disabled={isReadOnly}
                            value={row.expiryDate || ''}
                            onChange={(e) => updateRow(row.rowId, { expiryDate: e.target.value })}
                            className="w-full h-9 px-1.5 text-center rounded-lg border border-slate-300 bg-white font-bold text-slate-800 outline-none focus:border-cyan-600 text-xs sm:text-sm disabled:bg-slate-100 disabled:text-slate-700 disabled:cursor-not-allowed"
                          />
                        </td>

                        {/* GHI CHÚ */}
                        <td className="p-1 border-r border-slate-200">
                          <input
                            type="text"
                            disabled={isReadOnly}
                            value={row.note}
                            onChange={(e) => updateRow(row.rowId, { note: e.target.value })}
                            placeholder="Ghi chú..."
                            className="w-full h-9 px-2 rounded-lg border border-slate-300 bg-white font-medium text-slate-700 outline-none focus:border-cyan-600 text-xs sm:text-sm disabled:bg-slate-100 disabled:text-slate-700 disabled:cursor-not-allowed"
                          />
                        </td>

                        {/* THAO TÁC (4 Action Icons styled exactly as sample image: White bg, cyan border, rounded squircle) */}
                        <td className="p-1.5 text-center pr-2 bg-cyan-50/30">
                          <div className="flex items-center justify-center gap-1.5">
                            {/* 1. Gợi ý vị trí cất hàng (AI Slotting) */}
                            <button
                              type="button"
                              onClick={() => {
                                setAiSlottingTargetRowId(row.rowId);
                                setShowAiSlottingModal(true);
                              }}
                              className={`flex h-8 w-8 items-center justify-center rounded-xl transition cursor-pointer ${
                                row.assignedBins && row.assignedBins.length > 0
                                  ? 'border border-emerald-600 bg-emerald-600 text-white shadow-xs hover:bg-emerald-700'
                                  : 'border border-cyan-400 bg-white text-cyan-600 shadow-2xs hover:bg-cyan-600 hover:text-white hover:border-cyan-600'
                              }`}
                              title={
                                row.assignedBins && row.assignedBins.length > 0
                                  ? `Vị trí ô kệ: ${row.locationBin || row.assignedBins.join(', ')}`
                                  : 'Gợi ý vị trí cất hàng vào kho (AI Slotting Grid)'
                              }
                            >
                              <Sparkles size={16} strokeWidth={2} />
                            </button>

                             {/* 2. Cấu hình Trọng lượng & Thể tích */}
                            <button
                              type="button"
                              onClick={() => setWeightModalRow(row)}
                              className={`flex h-8 w-8 items-center justify-center rounded-xl transition cursor-pointer ${
                                hasWeightOrVol
                                  ? 'border border-emerald-600 bg-emerald-600 text-white shadow-xs hover:bg-emerald-700'
                                  : 'border border-cyan-400 bg-white text-cyan-600 shadow-2xs hover:bg-cyan-600 hover:text-white hover:border-cyan-600'
                              }`}
                              title={
                                hasWeightOrVol
                                  ? `Trọng lượng: ${(row.weight || 0).toFixed(1)} kg, Thể tích: ${(row.volume || 0).toFixed(3)} m³`
                                  : 'Cấu hình Trọng lượng & Thể tích'
                              }
                            >
                              <Scale size={16} strokeWidth={2} />
                            </button>

                            {!isReadOnly && (
                              <>
                                {/* 3. Nhân đôi dòng */}
                                <button
                                  type="button"
                                  onClick={() => handleDuplicateRow(idx)}
                                  className="flex h-8 w-8 items-center justify-center rounded-xl border border-cyan-400 bg-white text-cyan-600 shadow-2xs transition hover:bg-cyan-600 hover:text-white hover:border-cyan-600 cursor-pointer"
                                  title="Nhân đôi dòng"
                                >
                                  <Copy size={16} strokeWidth={2} />
                                </button>

                                {/* 4. Xóa dòng */}
                                <button
                                  type="button"
                                  onClick={() => handleRemoveRow(row.rowId)}
                                  className="flex h-8 w-8 items-center justify-center rounded-xl border border-rose-300 bg-white text-rose-500 shadow-2xs transition hover:bg-rose-600 hover:text-white hover:border-rose-600 cursor-pointer"
                                  title="Xóa dòng"
                                >
                                  <Trash2 size={16} strokeWidth={2} />
                                </button>
                              </>
                            )}
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
                onClick={() => {
                  if (isReadOnly) return;
                  setShowEmployeeDropdown((prev) => !prev);
                }}
                className={`h-10 w-full rounded-xl border-2 border-slate-300 bg-white px-3 text-xs sm:text-sm font-bold text-slate-800 flex items-center justify-between outline-none shadow-xs transition ${
                  isReadOnly ? 'bg-slate-100 text-slate-600 cursor-not-allowed' : 'cursor-pointer hover:border-cyan-500'
                }`}
              >
                <span className="truncate">{activeTab?.employeeName || currentUserName}</span>
                <ChevronDown
                  size={16}
                  className={`text-slate-500 transition-transform duration-200 ${showEmployeeDropdown ? 'rotate-180' : ''}`}
                />
              </div>

              {!isReadOnly && showEmployeeDropdown && (
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
                disabled={isReadOnly}
                value={activeTab?.description || ''}
                onChange={(e) => updateActiveTab((t) => ({ ...t, description: e.target.value }))}
                placeholder="Nhập ghi chú..."
                className="w-full p-1.5 rounded-lg border-2 border-slate-200 bg-white font-medium text-slate-700 outline-none focus:border-cyan-600 resize-none text-xs disabled:bg-slate-100 disabled:text-slate-600 disabled:cursor-not-allowed"
              />
            </div>

            {/* Hình thức thanh toán Radios */}
            <div className="space-y-1.5 text-xs font-semibold text-slate-800 border-t border-slate-200 pt-1.5">
              <label className="block font-bold text-slate-700">Hình thức thanh toán:</label>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-1 cursor-pointer">
                  <input
                    type="radio"
                    disabled={isReadOnly}
                    name="inboundPaymentMethod"
                    value="Tiền mặt"
                    checked={(activeTab?.paymentMethod || 'Tiền mặt') === 'Tiền mặt'}
                    onChange={(e) => updateActiveTab((t) => ({ ...t, paymentMethod: e.target.value }))}
                    className="h-3.5 w-3.5 text-cyan-600 focus:ring-cyan-500 cursor-pointer disabled:cursor-not-allowed"
                  />
                  <span>Tiền mặt</span>
                </label>
                <label className="flex items-center gap-1 cursor-pointer">
                  <input
                    type="radio"
                    disabled={isReadOnly}
                    name="inboundPaymentMethod"
                    value="Chuyển khoản"
                    checked={activeTab?.paymentMethod === 'Chuyển khoản'}
                    onChange={(e) => updateActiveTab((t) => ({ ...t, paymentMethod: e.target.value }))}
                    className="h-3.5 w-3.5 text-cyan-600 focus:ring-cyan-500 cursor-pointer disabled:cursor-not-allowed"
                  />
                  <span>Chuyển khoản</span>
                </label>
                <label className="flex items-center gap-1 cursor-pointer">
                  <input
                    type="radio"
                    disabled={isReadOnly}
                    name="inboundPaymentMethod"
                    value="ATM"
                    checked={activeTab?.paymentMethod === 'ATM'}
                    onChange={(e) => updateActiveTab((t) => ({ ...t, paymentMethod: e.target.value }))}
                    className="h-3.5 w-3.5 text-cyan-600 focus:ring-cyan-500 cursor-pointer disabled:cursor-not-allowed"
                  />
                  <span>ATM</span>
                </label>
              </div>

              {/* Tài khoản thanh toán (Custom Dropdown) */}
              <div className="relative account-dropdown-box mt-2">
                <label className="mb-1 block text-xs font-bold text-slate-700">Tài khoản thanh toán</label>
                <div
                  onClick={() => {
                    if (isReadOnly) return;
                    setShowAccountDropdown((prev) => !prev);
                  }}
                  className={`h-10 w-full rounded-xl border-2 border-slate-300 bg-white px-3 text-xs sm:text-sm font-bold text-slate-800 flex items-center justify-between outline-none shadow-xs transition ${
                    isReadOnly ? 'bg-slate-100 text-slate-600 cursor-not-allowed' : 'cursor-pointer hover:border-cyan-500'
                  }`}
                >
                  <span className="truncate">
                    {activeTab?.paymentAccount || 'Chọn tài khoản thanh toán...'}
                  </span>
                  <ChevronDown
                    size={16}
                    className={`text-slate-500 transition-transform duration-200 ${showAccountDropdown ? 'rotate-180' : ''}`}
                  />
                </div>

                {!isReadOnly && showAccountDropdown && (
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
            <div className="rounded-xl border-2 border-cyan-200 bg-cyan-50/60 p-3 shadow-sm space-y-2 text-slate-800">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                <span>Thành tiền hàng:</span>
                <span className="font-extrabold text-slate-900">{rawGoodsSubtotal.toLocaleString('vi-VN')} đ</span>
              </div>

              <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                <span>Chiết khấu:</span>
                <span className="font-extrabold text-slate-900">
                  {totalDiscount > 0 ? `-${totalDiscount.toLocaleString('vi-VN')} đ` : '0 đ'}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                <span>Thuế VAT:</span>
                <span className="font-extrabold text-emerald-700">
                  {totalVat > 0 ? `+${totalVat.toLocaleString('vi-VN')} đ` : '0 đ'}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                <span>Phí vận chuyển:</span>
                <span className="font-extrabold text-slate-900">
                  {activeTab?.shippingFee ? `${activeTab.shippingFee.toLocaleString('vi-VN')} đ` : '0 đ'}
                </span>
              </div>

              <div className="border-t border-slate-300/80 pt-2 flex items-center justify-between">
                <span className="text-xs font-extrabold uppercase tracking-wide text-cyan-900">
                  TỔNG THÀNH TOÁN:
                </span>
                <span className="text-sm font-black text-cyan-700 tracking-tight">
                  {grandTotal.toLocaleString('vi-VN')} đ
                </span>
              </div>

              <div className="space-y-1 pt-1.5 border-t border-slate-200">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700">Trả nhà cung cấp:</span>
                  <button
                    type="button"
                    disabled={isReadOnly}
                    onClick={() => updateActiveTab((t) => ({ ...t, amountPaid: grandTotal }))}
                    className="text-[10px] font-black text-cyan-700 hover:text-cyan-900 hover:underline cursor-pointer disabled:opacity-50"
                  >
                    Trả đủ (100%)
                  </button>
                </div>
                <div className="relative flex items-center">
                  <FormattedNumberInput
                    disabled={isReadOnly}
                    value={activeTab?.amountPaid}
                    onChange={(val) => updateActiveTab((t) => ({ ...t, amountPaid: val }))}
                    placeholder="0"
                    className="w-full h-9 pl-3 pr-7 text-right rounded-xl border-2 border-emerald-500 bg-white font-black text-emerald-700 outline-none focus:ring-2 focus:ring-emerald-500/20 text-xs sm:text-sm disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed shadow-2xs"
                  />
                  <span className="absolute right-2.5 font-bold text-slate-500 text-xs pointer-events-none">đ</span>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs font-semibold pt-1 border-t border-slate-200">
                <span className="text-slate-700">Còn nợ lại NCC:</span>
                <span className={`font-extrabold ${remainingDebt > 0 ? 'text-red-600' : 'text-slate-900'}`}>
                  {remainingDebt.toLocaleString('vi-VN')} đ
                </span>
              </div>
            </div>
          </div>

          {/* Unified Large Prominent Action Buttons */}
          <div className="space-y-2 pt-2 flex-shrink-0">
            {actionParam === 'view' ? (
              <>
                <div className="rounded-xl border border-cyan-300 bg-cyan-50 p-3 text-center text-xs font-bold text-cyan-900 shadow-xs flex items-center justify-center gap-2">
                  <AlertCircle size={16} className="text-cyan-700 flex-shrink-0" />
                  <span>Đang xem chi tiết phiếu nhập kho ở chế độ Chỉ đọc (Read-only).</span>
                </div>
                <button
                  type="button"
                  onClick={handleBackNavigation}
                  className="w-full h-11 flex items-center justify-center gap-2 rounded-xl bg-cyan-700 px-4 py-2.5 text-xs sm:text-sm font-black uppercase tracking-wide text-white shadow-md hover:bg-cyan-800 transition active:scale-95 cursor-pointer"
                >
                  <ArrowLeft size={18} strokeWidth={2.2} />
                  <span>QUAY LẠI DANH SÁCH</span>
                </button>
              </>
            ) : (
              <>
                {activeTab?.id && !['DRAFT', 'draft', 'Đơn nháp'].includes(activeTab?.status || 'DRAFT') && (
                  <div className="rounded-xl border border-amber-300 bg-amber-50 p-2.5 text-center text-xs font-extrabold text-amber-800 shadow-xs">
                    🔒 Phiếu đã lưu chính thức ({activeTab.status || 'Đã nhập kho'}). Chỉ hỗ trợ xem thông tin, không thể chỉnh sửa.
                  </div>
                )}

                <button
                  type="button"
                  disabled={saving || (Boolean(activeTab?.id) && !['DRAFT', 'draft', 'Đơn nháp'].includes(activeTab?.status || 'DRAFT'))}
                  onClick={() => handleSaveInboundOrder(true, 'COMPLETED')}
                  className="w-full h-11 flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs sm:text-sm font-black uppercase tracking-wide text-white shadow-md hover:bg-emerald-700 transition active:scale-95 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Printer size={18} strokeWidth={2.2} />
                  <span>Lưu & In phiếu nhập</span>
                </button>

                <button
                  type="button"
                  disabled={saving || (Boolean(activeTab?.id) && !['DRAFT', 'draft', 'Đơn nháp'].includes(activeTab?.status || 'DRAFT'))}
                  onClick={() => handleSaveInboundOrder(false, 'COMPLETED')}
                  className="w-full h-11 flex items-center justify-center gap-2 rounded-xl bg-cyan-700 px-4 py-2.5 text-xs sm:text-sm font-black uppercase tracking-wide text-white shadow-md hover:bg-cyan-800 transition active:scale-95 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Save size={18} strokeWidth={2.2} />
                  <span>Lưu phiếu nhập kho</span>
                </button>

                <button
                  type="button"
                  disabled={saving || (Boolean(activeTab?.id) && !['DRAFT', 'draft', 'Đơn nháp'].includes(activeTab?.status || 'DRAFT'))}
                  onClick={() => handleSaveInboundOrder(false, 'DRAFT')}
                  className="w-full h-11 flex items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-xs sm:text-sm font-black uppercase tracking-wide text-white shadow-sm hover:bg-amber-600 transition active:scale-95 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
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
              </>
            )}
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

      {/* AI Slotting Chat & Warehouse Location Guidance Modal */}
      <AiSlottingChatModal
        isOpen={showAiSlottingModal}
        onClose={() => {
          setShowAiSlottingModal(false);
          setAiSlottingTargetRowId(null);
        }}
        items={activeValidItems}
        targetRowId={aiSlottingTargetRowId}
        warehouseCode={activeTab?.warehouseCode || 'KH006'}
        onConfirmAll={handleConfirmAiSlotting}
        onSkipAi={handleSkipAiSlotting}
        isFinalSaving={!!pendingSaveConfig}
      />

      {/* Storage Information Modal (Xem thông tin lưu trữ tại các kho) */}
      {storageInfoProduct && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-3xl overflow-hidden rounded-3xl bg-white shadow-2xl animate-[fadeIn_0.15s_ease-out]">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-cyan-800/20 bg-gradient-to-r from-cyan-600 to-cyan-800 px-6 py-4 text-white">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-white/20 p-2 text-white shadow-inner">
                  <Building2 className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-lg font-black tracking-wide text-white">Thông Tin Lưu Trữ Tồn Kho Hàng Hóa</h3>
                  <p className="text-xs text-cyan-100 font-bold">
                    Mã SKU: <span className="text-amber-300">{storageInfoProduct.productSku}</span> | {storageInfoProduct.productName}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setStorageInfoProduct(null)}
                className="rounded-xl p-1.5 text-white/80 hover:bg-white/20 hover:text-white transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 max-h-[70vh] overflow-y-auto space-y-4">
              <div className="flex items-center justify-between rounded-2xl border-2 border-cyan-200 bg-cyan-50/70 p-4 shadow-xs">
                <div>
                  <p className="text-xs font-black uppercase text-slate-500">Tổng tồn kho toàn hệ thống</p>
                  <p className="text-2xl font-black text-cyan-950 mt-0.5">
                    {(storageInfoBalances.reduce((s, b) => s + (Number(b.available) || Number(b.totalPhysical) || 0), 0)).toLocaleString('vi-VN')} {storageInfoProduct.unit}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-black uppercase text-slate-500">Số kho đang lưu trữ</p>
                  <p className="text-lg font-black text-cyan-900 mt-0.5">
                    {storageInfoBalances.length > 0 ? `${storageInfoBalances.length} vị trí / kho` : 'Chưa có ghi nhận'}
                  </p>
                </div>
              </div>

              <div className="overflow-hidden rounded-2xl border-2 border-slate-200 bg-white shadow-xs">
                <table className="w-full text-left text-sm border-collapse">
                  <thead className="bg-slate-100 text-xs font-black uppercase text-slate-700 border-b-2 border-slate-200">
                    <tr>
                      <th className="p-3 border-r border-slate-200">Kho Hàng</th>
                      <th className="p-3 border-r border-slate-200 text-center">Vị Trí / Ô Kệ</th>
                      <th className="p-3 border-r border-slate-200 text-right">Tồn Thực Tế</th>
                      <th className="p-3 border-r border-slate-200 text-right">Đang Giữ</th>
                      <th className="p-3 border-r border-slate-200 text-right">Khả Dụng</th>
                      <th className="p-3 text-center">Trạng Thái</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {loadingStorageInfo ? (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-sm font-bold text-slate-400">
                          Đang truy vấn thông tin kho lưu trữ...
                        </td>
                      </tr>
                    ) : storageInfoBalances.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-sm font-bold text-slate-400">
                          Chưa có vị trí ô kệ hoặc thông tin tồn kho cho hàng hóa này.
                        </td>
                      </tr>
                    ) : (
                      storageInfoBalances.map((b: any, idx: number) => {
                        const avail = Number(b.available || 0);
                        const phys = Number(b.totalPhysical || avail);
                        const alloc = Number(b.allocated || 0);
                        const loc = b.locationCode || 'KH006';
                        const whName = warehouses.find(w => w.code === loc)?.name || (loc === 'KH006' ? 'Kho Thanh Trì' : `Kho ${loc}`);

                        return (
                          <tr key={b.id || idx} className="hover:bg-cyan-50/50 font-medium text-slate-800 transition">
                            <td className="p-3 border-r border-slate-100 font-extrabold text-cyan-900">
                              {whName} ({loc})
                            </td>
                            <td className="p-3 border-r border-slate-100 text-center font-bold text-slate-700">
                              <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1 text-xs text-slate-800 font-black border border-slate-200">
                                <MapPin className="h-3.5 w-3.5 text-cyan-600" />
                                {b.binCode || loc}
                              </span>
                            </td>
                            <td className="p-3 border-r border-slate-100 text-right font-black text-slate-900">
                              {phys.toLocaleString('vi-VN')}
                            </td>
                            <td className="p-3 border-r border-slate-100 text-right font-bold text-amber-600">
                              {alloc.toLocaleString('vi-VN')}
                            </td>
                            <td className="p-3 border-r border-slate-100 text-right font-black text-cyan-800">
                              {avail.toLocaleString('vi-VN')}
                            </td>
                            <td className="p-3 text-center">
                              <span className={`inline-flex rounded-full px-3 py-1 text-xs font-black border ${
                                avail > 10
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                                  : avail > 0
                                  ? 'bg-amber-50 text-amber-700 border-amber-300'
                                  : 'bg-rose-50 text-rose-700 border-rose-300'
                              }`}>
                                {avail > 10 ? 'Sẵn sàng' : avail > 0 ? 'Sắp hết' : 'Hết hàng'}
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex justify-end bg-slate-50 border-t-2 border-slate-200 px-6 py-3.5">
              <button
                type="button"
                onClick={() => setStorageInfoProduct(null)}
                className="rounded-xl border-2 border-slate-300 bg-white px-6 py-2.5 text-sm font-black text-slate-700 shadow-2xs hover:bg-slate-100 transition cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  if (standalone) {
    return <MainLayout>{contentMarkup}</MainLayout>;
  }

  return contentMarkup;
}
