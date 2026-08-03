import React from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRightLeft,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  FileText,
  PackageCheck,
  RefreshCw,
  Search,
  Settings2,
  ArrowUpRight,
  Truck,
  X,
  CheckCircle2,
  MessageSquare,
  Eye,
  XCircle,
  DollarSign,
  Printer,
} from 'lucide-react';
import type { InboundReceipt } from '../types';

type PurchaseOrdersWindowProps = {
  compact?: boolean;
  receipts: InboundReceipt[];
};

type StatusGroup = 'waiting' | 'in-transit' | 'completed' | 'cancelled';
type TimeFilter = 'all' | 'this-month' | '7-days';

const DAY_MS = 24 * 60 * 60 * 1000;

function numberToVietnameseWords(number: number): string {
  if (!number || isNaN(number) || number === 0) return 'Không đồng';
  const units = ['', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];
  const scales = ['', 'nghìn', 'triệu', 'tỷ', 'nghìn tỷ'];

  function readGroup(n: number): string {
    const tram = Math.floor(n / 100);
    const chuc = Math.floor((n % 100) / 10);
    const donvi = n % 10;
    let res = '';

    if (tram > 0 || n >= 100) {
      res += units[tram] + ' trăm ';
    }
    if (chuc > 1) {
      res += units[chuc] + ' mươi ';
      if (donvi === 1) res += 'mốt ';
      else if (donvi === 5) res += 'lăm ';
      else if (donvi > 0) res += units[donvi] + ' ';
    } else if (chuc === 1) {
      res += 'mười ';
      if (donvi === 5) res += 'lăm ';
      else if (donvi > 0) res += units[donvi] + ' ';
    } else if (chuc === 0 && donvi > 0) {
      if (tram > 0) res += 'linh ';
      res += units[donvi] + ' ';
    }
    return res.trim();
  }

  let n = Math.abs(Math.floor(number));
  let str = '';
  let scaleIndex = 0;

  while (n > 0) {
    const group = n % 1000;
    if (group > 0) {
      const groupStr = readGroup(group);
      str = groupStr + ' ' + scales[scaleIndex] + ' ' + str;
    }
    n = Math.floor(n / 1000);
    scaleIndex++;
  }

  str = str.trim();
  if (str) {
    str = str.charAt(0).toUpperCase() + str.slice(1) + ' đồng';
  } else {
    str = 'Không đồng';
  }
  return str;
}

function normalizeText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function formatDate(value?: string) {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '-';
  return parsed.toLocaleDateString('vi-VN');
}

function formatDateTime(value?: string) {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '-';
  const time = parsed.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const date = parsed.toLocaleDateString('vi-VN');
  return `${time} ${date}`;
}

function formatQuantity(value: number) {
  return new Intl.NumberFormat('vi-VN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value || 0);
}

function formatCurrency(value?: number) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value || 0);
}

function sumExpected(receipt: InboundReceipt) {
  return (receipt.details || []).reduce((total, detail) => total + (detail.expectedQty || 0), 0);
}

function sumReceived(receipt: InboundReceipt) {
  return (receipt.details || []).reduce((total, detail) => total + (detail.receivedQty || 0), 0);
}

function receiptNumber(receipt: InboundReceipt, index: number) {
  const rawId = String(receipt.id || '').trim();
  if (/^DMH\d+$/i.test(rawId)) return rawId.toUpperCase();
  const digits = rawId.replace(/\D/g, '');
  if (digits) return `DMH${digits.padStart(5, '0')}`;
  return `DMH${String(index + 1).padStart(5, '0')}`;
}

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
  };
}

function inferOrderDate(receipt: InboundReceipt) {
  if (!receipt.expectedDate) return null;
  const expected = new Date(receipt.expectedDate);
  if (Number.isNaN(expected.getTime())) return null;
  return new Date(expected.getTime() - 2 * DAY_MS);
}

function getStatusGroup(status?: string): StatusGroup {
  const normalized = (status || 'CREATED').toUpperCase();
  if (normalized === 'RECEIVED' || normalized === 'COMPLETED') return 'completed';
  if (normalized === 'SUPPLIER_APPROVED' || normalized === 'PARTIALLY_RECEIVED' || normalized === 'IN_TRANSIT' || normalized === 'DELIVERING') return 'in-transit';
  if (normalized === 'CANCELLED' || normalized === 'CANCELED') return 'cancelled';
  return 'waiting';
}

function statusLabel(status?: string) {
  const normalized = (status || 'CREATED').toUpperCase();
  const group = getStatusGroup(status);
  if (normalized === 'APPROVED') return 'Đơn đặt hàng mới';
  if (normalized === 'SUPPLIER_APPROVED') return 'NCC đã xác nhận';
  if (normalized === 'REJECTED') return 'Phản hồi giá';
  if (group === 'completed') return 'Hoàn thành';
  if (group === 'in-transit') return 'Đang giao';
  if (group === 'cancelled') return 'Đã hủy';
  return 'Chờ manager duyệt';
}

function statusClass(status?: string) {
  const normalized = (status || 'CREATED').toUpperCase();
  if (normalized === 'REJECTED') return 'border-amber-200 bg-amber-50 text-amber-700';
  const group = getStatusGroup(status);
  if (group === 'completed') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (group === 'in-transit') return 'border-blue-200 bg-blue-50 text-blue-700';
  if (group === 'cancelled') return 'border-red-200 bg-red-50 text-red-600';
  return 'border-amber-200 bg-amber-50 text-amber-700';
}

function supplierLabel(receipt: InboundReceipt) {
  return receipt.supplier?.name || 'Nhà cung cấp chưa đồng bộ';
}

function supplierCode(receipt: InboundReceipt) {
  return receipt.supplier?.supplierCode || '-';
}

function buildSearchText(receipt: InboundReceipt, index: number) {
  const detailText = (receipt.details || [])
    .map((detail) => [detail.product?.internalSku, detail.product?.name].filter(Boolean).join(' '))
    .join(' ');

  return normalizeText(
    [
      receiptNumber(receipt, index),
      supplierCode(receipt),
      supplierLabel(receipt),
      detailText,
      statusLabel(receipt.status),
      formatDate(receipt.expectedDate),
    ]
      .filter(Boolean)
      .join(' '),
  );
}

function RowActionButton({
  label,
  title,
  icon,
  onClick,
}: {
  label: string;
  title: string;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      title={title}
      aria-label={label}
      className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:border-cyan-300 hover:bg-cyan-50 hover:text-cyan-600"
    >
      {icon}
    </button>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <label className="mb-2 block text-sm font-bold text-slate-700">{label}</label>
      <div className="flex min-h-11 items-center rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700 whitespace-pre-line">
        {value || '-'}
      </div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
      <span className="text-sm font-semibold text-slate-500">{label}</span>
      <span className="text-sm font-black text-slate-900">{value}</span>
    </div>
  );
}

