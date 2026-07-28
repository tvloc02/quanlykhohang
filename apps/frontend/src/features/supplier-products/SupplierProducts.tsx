import React from 'react';
import { Search, Package, Truck, CheckCircle2, SlidersHorizontal, Eye, History } from 'lucide-react';
import type { SupplierProductLink, InboundReceipt } from '../supplier-portal/types';

const API_BASE_URL = 'http://localhost:3000/api';

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
  };
}

function formatMoney(value: string, currency: string) {
  const amount = Number(value || 0);
  try {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: currency || 'VND' }).format(amount);
  } catch (error) {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
  }
}

type ProductRow = SupplierProductLink & {
  supplierId: string;
  supplierCode: string;
  supplierName: string;
  supplierStatus: string;
  supplierContact?: string;
  currency: string;
};

export default function SupplierProducts() {
  const [rows, setRows] = React.useState<ProductRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [search, setSearch] = React.useState('');
  const [pageSize, setPageSize] = React.useState(20);
  const [currentPage, setCurrentPage] = React.useState(1);

  // Advanced filters state
  const [showAdvancedSearch, setShowAdvancedSearch] = React.useState(false);
  const [filterSupplierName, setFilterSupplierName] = React.useState('');
  const [filterMinQty, setFilterMinQty] = React.useState('');
  const [filterMaxQty, setFilterMaxQty] = React.useState('');
  const [filterMinPrice, setFilterMinPrice] = React.useState('');
  const [filterMaxPrice, setFilterMaxPrice] = React.useState('');

  // Purchase history modal states
  const [inboundReceipts, setInboundReceipts] = React.useState<InboundReceipt[]>([]);
  const [historyModalOpen, setHistoryModalOpen] = React.useState(false);
  const [activeRowForHistory, setActiveRowForHistory] = React.useState<ProductRow | null>(null);

  const loadRows = React.useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const [suppliersResponse, inboundResponse] = await Promise.all([
        fetch(`${API_BASE_URL}/suppliers`, { headers: authHeaders() }),
        fetch(`${API_BASE_URL}/inbound`, { headers: authHeaders() }),
      ]);

      if (!suppliersResponse.ok) {
        const data = await suppliersResponse.json().catch(() => null);
        throw new Error(data?.message || 'Không tải được danh sách sản phẩm nhà cung cấp');
      }

      const suppliers = (await suppliersResponse.json()) as Array<{
        id: string;
        supplierCode: string;
        name: string;
        status?: string;
        contactPerson?: string;
        currency?: string;
        products?: SupplierProductLink[];
      }>;

      const nextRows: ProductRow[] = suppliers.flatMap((supplier) =>
        (supplier.products || []).map((link) => ({
          ...link,
          supplierId: supplier.id,
          supplierCode: supplier.supplierCode,
          supplierName: supplier.name,
          supplierStatus: supplier.status || 'active',
          supplierContact: supplier.contactPerson,
          currency: supplier.currency || 'VND',
        })),
      );

      setRows(nextRows);

      if (inboundResponse.ok) {
        const receipts = (await inboundResponse.json()) as InboundReceipt[];
        setInboundReceipts(receipts);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi khi tải dữ liệu');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadRows();
  }, [loadRows]);

  React.useEffect(() => {
    setCurrentPage(1);
  }, [search, showAdvancedSearch, filterSupplierName, filterMinQty, filterMaxQty, filterMinPrice, filterMaxPrice]);

  const filteredRows = rows.filter((row) => {
    const keyword = search.trim().toLowerCase();
    
    // Global search check
    const matchesKeyword = !keyword ||
      row.supplierCode.toLowerCase().includes(keyword) ||
      row.supplierName.toLowerCase().includes(keyword) ||
      row.supplierContact?.toLowerCase().includes(keyword) ||
      row.product?.internalSku.toLowerCase().includes(keyword) ||
      row.product?.name.toLowerCase().includes(keyword) ||
      row.supplierSku?.toLowerCase().includes(keyword) ||
      row.itemGroup?.toLowerCase().includes(keyword);

    if (!matchesKeyword) return false;

    // Advanced search checks
    if (showAdvancedSearch) {
      if (filterSupplierName.trim()) {
        const suppName = filterSupplierName.trim().toLowerCase();
        if (!row.supplierName.toLowerCase().includes(suppName) && !row.supplierCode.toLowerCase().includes(suppName)) {
          return false;
        }
      }

      if (filterMinQty.trim()) {
        const minQty = Number(filterMinQty);
        if (!isNaN(minQty) && (row.quantity ?? 0) < minQty) {
          return false;
        }
      }

      if (filterMaxQty.trim()) {
        const maxQty = Number(filterMaxQty);
        if (!isNaN(maxQty) && (row.quantity ?? 0) > maxQty) {
          return false;
        }
      }

      if (filterMinPrice.trim()) {
        const minPrice = Number(filterMinPrice);
        if (!isNaN(minPrice) && Number(row.purchasePrice || 0) < minPrice) {
          return false;
        }
      }

      if (filterMaxPrice.trim()) {
        const maxPrice = Number(filterMaxPrice);
        if (!isNaN(maxPrice) && Number(row.purchasePrice || 0) > maxPrice) {
          return false;
        }
      }
    }

    return true;
  });

  const totalItems = filteredRows.length;
  const totalPages = Math.max(Math.ceil(totalItems / pageSize), 1);
  const startIndex = (currentPage - 1) * pageSize + 1;
  const endIndex = Math.min(currentPage * pageSize, totalItems);
  const paginatedRows = filteredRows.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const getLatestPurchase = React.useCallback(
    (row: ProductRow) => {
      const matching = inboundReceipts.filter(
        (receipt) =>
          (receipt.supplier?.id === row.supplierId || receipt.supplier?.supplierCode === row.supplierCode) &&
          receipt.details?.some((d) => d.product?.id === row.product?.id),
      );
      if (!matching.length) return null;
      const sorted = [...matching].sort((a, b) => {
        const dateA = a.expectedDate ? new Date(a.expectedDate).getTime() : 0;
        const dateB = b.expectedDate ? new Date(b.expectedDate).getTime() : 0;
        return dateB - dateA;
      });
      return sorted[0];
    },
    [inboundReceipts],
  );

  const matchingReceiptsForActive = React.useMemo(() => {
    if (!activeRowForHistory) return [];
    return inboundReceipts.filter(
      (receipt) =>
        (receipt.supplier?.id === activeRowForHistory.supplierId || receipt.supplier?.supplierCode === activeRowForHistory.supplierCode) &&
        receipt.details?.some((d) => d.product?.id === activeRowForHistory.product?.id),
    );
  }, [activeRowForHistory, inboundReceipts]);

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2.5 rounded-xl border-2 border-cyan-500 bg-cyan-600 px-4 py-2 text-white shadow-md">
            <Package className="h-5 w-5 text-cyan-100" />
            <h1 className="text-lg font-bold tracking-tight text-white">Sản phẩm nhà cung cấp</h1>
          </div>
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-cyan-500" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="h-11 w-full rounded-xl border-2 border-cyan-500 bg-white pl-11 pr-4 text-base outline-none transition focus:border-cyan-600 focus:ring-4 focus:ring-cyan-500/10"
              placeholder="Tìm kiếm theo NCC, mã nội bộ, tên sản phẩm..."
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border-2 border-cyan-600 bg-white px-5 text-sm font-black text-cyan-600 transition hover:bg-cyan-50"
            >
              Export
            </button>
            <button
              type="button"
              onClick={() => setShowAdvancedSearch(!showAdvancedSearch)}
              className={`inline-flex h-11 items-center justify-center gap-2 rounded-xl border-2 px-5 text-sm font-black transition ${
                showAdvancedSearch
                  ? 'border-cyan-600 bg-cyan-50 text-cyan-700 shadow-sm'
                  : 'border-cyan-600 bg-white text-cyan-600 hover:bg-cyan-50'
              }`}
            >
              <SlidersHorizontal className="h-4 w-4" />
              Tìm kiếm nâng cao
            </button>
          </div>
        </div>

        {showAdvancedSearch && (
          <div className="rounded-2xl border-2 border-slate-200 bg-slate-50 p-5 transition-all">
            <h3 className="mb-4 text-sm font-black uppercase tracking-wider text-slate-700">Bộ lọc nâng cao</h3>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-600">Nhà cung cấp</label>
                <input
                  type="text"
                  value={filterSupplierName}
                  onChange={(e) => setFilterSupplierName(e.target.value)}
                  className="h-10 w-full rounded-xl border-2 border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-cyan-500"
                  placeholder="Nhập tên hoặc mã NCC..."
                />
              </div>
              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-600">Số lượng sản phẩm</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    value={filterMinQty}
                    onChange={(e) => setFilterMinQty(e.target.value)}
                    className="h-10 w-full rounded-xl border-2 border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-cyan-500"
                    placeholder="Từ..."
                  />
                  <span className="text-slate-400 font-bold">-</span>
                  <input
                    type="number"
                    min={0}
                    value={filterMaxQty}
                    onChange={(e) => setFilterMaxQty(e.target.value)}
                    className="h-10 w-full rounded-xl border-2 border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-cyan-500"
                    placeholder="Đến..."
                  />
                </div>
              </div>
              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-600">Tìm theo giá</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    value={filterMinPrice}
                    onChange={(e) => setFilterMinPrice(e.target.value)}
                    className="h-10 w-full rounded-xl border-2 border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-cyan-500"
                    placeholder="Từ..."
                  />
                  <span className="text-slate-400 font-bold">-</span>
                  <input
                    type="number"
                    min={0}
                    value={filterMaxPrice}
                    onChange={(e) => setFilterMaxPrice(e.target.value)}
                    className="h-10 w-full rounded-xl border-2 border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-cyan-500"
                    placeholder="Đến..."
                  />
                </div>
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setFilterSupplierName('');
                  setFilterMinQty('');
                  setFilterMaxQty('');
                  setFilterMinPrice('');
                  setFilterMaxPrice('');
                }}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-600 transition hover:bg-slate-100"
              >
                Xóa bộ lọc
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="mt-6 overflow-hidden rounded-2xl border-2 border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1220px] border-collapse bg-white">
            <thead className="bg-cyan-50">
              <tr className="border-b-2 border-slate-200">
                <th className="w-16 border-x border-slate-200 px-3 py-4 text-center text-sm font-extrabold uppercase text-slate-800">STT</th>
                <th className="w-20 border-x border-slate-200 px-3 py-4 text-center text-sm font-extrabold uppercase text-slate-800">Ảnh</th>
                <th className="w-48 border-x border-slate-200 px-3 py-4 text-center text-sm font-extrabold uppercase text-slate-800">Mã hàng hóa</th>
                <th className="min-w-[250px] border-x border-slate-200 px-3 py-4 text-center text-sm font-extrabold uppercase text-slate-800">Tên hàng hóa</th>
                <th className="w-64 border-x border-slate-200 px-3 py-4 text-center text-sm font-extrabold uppercase text-slate-800">Nhà cung cấp</th>
                <th className="w-32 border-x border-slate-200 px-3 py-4 text-center text-sm font-extrabold uppercase text-slate-800">Số lượng</th>
                <th className="w-40 border-x border-slate-200 px-3 py-4 text-center text-sm font-extrabold uppercase text-slate-800">Giá</th>
                <th className="w-36 border-x border-slate-200 px-3 py-4 text-center text-sm font-extrabold uppercase text-slate-800">Đã mua</th>
                <th className="w-52 border-x border-slate-200 px-3 py-4 text-center text-sm font-extrabold uppercase text-slate-800">Lịch sử mua gần đây</th>
                <th className="w-28 border-x border-slate-200 px-3 py-4 text-center text-sm font-extrabold uppercase text-slate-800">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={10} className="px-6 py-16 text-center text-sm font-medium text-slate-500">
                    Đang tải dữ liệu...
                  </td>
                </tr>
              ) : paginatedRows.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-6 py-16 text-center text-sm font-medium text-slate-500">
                    Không tìm thấy sản phẩm nhà cung cấp.
                  </td>
                </tr>
              ) : (
                paginatedRows.map((row, index) => {
                  const latest = getLatestPurchase(row);
                  return (
                    <tr key={`${row.id}-${row.supplierId}`} className="group border-b border-slate-200 transition hover:bg-cyan-50/50">
                      <td className="border-x border-slate-200 px-3 py-4 text-center text-sm font-semibold text-slate-700">{startIndex + index}</td>
                      <td className="border-x border-slate-200 px-3 py-4 text-center">
                        <div className="mx-auto flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                          {row.product?.image ? (
                            <img src={row.product.image} alt="Ảnh hàng hóa" className="h-full w-full object-cover" />
                          ) : (
                            <Package className="h-6 w-6 text-slate-300" />
                          )}
                        </div>
                      </td>
                      <td className="border-x border-slate-200 px-3 py-4 text-center text-sm font-semibold text-slate-700 uppercase">
                        <div>{row.product?.internalSku || '-'}</div>
                        {row.supplierSku && (
                          <div className="text-[10px] font-medium text-slate-500 mt-0.5">({row.supplierSku})</div>
                        )}
                      </td>
                      <td className="border-x border-slate-200 px-3 py-4 text-center text-sm font-semibold text-slate-700">{row.product?.name || '-'}</td>
                      <td className="border-x border-slate-200 px-3 py-4 text-center text-sm font-semibold text-slate-700">
                        {row.supplierName} <span className="text-xs font-medium text-slate-500">({row.supplierCode})</span>
                      </td>
                      <td className="border-x border-slate-200 px-3 py-4 text-center text-sm font-semibold text-slate-700">{row.quantity ?? 0}</td>
                      <td className="border-x border-slate-200 px-3 py-4 text-center text-sm font-semibold text-slate-700">{formatMoney(row.purchasePrice, row.currency)}</td>
                      <td className="border-x border-slate-200 px-3 py-4 text-center text-sm font-semibold text-slate-700">{row.quantitySold ?? 0}</td>
                      <td className="border-x border-slate-200 px-3 py-4 text-center text-sm font-semibold text-slate-700">
                        {latest ? (
                          <div className="text-sm">
                            <div className="font-semibold text-slate-800">{latest.id}</div>
                            <div className="text-xs text-slate-500">
                              {latest.expectedDate ? new Date(latest.expectedDate).toLocaleDateString('vi-VN') : '-'}
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td className="border-x border-slate-200 px-3 py-4 text-center">
                        <button
                          type="button"
                          onClick={() => {
                            setActiveRowForHistory(row);
                            setHistoryModalOpen(true);
                          }}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-xl border-2 border-cyan-500 bg-white text-cyan-600 transition hover:bg-cyan-50"
                          title="Xem lịch sử đặt hàng"
                        >
                          <Eye className="h-4 w-4" strokeWidth={2.5} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {!loading && totalItems > 0 && (
          <div className="flex flex-col items-center justify-between border-t border-slate-200 bg-slate-50/80 px-6 py-3 sm:flex-row">
            <div className="text-sm text-slate-600">
              Tổng: <b>{totalItems}</b> sản phẩm
              <span className="ml-2">Hiển thị {startIndex} - {endIndex}</span>
            </div>
            <div className="mt-3 flex items-center gap-2 sm:mt-0">
              <select
                value={pageSize}
                onChange={(event) => {
                  setPageSize(Number(event.target.value));
                  setCurrentPage(1);
                }}
                className="h-9 rounded-lg border border-slate-300 bg-white px-2 text-sm outline-none transition focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
              >
                <option value={5}>5</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(1)}
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-50"
                >
                  «
                </button>
                <button
                  type="button"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-50"
                >
                  ‹
                </button>
                <div className="flex h-9 min-w-[48px] items-center justify-center rounded-lg bg-cyan-600 px-3 text-sm font-bold text-white">{currentPage}</div>
                <button
                  type="button"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-50"
                >
                  ›
                </button>
                <button
                  type="button"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(totalPages)}
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-50"
                >
                  »
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          {error}
        </div>
      )}

      {/* Order History Modal */}
      {historyModalOpen && activeRowForHistory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm">
          <div className="w-[850px] max-w-[95%] rounded-2xl bg-white shadow-2xl border border-slate-100 flex flex-col max-h-[85vh]">
            <div className="border-b-2 border-slate-100 px-6 py-4 flex items-center justify-between">
              <h3 className="text-lg font-black text-slate-900">Lịch sử đơn đặt hàng</h3>
              <button
                type="button"
                onClick={() => {
                  setHistoryModalOpen(false);
                  setActiveRowForHistory(null);
                }}
                className="text-slate-400 hover:text-slate-600 text-xl font-bold"
              >
                &times;
              </button>
            </div>
            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase">Hàng hóa</p>
                  <p className="text-base font-black text-slate-900 mt-1">
                    [{activeRowForHistory.product?.internalSku}] - {activeRowForHistory.product?.name}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase">Nhà cung cấp</p>
                  <p className="text-base font-black text-slate-900 mt-1">
                    {activeRowForHistory.supplierName} ({activeRowForHistory.supplierCode})
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 overflow-hidden mt-4">
                <table className="w-full border-collapse bg-white">
                  <thead className="bg-slate-50">
                    <tr className="border-b border-slate-200">
                      <th className="px-4 py-3 text-center text-xs font-black uppercase text-slate-600">STT</th>
                      <th className="px-4 py-3 text-center text-xs font-black uppercase text-slate-600">Mã đơn hàng</th>
                      <th className="px-4 py-3 text-center text-xs font-black uppercase text-slate-600">Ngày dự kiến</th>
                      <th className="px-4 py-3 text-center text-xs font-black uppercase text-slate-600">SL yêu cầu</th>
                      <th className="px-4 py-3 text-center text-xs font-black uppercase text-slate-600">SL thực nhập</th>
                      <th className="px-4 py-3 text-center text-xs font-black uppercase text-slate-600">Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody>
                    {matchingReceiptsForActive.length ? (
                      matchingReceiptsForActive.map((receipt, index) => {
                        const detail = receipt.details?.find((d) => d.product?.id === activeRowForHistory.product?.id);
                        return (
                          <tr key={receipt.id} className="border-t border-slate-200 text-sm hover:bg-slate-50/50">
                            <td className="px-4 py-3 text-center text-slate-500 font-semibold">{index + 1}</td>
                            <td className="px-4 py-3 text-center font-bold text-slate-800">{receipt.id}</td>
                            <td className="px-4 py-3 text-center text-slate-600 font-medium">
                              {receipt.expectedDate ? new Date(receipt.expectedDate).toLocaleDateString('vi-VN') : '-'}
                            </td>
                            <td className="px-4 py-3 text-center font-bold text-slate-700">{detail?.expectedQty ?? 0}</td>
                            <td className="px-4 py-3 text-center font-bold text-cyan-700">{detail?.receivedQty ?? 0}</td>
                            <td className="px-4 py-3 text-center">
                              <span className="inline-flex rounded-lg px-2.5 py-1 text-xs font-bold bg-cyan-50 text-cyan-700 border border-cyan-100">
                                {receipt.status || 'Chờ xử lý'}
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-slate-400 font-semibold">
                          Chưa có lịch sử đơn đặt hàng cho sản phẩm này.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="flex justify-end gap-3 border-t border-slate-100 px-6 py-4 bg-slate-50">
              <button
                type="button"
                onClick={() => {
                  setHistoryModalOpen(false);
                  setActiveRowForHistory(null);
                }}
                className="rounded-xl border border-slate-300 bg-white px-5 py-2.5 font-bold text-slate-700 hover:bg-slate-50"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}