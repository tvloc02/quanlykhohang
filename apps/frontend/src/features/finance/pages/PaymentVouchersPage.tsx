import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Plus,
  Trash2,
  Printer,
  FileSpreadsheet,
  Search,
  X,
  Save,
  CheckCircle,
  XCircle,
  CreditCard,
  Eye,
  Pencil,
  Copy,
  Maximize2,
  Minimize2,
  Settings,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Filter,
  ChevronDown,
} from 'lucide-react';
import * as XLSX from 'xlsx';

export interface PaymentVoucher {
  id: string;
  code: string;
  date: string;
  type: string;
  targetName: string;
  addressTel: string;
  paymentMethod: 'Tiền mặt' | 'Chuyển khoản' | 'COD' | 'ATM';
  wallet: string;
  amount: number;
  staffName: string;
  note: string;
}

const STORAGE_KEY = 'smart-wms-payment-vouchers-data';
const API_BASE_URL = '/api';

export interface PartnerOption {
  id: string;
  name: string;
  type: 'Khách hàng' | 'Nhà cung cấp';
  phone?: string;
  address?: string;
}

const DEFAULT_PARTNERS: PartnerOption[] = [
  // Nhà cung cấp
  { id: 'sup-1', name: 'Nhà cung cấp An Bình', type: 'Nhà cung cấp', phone: '0977112233', address: 'Số 10 Kho Tân Triều, Thanh Trì, Hà Nội' },
  { id: 'sup-2', name: 'Công ty TNHH Thiết Bị Điện Hải Hà', type: 'Nhà cung cấp', phone: '0966445566', address: 'KCN Bắc Thăng Long, Hà Nội' },
  { id: 'sup-3', name: 'Tổng Công ty Vật Tư Kho Bãi Việt Nam', type: 'Nhà cung cấp', phone: '0944889900', address: 'Quận Hải Châu, Đà Nẵng' },
  // Khách hàng
  { id: 'cust-1', name: 'Công ty TNHH Thương Mại Minh Long', type: 'Khách hàng', phone: '0912345678', address: '123 Nguyễn Trãi, Thanh Xuân, Hà Nội' },
  { id: 'cust-2', name: 'Công ty Cổ Phần XNK Nam Anh', type: 'Khách hàng', phone: '0987654321', address: '45 Lê Văn Lương, Cầu Giấy, Hà Nội' },
  { id: 'cust-3', name: 'Khách hàng bán lẻ (Khách lẻ)', type: 'Khách hàng', phone: '0901234567', address: 'Hà Nội' },
  { id: 'cust-4', name: 'Tập đoàn Công nghệ Viễn Đông', type: 'Khách hàng', phone: '0934567890', address: 'Quận 1, TP. Hồ Chí Minh' },
];

interface FormattedPriceInputProps {
  value: number | '' | undefined | null;
  onChange: (val: number) => void;
  readOnly?: boolean;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

function FormattedPriceInput({
  value,
  onChange,
  readOnly,
  disabled,
  placeholder = '0',
  className,
}: FormattedPriceInputProps) {
  const formatVal = (v: number | '' | undefined | null): string => {
    if (v === '' || v === undefined || v === null || v === 0) return '0';
    const num = Number(v);
    if (isNaN(num)) return '0';
    return num.toLocaleString('vi-VN');
  };

  const [displayValue, setDisplayValue] = useState<string>(formatVal(value));

  useEffect(() => {
    setDisplayValue(formatVal(value));
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawStr = e.target.value;
    const digitsOnly = rawStr.replace(/\D/g, '');
    if (!digitsOnly) {
      setDisplayValue('0');
      onChange(0);
    } else {
      const num = parseInt(digitsOnly, 10);
      setDisplayValue(num.toLocaleString('vi-VN'));
      onChange(num);
    }
  };

  return (
    <input
      type="text"
      inputMode="numeric"
      value={displayValue}
      onChange={handleChange}
      readOnly={readOnly}
      disabled={disabled}
      placeholder={placeholder}
      className={className}
    />
  );
}

interface SearchablePartnerSelectProps {
  value: string;
  onChange: (partnerName: string, selectedPartner?: PartnerOption) => void;
  partners: PartnerOption[];
  disabled?: boolean;
  placeholder?: string;
}

function SearchablePartnerSelect({
  value,
  onChange,
  partners,
  disabled,
  placeholder = '-- Chọn Nhà cung cấp / Khách hàng / Đối tác --',
}: SearchablePartnerSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredPartners = useMemo(() => {
    if (!searchQuery.trim()) return partners;
    const q = searchQuery.toLowerCase();
    return partners.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.phone && p.phone.includes(q)) ||
        (p.address && p.address.toLowerCase().includes(q))
    );
  }, [partners, searchQuery]);

  const customers = useMemo(() => filteredPartners.filter((p) => p.type === 'Khách hàng'), [filteredPartners]);
  const suppliers = useMemo(() => filteredPartners.filter((p) => p.type === 'Nhà cung cấp'), [filteredPartners]);

