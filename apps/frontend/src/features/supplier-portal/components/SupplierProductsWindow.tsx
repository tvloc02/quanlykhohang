import React from 'react';
import { CheckCircle2, Download, FileSpreadsheet, Package, Pencil, Plus, Search, Trash2, Upload, History } from 'lucide-react';
import type { SupplierProductLink, SupplierProfile } from '../types';

type SupplierProductsWindowProps = {
  profile: SupplierProfile | null;
  compact?: boolean;
  onAdd: () => void;
  onEdit: (link: SupplierProductLink) => void;
  onDelete: (link: SupplierProductLink) => void;
  onImport: () => void;
  onExport: () => void;
  onDownloadTemplate: () => void;
  onAddQuantity?: (link: SupplierProductLink) => void;
  onViewOrderHistory?: (link: SupplierProductLink) => void;
  onBulkAddQuantity?: (ids: string[]) => void;
  onBulkDelete?: (ids: string[]) => void;
  onEditPrice?: (link: SupplierProductLink) => void;
};

function formatMoney(value: string, currency: string) {
  const amount = Number(value || 0);
  try {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: currency || 'VND' }).format(amount);
  } catch (error) {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
  }
}

export default function SupplierProductsWindow({
  profile,
  compact,
  onAdd,
  onEdit,
  onDelete,
  onImport,
  onExport,
  onDownloadTemplate,
  onAddQuantity,
  onViewOrderHistory,
  onBulkAddQuantity,
  onBulkDelete,
  onEditPrice,
}: SupplierProductsWindowProps) {
  const [search, setSearch] = React.useState('');
  const [primaryFilter, setPrimaryFilter] = React.useState<'all' | 'primary' | 'secondary'>('all');
  const [pageSize, setPageSize] = React.useState(10);
  const [currentPage, setCurrentPage] = React.useState(1);
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);

  React.useEffect(() => {
    setSelectedIds([]);
  }, [search, currentPage]);

  const links = profile?.products || [];
  const filteredLinks = links.filter((link) => {
    const keyword = search.trim().toLowerCase();
    const matchesKeyword =
      !keyword ||
      link.product?.internalSku.toLowerCase().includes(keyword) ||
      link.product?.name.toLowerCase().includes(keyword) ||
      link.supplierSku?.toLowerCase().includes(keyword);
    const matchesPrimary =
      primaryFilter === 'all' ||
      (primaryFilter === 'primary' && link.isPrimary) ||
      (primaryFilter === 'secondary' && !link.isPrimary);

    return matchesKeyword && matchesPrimary;
  });

  React.useEffect(() => {
    setCurrentPage(1);
  }, [search, primaryFilter]);

  const totalItems = filteredLinks.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const startIndex = (currentPage - 1) * pageSize + 1;
  const endIndex = Math.min(currentPage * pageSize, totalItems);
  const paginatedLinks = filteredLinks.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const primaryCount = links.filter((link) => link.isPrimary).length;

  if (compact) {
    return (
      <div className="flex h-full flex-col gap-3">
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-black uppercase text-slate-500">Tổng SP</p>
            <p className="mt-2 text-2xl font-black text-slate-900">{links.length}</p>
          </div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
            <p className="text-xs font-black uppercase text-emerald-600">NCC chính</p>
            <p className="mt-2 text-2xl font-black text-emerald-700">{primaryCount}</p>
          </div>
          <div className="rounded-xl border border-cyan-200 bg-cyan-50 p-3">
            <p className="text-xs font-black uppercase text-cyan-600">Tiền tệ</p>
            <p className="mt-2 text-2xl font-black text-cyan-700">{profile?.currency || 'VND'}</p>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-hidden rounded-xl border border-slate-200">
          <table className="w-full border-collapse bg-white">
            <thead className="bg-slate-50">
              <tr>
                <th className="border-x border-slate-200 px-3 py-3 text-left text-xs font-black uppercase text-slate-600">Mặt hàng</th>
                <th className="border-x border-slate-200 px-3 py-3 text-left text-xs font-black uppercase text-slate-600">Nhóm</th>
                <th className="border-x border-slate-200 px-3 py-3 text-right text-xs font-black uppercase text-slate-600">Số lượng</th>
              </tr>
            </thead>
            <tbody>
              {links.slice(0, 4).map((link) => (
                <tr key={link.id} className="border-t border-slate-200">
                  <td className="border-x border-slate-200 px-3 py-3 text-sm">
                    <p className="font-black text-slate-800">{link.product?.internalSku || '-'}</p>
                    <p className="truncate font-semibold text-slate-600">{link.product?.name || '-'}</p>
                  </td>
                  <td className="border-x border-slate-200 px-3 py-3 text-sm font-semibold text-slate-600">{link.itemGroup || '-'}</td>
                  <td className="border-x border-slate-200 px-3 py-3 text-right text-sm font-bold text-slate-700">
                    {link.quantity ?? 0}
                  </td>
                </tr>
              ))}
              {links.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-sm font-semibold text-slate-500">
                    Chưa có mặt hàng cung cấp.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  const totalProducts = links.length;
  const totalStockQuantity = links.reduce((sum, link) => sum + (link.quantity || 0), 0);
  const totalSoldProductCount = links.filter((link) => (link.quantitySold || 0) > 0).length;
  const totalSoldQuantity = links.reduce((sum, link) => sum + (link.quantitySold || 0), 0);
  const totalRevenue = links.reduce((sum, link) => sum + (link.quantitySold || 0) * Number(link.purchasePrice || 0), 0);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
        <div className="rounded-xl border-2 border-cyan-600 bg-white p-4">
          <p className="text-xs font-black uppercase text-cyan-600">Tổng mặt hàng</p>
          <p className="mt-2 text-2xl font-black text-slate-900">{totalProducts}</p>
        </div>
        <div className="rounded-xl border-2 border-cyan-600 bg-white p-4">
          <p className="text-xs font-black uppercase text-cyan-600">Tổng số lượng hàng hóa</p>
          <p className="mt-2 text-2xl font-black text-slate-900">{totalStockQuantity}</p>
        </div>
        <div className="rounded-xl border-2 border-cyan-600 bg-white p-4">
          <p className="text-xs font-black uppercase text-cyan-600">Tổng sản phẩm bán ra</p>
          <p className="mt-2 text-2xl font-black text-slate-900">{totalSoldProductCount}</p>
        </div>
        <div className="rounded-xl border-2 border-cyan-600 bg-white p-4">
          <p className="text-xs font-black uppercase text-cyan-600">Tổng số lượng SP bán ra</p>
          <p className="mt-2 text-2xl font-black text-slate-900">{totalSoldQuantity}</p>
        </div>
        <div className="rounded-xl border-2 border-cyan-600 bg-white p-4">
          <p className="text-xs font-black uppercase text-cyan-600">Tổng thu nhập</p>
          <p className="mt-2 text-2xl font-black text-slate-900">{formatMoney(String(totalRevenue), profile?.currency || 'VND')}</p>
        </div>
      </div>

      <div className="mt-4 rounded-xl border-2 border-slate-200 bg-white p-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="h-11 w-full rounded-xl border-2 border-slate-200 bg-slate-50 pl-11 pr-4 text-sm font-semibold outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
              placeholder="Tìm mã nội bộ, tên sản phẩm hoặc supplier SKU..."
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onAdd}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border-2 border-cyan-600 bg-white px-4 text-sm font-black text-cyan-600 transition hover:bg-cyan-50"
            >
              <Plus className="h-4 w-4" />
              Thêm
            </button>
            <button
              type="button"
              onClick={onImport}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border-2 border-cyan-600 bg-white px-4 text-sm font-black text-cyan-600 transition hover:bg-cyan-50"
            >
              <Upload className="h-4 w-4" />
              Import
            </button>
            <button
              type="button"
              onClick={onExport}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border-2 border-cyan-600 bg-white px-4 text-sm font-black text-cyan-600 transition hover:bg-cyan-50"
            >
              <Download className="h-4 w-4" />
              Export
            </button>
            <button
              type="button"
              onClick={onDownloadTemplate}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border-2 border-cyan-600 bg-white px-4 text-sm font-black text-cyan-600 transition hover:bg-cyan-50"
            >
              <FileSpreadsheet className="h-4 w-4" />
              Mẫu
            </button>
          </div>
        </div>
      </div>

      {selectedIds.length > 0 && (
        <div className="mt-4 flex items-center justify-between rounded-xl border-2 border-cyan-600 bg-cyan-50/20 px-4 py-3">
          <span className="text-sm font-bold text-cyan-800">
            Đã chọn <b>{selectedIds.length}</b> mặt hàng
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => onBulkAddQuantity?.(selectedIds)}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border-2 border-cyan-600 bg-white px-4 text-xs font-black text-cyan-600 transition hover:bg-cyan-50"
            >
              <Plus className="h-3.5 w-3.5" />
              Thêm số lượng hàng loạt
            </button>
            <button
              type="button"
              onClick={() => onBulkDelete?.(selectedIds)}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border-2 border-red-600 bg-white px-4 text-xs font-black text-red-600 transition hover:bg-red-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Xóa hàng loạt
            </button>
          </div>
        </div>
      )}

      <div className="mt-4 flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border-2 border-slate-200 bg-white">
        <div className="flex-1 overflow-auto">
          <table className="w-full min-w-[1450px] border-collapse bg-white">
            <thead className="sticky top-0 z-10 bg-slate-50">
              <tr className="border-b-2 border-slate-200">
                <th className="w-12 border-x border-slate-200 px-3 py-4 text-center">
                  <input
                    type="checkbox"
                    checked={paginatedLinks.length > 0 && paginatedLinks.every((link) => selectedIds.includes(link.id))}
                    onChange={(e) => {
                      if (e.target.checked) {
                        const newSelectedIds = Array.from(new Set([...selectedIds, ...paginatedLinks.map((link) => link.id)]));
                        setSelectedIds(newSelectedIds);
                      } else {
                        setSelectedIds(selectedIds.filter((id) => !paginatedLinks.some((link) => link.id === id)));
                      }
                    }}
                    className="h-4 w-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
                  />
                </th>
                <th className="w-24 border-x border-slate-200 px-3 py-4 text-center text-sm font-black uppercase text-slate-700">STT</th>
                <th className="w-20 border-x border-slate-200 px-3 py-4 text-center text-sm font-black uppercase text-slate-700">Ảnh</th>
                <th className="w-36 border-x border-slate-200 px-3 py-4 text-center text-sm font-black uppercase text-slate-700">Mã hàng hóa</th>
                <th className="min-w-[250px] border-x border-slate-200 px-3 py-4 text-center text-sm font-black uppercase text-slate-700">Tên hàng hóa</th>
                <th className="w-44 border-x border-slate-200 px-3 py-4 text-center text-sm font-black uppercase text-slate-700">Loại hàng hóa</th>
                <th className="w-28 border-x border-slate-200 px-3 py-4 text-center text-sm font-black uppercase text-slate-700">ĐV Tính</th>
                <th className="w-36 border-x border-slate-200 px-3 py-4 text-center text-sm font-black uppercase text-slate-700">Giá sản phẩm</th>
                <th className="w-28 border-x border-slate-200 px-3 py-4 text-center text-sm font-black uppercase text-slate-700">Số lượng</th>
                <th className="w-36 border-x border-slate-200 px-3 py-4 text-center text-sm font-black uppercase text-slate-700">Lịch sử thêm</th>
                <th className="w-40 border-x border-slate-200 px-3 py-4 text-center text-sm font-black uppercase text-slate-700">Lịch sử đã bán</th>
                <th className="sticky right-0 w-48 border-l border-slate-200 bg-slate-50 px-3 py-4 text-center text-sm font-black uppercase text-slate-700 shadow-[-4px_0_12px_rgba(0,0,0,0.03)]">
                  Thao tác
                </th>
              </tr>
            </thead>
            <tbody>
              {paginatedLinks.length ? (
                paginatedLinks.map((link, index) => (
                  <tr key={link.id} className="group border-b border-slate-200 transition hover:bg-cyan-50/50">
                    <td className="border-x border-slate-200 px-3 py-4 text-center">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(link.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedIds([...selectedIds, link.id]);
                          } else {
                            setSelectedIds(selectedIds.filter((id) => id !== link.id));
                          }
                        }}
                        className="h-4 w-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
                      />
                    </td>
                    <td className="border-x border-slate-200 px-3 py-4 text-center text-sm text-slate-900">
                      {startIndex + index}
                    </td>
                    <td className="border-x border-slate-200 px-3 py-4 text-center">
                      <div className="mx-auto flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                        {link.product?.image ? (
                          <img src={link.product.image} alt="Ảnh hàng hóa" className="h-full w-full object-cover" />
                        ) : (
                          <Package className="h-6 w-6 text-slate-300" />
                        )}
                      </div>
                    </td>
                    <td className="border-x border-slate-200 px-3 py-4 text-center text-sm uppercase text-slate-900">
                      <div>{link.product?.internalSku || '-'}</div>
                      {link.supplierSku && (
                        <div className="text-[10px] font-medium text-slate-500 mt-0.5">({link.supplierSku})</div>
                      )}
                    </td>
                    <td className="border-x border-slate-200 px-3 py-4 text-center text-sm text-slate-900">
                      {link.product?.name || '-'}
                    </td>
                    <td className="border-x border-slate-200 px-3 py-4 text-center text-sm text-slate-900">
                      {link.itemGroup || '-'}
                    </td>
                    <td className="border-x border-slate-200 px-3 py-4 text-center text-sm text-slate-900">
                      {link.product?.unit || '-'}
                    </td>
                    <td className="border-x border-slate-200 px-3 py-4 text-center text-sm text-slate-900">
                      <button
                        type="button"
                        onClick={() => onEditPrice?.(link)}
                        className="font-medium text-cyan-600 hover:text-cyan-700 hover:underline transition"
                        title="Nhấp để sửa giá nhanh"
                      >
                        {formatMoney(String(link.purchasePrice || 0), profile?.currency || 'VND')}
                      </button>
                    </td>
                    <td className="border-x border-slate-200 px-3 py-4 text-center text-sm text-slate-900">
                      {link.quantity ?? 0}
                    </td>
                    <td className="border-x border-slate-200 px-3 py-4 text-center text-sm text-slate-900">
                      {link.quantityAdded ?? 0}
                    </td>
                    <td className="border-x border-slate-200 px-3 py-4 text-center text-sm text-slate-900">
                      {link.quantitySold ?? 0}
                    </td>
                    <td className="sticky right-0 border-l border-slate-200 bg-white px-3 py-4 text-center align-middle shadow-[-4px_0_12px_rgba(0,0,0,0.03)] group-hover:bg-cyan-50/50">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          type="button"
                          onClick={() => onAddQuantity?.(link)}
                          title="Thêm số lượng"
                          className="flex h-9 w-9 items-center justify-center rounded-xl border-2 border-cyan-600 bg-white text-cyan-600 transition hover:bg-cyan-50"
                        >
                          <Plus size={18} strokeWidth={2.5} />
                        </button>
                        <button
                          type="button"
                          onClick={() => onViewOrderHistory?.(link)}
                          title="Lịch sử đơn hàng"
                          className="flex h-9 w-9 items-center justify-center rounded-xl border-2 border-cyan-600 bg-white text-cyan-600 transition hover:bg-cyan-50"
                        >
                          <History size={18} strokeWidth={2.5} />
                        </button>
                        <button
                          type="button"
                          onClick={() => onEdit(link)}
                          title="Sửa"
                          className="flex h-9 w-9 items-center justify-center rounded-xl border-2 border-cyan-600 bg-white text-cyan-600 transition hover:bg-cyan-50"
                        >
                          <Pencil size={18} strokeWidth={2.5} />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDelete(link)}
                          title="Xóa"
                          className="flex h-9 w-9 items-center justify-center rounded-xl border-2 border-cyan-600 bg-white text-cyan-600 transition hover:bg-cyan-50"
                        >
                          <Trash2 size={18} strokeWidth={2.5} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={12} className="px-6 py-14 text-center">
                    <Package className="mx-auto h-10 w-10 text-slate-300" />
                    <p className="mt-3 text-sm font-semibold text-slate-500">Chưa có mặt hàng phù hợp.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {totalItems > 0 && (
          <div className="flex flex-col items-center justify-between border-t border-slate-200 bg-slate-50/50 px-6 py-3 sm:flex-row">
            <div className="text-sm text-slate-600">
              Tổng số: <b>{totalItems}</b> <span className="ml-2">Hiển thị {startIndex} - {endIndex}</span>
            </div>
            <div className="mt-4 flex items-center gap-2 sm:mt-0">
              <select
                value={pageSize}
                onChange={(event) => {
                  setPageSize(Number(event.target.value));
                  setCurrentPage(1);
                }}
                className="h-8 rounded-lg border border-slate-300 bg-white px-2 text-sm outline-none transition focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
              >
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => setCurrentPage(1)} disabled={currentPage === 1} className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-50">«</button>
                <button type="button" onClick={() => setCurrentPage((page) => Math.max(1, page - 1))} disabled={currentPage === 1} className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-50">‹</button>
                {(() => {
                  const pages = [];
                  const range = 2; // Show 2 pages before and after current
                  const start = Math.max(1, currentPage - range);
                  const end = Math.min(totalPages, currentPage + range);
                  for (let i = start; i <= end; i++) {
                    pages.push(i);
                  }
                  return pages.map((page) => {
                    const isCurrent = page === currentPage;
                    return (
                      <button
                        key={page}
                        type="button"
                        onClick={() => setCurrentPage(page)}
                        className={`flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold transition-all ${
                          isCurrent
                            ? 'bg-cyan-600 text-white'
                            : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        {page}
                      </button>
                    );
                  });
                })()}
                <button type="button" onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))} disabled={currentPage === totalPages} className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-50">›</button>
                <button type="button" onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages} className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-50">»</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