function PrintReceiptModal({
  receipt,
  onClose,
}: {
  receipt: InboundReceipt;
  onClose: () => void;
}) {
  const details = receipt.details || [];
  const totalQty = details.reduce((sum, item) => sum + (item.expectedQty || 0), 0);
  const totalAmount = details.reduce(
    (sum, item) => sum + (item.expectedQty || 0) * (item.unitPrice || 0),
    0,
  );
  const formattedNo = receiptNumber(receipt, 0);

  const now = new Date();
  const day = now.getDate();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  return createPortal(
    <div className="fixed inset-0 top-0 left-0 w-screen h-screen z-[99999] flex items-center justify-center bg-slate-950/75 p-3 sm:p-6 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-4xl max-h-[96vh] flex flex-col rounded-2xl bg-white shadow-2xl overflow-hidden my-auto border border-slate-200">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 bg-slate-50 print:hidden">
          <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
            <Printer className="h-5 w-5 text-cyan-600" />
            In Phiếu Nhập Kho / Đơn Đặt Hàng
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-8 bg-white text-slate-900 space-y-6">
          <div className="flex justify-between items-start border-b border-slate-300 pb-4">
            <div>
              <p className="font-bold text-base uppercase text-slate-900 tracking-wide">CÔNG TY TNHH QUẢN LÝ KHO</p>
              <p className="text-xs text-slate-600 mt-1">Địa chỉ: 123 Đường ABC, Quận X, TP Y</p>
              <p className="text-xs text-slate-600">Tel: 0123.456.789 - Hotline: 0987.654.321</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-bold text-slate-800">Số phiếu: <span className="font-mono text-slate-900 font-black">{formattedNo}</span></p>
              <p className="text-xs italic text-slate-600 mt-1">Ngày {day} Tháng {month} Năm {year}</p>
            </div>
          </div>

          <div className="text-center py-2">
            <h1 className="text-2xl font-black uppercase text-slate-900 tracking-wider">PHIẾU NHẬP KHO</h1>
            <p className="text-xs font-bold text-slate-500 uppercase mt-0.5">(ĐƠN MUA HÀNG)</p>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm border-b border-slate-200 pb-4">
            <div>
              <p><span className="font-bold text-slate-700">Nhà cung cấp:</span> <span className="font-semibold">{supplierLabel(receipt)}</span></p>
              <p className="mt-1"><span className="font-bold text-slate-700">Địa chỉ:</span> {(receipt.supplier as any)?.address || '..................................................................'}</p>
            </div>
            <div className="text-right">
              <p><span className="font-bold text-slate-700">SĐT:</span> {receipt.supplier?.phone || '......................'}</p>
              <p className="mt-1"><span className="font-bold text-slate-700">Mã số thuế:</span> {receipt.supplier?.taxCode || '......................'}</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse border border-slate-900 text-sm">
              <thead>
                <tr className="bg-slate-100 text-slate-900 font-bold border-b border-slate-900">
                  <th className="border border-slate-900 p-2 text-center w-12">STT</th>
                  <th className="border border-slate-900 p-2 text-left w-28">Mã hàng</th>
                  <th className="border border-slate-900 p-2 text-left">Tên hàng</th>
                  <th className="border border-slate-900 p-2 text-center w-16">ĐVT</th>
                  <th className="border border-slate-900 p-2 text-center w-24">Số lượng</th>
                  <th className="border border-slate-900 p-2 text-right w-28">Đơn giá</th>
                  <th className="border border-slate-900 p-2 text-center w-16">% CK</th>
                  <th className="border border-slate-900 p-2 text-right w-32">Thành tiền</th>
                  <th className="border border-slate-900 p-2 text-left w-24">Ghi chú</th>
                </tr>
              </thead>
              <tbody>
                {details.map((item, idx) => {
                  const lineTotal = (item.expectedQty || 0) * (item.unitPrice || 0);
                  return (
                    <tr key={item.id || idx} className="border-b border-slate-900">
                      <td className="border border-slate-900 p-2 text-center font-medium">{idx + 1}</td>
                      <td className="border border-slate-900 p-2 font-mono font-semibold">{item.product?.internalSku || '-'}</td>
                      <td className="border border-slate-900 p-2 font-bold">{item.product?.name || '-'}</td>
                      <td className="border border-slate-900 p-2 text-center">{item.product?.unit || 'Mét'}</td>
                      <td className="border border-slate-900 p-2 text-center font-bold">{formatQuantity(item.expectedQty)}</td>
                      <td className="border border-slate-900 p-2 text-right font-medium">{formatQuantity(item.unitPrice || 0)}</td>
                      <td className="border border-slate-900 p-2 text-center">-</td>
                      <td className="border border-slate-900 p-2 text-right font-bold">{formatCurrency(lineTotal)}</td>
                      <td className="border border-slate-900 p-2 text-xs italic">{(item as any).note || '-'}</td>
                    </tr>
                  );
                })}

                <tr className="border-b border-slate-900 bg-slate-50 font-bold">
                  <td colSpan={4} className="border border-slate-900 p-2 text-right uppercase">Tổng cộng (1)</td>
                  <td className="border border-slate-900 p-2 text-center font-bold text-base">{formatQuantity(totalQty)}</td>
                  <td className="border border-slate-900 p-2"></td>
                  <td className="border border-slate-900 p-2"></td>
                  <td className="border border-slate-900 p-2 text-right font-bold text-base">{formatCurrency(totalAmount)}</td>
                  <td className="border border-slate-900 p-2"></td>
                </tr>
                <tr>
                  <td colSpan={7} className="border border-slate-900 p-2 text-right font-semibold">Nợ cũ (2)</td>
                  <td className="border border-slate-900 p-2 text-right font-bold">0</td>
                  <td className="border border-slate-900 p-2"></td>
                </tr>
                <tr>
                  <td colSpan={7} className="border border-slate-900 p-2 text-right font-semibold">Số tiền thanh toán (3)</td>
                  <td className="border border-slate-900 p-2 text-right font-bold">0</td>
                  <td className="border border-slate-900 p-2"></td>
                </tr>
                <tr className="bg-slate-100 font-bold">
                  <td colSpan={7} className="border border-slate-900 p-2 text-right uppercase">Còn nợ (1 + 2 - 3)</td>
                  <td className="border border-slate-900 p-2 text-right font-black text-base">{formatCurrency(totalAmount)}</td>
                  <td className="border border-slate-900 p-2"></td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="text-sm italic font-medium text-slate-800 pt-2">
            Số tiền bằng chữ: <span className="font-bold not-italic text-slate-900">{numberToVietnameseWords(totalAmount)}</span>
          </div>

          <div className="grid grid-cols-2 gap-8 pt-8 text-center text-sm">
            <div>
              <p className="font-bold uppercase text-slate-900">THỦ KHO</p>
              <p className="text-xs italic text-slate-500 mt-1">(Ký, họ tên)</p>
            </div>
            <div>
              <p className="text-xs italic text-slate-600">Ngày {day} Tháng {month} Năm {year}</p>
              <p className="font-bold uppercase text-slate-900 mt-1">NGƯỜI GIAO HÀNG / ĐẠI DIỆN BÊN MUA</p>
              <p className="text-xs italic text-slate-500 mt-1">(Ký, họ tên)</p>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4 print:hidden">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-300 bg-white px-5 py-2.5 font-bold text-slate-700 hover:bg-slate-100 transition"
          >
            Đóng
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-xl bg-cyan-600 px-6 py-2.5 font-bold text-white shadow-sm hover:bg-cyan-700 flex items-center gap-2 transition"
          >
            <Printer className="h-4 w-4" />
            In phiếu
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default function PurchaseOrdersWindow({ compact, receipts }: PurchaseOrdersWindowProps) {
  const [search, setSearch] = React.useState('');
  const [timeFilter, setTimeFilter] = React.useState<TimeFilter>('all');
  const [statusFilter, setStatusFilter] = React.useState<'all' | StatusGroup>('all');
  const [pageSize, setPageSize] = React.useState(50);
  const [currentPage, setCurrentPage] = React.useState(1);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [creatingStockIn, setCreatingStockIn] = React.useState(false);
  const navigate = useNavigate();



  const sortedReceipts = React.useMemo(
    () =>
      [...receipts]
        .sort((left, right) => {
          const leftTime = left.expectedDate ? new Date(left.expectedDate).getTime() : 0;
          const rightTime = right.expectedDate ? new Date(right.expectedDate).getTime() : 0;
          return rightTime - leftTime;
        }),
    [receipts],
  );

  const filteredReceipts = React.useMemo(() => {
    const keyword = normalizeText(search.trim());
    const now = new Date();

    return sortedReceipts.filter((receipt, index) => {
      const searchable = buildSearchText(receipt, index);
      const matchesKeyword = !keyword || searchable.includes(keyword);
      const statusGroup = getStatusGroup(receipt.status);
      const matchesStatus = statusFilter === 'all' || statusGroup === statusFilter;

      let matchesTime = true;
      if (timeFilter !== 'all') {
        const receiptDate = receipt.expectedDate ? new Date(receipt.expectedDate) : null;
        if (!receiptDate || Number.isNaN(receiptDate.getTime())) {
          matchesTime = false;
        } else if (timeFilter === 'this-month') {
          matchesTime =
            receiptDate.getFullYear() === now.getFullYear() &&
            receiptDate.getMonth() === now.getMonth();
        } else if (timeFilter === '7-days') {
          matchesTime = now.getTime() - receiptDate.getTime() <= 7 * DAY_MS;
        }
      }

      return matchesKeyword && matchesStatus && matchesTime;
    });
  }, [search, sortedReceipts, statusFilter, timeFilter]);

  React.useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter, timeFilter]);



  React.useEffect(() => {
    const nextTotalPages = Math.max(1, Math.ceil(filteredReceipts.length / pageSize));
    if (currentPage > nextTotalPages) {
      setCurrentPage(nextTotalPages);
    }
  }, [currentPage, filteredReceipts.length, pageSize]);

  const selectedReceipt = React.useMemo(
    () => filteredReceipts.find((receipt) => receipt.id === selectedId) || null,
    [filteredReceipts, selectedId],
  );

  const API_BASE_URL = 'http://localhost:3000/api';
  const [isAsnModalOpen, setIsAsnModalOpen] = React.useState(false);
  const [isNegotiateModalOpen, setIsNegotiateModalOpen] = React.useState(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = React.useState(false);
  const [supplierPrices, setSupplierPrices] = React.useState<Record<string, number>>({});
  const [supplierCatalogPrices, setSupplierCatalogPrices] = React.useState<Record<string, number>>({});
  const [negotiateNote, setNegotiateNote] = React.useState('');
  const [asnDate, setAsnDate] = React.useState('');
  const [asnNote, setAsnNote] = React.useState('');
  const [driverName, setDriverName] = React.useState('');
  const [driverPhone, setDriverPhone] = React.useState('');
  const [asnItems, setAsnItems] = React.useState<Array<{ id: string; expectedQty: number; name: string; sku: string }>>([]);
  const [loadedReceipt, setLoadedReceipt] = React.useState<InboundReceipt | null>(null);
  const [loadingDetails, setLoadingDetails] = React.useState(false);

  // Load supplier catalog product list prices dynamically from supplier profile
  React.useEffect(() => {
    const fetchSupplierCatalog = async () => {
      try {
        const token = localStorage.getItem('token') || '';
        const response = await fetch(`${API_BASE_URL}/suppliers/me`, {
          headers: authHeaders(),
        });
        if (response.ok) {
          const profileData = await response.json();
          if (profileData && Array.isArray(profileData.products)) {
            const priceMap: Record<string, number> = {};
            profileData.products.forEach((link: any) => {
              const price = Number(link.purchasePrice || 0);
              if (link.product?.id) priceMap[link.product.id] = price;
              if (link.product?.internalSku) priceMap[link.product.internalSku] = price;
              if (link.supplierSku) priceMap[link.supplierSku] = price;
            });
            setSupplierCatalogPrices(priceMap);
          }
        }
      } catch (err) {
        console.error('Failed to load supplier product list price map:', err);
      }
    };
    void fetchSupplierCatalog();
  }, []);

  // Load full details when a receipt is selected
  React.useEffect(() => {
    if (!selectedReceipt) {
      setLoadedReceipt(null);
      return;
    }

    setLoadingDetails(true);
    const loadDetails = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/inbound/purchase-orders/${selectedReceipt.id}`, {
          headers: authHeaders(),
        });
        if (response.ok) {
          const fullReceipt = await response.json() as InboundReceipt;
          setLoadedReceipt(fullReceipt);
        }
      } catch (err) {
        console.error('Failed to load receipt details:', err);
        setLoadedReceipt(selectedReceipt);
      } finally {
        setLoadingDetails(false);
      }
    };
    void loadDetails();
  }, [selectedReceipt?.id]);

  React.useEffect(() => {
    const receipt = loadedReceipt || selectedReceipt;
    if (receipt) {
      setAsnDate(receipt.expectedDate ? receipt.expectedDate.split('T')[0] : '');
      setAsnNote(receipt.description || '');
      setAsnItems((receipt.details || []).map(d => ({
        id: d.id,
        expectedQty: d.expectedQty || 0,
        name: d.product?.name || '',
        sku: d.product?.internalSku || ''
      })));

      const initialPrices: Record<string, number> = {};
      (receipt.details || []).forEach((d) => {
        initialPrices[d.id] = Number(d.unitPrice || 0);
      });
      setSupplierPrices(initialPrices);
    }
  }, [loadedReceipt, selectedReceipt]);

  const handleNegotiateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReceipt) return;

    try {
      const payloadItems = Object.entries(supplierPrices).map(([detailId, supplierPrice]) => ({
        detailId,
        supplierPrice: Number(supplierPrice) || 0,
      }));

      const response = await fetch(`${API_BASE_URL}/inbound/purchase-orders/${selectedReceipt.id}/supplier-negotiate`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          items: payloadItems,
          reason: negotiateNote || 'Nhà cung cấp đề xuất điều chỉnh báo giá sản phẩm.',
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data?.message || 'Không thể gửi phản hồi báo giá');
      }

      alert('Đã gửi phản hồi báo giá tới Quản lý thành công!');
      setIsNegotiateModalOpen(false);
      setSelectedId(null);
      window.location.reload();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Đã có lỗi xảy ra');
    }
  };

  const handleAsnSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReceipt) return;

    try {
      const fullDesc = [
        driverName ? `Tài xế: ${driverName}` : '',
        driverPhone ? `SĐT: ${driverPhone}` : '',
        asnNote ? `Ghi chú: ${asnNote}` : ''
      ].filter(Boolean).join(' | ');

      const response = await fetch(`${API_BASE_URL}/inbound/purchase-orders/${selectedReceipt.id}/supplier-approve`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          expectedDate: asnDate,
          description: fullDesc,
        })
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data?.message || 'Khong xac nhan duoc don mua hang');
      }

      setIsAsnModalOpen(false);
      window.location.reload();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Đã có lỗi xảy ra');
    }
  };

  const handleRejectOrder = async () => {
    if (!selectedReceipt) return;
    const reason = window.prompt('Vui lòng nhập lý do từ chối đơn hàng:');
    if (reason === null) return; // User cancelled

    try {
      const response = await fetch(`${API_BASE_URL}/inbound/purchase-orders/${selectedReceipt.id}/supplier-reject`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ reason })
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data?.message || 'Không thể từ chối đơn hàng');
      }

      window.location.reload();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Đã có lỗi xảy ra');
    }
  };

  const totalItems = filteredReceipts.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const paginatedReceipts = filteredReceipts.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const startIndex = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endIndex = Math.min(currentPage * pageSize, totalItems);

  const waitingCount = receipts.filter((receipt) => getStatusGroup(receipt.status) === 'waiting').length;
  const transitCount = receipts.filter((receipt) => getStatusGroup(receipt.status) === 'in-transit').length;
  const completedCount = receipts.filter((receipt) => getStatusGroup(receipt.status) === 'completed').length;
  const displayReceipt = loadedReceipt || selectedReceipt;
  const selectedExpected = displayReceipt ? sumExpected(displayReceipt) : 0;
  const selectedReceived = displayReceipt ? sumReceived(displayReceipt) : 0;
  const selectedRate = selectedExpected > 0 ? Math.min(100, Math.round((selectedReceived / selectedExpected) * 100)) : 0;

  const totalPoValue = receipts.reduce((sum, receipt) => {
    const receiptAmount = (receipt.details || []).reduce(
      (dSum, detail) => dSum + (detail.expectedQty || 0) * (detail.unitPrice || 0),
      0,
    );
    return sum + receiptAmount;
  }, 0);

  if (compact) {
    return (
      <div className="flex h-full flex-col gap-3">
        {/* Metric Cards Header */}
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-2.5 shadow-2xs">
            <p className="text-[11px] font-bold uppercase tracking-wider text-amber-700">Chờ nhập kho</p>
            <p className="mt-1 text-xl font-bold text-amber-900">{waitingCount}</p>
          </div>
          <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-2.5 shadow-2xs">
            <p className="text-[11px] font-bold uppercase tracking-wider text-blue-700">Đang giao</p>
            <p className="mt-1 text-xl font-bold text-blue-900">{transitCount}</p>
          </div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-2.5 shadow-2xs">
            <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">Hoàn thành</p>
            <p className="mt-1 text-xl font-bold text-emerald-900">{completedCount}</p>
          </div>
          <div className="rounded-xl border border-cyan-200 bg-cyan-50/70 p-2.5 shadow-2xs">
            <p className="text-[11px] font-bold uppercase tracking-wider text-cyan-700">Tổng giá trị PO</p>
            <p className="mt-1 text-sm font-bold text-cyan-900 truncate">{formatCurrency(totalPoValue)}</p>
          </div>
        </div>

        {/* PO List */}
        <div className="space-y-2 overflow-y-auto max-h-[220px] pr-1">
          {receipts.slice(0, 4).map((receipt, index) => {
            const expected = sumExpected(receipt);
            const received = sumReceived(receipt);
            const poAmount = (receipt.details || []).reduce(
              (dSum, detail) => dSum + (detail.expectedQty || 0) * (detail.unitPrice || 0),
              0,
            );

            return (
              <button
                key={receipt.id}
                type="button"
                onClick={() => setSelectedId(receipt.id)}
                className="w-full rounded-xl border border-slate-200 bg-white p-3 text-left transition hover:border-cyan-400 hover:bg-cyan-50/40 shadow-2xs"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 text-sm">{receiptNumber(receipt, index)}</span>
                    <span className="text-xs font-normal text-slate-500">
                      ({(receipt.details || []).length} mặt hàng)
                    </span>
                  </div>
                  <span className={`rounded-lg border px-2 py-0.5 text-xs font-semibold ${statusClass(receipt.status)}`}>
                    {statusLabel(receipt.status)}
                  </span>
                </div>

                <div className="mt-2 flex items-center justify-between text-xs border-t border-slate-100 pt-2">
                  <div className="text-slate-600 font-normal">
                    Dự kiến giao: <span className="font-semibold text-slate-800">{formatDate(receipt.expectedDate)}</span>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-cyan-700">{formatCurrency(poAmount)}</span>
                    <span className="ml-2 font-normal text-slate-500">
                      SL: {formatQuantity(received)}/{formatQuantity(expected)}
                    </span>
                  </div>
                </div>
              </button>
            );
          })}

          {receipts.length === 0 && (
            <div className="rounded-xl border border-slate-200 bg-white p-5 text-center text-sm font-normal text-slate-500">
              Chưa có đơn mua hàng nào được đồng bộ.
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="flex h-[72px] items-center justify-center rounded-xl bg-[#4295b4] px-4 shadow-sm">
          <p className="text-lg font-bold text-white uppercase">{receipts.length} TỔNG ĐƠN ĐẶT HÀNG</p>
        </div>
        <div className="flex h-[72px] items-center justify-center rounded-xl bg-[#4295b4] px-4 shadow-sm">
          <p className="text-lg font-bold text-white uppercase">{waitingCount} CHỜ DUYỆT</p>
        </div>
        <div className="flex h-[72px] items-center justify-center rounded-xl bg-[#4295b4] px-4 shadow-sm">
          <p className="text-lg font-bold text-white uppercase">{transitCount} ĐÃ DUYỆT</p>
        </div>
        <div className="flex h-[72px] items-center justify-center rounded-xl bg-[#4295b4] px-4 shadow-sm">
          <p className="text-lg font-bold text-white uppercase">{completedCount} HOÀN THÀNH</p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1.2fr_0.9fr_0.9fr_auto]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="h-11 w-full rounded-xl border-2 border-slate-200 bg-white pl-11 pr-4 text-sm font-medium outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
              placeholder="Tìm kiếm số đơn, nhà cung cấp, sản phẩm..."
            />
          </div>
          <select
            value={timeFilter}
            onChange={(event) => setTimeFilter(event.target.value as TimeFilter)}
            className="h-11 rounded-xl border-2 border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
          >
            <option value="all">Thời gian: Tất cả</option>
            <option value="this-month">Thời gian: Tháng này</option>
            <option value="7-days">Thời gian: 7 ngày gần đây</option>
          </select>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as 'all' | StatusGroup)}
            className="h-11 rounded-xl border-2 border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
          >
            <option value="all">Trạng thái: Tất cả</option>
            <option value="waiting">Trạng thái: Chờ nhập kho</option>
            <option value="in-transit">Trạng thái: Đang giao</option>
            <option value="completed">Trạng thái: Hoàn thành</option>
          </select>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setTimeFilter('all');
                setStatusFilter('all');
              }}
              className="inline-flex h-11 items-center justify-center rounded-xl border-2 border-slate-200 bg-white px-3 text-slate-500 transition hover:bg-slate-50 hover:text-slate-700"
              title="Đặt lại bộ lọc"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="inline-flex h-11 items-center justify-center rounded-xl border-2 border-slate-200 bg-white px-3 text-slate-500 transition hover:bg-slate-50 hover:text-slate-700"
              title="Bố cục"
            >
              <ArrowUpRight className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="inline-flex h-11 items-center justify-center rounded-xl border-2 border-slate-200 bg-white px-3 text-slate-500 transition hover:bg-slate-50 hover:text-slate-700"
              title="Cài đặt"
            >
              <Settings2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1220px] border-collapse bg-white">
            <thead className="bg-slate-50">
              <tr className="border-b border-slate-200">
                <th className="w-16 border-x border-slate-200 px-3 py-4 text-center text-sm font-black uppercase text-slate-700">STT</th>
                <th className="border-x border-slate-200 px-3 py-4 text-center text-sm font-black uppercase text-slate-700">Mã đơn hàng NCC</th>
                <th className="border-x border-slate-200 px-3 py-4 text-center text-sm font-black uppercase text-slate-700">Mã đơn hàng tham chiếu</th>
                <th className="border-x border-slate-200 px-3 py-4 text-center text-sm font-black uppercase text-slate-700">Ngày đặt hàng</th>
                <th className="border-x border-slate-200 px-3 py-4 text-center text-sm font-black uppercase text-slate-700">Tên nhà cung cấp</th>
                <th className="border-x border-slate-200 px-3 py-4 text-center text-sm font-black uppercase text-slate-700">Ngày giao hàng</th>
                <th className="border-x border-slate-200 px-3 py-4 text-center text-sm font-black uppercase text-slate-700">Trạng thái</th>
                <th className="sticky right-0 w-28 border-l border-slate-200 bg-slate-50 px-3 py-4 text-center text-sm font-black uppercase text-slate-700 shadow-[-4px_0_12px_rgba(0,0,0,0.03)]">
                  Thao tác
                </th>
              </tr>
            </thead>
            <tbody>
              {paginatedReceipts.length ? (
                paginatedReceipts.map((receipt, index) => {
                  const number = receiptNumber(receipt, (currentPage - 1) * pageSize + index);
                  const isSelected = receipt.id === selectedId;

                  return (
                    <tr
                      key={receipt.id}
                      onClick={() => setSelectedId(receipt.id)}
                      className={`group cursor-pointer border-b border-slate-200 transition hover:bg-cyan-50/60 ${
                        isSelected ? 'bg-blue-50/60' : ''
                      }`}
                      aria-selected={isSelected}
                    >
                      <td className="border-x border-slate-200 px-3 py-4 text-center text-sm font-medium text-slate-700">
                        {startIndex + index}
                      </td>
                      <td className="border-x border-slate-200 px-3 py-4 text-center text-sm font-medium text-slate-700">
                        {number}
                      </td>
                      <td className="border-x border-slate-200 px-3 py-4 text-center text-sm font-medium text-slate-700">
                        {(receipt as any).poNumber || (receipt as any).receiptNo || '-'}
                      </td>
                      <td className="border-x border-slate-200 px-3 py-4 text-center text-sm font-medium text-slate-700">
                        {formatDateTime((receipt as any).orderDate || inferOrderDate(receipt)?.toISOString())}
                      </td>
                      <td className="border-x border-slate-200 px-3 py-4 text-center text-sm font-medium text-slate-700">
                        {supplierLabel(receipt)}
                      </td>
                      <td className="border-x border-slate-200 px-3 py-4 text-center text-sm font-medium text-slate-700">
                        {formatDateTime(receipt.expectedDate)}
                      </td>
                      <td className="border-x border-slate-200 px-3 py-4 text-center align-middle">
                        <span className={`inline-flex items-center gap-1 rounded-lg border px-3 py-1 text-xs font-bold ${statusClass(receipt.status)}`}>
                          <Truck className="h-3.5 w-3.5" />
                          {statusLabel(receipt.status)}
                        </span>
                      </td>
                      <td className="sticky right-0 border-l border-slate-200 bg-white px-3 py-4 text-center align-middle shadow-[-4px_0_12px_rgba(0,0,0,0.03)] group-hover:bg-cyan-50/60">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setSelectedId(receipt.id); }}
                            className="flex h-9 w-9 items-center justify-center rounded-xl border-2 border-cyan-500 bg-white text-cyan-600 shadow-sm transition hover:bg-cyan-50"
                            title="Xem chi tiết đơn hàng"
                          >
                            <Eye className="h-4 w-4" />
                          </button>

                          {['APPROVED', 'REJECTED', 'CREATED'].includes((receipt.status || '').toUpperCase()) && (
                            <>
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); setSelectedId(receipt.id); setIsAsnModalOpen(true); }}
                                className="flex h-9 w-9 items-center justify-center rounded-xl border-2 border-cyan-500 bg-white text-cyan-600 shadow-sm transition hover:bg-cyan-50"
                                title="Duyệt đơn hàng"
                              >
                                <CheckCircle2 className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); setSelectedId(receipt.id); setIsNegotiateModalOpen(true); }}
                                className="flex h-9 w-9 items-center justify-center rounded-xl border-2 border-cyan-500 bg-white text-cyan-600 shadow-sm transition hover:bg-cyan-50"
                                title="Phản hồi / Báo giá lại"
                              >
                                <MessageSquare className="h-4 w-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} className="px-6 py-14 text-center">
                    <PackageCheck className="mx-auto h-10 w-10 text-slate-300" />
                    <p className="mt-3 text-sm font-semibold text-slate-500">Chưa có đơn mua hàng phù hợp với bộ lọc hiện tại.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col items-center justify-between gap-4 border-t border-slate-200 bg-slate-50/50 px-6 py-3 sm:flex-row">
          <div className="text-sm text-slate-600">
            Tổng số: <b>{totalItems}</b>
            {totalItems > 0 && (
              <span className="ml-2">
                Hiển thị {startIndex} - {endIndex}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-slate-600">Số dòng/trang</span>
            <select
              value={pageSize}
              onChange={(event) => {
                setPageSize(Number(event.target.value));
                setCurrentPage(1);
              }}
              className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-40"
              >
                «
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                disabled={currentPage === 1}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-40"
              >
                ‹
              </button>
              <button
                type="button"
                className="flex h-9 min-w-9 items-center justify-center rounded-lg bg-cyan-600 px-3 text-sm font-bold text-white"
              >
                {currentPage}
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                disabled={currentPage === totalPages}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-40"
              >
                ›
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-40"
              >
                »
              </button>
            </div>
          </div>
        </div>
      </div>

      {selectedReceipt && createPortal(
        <div className="fixed inset-0 top-0 left-0 w-screen h-screen z-[99999] flex items-center justify-center bg-slate-950/75 p-3 sm:p-6 backdrop-blur-md overflow-y-auto">
          <div className="flex w-full max-w-6xl max-h-[94vh] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl my-auto">
            <div className="shrink-0 flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 bg-white z-10">
              <div>
                <p className="text-2xl font-black text-slate-900">Đơn đặt hàng {receiptNumber(displayReceipt || selectedReceipt, 0)}</p>
                <p className="mt-1 text-sm font-medium text-slate-500">
                  Dữ liệu đồng bộ từ nhà cung cấp {supplierLabel(displayReceipt || selectedReceipt)}.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`rounded-lg border px-3 py-1 text-sm font-bold ${statusClass(displayReceipt?.status)}`}>
                  {statusLabel(displayReceipt?.status)}
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedId(null)}
                  className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                  title="Đóng chi tiết"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/30">
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-[2fr_1fr]">
                {/* CỘT TRÁI: THÔNG TIN NHÀ CUNG CẤP & ĐẶT HÀNG */}
                <div className="flex flex-col gap-6">
                  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <h3 className="mb-4 text-sm font-black uppercase text-slate-800">Thông tin nhà cung cấp</h3>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <Field label="Nhà cung cấp" value={supplierLabel(displayReceipt || selectedReceipt)} />
                      <Field label="Mã số thuế" value={(displayReceipt || selectedReceipt)?.supplier?.taxCode || "Chưa cập nhật"} />
                      <Field label="Người liên hệ" value={(displayReceipt || selectedReceipt)?.supplier?.contactPerson || "-"} />
                      <Field label="Số điện thoại" value={(displayReceipt || selectedReceipt)?.supplier?.phone || "-"} />
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm flex-1">
                    <h3 className="mb-4 text-sm font-black uppercase text-slate-800">Thông tin đặt hàng</h3>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <Field label="Người đặt hàng" value={(displayReceipt || selectedReceipt)?.creatorName || "-"} />
                      <Field label="SĐT người đặt" value={(displayReceipt || selectedReceipt)?.creatorPhone || "-"} />
                      <Field label="Kho hàng" value={(displayReceipt || selectedReceipt)?.details?.[0]?.warehouseCode || "-"} />
                      <Field label="Quản lý (Người duyệt)" value={(displayReceipt || selectedReceipt)?.approverName || "-"} />
                      <div className="sm:col-span-2">
                        <label className="mb-2 block text-sm font-bold text-slate-700">Ghi chú</label>
                        <div className="min-h-[80px] w-full rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-sm font-semibold text-slate-700 leading-relaxed">
                          {displayReceipt?.description || 'Không có ghi chú thêm cho đơn hàng này.'}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* CỘT PHẢI: ĐƠN HÀNG & TỔNG KẾT */}
                <div className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <h3 className="mb-4 text-sm font-black uppercase text-slate-800">Thông tin đơn hàng</h3>
                  <div className="grid grid-cols-1 gap-4">
                    <Field label="Mã đơn hàng" value={receiptNumber(displayReceipt || selectedReceipt, 0)} />
                    <Field label="Ngày tạo đơn" value={formatDateTime(inferOrderDate(displayReceipt || selectedReceipt)?.toISOString())} />
                    <Field label="Ngày giao hàng dự kiến" value={formatDateTime((displayReceipt || selectedReceipt)?.expectedDate)} />
                    <Field label="Trạng thái đơn hàng" value={statusLabel(displayReceipt?.status)} />
                  </div>

                  {/* TỔNG KẾT */}
                  <div className="mt-auto pt-6">
                    <div className="space-y-4 rounded-2xl border border-cyan-200 bg-[#f4fcfc] p-5">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-sm font-bold uppercase text-cyan-800">Tổng sản phẩm</p>
                          <p className="mt-0.5 text-[11px] font-medium text-cyan-600/80">(Số mặt hàng khác nhau)</p>
                        </div>
                        <p className="text-lg font-black text-cyan-900">{displayReceipt?.details?.length || 0}</p>
                      </div>
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-sm font-bold uppercase text-cyan-800">Tổng số lượng</p>
                          <p className="mt-0.5 text-[11px] font-medium text-cyan-600/80">(Tổng cộng tất cả các sản phẩm)</p>
                        </div>
                        <p className="text-lg font-black text-cyan-900">{formatQuantity(selectedExpected)}</p>
                      </div>
                      <div className="flex justify-between items-end border-t border-cyan-200/60 pt-4 mt-2">
                        <p className="text-sm font-bold uppercase text-cyan-800 mb-1">Tỷ lệ nhận hàng</p>
                        <p className="text-2xl font-black text-cyan-900 tracking-tight">{selectedRate}%</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* BẢNG HÀNG HÓA */}
              <section className="mt-6">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-cyan-600" />
                    <h4 className="font-black text-slate-900">Chi tiết hàng hóa & Báo giá</h4>
                  </div>
                </div>
                <div className="overflow-hidden rounded-2xl border-2 border-cyan-300 shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[980px] bg-white">
                      <thead className="bg-[#ecfeff] text-xs font-black text-cyan-950 uppercase border-b-2 border-cyan-300">
                        <tr>
                          <th className="w-14 px-3 py-3 text-center text-xs font-bold uppercase text-cyan-950 border-r border-cyan-200">STT</th>
                          <th className="px-3 py-3 text-left text-xs font-bold uppercase text-cyan-950 border-r border-cyan-200">Mã hàng hóa</th>
                          <th className="px-3 py-3 text-left text-xs font-bold uppercase text-cyan-950 border-r border-cyan-200">Tên hàng hóa</th>
                          <th className="px-3 py-3 text-left text-xs font-bold uppercase text-cyan-950 border-r border-cyan-200">Kho nhận</th>
                          <th className="px-3 py-3 text-center text-xs font-bold uppercase text-cyan-950 border-r border-cyan-200">Đơn vị tính</th>
                          <th className="px-3 py-3 text-center text-xs font-bold uppercase text-cyan-950 border-r border-cyan-200">SL yêu cầu</th>
                          <th className="px-3 py-3 text-right text-xs font-bold uppercase text-cyan-950 border-r border-cyan-200">Đơn giá</th>
                          <th className="px-3 py-3 text-right text-xs font-bold uppercase text-cyan-950 border-r border-cyan-200">Thành tiền</th>
                          <th className="px-3 py-3 text-center text-xs font-bold uppercase text-cyan-950">SL đã nhận</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 bg-white">
                        {(displayReceipt?.details || []).length ? (
                          (displayReceipt?.details || []).map((detail, index) => {
                            const itemQty = detail.expectedQty || 0;
                            const itemPrice = detail.unitPrice || 0;
                            const lineTotal = itemQty * itemPrice;
                            return (
                              <tr key={detail.id} className="hover:bg-cyan-50/50 transition">
                                <td className="px-3 py-4 text-center text-sm font-semibold text-slate-600 border-r border-slate-200">
                                  {index + 1}
                                </td>
                                <td className="px-3 py-4 text-sm font-mono font-bold text-cyan-900 border-r border-slate-200 whitespace-nowrap">
                                  {detail.product?.internalSku || '-'}
                                </td>
                                <td className="px-3 py-4 text-sm font-semibold text-slate-800 border-r border-slate-200">
                                  {detail.product?.name || 'Hàng hóa'}
                                </td>
                                <td className="px-3 py-4 text-sm font-medium text-slate-600">
                                  {detail.warehouseCode || 'Kho nguyên vật liệu'}
                                </td>
                                <td className="px-3 py-4 text-center text-sm font-semibold text-slate-700">
                                  {detail.product?.unit || 'Mét'}
                                </td>
                                <td className="px-3 py-4 text-center">
                                  <span className="inline-flex h-9 min-w-16 items-center justify-center rounded-xl border-2 border-slate-200 bg-white px-3 text-sm font-bold text-slate-700">
                                    {formatQuantity(itemQty)}
                                  </span>
                                </td>
                                <td className="px-3 py-4 text-right text-sm font-semibold text-slate-800">
                                  {formatCurrency(itemPrice)}
                                </td>
                                <td className="px-3 py-4 text-right text-sm font-bold text-slate-900">
                                  {formatCurrency(lineTotal)}
                                </td>
                                <td className="px-3 py-4 text-center">
                                  <span className="inline-flex h-9 min-w-16 items-center justify-center rounded-xl border-2 border-slate-200 bg-white px-3 text-sm font-bold text-cyan-600">
                                    {formatQuantity(detail.receivedQty)}
                                  </span>
                                </td>
                              </tr>
                            );
                          })
                        ) : (
                          <tr>
                            <td colSpan={8} className="px-6 py-12 text-center text-sm font-semibold text-slate-500">
                              Đơn hàng này chưa có dòng hàng nào.
                            </td>
                          </tr>
                        )}
                        <tr className="bg-slate-50 font-bold border-t-2 border-slate-200">
                          <td colSpan={4} className="px-3 py-4 text-right text-sm font-black uppercase text-slate-700">
                            Tổng cộng
                          </td>
                          <td className="px-3 py-4 text-center text-base font-black text-slate-900">
                            {formatQuantity(selectedExpected)}
                          </td>
                          <td className="px-3 py-4 text-right text-sm font-black uppercase text-slate-700">
                            Tổng tiền:
                          </td>
                          <td className="px-3 py-4 text-right text-base font-black text-cyan-700">
                            {formatCurrency(
                              (displayReceipt?.details || []).reduce(
                                (sum, item) => sum + (item.expectedQty || 0) * (item.unitPrice || 0),
                                0
                              )
                            )}
                          </td>
                          <td className="px-3 py-4 text-center text-base font-black text-cyan-700">
                            {formatQuantity(selectedReceived)}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>
            </div>

            <div className="shrink-0 flex flex-col gap-3 border-t border-slate-200 bg-white px-5 py-4 sm:flex-row sm:justify-end z-10">
              <button
                type="button"
                onClick={() => setIsPrintModalOpen(true)}
                className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-cyan-400 bg-white px-5 py-2.5 text-sm font-bold text-cyan-700 shadow-sm transition hover:bg-cyan-50"
              >
                <Printer className="h-4 w-4 text-cyan-600" />
                In đơn mua hàng
              </button>

              <button
                type="button"
                onClick={() => setSelectedId(null)}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-slate-600 shadow-sm transition hover:bg-slate-50"
              >
                Hủy
              </button>
              {displayReceipt?.status && ['APPROVED', 'REJECTED', 'CREATED'].includes(displayReceipt.status.toUpperCase()) && (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleRejectOrder}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-5 py-2.5 text-sm font-bold text-red-600 shadow-sm transition hover:bg-red-100"
                  >
                    <XCircle className="h-4 w-4" />
                    Từ chối
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsNegotiateModalOpen(true)}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-5 py-2.5 text-sm font-bold text-amber-700 shadow-sm transition hover:bg-amber-100"
                  >
                    <MessageSquare className="h-4 w-4" />
                    Phản hồi / Báo giá lại
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsAsnModalOpen(true)}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-cyan-700"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Duyệt đơn mua hàng
                  </button>
                </div>
              )}
              {displayReceipt?.status && (displayReceipt.status.toUpperCase() === 'RECEIVED' || displayReceipt.status.toUpperCase() === 'COMPLETED') && (
                <button
                  type="button"
                  onClick={() => {
                    window.alert('Lập hóa đơn điện tử thành công! Hệ thống Kế toán đã ghi nhận khoản phải thu.');
                  }}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700"
                >
                  <FileText className="h-4 w-4" />
                  Lập hóa đơn điện tử
                </button>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {isNegotiateModalOpen && selectedReceipt && createPortal(
        <div className="fixed inset-0 top-0 left-0 w-screen h-screen z-[99999] flex items-center justify-center bg-slate-950/75 p-3 sm:p-6 backdrop-blur-md overflow-y-auto">
          <div className="w-full max-w-6xl max-h-[94vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl my-auto">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <div>
                <h3 className="text-xl font-black text-slate-900 flex items-center gap-2">
                  <MessageSquare className="h-6 w-6 text-slate-800" />
                  Phản hồi & thương lượng báo giá
                </h3>
                <p className="text-sm text-slate-600 mt-0.5">
                  Nhập đơn giá đề xuất của Nhà cung cấp cho từng mặt hàng để gửi báo giá phản hồi cho Bên mua.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsNegotiateModalOpen(false)}
                className="rounded-xl p-2 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleNegotiateSubmit} className="mt-4 space-y-4">
              <div className="overflow-x-auto rounded-xl border border-cyan-300 shadow-sm">
                <table className="w-full text-left border-collapse bg-white">
                  <thead className="bg-[#ecfeff] text-xs font-black text-cyan-950 uppercase border-b-2 border-cyan-300">
                    <tr>
                      <th className="p-3 text-center w-12 whitespace-nowrap border-r border-cyan-200">STT</th>
                      <th className="p-3 text-left whitespace-nowrap border-r border-cyan-200">Mã hàng hóa</th>
                      <th className="p-3 text-left whitespace-nowrap border-r border-cyan-200">Tên hàng hóa</th>
                      <th className="p-3 text-center w-24 whitespace-nowrap border-r border-cyan-200">SL đặt</th>
                      <th className="p-3 text-center whitespace-nowrap border-r border-cyan-200">Giá niêm yết NCC</th>
                      <th className="p-3 text-center whitespace-nowrap border-r border-cyan-200">Giá bên mua yêu cầu</th>
                      <th className="p-3 text-center whitespace-nowrap border-r border-cyan-200">Thành tiền bên mua</th>
                      <th className="p-3 text-center w-48 whitespace-nowrap border-r border-cyan-200">Giá mong muốn điều chỉnh</th>
                      <th className="p-3 text-center whitespace-nowrap">Thành tiền đề xuất</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-sm">
                    {((loadedReceipt?.details || selectedReceipt.details || []).map((detail, idx) => {
                      const qty = detail.expectedQty || 0;
                      const prodId = detail.product?.id || '';
                      const prodSku = detail.product?.internalSku || '';
                      const listPrice = supplierCatalogPrices[prodId] ?? supplierCatalogPrices[prodSku] ?? (detail as any).listPrice ?? (detail.product as any)?.purchasePrice ?? (detail.product as any)?.listPrice ?? detail.unitPrice ?? 0;
                      const buyerPrice = detail.unitPrice || 0;
                      const buyerTotal = qty * buyerPrice;
                      const supplierPrice = supplierPrices[detail.id] ?? buyerPrice;
                      const supplierTotal = qty * supplierPrice;

                      return (
                        <tr key={detail.id} className="hover:bg-cyan-50/50 transition">
                          <td className="p-3 text-center font-medium text-slate-800 border-r border-slate-200">{idx + 1}</td>
                          <td className="p-3 text-left font-mono font-bold text-cyan-900 border-r border-slate-200 whitespace-nowrap">
                            {detail.product?.internalSku || '-'}
                          </td>
                          <td className="p-3 text-left font-semibold text-slate-900 border-r border-slate-200">
                            {detail.product?.name || 'Hàng hóa'}
                          </td>
                          <td className="p-3 text-center font-bold text-slate-900 border-r border-slate-200 whitespace-nowrap">
                            {formatQuantity(qty)}
                          </td>
                          <td className="p-3 text-center font-medium text-slate-800 border-r border-slate-200 whitespace-nowrap">
                            {formatCurrency(listPrice)}
                          </td>
                          <td className="p-3 text-center font-medium text-slate-800 border-r border-slate-200 whitespace-nowrap">
                            {formatCurrency(buyerPrice)}
                          </td>
                          <td className="p-3 text-center font-bold text-slate-900 border-r border-slate-200 whitespace-nowrap">
                            {formatCurrency(buyerTotal)}
                          </td>
                          <td className="p-3 text-center border-r border-slate-200">
                            <input
                              type="number"
                              min={0}
                              step="any"
                              value={supplierPrices[detail.id] ?? buyerPrice}
                              onChange={(e) => {
                                const val = Number(e.target.value);
                                setSupplierPrices((prev) => ({ ...prev, [detail.id]: val }));
                              }}
                              className="h-9 w-full rounded-lg border-2 border-cyan-300 bg-white px-2 text-center text-sm font-bold text-slate-900 outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-500/20"
                            />
                          </td>
                          <td className="p-3 text-center font-bold text-cyan-900 whitespace-nowrap">
                            {formatCurrency(supplierTotal)}
                          </td>
                        </tr>
                      );
                    }))}
                  </tbody>
                </table>
              </div>

              {/* Summary of totals */}
              {(() => {
                const details = loadedReceipt?.details || selectedReceipt.details || [];
                const totalBuyer = details.reduce((sum, d) => sum + (d.expectedQty || 0) * (d.unitPrice || 0), 0);
                const totalSupplier = details.reduce((sum, d) => sum + (d.expectedQty || 0) * (supplierPrices[d.id] ?? d.unitPrice ?? 0), 0);
                const diff = totalSupplier - totalBuyer;

                return (
                  <div className="grid grid-cols-3 gap-4 rounded-xl border border-cyan-200 bg-cyan-50/50 p-4 text-center">
                    <div className="border-r border-cyan-200 pr-4">
                      <p className="text-xs font-bold uppercase text-cyan-800">Tổng tiền đặt mua (Bên mua)</p>
                      <p className="mt-1 text-lg font-bold text-slate-900">{formatCurrency(totalBuyer)}</p>
                    </div>
                    <div className="border-r border-cyan-200 px-4">
                      <p className="text-xs font-bold uppercase text-cyan-800">Tổng tiền đề xuất (NCC)</p>
                      <p className="mt-1 text-lg font-bold text-slate-900">{formatCurrency(totalSupplier)}</p>
                    </div>
                    <div className="pl-4">
                      <p className="text-xs font-bold uppercase text-cyan-800">Chênh lệch</p>
                      <p className="mt-1 text-lg font-bold text-cyan-900">
                        {diff > 0 ? `+${formatCurrency(diff)}` : formatCurrency(diff)}
                      </p>
                    </div>
                  </div>
                );
              })()}

              <div>
                <label className="mb-2 block text-sm font-bold text-slate-900">Ghi chú / Lý do điều chỉnh giá</label>
                <textarea
                  value={negotiateNote}
                  onChange={(e) => setNegotiateNote(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-900 outline-none transition focus:border-slate-600"
                  rows={3}
                  placeholder="Nhập lý do điều chỉnh giá hoặc đề xuất khác gửi cho Bên mua..."
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsNegotiateModalOpen(false)}
                  className="rounded-xl border border-slate-300 px-5 py-2.5 font-bold text-slate-700 hover:bg-slate-100"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-cyan-600 px-6 py-2.5 font-bold text-white shadow-sm hover:bg-cyan-700 flex items-center gap-2"
                >
                  <MessageSquare className="h-4 w-4" />
                  Gửi phản hồi báo giá
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {isPrintModalOpen && selectedReceipt && (
        <PrintReceiptModal
          receipt={loadedReceipt || selectedReceipt}
          onClose={() => setIsPrintModalOpen(false)}
        />
      )}

      {isAsnModalOpen && selectedReceipt && createPortal(
        <div className="fixed inset-0 top-0 left-0 w-screen h-screen z-[99999] flex items-center justify-center bg-slate-950/75 p-3 sm:p-6 backdrop-blur-md overflow-y-auto">
          <div className="w-full max-w-2xl max-h-[96vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl my-auto">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <h3 className="text-xl font-black text-slate-900">Xác nhận đơn hàng & Thông báo giao hàng (ASN)</h3>
              <button
                type="button"
                onClick={() => setIsAsnModalOpen(false)}
                className="rounded-xl p-2 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleAsnSubmit} className="mt-4 space-y-4">
              <div>
                <label className="mb-2 block text-sm font-bold text-slate-700">Ngày giao hàng dự kiến</label>
                <input
                  type="date"
                  value={asnDate}
                  onChange={(e) => setAsnDate(e.target.value)}
                  className="h-11 w-full rounded-xl border-2 border-slate-200 px-4 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-2 block text-sm font-bold text-slate-700">Tên tài xế</label>
                  <input
                    type="text"
                    value={driverName}
                    onChange={(e) => setDriverName(e.target.value)}
                    className="h-11 w-full rounded-xl border-2 border-slate-200 px-4 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
                    placeholder="Nguyễn Văn A"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-bold text-slate-700">Số điện thoại tài xế</label>
                  <input
                    type="text"
                    value={driverPhone}
                    onChange={(e) => setDriverPhone(e.target.value)}
                    className="h-11 w-full rounded-xl border-2 border-slate-200 px-4 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
                    placeholder="0912345678"
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold text-slate-700">Diễn giải / Ghi chú giao hàng</label>
                <textarea
                  value={asnNote}
                  onChange={(e) => setAsnNote(e.target.value)}
                  className="w-full rounded-xl border-2 border-slate-200 px-4 py-2 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
                  rows={3}
                  placeholder="Nhập thông tin biển số xe, người vận chuyển..."
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold text-slate-700">Chi tiết số lượng giao hàng</label>
                <div className="max-h-48 overflow-y-auto space-y-2 border border-slate-200 rounded-xl p-3 bg-slate-50">
                  {asnItems.map((item, idx) => (
                    <div key={item.id} className="flex items-center justify-between gap-4 border-b border-slate-100 pb-2 last:border-0 last:pb-0">
                      <div>
                        <p className="text-sm font-bold text-slate-800">{item.sku} - {item.name}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-400 font-semibold">Số lượng:</span>
                        <input
                          type="number"
                          min={1}
                          value={item.expectedQty}
                          onChange={(e) => {
                            const newQty = Number(e.target.value);
                            setAsnItems(prev => prev.map((it, i) => i === idx ? { ...it, expectedQty: newQty } : it));
                          }}
                          className="h-9 w-24 rounded-lg border border-slate-300 bg-white px-2 text-right text-sm font-bold outline-none focus:border-cyan-500"
                          required
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsAsnModalOpen(false)}
                  className="rounded-xl border-2 border-slate-200 px-5 py-2.5 font-bold text-slate-600 hover:bg-slate-50"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-cyan-600 px-6 py-2.5 font-bold text-white shadow-sm hover:bg-cyan-700 flex items-center gap-2"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Xác nhận & Duyệt đơn hàng
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