  return (
    <div className="relative w-full" ref={containerRef}>
      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className="w-full rounded-xl border-2 border-cyan-500 bg-white px-3.5 py-2.5 text-sm font-bold text-slate-800 flex items-center justify-between outline-none focus:ring-4 focus:ring-cyan-500/10 cursor-pointer hover:bg-slate-50 transition"
      >
        <span className={value ? 'text-slate-800 font-bold' : 'text-slate-400 font-normal'}>
          {value || placeholder}
        </span>
        <ChevronDown size={18} className={`text-slate-500 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Floating Dropdown Panel */}
      {isOpen && !disabled && (
        <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-white rounded-xl border border-slate-300 shadow-xl overflow-hidden p-2 space-y-1.5 max-h-72 flex flex-col">
          {/* Search Input Bar */}
          <div className="relative flex items-center shrink-0">
            <Search size={15} className="absolute left-3 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm kiếm đối tượng, SĐT..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-7 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 bg-white focus:border-cyan-500 outline-none"
              autoFocus
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 text-slate-400 hover:text-slate-600 text-xs font-bold"
              >
                ✕
              </button>
            )}
          </div>

          {/* List Options */}
          <div className="overflow-y-auto space-y-2 pr-0.5 flex-1 text-xs">
            {suppliers.length > 0 && (
              <div>
                <div className="text-[11px] font-bold text-slate-400 uppercase px-2 py-1 tracking-wide">
                  Nhà cung cấp
                </div>
                <div className="space-y-0.5">
                  {suppliers.map((s) => (
                    <div
                      key={s.id}
                      onClick={() => {
                        onChange(s.name, s);
                        setIsOpen(false);
                        setSearchQuery('');
                      }}
                      className={`px-3 py-2 rounded-lg font-semibold cursor-pointer transition flex items-center justify-between ${
                        value === s.name
                          ? 'bg-cyan-50 text-cyan-900 font-bold'
                          : 'hover:bg-slate-100 text-slate-700'
                      }`}
                    >
                      <span>{s.name}</span>
                      {s.phone && <span className="text-slate-400 text-[11px] font-mono">{s.phone}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {customers.length > 0 && (
              <div>
                <div className="text-[11px] font-bold text-slate-400 uppercase px-2 py-1 tracking-wide">
                  Khách hàng
                </div>
                <div className="space-y-0.5">
                  {customers.map((c) => (
                    <div
                      key={c.id}
                      onClick={() => {
                        onChange(c.name, c);
                        setIsOpen(false);
                        setSearchQuery('');
                      }}
                      className={`px-3 py-2 rounded-lg font-semibold cursor-pointer transition flex items-center justify-between ${
                        value === c.name
                          ? 'bg-cyan-50 text-cyan-900 font-bold'
                          : 'hover:bg-slate-100 text-slate-700'
                      }`}
                    >
                      <span>{c.name}</span>
                      {c.phone && <span className="text-slate-400 text-[11px] font-mono">{c.phone}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {filteredPartners.length === 0 && (
              <div className="p-3 text-center text-xs text-slate-400">
                Không tìm thấy "{searchQuery}"
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
  };
}

export function readStoredPaymentVouchers(): PaymentVoucher[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // fallback
  }
  return [];
}

export function saveStoredPaymentVouchers(items: PaymentVoucher[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  window.dispatchEvent(new Event('storage'));
}

export default function PaymentVouchersPage() {
  const [vouchers, setVouchers] = useState<PaymentVoucher[]>(readStoredPaymentVouchers);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isFullScreen, setIsFullScreen] = useState(false);

  // Column visibility state
  const [columnVis, setColumnVis] = useState({
    code: true,
    date: true,
    type: true,
    targetName: true,
    amount: true,
    paymentMethod: true,
    wallet: true,
    staffName: true,
    note: true,
  });
  const [showColumnModal, setShowColumnModal] = useState(false);

  // Real Partners (Suppliers + Customers) & Staff from System
  const [partners, setPartners] = useState<PartnerOption[]>(DEFAULT_PARTNERS);
  const [staffList, setStaffList] = useState<{ id: string; fullName: string; email: string }[]>([]);

  // Filter states
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 3);
    return d.toISOString().split('T')[0];
  });
  const [toDate, setToDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [searchQuery, setSearchQuery] = useState('');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState('ALL');

  // Pagination states
  const [pageSize, setPageSize] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'view' | 'edit' | null>(null);

  // Toast
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error'>('success');

  // Current logged in user
  const currentUser = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('user') || '{}');
    } catch {
      return {};
    }
  }, []);
  const defaultStaffName = currentUser.fullName || currentUser.email || 'Admin';

  // Form State
  const [form, setForm] = useState<PaymentVoucher>({
    id: '',
    code: '',
    date: new Date().toISOString().split('T')[0],
    type: '201 Chi trả nhà cung cấp',
    targetName: '',
    addressTel: '-',
    paymentMethod: 'Tiền mặt',
    wallet: 'Ví tiền mặt chính',
    amount: 0,
    staffName: defaultStaffName,
    note: '',
  });

  // Load Real Suppliers, Customers & Staff from System API
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [supRes, custRes, userRes] = await Promise.all([
          fetch(`${API_BASE_URL}/suppliers`, { headers: authHeaders() }).catch(() => null),
          fetch(`${API_BASE_URL}/customers`, { headers: authHeaders() }).catch(() => null),
          fetch(`${API_BASE_URL}/users`, { headers: authHeaders() }).catch(() => null),
        ]);

        const loadedPartners: PartnerOption[] = [];

        if (supRes && supRes.ok) {
          const data = await supRes.json();
          if (Array.isArray(data)) {
            data.forEach((s: any) => {
              loadedPartners.push({
                id: `sup-${s.id}`,
                name: String(s.name || s.fullName || s.code),
                type: 'Nhà cung cấp',
                phone: s.phone,
                address: s.address,
              });
            });
          }
        }

        if (custRes && custRes.ok) {
          const data = await custRes.json();
          if (Array.isArray(data)) {
            data.forEach((c: any) => {
              loadedPartners.push({
                id: `cust-${c.id}`,
                name: String(c.name || c.fullName || c.code),
                type: 'Khách hàng',
                phone: c.phone,
                address: c.address,
              });
            });
          }
        }

        if (loadedPartners.length > 0) {
          setPartners(loadedPartners);
        } else {
          setPartners(DEFAULT_PARTNERS);
        }

        if (userRes && userRes.ok) {
          const data = await userRes.json();
          if (Array.isArray(data)) {
            setStaffList(
              data.map((u: any) => ({
                id: String(u.id),
                fullName: String(u.fullName || u.email?.split('@')[0]),
                email: String(u.email),
              }))
            );
          }
        }
      } catch {
        setPartners(DEFAULT_PARTNERS);
      }
    };
    fetchData();
  }, []);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToastMessage(msg);
    setToastType(type);
    setTimeout(() => setToastMessage(''), 3500);
  };

  const handleOpenCreateModal = () => {
    const now = new Date();
    const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    const newCode = `PC-${dateStr}-${String(vouchers.length + 1).padStart(3, '0')}`;
    setForm({
      id: `pc-${Date.now()}`,
      code: newCode,
      date: new Date().toISOString().split('T')[0],
      type: '201 Chi trả nhà cung cấp',
      targetName: '',
      addressTel: '-',
      paymentMethod: 'Tiền mặt',
      wallet: 'Ví tiền mặt chính',
      amount: 0,
      staffName: defaultStaffName,
      note: '',
    });
    setModalMode('create');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (item: PaymentVoucher, mode: 'view' | 'edit' = 'edit') => {
    setForm({ ...item });
    setModalMode(mode);
    setIsModalOpen(true);
  };

  const handleSaveForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.amount || form.amount <= 0) {
      showToast('Vui lòng nhập số tiền chi hợp lệ lớn hơn 0!', 'error');
      return;
    }

    let updated: PaymentVoucher[];
    if (modalMode === 'edit') {
      updated = vouchers.map((v) => (v.id === form.id ? form : v));
      showToast(`Đã cập nhật phiếu chi ${form.code} thành công!`);
    } else {
      updated = [form, ...vouchers];
      showToast(`Đã tạo mới phiếu chi ${form.code} thành công!`);
    }

    setVouchers(updated);
    saveStoredPaymentVouchers(updated);
    setIsModalOpen(false);
  };

  const handleDeleteSelected = () => {
    if (selectedIds.length === 0) return;
    if (confirm(`Bạn có chắc chắn muốn xóa ${selectedIds.length} phiếu chi đã chọn?`)) {
      const updated = vouchers.filter((v) => !selectedIds.includes(v.id));
      setVouchers(updated);
      saveStoredPaymentVouchers(updated);
      setSelectedIds([]);
      showToast(`Đã xóa ${selectedIds.length} phiếu chi!`);
    }
  };

  const handleDeleteSingle = (id: string, code: string) => {
    if (confirm(`Bạn có chắc chắn muốn xóa phiếu chi ${code}?`)) {
      const updated = vouchers.filter((v) => v.id !== id);
      setVouchers(updated);
      saveStoredPaymentVouchers(updated);
      if (selectedIds.includes(id)) {
        setSelectedIds(selectedIds.filter((item) => item !== id));
      }
      showToast(`Đã xóa phiếu chi ${code}!`);
    }
  };

  const handleCopySelected = () => {
    if (selectedIds.length === 0) {
      showToast('Vui lòng chọn ít nhất một phiếu chi để copy!', 'error');
      return;
    }
    const now = new Date();
    const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    const selectedItems = vouchers.filter((v) => selectedIds.includes(v.id));
    
    const newItems: PaymentVoucher[] = selectedItems.map((item, idx) => ({
      ...item,
      id: `pc-${Date.now()}-${idx}`,
      code: `PC-${dateStr}-${String(vouchers.length + idx + 1).padStart(3, '0')}`,
      date: new Date().toISOString().split('T')[0],
      note: item.note ? `${item.note} (Bản sao)` : '(Bản sao)',
    }));

    const updated = [...newItems, ...vouchers];
    setVouchers(updated);
    saveStoredPaymentVouchers(updated);
    showToast(`Đã nhân bản ${newItems.length} phiếu chi thành công!`);
  };

  const handleExportExcel = () => {
    const dataToExport = filteredVouchers.map((v, i) => ({
      STT: i + 1,
      'Mã phiếu': v.code,
      'Ngày lập': v.date,
      'Nội dung chi': v.type,
      'Đối tượng': v.targetName,
      'Số tiền (VND)': v.amount,
      'Hình thức': v.paymentMethod,
      'Tài khoản/Ví': v.wallet,
      'Nhân viên': v.staffName,
      'Ghi chú': v.note,
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Danh_Sach_Phieu_Chi');
    XLSX.writeFile(wb, `Danh_Sach_Phieu_Chi_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const filteredVouchers = useMemo(() => {
    return vouchers.filter((v) => {
      const matchesSearch =
        !searchQuery ||
        v.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        v.targetName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        v.type.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesFrom = !fromDate || v.date >= fromDate;
      const matchesTo = !toDate || v.date <= toDate;
      const matchesMethod = paymentMethodFilter === 'ALL' || v.paymentMethod === paymentMethodFilter;

      return matchesSearch && matchesFrom && matchesTo && matchesMethod;
    });
  }, [vouchers, searchQuery, fromDate, toDate, paymentMethodFilter]);

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, fromDate, toDate, paymentMethodFilter]);

