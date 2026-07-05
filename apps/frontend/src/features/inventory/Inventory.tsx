import React from 'react';
import {
  Search,
  Filter,
  Boxes,
  X,
  XCircle,
  CheckCircle,
} from 'lucide-react';

// Tích hợp Toast nội bộ để không bị lỗi import
function Toast({ message, type, onClose }: { message: string; type: 'success' | 'error'; onClose: () => void }) {
  React.useEffect(() => {
    if (message) {
      const timer = setTimeout(() => onClose(), 3000);
      return () => clearTimeout(timer);
    }
  }, [message, onClose]);

  if (!message) return null;

  return (
    <div className={`fixed top-4 right-4 z-[60] flex items-center gap-3 rounded-xl px-4 py-3 shadow-lg transition-all ${type === 'error' ? 'bg-red-50 text-red-600 border border-red-200' : 'bg-emerald-50 text-emerald-600 border border-emerald-200'}`}>
      {type === 'error' ? <XCircle size={20} /> : <CheckCircle size={20} />}
      <p className="text-sm font-semibold">{message}</p>
      <button onClick={onClose} className="ml-2 rounded-lg p-1 hover:bg-white/50 transition">
        <X size={16} />
      </button>
    </div>
  );
}

interface StockItem {
  id: string;
  sku: string;
  name: string;
  location: string;
  physical: number;
  allocated: number;
  available: number;
}

const API_BASE_URL = 'http://localhost:3000/api';

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
  };
}

