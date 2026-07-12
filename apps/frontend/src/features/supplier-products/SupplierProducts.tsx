import React from 'react';
import { Search, Package, Truck, CheckCircle2 } from 'lucide-react';
import type { SupplierProductLink } from '../supplier-portal/types';

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

  const loadRows = React.useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_BASE_URL}/suppliers`, { headers: authHeaders() });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.message || 'Không tải được danh sách sản phẩm nhà cung cấp');
      }

      const suppliers = (await response.json()) as Array<{
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
  }, [search]);

  const filteredRows = rows.filter((row) => {
    const keyword = search.trim().toLowerCase();
    return (
      !keyword ||
      row.supplierCode.toLowerCase().includes(keyword) ||
      row.supplierName.toLowerCase().includes(keyword) ||
      row.supplierContact?.toLowerCase().includes(keyword) ||
      row.product?.internalSku.toLowerCase().includes(keyword) ||
      row.product?.name.toLowerCase().includes(keyword) ||
      row.supplierSku?.toLowerCase().includes(keyword) ||
      row.itemGroup?.toLowerCase().includes(keyword)
    );
  });

  const totalItems = filteredRows.length;
  const totalPages = Math.max(Math.ceil(totalItems / pageSize), 1);
  const startIndex = (currentPage - 1) * pageSize + 1;
  const endIndex = Math.min(currentPage * pageSize, totalItems);
  const paginatedRows = filteredRows.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-black text-slate-900">Sản phẩm NCC</h1>
      </div>

      <div className="mt-6 flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="h-11 w-full rounded-xl border-2 border-slate-200 bg-white pl-11 pr-4 text-base outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
            placeholder="Tìm kiếm theo NCC, mã nội bộ, tên sản phẩm..."
          />
        </div>
        <button
          type="button"
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-600 px-6 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-cyan-700"
        >
          <span>Export</span>
        </button>
      </div>

      <div className="mt-6 overflow-hidden rounded-2xl border-2 border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1360px] border-collapse bg-white">
            <thead className="bg-slate-50">
              <tr className="border-b-2 border-slate-200">
                <th className="w-16 border-x border-slate-200 px-3 py-4 text-center text-sm font-black uppercase text-slate-700">STT</th>
                <th className="border-x border-slate-200 px-3 py-4 text-left text-sm font-black uppercase text-slate-700">NCC</th>
                <th className="border-x border-slate-200 px-3 py-4 text-left text-sm font-black uppercase text-slate-700">Mã nội bộ</th>
                <th className="border-x border-slate-200 px-3 py-4 text-left text-sm font-black uppercase text-slate-700">Tên sản phẩm</th>
                <th className="border-x border-slate-200 px-3 py-4 text-left text-sm font-black uppercase text-slate-700">Supplier SKU</th>
                <th className="border-x border-slate-200 px-3 py-4 text-left text-sm font-black uppercase text-slate-700">Nhóm hàng</th>
                <th className="border-x border-slate-200 px-3 py-4 text-center text-sm font-black uppercase text-slate-700">ĐVT</th>
                <th className="border-x border-slate-200 px-3 py-4 text-left text-sm font-black uppercase text-slate-700">Vị trí</th>
                <th className="border-x border-slate-200 px-3 py-4 text-right text-sm font-black uppercase text-slate-700">Giá nhập</th>
                <th className="border-x border-slate-200 px-3 py-4 text-center text-sm font-black uppercase text-slate-700">NCC chính</th>
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
                paginatedRows.map((row, index) => (
                  <tr key={`${row.id}-${row.supplierId}`} className="group border-b border-slate-200 transition hover:bg-cyan-50/50">
                    <td className="border-x border-slate-200 px-3 py-4 text-center text-sm text-slate-700">{startIndex + index}</td>
                    <td className="border-x border-slate-200 px-3 py-4 text-left text-sm font-bold text-slate-900">{row.supplierName} <span className="text-xs font-medium text-slate-500">({row.supplierCode})</span></td>
                    <td className="border-x border-slate-200 px-3 py-4 text-left text-sm font-semibold text-slate-700">{row.product?.internalSku || '-'}</td>
                    <td className="border-x border-slate-200 px-3 py-4 text-left text-sm text-slate-700">{row.product?.name || '-'}</td>
                    <td className="border-x border-slate-200 px-3 py-4 text-left text-sm font-semibold text-slate-700">{row.supplierSku || '-'}</td>
                    <td className="border-x border-slate-200 px-3 py-4 text-left text-sm text-slate-700">{row.itemGroup || '-'}</td>
                    <td className="border-x border-slate-200 px-3 py-4 text-center text-sm text-slate-700">{row.product?.unit || '-'}</td>
                    <td className="border-x border-slate-200 px-3 py-4 text-left text-sm text-slate-700">{row.storagePosition || '-'}</td>
                    <td className="border-x border-slate-200 px-3 py-4 text-right text-sm font-bold text-slate-800">{formatMoney(row.purchasePrice, row.currency)}</td>
                    <td className="border-x border-slate-200 px-3 py-4 text-center text-sm">
                      <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold ${row.isPrimary ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-600 border border-slate-200'}`}>
                        {row.isPrimary ? <CheckCircle2 className="h-3.5 w-3.5" /> : null}
                        {row.isPrimary ? 'Có' : 'Không'}
                      </span>
                    </td>
                  </tr>
                ))
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
    </div>
  );
}