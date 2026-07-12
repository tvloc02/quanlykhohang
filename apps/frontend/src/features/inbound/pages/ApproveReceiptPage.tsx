import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  Clock3,
  CalendarDays,
  FileText,
  Search,
  RefreshCw,
  Package,
  Building,
  Check,
  XCircle,
} from 'lucide-react';

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
    case 'RECEIVED': return 'Đã nhận đủ';
    case 'IN_TRANSIT': return 'Đang giao (ASN)';
    case 'CANCELLED': return 'Đã hủy';
    default: return 'Chờ xử lý';
  }
}

function statusClass(status?: string) {
  switch ((status || 'CREATED').toUpperCase()) {
    case 'APPROVED': return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    case 'PARTIALLY_RECEIVED': return 'border-amber-200 bg-amber-50 text-amber-700';
    case 'RECEIVED': return 'border-blue-200 bg-blue-50 text-blue-700';
    case 'IN_TRANSIT': return 'border-cyan-200 bg-cyan-50 text-cyan-700';
    case 'CANCELLED': return 'border-red-200 bg-red-50 text-red-600';
    default: return 'border-slate-200 bg-slate-50 text-slate-700';
  }
}

export default function ApproveReceiptPage() {
  const [receipts, setReceipts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const fetchReceipts = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await fetch(`${API_BASE_URL}/inbound/purchase-orders`, {
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error('Không thể tải danh sách phiếu nhập kho');
      const data = await res.json();
      
      // Lọc các phiếu chưa duyệt hoặc chưa hủy (chờ duyệt)
      const pending = (data || []).filter((r: any) => r.status !== 'APPROVED' && r.status !== 'CANCELLED');
      setReceipts(pending);
      if (pending.length > 0 && !selectedId) {
        setSelectedId(pending[0].id);
      }
    } catch (err: any) {
      setError(err.message || 'Lỗi tải dữ liệu');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReceipts();
  }, []);

  const handleApprove = async (receiptId: string) => {
    if (!window.confirm('Bạn có chắc chắn muốn phê duyệt phiếu nhập này? Việc này sẽ cộng tồn kho vật lý chính thức.')) return;
    setApproving(true);
    try {
      const res = await fetch(`${API_BASE_URL}/inbound/purchase-orders/${receiptId}/approve`, {
        method: 'POST',
        headers: authHeaders(),
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        throw new Error(errorData?.message || 'Lỗi phê duyệt phiếu');
      }

      alert('Phê duyệt phiếu nhập và cập nhật tồn kho thành công!');
      setSelectedId(null);
      await fetchReceipts();
    } catch (err: any) {
      alert(err.message || 'Có lỗi xảy ra khi phê duyệt');
    } finally {
      setApproving(false);
    }
  };

  const handleCancel = async (receiptId: string) => {
    if (!window.confirm('Bạn có chắc chắn muốn hủy phiếu nhập này?')) return;
    setApproving(true);
    try {
      const res = await fetch(`${API_BASE_URL}/inbound/purchase-orders/${receiptId}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error('Không thể hủy phiếu');

      alert('Đã hủy phiếu nhập thành công!');
      setSelectedId(null);
      await fetchReceipts();
    } catch (err: any) {
      alert(err.message || 'Lỗi hủy phiếu');
    } finally {
      setApproving(false);
    }
  };

  const selectedReceipt = receipts.find((r) => r.id === selectedId) || null;

  const filteredReceipts = receipts.filter((r) => {
    const term = search.toLowerCase();
    return (
      (r.poNumber || '').toLowerCase().includes(term) ||
      (r.supplier?.name || r.supplierName || '').toLowerCase().includes(term)
    );
  });

  return (
    <div className="flex h-screen flex-col bg-slate-50 p-6 lg:flex-row gap-6 overflow-hidden">
      {/* List Section */}
      <div className="flex flex-col w-full lg:w-96 bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden h-full">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-800">Phiếu chờ phê duyệt</h2>
            <button
              onClick={fetchReceipts}
              className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm số phiếu, đối tác..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-9 pl-9 pr-4 rounded-xl border border-slate-200 text-sm outline-none transition focus:border-cyan-500"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {loading ? (
            <div className="p-8 text-center text-slate-400 text-sm">Đang tải phiếu...</div>
          ) : filteredReceipts.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-sm">Không tìm thấy phiếu nào.</div>
          ) : (
            filteredReceipts.map((r) => (
              <button
                key={r.id}
                onClick={() => setSelectedId(r.id)}
                className={`w-full text-left p-3 rounded-xl border transition flex flex-col gap-2 ${
                  r.id === selectedId
                    ? 'border-cyan-500 bg-cyan-50/30'
                    : 'border-transparent hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-slate-900">{r.poNumber}</span>
                  <span className={`px-2 py-0.5 rounded-lg text-xs font-bold border ${statusClass(r.status)}`}>
                    {statusLabel(r.status)}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs text-slate-500">
                  <span className="truncate max-w-[160px] font-medium text-slate-700">
                    {r.supplier?.name || r.supplierName || 'Khách lẻ'}
                  </span>
                  <span>{formatDate(r.orderDate)}</span>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Reconciliation Section */}
      <div className="flex-1 bg-white border border-slate-200 rounded-2xl shadow-sm flex flex-col h-full overflow-hidden">
        {selectedReceipt ? (
          <div className="flex-1 flex flex-col h-full overflow-hidden">
            {/* Detail Header */}
            <div className="p-6 border-b border-slate-200 flex flex-col md:flex-row justify-between gap-4 bg-slate-50/50">
              <div className="flex gap-4 items-start">
                <div className="p-3 bg-cyan-50 text-cyan-600 rounded-2xl">
                  <FileText className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900">{selectedReceipt.poNumber}</h3>
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 font-semibold">
                    <span className="flex items-center gap-1">
                      <Building className="h-3.5 w-3.5" />
                      {selectedReceipt.supplier?.name || selectedReceipt.supplierName || 'Khách lẻ / Chưa xác định'}
                    </span>
                    <span className="flex items-center gap-1">
                      <CalendarDays className="h-3.5 w-3.5" />
                      Ngày lập: {formatDate(selectedReceipt.orderDate)}
                    </span>
                    {selectedReceipt.expectedDate && (
                      <span className="flex items-center gap-1">
                        <Clock3 className="h-3.5 w-3.5" />
                        Ngày giao dự kiến: {formatDate(selectedReceipt.expectedDate)}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => handleCancel(selectedReceipt.id)}
                  disabled={approving}
                  className="h-10 px-4 border-2 border-red-200 hover:border-red-300 hover:bg-red-50 text-red-600 font-bold rounded-xl text-sm transition disabled:opacity-50 flex items-center gap-1.5"
                >
                  <XCircle className="h-4 w-4" />
                  Hủy phiếu
                </button>
                <button
                  onClick={() => handleApprove(selectedReceipt.id)}
                  disabled={approving}
                  className="h-10 px-5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-sm transition shadow-sm hover:shadow disabled:opacity-50 flex items-center gap-1.5"
                >
                  <Check className="h-4 w-4" />
                  Phê duyệt & Nhập kho
                </button>
              </div>
            </div>

            {/* Reconciliation Comparison Table */}
            <div className="flex-1 overflow-auto p-6">
              <div className="mb-4 bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3 text-amber-800 text-sm font-semibold">
                <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0" />
                <p>
                  Vui lòng đối chiếu số lượng thực nhận và số lượng yêu cầu. Sau khi phê duyệt, tồn kho vật lý trong hệ thống sẽ chính thức được cộng thêm.
                </p>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left border-collapse bg-white">
                  <thead className="bg-slate-50">
                    <tr className="border-b border-slate-200 text-xs font-bold text-slate-700 uppercase">
                      <th className="px-4 py-3 text-center w-12">STT</th>
                      <th className="px-4 py-3">SKU</th>
                      <th className="px-4 py-3">Sản phẩm</th>
                      <th className="px-4 py-3 text-center">Vị trí kho</th>
                      <th className="px-4 py-3 text-right">Số lượng Yêu cầu</th>
                      <th className="px-4 py-3 text-right">Số lượng Thực nhận</th>
                      <th className="px-4 py-3 text-right">Chênh lệch</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(selectedReceipt.details || []).map((d: any, index: number) => {
                      const exp = d.expectedQty || 0;
                      const rec = d.receivedQty || 0;
                      const diff = rec - exp;

                      return (
                        <tr key={d.id} className="border-b border-slate-200 last:border-0 hover:bg-slate-50/50 text-sm">
                          <td className="px-4 py-4 text-center text-slate-400 font-bold">{index + 1}</td>
                          <td className="px-4 py-4 font-mono font-bold text-slate-700">{d.product?.internalSku}</td>
                          <td className="px-4 py-4 font-semibold text-slate-800">{d.product?.name}</td>
                          <td className="px-4 py-4 text-center font-bold text-slate-600">{d.warehouseCode || 'DEFAULT'}</td>
                          <td className="px-4 py-4 text-right font-semibold text-slate-700">{exp}</td>
                          <td className="px-4 py-4 text-right font-black text-slate-900">{rec}</td>
                          <td className={`px-4 py-4 text-right font-black ${
                            diff === 0 
                              ? 'text-emerald-600' 
                              : diff < 0 
                                ? 'text-red-500' 
                                : 'text-cyan-600'
                          }`}>
                            {diff === 0 ? 'Khớp (0)' : diff > 0 ? `+${diff}` : diff}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Receipt Summary Footer */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-between items-center text-sm font-semibold text-slate-600">
              <span>Tổng số mặt hàng: <strong className="text-slate-950">{(selectedReceipt.details || []).length}</strong></span>
              <span>Tổng giá trị: <strong className="text-slate-950">{formatMoney(selectedReceipt.totalAmount || 0)}</strong></span>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-center text-slate-400">
            <CheckCircle2 className="h-16 w-16 text-slate-200 mb-4" />
            <h3 className="text-lg font-bold text-slate-700">Tất cả các phiếu đã được xử lý</h3>
            <p className="text-sm mt-1">Không có phiếu nhập kho nào đang chờ phê duyệt.</p>
          </div>
        )}
      </div>
    </div>
  );
}