export default function Inventory() {
  const [stocks, setStocks] = React.useState<StockItem[]>([]);
  const [search, setSearch] = React.useState('');
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');

  // Pagination states
  const [pageSize, setPageSize] = React.useState(20);
  const [currentPage, setCurrentPage] = React.useState(1);

  const loadData = React.useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_BASE_URL}/inventory/balances`, { headers: authHeaders() });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.message || 'Không tải được dữ liệu tồn kho');
      }

      const rawData = await response.json();
      const mappedData: StockItem[] = (rawData || []).map((item: any) => ({
        id: item.id,
        sku: item.product?.internalSku || '',
        name: item.product?.name || '',
        location: item.locationCode || '',
        physical: Number(item.totalPhysical) || 0,
        allocated: Number(item.allocated) || 0,
        available: Number(item.available) || 0,
      }));
      setStocks(mappedData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi hệ thống khi tải dữ liệu');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  // Reset trang khi filter
  React.useEffect(() => {
    setCurrentPage(1);
  }, [search]);

  const filteredStocks = stocks.filter((stock) => {
    const keyword = search.trim().toLowerCase();
    return (
      !keyword ||
      stock.sku.toLowerCase().includes(keyword) ||
      stock.name.toLowerCase().includes(keyword) ||
      stock.location.toLowerCase().includes(keyword)
    );
  });

  // Calculate Summaries
  const totalPhysical = stocks.reduce((sum, item) => sum + item.physical, 0);
  const totalAllocated = stocks.reduce((sum, item) => sum + item.allocated, 0);
  const totalAvailable = stocks.reduce((sum, item) => sum + item.available, 0);

  // Calculate Pagination
  const totalItems = filteredStocks.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const paginatedStocks = filteredStocks.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const startIndex = (currentPage - 1) * pageSize + 1;
  const endIndex = Math.min(currentPage * pageSize, totalItems);

  return (
    <div>
      <Toast
        message={error}
        type="error"
        onClose={() => setError('')}
      />

      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Quản lý tồn kho</h1>
          <p className="mt-1 text-sm font-medium text-slate-500">
            Theo dõi số lượng hàng hóa thực tế, đã phân bổ và có sẵn tại các vị trí.
          </p>
        </div>

        <button
          type="button"
          onClick={loadData}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-white border-2 border-slate-200 px-5 py-2.5 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50"
        >
          <Boxes className="h-4 w-4" />
          Làm mới dữ liệu
        </button>
      </div>

      {/* Summary Cards */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="rounded-2xl border-2 border-cyan-200 bg-cyan-50 p-6 transition-all hover:shadow-md">
          <p className="text-sm font-bold text-cyan-800 uppercase tracking-wider">Tổng tồn kho thực tế</p>
          <p className="mt-2 text-4xl font-black text-cyan-600">{totalPhysical.toLocaleString('vi-VN')}</p>
        </div>
        <div className="rounded-2xl border-2 border-yellow-200 bg-yellow-50 p-6 transition-all hover:shadow-md">
          <p className="text-sm font-bold text-yellow-800 uppercase tracking-wider">Hàng đã phân bổ</p>
          <p className="mt-2 text-4xl font-black text-yellow-600">{totalAllocated.toLocaleString('vi-VN')}</p>
        </div>
        <div className="rounded-2xl border-2 border-emerald-200 bg-emerald-50 p-6 transition-all hover:shadow-md">
          <p className="text-sm font-bold text-emerald-800 uppercase tracking-wider">Hàng có sẵn để bán</p>
          <p className="mt-2 text-4xl font-black text-emerald-600">{totalAvailable.toLocaleString('vi-VN')}</p>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="h-11 w-full rounded-xl border-2 border-slate-200 bg-white pl-11 pr-4 text-base outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
            placeholder="Tìm kiếm theo mã SKU, tên sản phẩm, vị trí..."
          />
        </div>
        <div className="flex justify-start xl:justify-end">
          <button className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border-2 border-slate-200 bg-white px-5 text-sm font-bold text-slate-700 transition hover:bg-slate-50">
            <Filter size={18} className="text-slate-500" />
            Lọc tồn kho
          </button>
        </div>
      </div>

      {/* Wrapper chứa bảng + phân trang dính liền nhau */}
      <div className="mt-5 overflow-hidden rounded-xl border-2 border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1040px] border-collapse bg-white">
            <thead className="bg-slate-50">
              <tr className="border-b-2 border-slate-200">
                <th className="w-16 border-x border-slate-200 px-3 py-4 text-center text-sm font-black uppercase text-slate-700">STT</th>
                <th className="border-x border-slate-200 px-3 py-4 text-center text-sm font-black uppercase text-slate-700">SKU</th>
                <th className="border-x border-slate-200 px-3 py-4 text-left text-sm font-black uppercase text-slate-700">Tên sản phẩm</th>
                <th className="border-x border-slate-200 px-3 py-4 text-center text-sm font-black uppercase text-slate-700">Vị trí</th>
                <th className="border-x border-slate-200 px-3 py-4 text-center text-sm font-black uppercase text-cyan-700 bg-cyan-50/50">Tồn kho thực</th>
                <th className="border-x border-slate-200 px-3 py-4 text-center text-sm font-black uppercase text-yellow-700 bg-yellow-50/50">Đã phân bổ</th>
                <th className="border-x border-slate-200 px-3 py-4 text-center text-sm font-black uppercase text-emerald-700 bg-emerald-50/50">Có sẵn</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-sm font-medium text-slate-500">
                    Đang tải dữ liệu tồn kho...
                  </td>
                </tr>
              ) : paginatedStocks.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-sm font-medium text-slate-500">
                    Chưa có sản phẩm tồn kho phù hợp.
                  </td>
                </tr>
              ) : (
                paginatedStocks.map((stock, index) => (
                  <tr key={stock.id} className="group border-b border-slate-200 transition hover:bg-cyan-50/30">
                    <td className="border-x border-slate-200 px-3 py-4 text-center text-sm text-slate-700">
                      {startIndex + index}
                    </td>
                    <td className="border-x border-slate-200 px-3 py-4 text-center text-sm font-bold text-slate-800">
                      {stock.sku}
                    </td>
                    <td className="border-x border-slate-200 px-3 py-4 text-left text-sm font-medium text-slate-700">
                      {stock.name}
                    </td>
                    <td className="border-x border-slate-200 px-3 py-4 text-center text-sm text-slate-700">
                      <span className="inline-flex rounded-lg bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600">
                        {stock.location || '-'}
                      </span>
                    </td>
                    <td className="border-x border-slate-200 px-3 py-4 text-center text-sm font-black text-cyan-600">
                      {stock.physical.toLocaleString('vi-VN')}
                    </td>
                    <td className="border-x border-slate-200 px-3 py-4 text-center text-sm font-black text-yellow-600">
                      {stock.allocated.toLocaleString('vi-VN')}
                    </td>
                    <td className="border-x border-slate-200 px-3 py-4 text-center text-sm font-black text-emerald-600">
                      {stock.available.toLocaleString('vi-VN')}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Phân trang */}
        {!loading && totalItems > 0 && (
          <div className="flex flex-col items-center justify-between border-t border-slate-200 bg-slate-50/50 px-6 py-3 sm:flex-row">
            <div className="text-sm text-slate-600">
              Tổng số: <b>{totalItems}</b> <span className="ml-2">Hiển thị {startIndex} - {endIndex}</span>
            </div>
            <div className="mt-4 flex items-center gap-2 sm:mt-0">
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="h-8 rounded-lg border border-slate-300 bg-white px-2 text-sm outline-none transition focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
              >
                <option value={5}>5</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-50"
                >
                  «
                </button>
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-50"
                >
                  ‹
                </button>
                <button className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-600 text-sm font-bold text-white">
                  {currentPage}
                </button>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-50"
                >
                  ›
                </button>
                <button
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-50"
                >
                  »
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}