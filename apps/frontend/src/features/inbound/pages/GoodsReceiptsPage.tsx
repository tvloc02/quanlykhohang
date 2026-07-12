import React, { useEffect, useState } from 'react';
import { Package, Search, Clock3, CalendarDays } from 'lucide-react';
import GoodsReceiptModal from '../../scanner/GoodsReceiptModal';
import { ScannedItem } from '../../scanner/ScannerPage';
import { ScannedProduct } from '../../../shared/components/BarcodeScanner';

const API_BASE_URL = 'http://localhost:3000/api';

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
  };
}

const formatMoney = (amount: number | string) => {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(Number(amount));
};

const formatDate = (dateStr?: string) => {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
};

function statusLabel(status?: string) {
  switch ((status || 'CREATED').toUpperCase()) {
    case 'APPROVED': return 'Đã duyệt';
    case 'PARTIALLY_RECEIVED': return 'Nhận 1 phần';
    case 'RECEIVED': return 'Hoàn thành';
    case 'CANCELLED': return 'Đã hủy';
    default: return 'Chờ xử lý';
  }
}

function statusClass(status?: string) {
  switch ((status || 'CREATED').toUpperCase()) {
    case 'APPROVED': return 'border-blue-200 bg-blue-50 text-blue-700';
    case 'PARTIALLY_RECEIVED': return 'border-cyan-200 bg-cyan-50 text-cyan-700';
    case 'RECEIVED': return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    case 'CANCELLED': return 'border-red-200 bg-red-50 text-red-600';
    default: return 'border-amber-200 bg-amber-50 text-amber-700';
  }
}

export default function GoodsReceiptsPage() {
  const [receipts, setReceipts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedReceipt, setSelectedReceipt] = useState<any | null>(null);

  useEffect(() => {
    fetchReceipts();
  }, []);

  const fetchReceipts = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE_URL}/inbound/purchase-orders`, {
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error('Không thể tải danh sách phiếu nhập kho');
      const data = await res.json();
      setReceipts(data || []);
    } catch (err: any) {
      setError(err.message || 'Có lỗi xảy ra');
    } finally {
      setLoading(false);
    }
  };

  const handleView = (receipt: any) => {
    setSelectedReceipt(receipt);
  };

  const closeModal = () => {
    setSelectedReceipt(null);
  };

  // Map backend details to ScannedItem format for the modal
  const mappedItems: ScannedItem[] = selectedReceipt?.details?.map((d: any) => ({
    product: {
      id: d.product?.id || '',
      internalSku: d.product?.internalSku || '',
      name: d.product?.name || 'Sản phẩm không xác định',
      unit: d.product?.unit || 'Cái',
      purchasePrice: Number(d.unitPrice) || 0,
    } as ScannedProduct,
    qty: d.expectedQty || 0,
    timestamp: new Date()
  })) || [];

  return (
    <div className="flex h-full flex-col p-6">
      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-cyan-100 text-cyan-600">
            <Package className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900">Danh sách Phiếu nhập kho</h1>
            <p className="text-sm font-medium text-slate-500">
              Tra cứu và in các phiếu nhập kho đã tạo từ mã vạch
            </p>
          </div>
        </div>
        <button onClick={fetchReceipts} className="flex h-11 items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 font-bold text-white transition hover:bg-slate-800">
          <Clock3 className="h-5 w-5" />
          Làm mới
        </button>
      </div>

      <div className="flex-1 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm flex flex-col">
        {loading ? (
          <div className="flex flex-1 items-center justify-center p-12 text-slate-500">
            <div className="flex flex-col items-center gap-2">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-cyan-600"></div>
              <p>Đang tải dữ liệu...</p>
            </div>
          </div>
        ) : error ? (
          <div className="flex flex-1 items-center justify-center p-12 text-red-500">{error}</div>
        ) : receipts.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center p-12 text-center text-slate-500">
            <Package className="mb-4 h-12 w-12 opacity-20" />
            <h3 className="text-lg font-bold text-slate-700">Chưa có phiếu nhập kho nào</h3>
            <p className="mt-1 text-sm">Hãy quét mã vạch và tạo phiếu nhập kho trước.</p>
          </div>
        ) : (
          <div className="overflow-x-auto flex-1">
            <table className="w-full min-w-[980px] border-collapse bg-white">
              <thead className="bg-slate-50">
                <tr className="border-b border-slate-200">
                  <th className="border-x border-slate-200 px-3 py-3 text-center text-sm font-semibold uppercase text-slate-700">Mã phiếu</th>
                  <th className="border-x border-slate-200 px-3 py-3 text-left text-sm font-semibold uppercase text-slate-700">Ngày lập</th>
                  <th className="border-x border-slate-200 px-3 py-3 text-left text-sm font-semibold uppercase text-slate-700">Nhà cung cấp</th>
                  <th className="border-x border-slate-200 px-3 py-3 text-center text-sm font-semibold uppercase text-slate-700">Tổng tiền</th>
                  <th className="border-x border-slate-200 px-3 py-3 text-center text-sm font-semibold uppercase text-slate-700">Trạng thái</th>
                  <th className="border-x border-slate-200 px-3 py-3 text-center text-sm font-semibold uppercase text-slate-700 w-28">Hành động</th>
                </tr>
              </thead>
              <tbody>
                {receipts.map((order: any) => (
                  <tr key={order.id} className="border-b border-slate-200 transition hover:bg-slate-50">
                    <td className="border-x border-slate-200 px-3 py-4 text-center text-sm text-slate-600 font-bold">{order.poNumber}</td>
                    <td className="border-x border-slate-200 px-3 py-4 text-left text-sm text-slate-600">
                      <span className="inline-flex items-center gap-1">
                        <CalendarDays className="h-4 w-4 text-slate-400" />
                        {formatDate(order.orderDate)}
                      </span>
                    </td>
                    <td className="border-x border-slate-200 px-3 py-4 text-left text-sm text-slate-600">
                      {order.supplier?.name || order.supplierName || 'Khách lẻ / Chưa xác định'}
                    </td>
                    <td className="border-x border-slate-200 px-3 py-4 text-center text-sm font-semibold text-slate-700">
                      {formatMoney(order.totalAmount || 0)}
                    </td>
                    <td className="border-x border-slate-200 px-3 py-4 text-center align-middle">
                      <span className={`inline-flex rounded-lg border px-3 py-1 text-xs font-bold ${statusClass(order.status)}`}>
                        {statusLabel(order.status)}
                      </span>
                    </td>
                    <td className="border-x border-slate-200 px-3 py-4 text-center align-middle">
                      <button
                        onClick={() => handleView(order)}
                        className="rounded-lg bg-cyan-50 px-3 py-1.5 text-xs font-bold text-cyan-700 transition hover:bg-cyan-100"
                      >
                        Xem & In
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <GoodsReceiptModal
        isOpen={!!selectedReceipt}
        onClose={closeModal}
        onConfirm={() => {}}
        items={mappedItems}
        viewMode={true}
        receiptNo={selectedReceipt?.poNumber}
        receiptDate={`Ngày ${new Date(selectedReceipt?.orderDate || Date.now()).getDate().toString().padStart(2, '0')} Tháng ${(new Date(selectedReceipt?.orderDate || Date.now()).getMonth() + 1).toString().padStart(2, '0')} Năm ${new Date(selectedReceipt?.orderDate || Date.now()).getFullYear()}`}
        supplierName={selectedReceipt?.supplier?.name || selectedReceipt?.supplierName || 'Khách lẻ / Chưa xác định'}
      />
    </div>
  );
}