  // Pagination calculations
  const totalItems = filteredVouchers.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const startIndex = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endIndex = Math.min(currentPage * pageSize, totalItems);
  const paginatedVouchers = filteredVouchers.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const toggleSelectAll = () => {
    if (paginatedVouchers.length > 0 && paginatedVouchers.every((v) => selectedIds.includes(v.id))) {
      const currentIds = new Set(paginatedVouchers.map((v) => v.id));
      setSelectedIds((prev) => prev.filter((id) => !currentIds.has(id)));
    } else {
      const currentIds = paginatedVouchers.map((v) => v.id);
      setSelectedIds((prev) => Array.from(new Set([...prev, ...currentIds])));
    }
  };

  return (
    <div className={`space-y-6 text-slate-800 ${isFullScreen ? 'fixed inset-0 z-[9000] bg-white overflow-y-auto p-6' : ''}`}>
      {/* TOAST NOTIFICATION */}
      {toastMessage &&
        createPortal(
          <div
            className={`fixed top-6 right-6 z-[9999] flex items-center gap-3 rounded-2xl px-5 py-3.5 shadow-2xl border backdrop-blur-md animate-in slide-in-from-top-4 ${
              toastType === 'error'
                ? 'bg-red-50/95 text-red-700 border-red-200'
                : 'bg-emerald-50/95 text-emerald-800 border-emerald-200'
            }`}
          >
            {toastType === 'error' ? <XCircle className="h-5 w-5 text-red-600" /> : <CheckCircle className="h-5 w-5 text-emerald-600" />}
            <p className="text-sm font-extrabold">{toastMessage}</p>
          </div>,
          document.body
        )}

      <div className="space-y-6 animate-in fade-in duration-200">
        {/* Top Header Section matching Inbound/Outbound */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="inline-flex items-center gap-2.5 rounded-2xl bg-cyan-600 px-5 py-2.5 text-white shadow-md">
              <CreditCard className="h-5 w-5" />
              <h1 className="text-xl font-extrabold tracking-tight uppercase">QUẢN LÝ PHIẾU CHI TIỀN</h1>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* 1. Thêm mới */}
            <button
              type="button"
              onClick={handleOpenCreateModal}
              className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-cyan-700 bg-white px-5 py-2.5 text-sm font-extrabold text-cyan-700 shadow-xs transition hover:bg-cyan-50 active:scale-95 cursor-pointer"
            >
              <Plus className="h-4.5 w-4.5 text-cyan-700" />
              Thêm mới
            </button>

            {/* 2. Copy */}
            <button
              type="button"
              onClick={handleCopySelected}
              className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-cyan-700 bg-white px-5 py-2.5 text-sm font-extrabold text-cyan-700 shadow-xs transition hover:bg-cyan-50 active:scale-95 cursor-pointer"
            >
              <Copy className="h-4.5 w-4.5 text-cyan-700" />
              Copy {selectedIds.length > 0 ? `(${selectedIds.length})` : ''}
            </button>

            {/* 3. Xóa */}
            <button
              type="button"
              onClick={handleDeleteSelected}
              className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-cyan-700 bg-white px-5 py-2.5 text-sm font-extrabold text-cyan-700 shadow-xs transition hover:bg-cyan-50 active:scale-95 cursor-pointer"
            >
              <Trash2 className="h-4.5 w-4.5 text-cyan-700" />
              Xóa {selectedIds.length > 0 ? `(${selectedIds.length})` : ''}
            </button>

            {/* 4. In báo cáo */}
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-cyan-700 bg-white px-5 py-2.5 text-sm font-extrabold text-cyan-700 shadow-xs transition hover:bg-cyan-50 active:scale-95 cursor-pointer"
            >
              <Printer className="h-4.5 w-4.5 text-cyan-700" />
              In báo cáo
            </button>

            {/* 5. Export Excel */}
            <button
              type="button"
              onClick={handleExportExcel}
              className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-cyan-700 bg-white px-5 py-2.5 text-sm font-extrabold text-cyan-700 shadow-xs transition hover:bg-cyan-50 active:scale-95 cursor-pointer"
            >
              <FileSpreadsheet className="h-4.5 w-4.5 text-cyan-700" />
              Export Excel
            </button>

            {/* 6. Hiển thị */}
            <button
              type="button"
              onClick={() => setShowColumnModal(true)}
              className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-cyan-700 bg-white px-5 py-2.5 text-sm font-extrabold text-cyan-700 shadow-xs transition hover:bg-cyan-50 active:scale-95 cursor-pointer"
            >
              <Settings className="h-4.5 w-4.5 text-cyan-700" />
              Hiển thị
            </button>

            {/* 7. Toàn màn hình */}
            <button
              type="button"
              onClick={() => setIsFullScreen(!isFullScreen)}
              className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-cyan-700 bg-white px-4 py-2.5 text-sm font-extrabold text-cyan-700 shadow-xs transition hover:bg-cyan-50 active:scale-95 cursor-pointer"
              title={isFullScreen ? 'Thoát toàn màn hình' : 'Toàn màn hình'}
            >
              {isFullScreen ? <Minimize2 className="h-4.5 w-4.5 text-cyan-700" /> : <Maximize2 className="h-4.5 w-4.5 text-cyan-700" />}
            </button>
          </div>
        </div>

        {/* High-density Filter & Search Bar */}
        <div className="rounded-2xl border-2 border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            {/* Search Input h-12 */}
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-cyan-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm kiếm theo mã phiếu chi, đối tượng nhận, nội dung chi..."
                className="h-12 w-full rounded-xl border-2 border-cyan-600/30 bg-slate-50/50 pl-11 pr-4 text-sm font-bold text-slate-800 outline-none transition focus:border-cyan-600 focus:bg-white focus:ring-4 focus:ring-cyan-500/10"
              />
            </div>

            {/* Date Range & Payment Filter Container (h-12) */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Date Box */}
              <div className="inline-flex h-12 items-center gap-2 rounded-xl border-2 border-cyan-600/30 bg-slate-50/80 px-3.5 shadow-2xs">
                <span className="text-xs font-extrabold uppercase text-cyan-950 tracking-wide">Từ ngày:</span>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="h-9 rounded-lg border-2 border-slate-300 bg-white px-2.5 text-xs font-bold text-slate-800 outline-none transition focus:border-cyan-600 focus:ring-2 focus:ring-cyan-500/20 cursor-pointer"
                />
                <span className="text-xs font-extrabold uppercase text-cyan-950 tracking-wide ml-1">Đến:</span>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="h-9 rounded-lg border-2 border-slate-300 bg-white px-2.5 text-xs font-bold text-slate-800 outline-none transition focus:border-cyan-600 focus:ring-2 focus:ring-cyan-500/20 cursor-pointer"
                />
              </div>

              {/* Payment Method Filter */}
              <div className="inline-flex h-12 items-center gap-2 rounded-xl border-2 border-cyan-600/30 bg-slate-50/80 px-3.5 shadow-2xs">
                <Filter className="h-4 w-4 text-cyan-600 shrink-0" />
                <span className="text-xs font-extrabold uppercase text-cyan-950 tracking-wide">Hình thức:</span>
                <select
                  value={paymentMethodFilter}
                  onChange={(e) => setPaymentMethodFilter(e.target.value)}
                  className="h-9 rounded-lg border-2 border-slate-300 bg-white px-2.5 text-xs font-bold text-slate-800 outline-none transition focus:border-cyan-600 focus:ring-2 focus:ring-cyan-500/20 cursor-pointer"
                >
                  <option value="ALL">Tất cả</option>
                  <option value="Tiền mặt">Tiền mặt</option>
                  <option value="Chuyển khoản">Chuyển khoản</option>
                  <option value="COD">COD</option>
                  <option value="ATM">ATM</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* High-density Table */}
        <div className="overflow-hidden rounded-2xl border-2 border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full border-collapse text-left min-w-[1450px]">
              <thead className="bg-cyan-50 sticky top-0 z-20 shadow-sm">
                <tr className="border-b-2 border-slate-200 text-slate-800 font-extrabold uppercase text-xs sm:text-sm tracking-wider">
                  <th className="w-12 min-w-[50px] border-r border-slate-200 px-2 py-4 text-center">
                    <input
                      type="checkbox"
                      checked={paginatedVouchers.length > 0 && paginatedVouchers.every((v) => selectedIds.includes(v.id))}
                      onChange={toggleSelectAll}
                      className="h-4.5 w-4.5 rounded border-slate-300 accent-cyan-600 focus:ring-cyan-500 cursor-pointer"
                    />
                  </th>
                  <th className="w-14 min-w-[60px] border-r border-slate-200 px-3 py-4 text-center">STT</th>
                  {columnVis.code && <th className="min-w-[210px] border-r border-slate-200 px-4 py-4 text-center whitespace-nowrap">Mã phiếu</th>}
                  {columnVis.date && <th className="min-w-[130px] border-r border-slate-200 px-3 py-4 text-center">Ngày lập</th>}
                  {columnVis.type && <th className="min-w-[180px] border-r border-slate-200 px-4 py-4 text-center">Nội dung chi</th>}
                  {columnVis.targetName && <th className="min-w-[200px] border-r border-slate-200 px-4 py-4 text-center">Đối tượng nhận</th>}
                  {columnVis.amount && <th className="min-w-[160px] border-r border-slate-200 px-4 py-4 text-center">Số tiền (VND)</th>}
                  {columnVis.paymentMethod && <th className="min-w-[130px] border-r border-slate-200 px-3 py-4 text-center">Hình thức</th>}
                  {columnVis.wallet && <th className="min-w-[160px] border-r border-slate-200 px-3 py-4 text-center">Tài khoản/Ví</th>}
                  {columnVis.staffName && <th className="min-w-[150px] border-r border-slate-200 px-3 py-4 text-center">Nhân viên</th>}
                  {columnVis.note && <th className="min-w-[180px] border-r border-slate-200 px-4 py-4 text-center">Ghi chú</th>}
                  <th className="sticky right-0 top-0 z-30 w-36 min-w-[140px] bg-cyan-100 px-3 py-4 text-center shadow-[-4px_0_12px_rgba(0,0,0,0.05)] border-l border-slate-200 text-cyan-950 font-black">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {paginatedVouchers.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="py-12 text-center text-slate-500 font-semibold text-sm">
                      Chưa có phiếu chi tiền nào. Hãy bấm <b>Thêm mới</b> để tạo bản ghi.
                    </td>
                  </tr>
                ) : (
                  paginatedVouchers.map((v, index) => {
                    const globalIndex = (currentPage - 1) * pageSize + index + 1;
                    const isSelected = selectedIds.includes(v.id);

                    return (
                      <tr
                        key={v.id}
                        className={`group border-b border-slate-200 transition cursor-pointer ${
                          isSelected ? 'bg-cyan-100/60' : 'hover:bg-cyan-50/60'
                        }`}
                      >
                        <td className="border-r border-slate-200 px-2 py-3.5 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              if (e.target.checked) setSelectedIds([...selectedIds, v.id]);
                              else setSelectedIds(selectedIds.filter((id) => id !== v.id));
                            }}
                            className="h-4 w-4 rounded border-slate-300 accent-cyan-600 focus:ring-cyan-500 cursor-pointer"
                          />
                        </td>
                        <td className="border-r border-slate-200 px-3 py-3.5 text-center text-sm font-medium text-slate-700">
                          {globalIndex}
                        </td>
                        {columnVis.code && (
                          <td className="border-r border-slate-200 px-4 py-3.5 text-sm font-extrabold text-cyan-700 whitespace-nowrap">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenEditModal(v, 'view');
                              }}
                              className="text-cyan-700 hover:text-cyan-900 hover:underline font-extrabold text-left cursor-pointer whitespace-nowrap"
                              title="Xem chi tiết phiếu chi"
                            >
                              {v.code}
                            </button>
                          </td>
                        )}
                        {columnVis.date && <td className="border-r border-slate-200 px-3 py-3.5 text-center text-sm font-medium text-slate-700">{v.date}</td>}
                        {columnVis.type && <td className="border-r border-slate-200 px-4 py-3.5 text-sm font-bold text-slate-800">{v.type}</td>}
                        {columnVis.targetName && <td className="border-r border-slate-200 px-4 py-3.5 text-sm font-extrabold text-slate-800">{v.targetName}</td>}
                        {columnVis.amount && (
                          <td className="border-r border-slate-200 px-4 py-3.5 text-right text-sm font-mono font-black text-red-600">
                            {v.amount.toLocaleString('vi-VN')} đ
                          </td>
                        )}
                        {columnVis.paymentMethod && (
                          <td className="border-r border-slate-200 px-3 py-3.5 text-center">
                            <span className="inline-flex rounded-lg bg-cyan-50 border border-cyan-200 px-2.5 py-1 text-xs font-extrabold text-cyan-800">
                              {v.paymentMethod}
                            </span>
                          </td>
                        )}
                        {columnVis.wallet && <td className="border-r border-slate-200 px-3 py-3.5 text-center text-sm font-bold text-slate-700">{v.wallet}</td>}
                        {columnVis.staffName && <td className="border-r border-slate-200 px-3 py-3.5 text-center text-sm font-medium text-slate-700">{v.staffName}</td>}
                        {columnVis.note && <td className="border-r border-slate-200 px-4 py-3.5 text-sm font-medium text-slate-600 max-w-[200px] truncate" title={v.note}>{v.note || '-'}</td>}

                        {/* Sticky Action Column */}
                        <td className="sticky right-0 top-0 z-10 border-l border-slate-200 bg-white px-3 py-3.5 text-center align-middle shadow-[-4px_0_12px_rgba(0,0,0,0.05)] group-hover:bg-cyan-50">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenEditModal(v, 'view');
                              }}
                              className="flex h-9 w-9 items-center justify-center rounded-xl border-2 border-cyan-600 bg-white text-cyan-600 shadow-sm transition hover:bg-cyan-50 cursor-pointer"
                              title="Xem chi tiết"
                            >
                              <Eye size={18} />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenEditModal(v, 'edit');
                              }}
                              className="flex h-9 w-9 items-center justify-center rounded-xl border-2 border-cyan-600 bg-white text-cyan-600 shadow-sm transition hover:bg-cyan-50 cursor-pointer"
                              title="Sửa phiếu chi"
                            >
                              <Pencil size={18} />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteSingle(v.id, v.code);
                              }}
                              className="flex h-9 w-9 items-center justify-center rounded-xl border-2 border-red-500 bg-white text-red-600 shadow-sm transition hover:bg-red-50 cursor-pointer"
                              title="Xóa phiếu chi"
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Standardized Pagination Bar */}
          {totalItems > 0 && (
            <div className="flex flex-col items-center justify-between border-t-2 border-slate-200 bg-slate-50/80 px-6 py-4 sm:flex-row gap-4">
              <div className="text-sm font-semibold text-slate-600">
                Hiển thị <span className="font-extrabold text-slate-900">{startIndex}</span> - <span className="font-extrabold text-slate-900">{endIndex}</span> trên tổng số <span className="font-extrabold text-slate-900">{totalItems}</span> phiếu chi
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-slate-700">Hiển thị:</span>
                  <select
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    className="h-10 rounded-xl border-2 border-cyan-600/30 bg-white px-3 text-sm font-bold text-slate-800 outline-none transition focus:border-cyan-600 cursor-pointer"
                  >
                    <option value={20}>20 / trang</option>
                    <option value={50}>50 / trang</option>
                    <option value={100}>100 / trang</option>
                    <option value={500}>500 / trang</option>
                  </select>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setCurrentPage(1)}
                    disabled={currentPage === 1}
                    className="flex h-10 w-10 items-center justify-center rounded-xl border-2 border-slate-200 bg-white text-slate-600 transition hover:bg-cyan-50 hover:text-cyan-700 disabled:opacity-40 disabled:hover:bg-white cursor-pointer"
                    title="Trang đầu"
                  >
                    <ChevronsLeft className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="flex h-10 w-10 items-center justify-center rounded-xl border-2 border-slate-200 bg-white text-slate-600 transition hover:bg-cyan-50 hover:text-cyan-700 disabled:opacity-40 disabled:hover:bg-white cursor-pointer"
                    title="Trang trước"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>

                  <span className="flex h-10 items-center justify-center rounded-xl bg-cyan-600 px-4 text-sm font-black text-white shadow-xs">
                    {currentPage} / {totalPages}
                  </span>

                  <button
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="flex h-10 w-10 items-center justify-center rounded-xl border-2 border-slate-200 bg-white text-slate-600 transition hover:bg-cyan-50 hover:text-cyan-700 disabled:opacity-40 disabled:hover:bg-white cursor-pointer"
                    title="Trang sau"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() => setCurrentPage(totalPages)}
                    disabled={currentPage === totalPages}
                    className="flex h-10 w-10 items-center justify-center rounded-xl border-2 border-slate-200 bg-white text-slate-600 transition hover:bg-cyan-50 hover:text-cyan-700 disabled:opacity-40 disabled:hover:bg-white cursor-pointer"
                    title="Trang cuối"
                  >
                    <ChevronsRight className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* COLUMN VISIBILITY MODAL */}
      {showColumnModal &&
        createPortal(
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm animate-in fade-in-50">
            <div className="w-full max-w-md overflow-hidden rounded-3xl border-2 border-cyan-500 bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b-2 border-slate-200 bg-cyan-50 px-6 py-4">
                <div className="flex items-center gap-2">
                  <Settings className="h-5 w-5 text-cyan-700" />
                  <h3 className="text-base font-extrabold text-slate-800 uppercase">Cấu hình hiển thị cột</h3>
                </div>
                <button onClick={() => setShowColumnModal(false)} className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-200 transition cursor-pointer">
                  <X size={18} />
                </button>
              </div>
              <div className="p-6 space-y-3">
                {[
                  { key: 'code', label: 'Mã phiếu' },
                  { key: 'date', label: 'Ngày lập' },
                  { key: 'type', label: 'Nội dung chi' },
                  { key: 'targetName', label: 'Đối tượng nhận' },
                  { key: 'amount', label: 'Số tiền (VND)' },
                  { key: 'paymentMethod', label: 'Hình thức thanh toán' },
                  { key: 'wallet', label: 'Tài khoản / Ví' },
                  { key: 'staffName', label: 'Nhân viên lập' },
                  { key: 'note', label: 'Ghi chú' },
                ].map(({ key, label }) => (
                  <label key={key} className="flex items-center gap-3 p-2 rounded-xl hover:bg-cyan-50/50 cursor-pointer font-bold text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={(columnVis as any)[key]}
                      onChange={(e) => setColumnVis({ ...columnVis, [key]: e.target.checked })}
                      className="h-4.5 w-4.5 rounded border-slate-300 accent-cyan-600 focus:ring-cyan-500 cursor-pointer"
                    />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
              <div className="flex items-center justify-end gap-3 border-t-2 border-slate-200 bg-slate-50 px-6 py-4">
                <button
                  type="button"
                  onClick={() => setShowColumnModal(false)}
                  className="rounded-xl bg-cyan-600 px-6 py-2.5 text-sm font-extrabold text-white hover:bg-cyan-700 shadow-md transition cursor-pointer"
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* POPUP FORM MODAL */}
      {isModalOpen &&
        createPortal(
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm animate-in fade-in-50 overflow-y-auto">
            <div className="w-full max-w-2xl overflow-hidden rounded-3xl border-2 border-cyan-500 bg-white shadow-2xl space-y-0 my-auto">
              {/* Modal Header */}
              <div className="flex items-center justify-between border-b-2 border-slate-200 bg-cyan-50 px-6 py-4">
                <div className="flex items-center gap-3">
                  <div className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-3.5 py-1.5 text-white font-black text-sm">
                    <CreditCard className="h-4.5 w-4.5" />
                    {modalMode === 'create' ? 'TẠO PHIẾU CHI MỚI' : modalMode === 'view' ? 'CHI TIẾT PHIẾU CHI' : 'CẬP NHẬT PHIẾU CHI'}
                  </div>
                </div>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-xl p-2 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Modal Form Content */}
              <form onSubmit={handleSaveForm} className="p-6 space-y-4 text-xs font-bold text-slate-700">
                <fieldset disabled={modalMode === 'view'} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-slate-700 font-extrabold">Ngày lập phiếu <span className="text-red-500">*</span></label>
                      <input
                        type="date"
                        value={form.date}
                        onChange={(e) => setForm({ ...form, date: e.target.value })}
                        className="w-full rounded-xl border-2 border-cyan-500 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-800 outline-none focus:ring-4 focus:ring-cyan-500/10"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-slate-700 font-extrabold">Mã phiếu chi <span className="text-red-500">*</span></label>
                      <input
                        type="text"
                        value={form.code}
                        onChange={(e) => setForm({ ...form, code: e.target.value })}
                        className="w-full rounded-xl border-2 border-cyan-500 bg-white px-3.5 py-2.5 font-mono text-sm font-bold text-slate-800 outline-none focus:ring-4 focus:ring-cyan-500/10"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-slate-700 font-extrabold">Nội dung chi tiền</label>
                    <select
                      value={form.type}
                      onChange={(e) => setForm({ ...form, type: e.target.value })}
                      className="w-full rounded-xl border-2 border-cyan-500 bg-white px-3.5 py-2.5 text-sm font-bold text-slate-800 outline-none focus:ring-4 focus:ring-cyan-500/10 cursor-pointer"
                    >
                      <option value="201 Chi trả nhà cung cấp">201 Chi trả nhà cung cấp</option>
                      <option value="202 Chi phí vận chuyển">202 Chi phí vận chuyển</option>
                      <option value="203 Chi lương nhân viên">203 Chi lương nhân viên</option>
                      <option value="204 Chi phí điện nước/quản lý">204 Chi phí điện nước/quản lý</option>
                      <option value="205 Chi phí khác">205 Chi phí khác</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-slate-700 font-extrabold">Đối tượng nhận (Nhà cung cấp / Đối tác) <span className="text-red-500">*</span></label>
                    <SearchablePartnerSelect
                      value={form.targetName}
                      partners={partners}
                      disabled={modalMode === 'view'}
                      placeholder="-- Chọn Nhà cung cấp / Khách hàng / Đối tác --"
                      onChange={(val, selectedPartner) => {
                        setForm({
                          ...form,
                          targetName: val,
                          addressTel: selectedPartner
                            ? `${selectedPartner.address || ''} ${selectedPartner.phone ? `(${selectedPartner.phone})` : ''}`.trim() || '-'
                            : form.addressTel,
                        });
                      }}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-slate-700 font-extrabold">Địa chỉ / Điện thoại</label>
                    <input
                      type="text"
                      value={form.addressTel}
                      onChange={(e) => setForm({ ...form, addressTel: e.target.value })}
                      className="w-full rounded-xl border-2 border-cyan-500 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-800 outline-none focus:ring-4 focus:ring-cyan-500/10"
                    />
                  </div>

                  {/* Payment Method */}
                  <div className="space-y-1.5">
                    <label className="text-slate-700 font-extrabold">Hình thức thanh toán</label>
                    <div className="flex flex-wrap items-center gap-6 pt-1">
                      {(['Tiền mặt', 'Chuyển khoản', 'COD', 'ATM'] as const).map((method) => (
                        <label key={method} className="flex items-center gap-2 cursor-pointer text-sm font-bold text-slate-800">
                          <input
                            type="radio"
                            name="paymentMethod"
                            checked={form.paymentMethod === method}
                            onChange={() => setForm({ ...form, paymentMethod: method })}
                            className="h-4 w-4 accent-cyan-600 focus:ring-cyan-500 cursor-pointer"
                          />
                          <span>{method}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Wallet Select */}
                  <div className="space-y-1.5">
                    <label className="text-slate-700 font-extrabold">Ví tiền mặt / Tài khoản chi</label>
                    <select
                      value={form.wallet}
                      onChange={(e) => setForm({ ...form, wallet: e.target.value })}
                      className="w-full rounded-xl border-2 border-cyan-500 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-800 outline-none focus:ring-4 focus:ring-cyan-500/10 cursor-pointer"
                    >
                      <option value="Ví tiền mặt chính">Ví tiền mặt chính</option>
                      <option value="BIDV - CN.Thăng Long">BIDV - CN.Thăng Long</option>
                      <option value="Vietcombank - Chi nhánh Hà Nội">Vietcombank - Chi nhánh Hà Nội</option>
                    </select>
                  </div>

                  {/* Amount Highlight Field */}
                  <div className="space-y-1.5 pt-1">
                    <label className="text-slate-700 font-extrabold text-xs uppercase flex items-center gap-1">
                      <span>Số tiền chi thực tế (VND):</span>
                      <span className="text-red-500">*</span>
                    </label>
                    <div className="flex items-center gap-2 w-full">
                      <div className="relative flex-1">
                        <FormattedPriceInput
                          value={form.amount}
                          onChange={(val) => setForm({ ...form, amount: val })}
                          readOnly={modalMode === 'view'}
                          placeholder="0"
                          className="w-full rounded-xl border-2 border-cyan-500 bg-white px-3.5 py-2.5 font-mono text-sm font-bold text-slate-800 outline-none focus:ring-4 focus:ring-cyan-500/10 transition"
                        />
                      </div>
                      <span className="flex items-center justify-center rounded-xl border-2 border-cyan-500 bg-cyan-50 px-3.5 py-2.5 font-black text-cyan-800 text-xs shrink-0 h-[42px]">
                        VND
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-slate-700 font-extrabold">Nhân viên lập phiếu</label>
                    {staffList.length > 0 ? (
                      <select
                        value={form.staffName}
                        onChange={(e) => setForm({ ...form, staffName: e.target.value })}
                        className="w-full rounded-xl border-2 border-cyan-500 bg-white px-3.5 py-2.5 text-sm font-bold text-slate-800 outline-none focus:ring-4 focus:ring-cyan-500/10 cursor-pointer"
                      >
                        {staffList.map((s) => (
                          <option key={s.id} value={s.fullName}>
                            {s.fullName} ({s.email})
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        value={form.staffName}
                        onChange={(e) => setForm({ ...form, staffName: e.target.value })}
                        className="w-full rounded-xl border-2 border-cyan-500 bg-white px-3.5 py-2.5 text-sm font-bold text-slate-800 outline-none"
                      />
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-slate-700 font-extrabold">Nội dung / Ghi chú</label>
                    <textarea
                      rows={2}
                      value={form.note}
                      onChange={(e) => setForm({ ...form, note: e.target.value })}
                      className="w-full rounded-xl border-2 border-cyan-500 bg-white p-3 text-sm font-semibold text-slate-800 outline-none focus:ring-4 focus:ring-cyan-500/10"
                      placeholder="Nhập ghi chú phiếu chi..."
                    />
                  </div>
                </fieldset>

                {/* Modal Footer Buttons */}
                <div className="flex items-center justify-end gap-3 pt-4 border-t-2 border-slate-200">
                  {modalMode !== 'view' && (
                    <button
                      type="submit"
                      className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-6 py-2.5 text-sm font-bold text-white shadow-md hover:bg-cyan-700 transition cursor-pointer"
                    >
                      <Save size={16} />
                      Lưu phiếu chi
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="inline-flex items-center gap-2 rounded-xl border-2 border-slate-300 bg-white px-5 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                  >
                    <X size={16} />
                    Đóng
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
