import React from 'react';
import { CheckCircle2, Download, FileSpreadsheet, Package, Pencil, Plus, Search, Trash2, Upload } from 'lucide-react';
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
}: SupplierProductsWindowProps) {
  const [search, setSearch] = React.useState('');
  const [primaryFilter, setPrimaryFilter] = React.useState<'all' | 'primary' | 'secondary'>('all');
  const [pageSize, setPageSize] = React.useState(10);
  const [currentPage, setCurrentPage] = React.useState(1);

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
                <th className="border-x border-slate-200 px-3 py-3 text-right text-xs font-black uppercase text-slate-600">Giá nhập</th>
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
                    {formatMoney(link.purchasePrice, profile?.currency || 'VND')}
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

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="rounded-xl border-2 border-slate-200 bg-white p-4">
          <p className="text-xs font-black uppercase text-slate-500">Tổng mặt hàng</p>
          <p className="mt-2 text-2xl font-black text-slate-900">{links.length}</p>
        </div>
        <div className="rounded-xl border-2 border-emerald-200 bg-emerald-50 p-4">
          <p className="text-xs font-black uppercase text-emerald-600">NCC chính</p>
          <p className="mt-2 text-2xl font-black text-emerald-700">{primaryCount}</p>
        </div>
        <div className="rounded-xl border-2 border-cyan-200 bg-cyan-50 p-4">
          <p className="text-xs font-black uppercase text-cyan-600">Lead time</p>
          <p className="mt-2 text-2xl font-black text-cyan-700">{profile?.leadTimeDays || 0} ngày</p>
        </div>
        <div className="grid min-h-[84px] grid-cols-2 gap-2">
          <button type="button" onClick={onAdd} className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-600 px-3 py-2 text-sm font-black text-white shadow-sm transition hover:bg-cyan-700">
            <Plus className="h-4 w-4" />
            Thêm
          </button>
          <button type="button" onClick={onImport} className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-cyan-600 bg-white px-3 py-2 text-sm font-black text-cyan-700 transition hover:bg-cyan-50">
            <Upload className="h-4 w-4" />
            Import
          </button>
          <button type="button" onClick={onExport} className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-slate-200 bg-white px-3 py-2 text-sm font-black text-slate-700 transition hover:bg-slate-50">
            <Download className="h-4 w-4" />
            Export
          </button>
          <button type="button" onClick={onDownloadTemplate} className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-slate-200 bg-white px-3 py-2 text-sm font-black text-slate-700 transition hover:bg-slate-50">
            <FileSpreadsheet className="h-4 w-4" />
            Mẫu
          </button>
        </div>
      </div>

      <div className="mt-4 rounded-xl border-2 border-slate-200 bg-white p-4">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1.4fr_0.8fr]">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="h-11 w-full rounded-xl border-2 border-slate-200 bg-slate-50 pl-11 pr-4 text-sm font-semibold outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
              placeholder="Tìm mã nội bộ, tên sản phẩm hoặc supplier SKU..."
            />
          </div>
          <select
            value={primaryFilter}
            onChange={(event) => setPrimaryFilter(event.target.value as 'all' | 'primary' | 'secondary')}
            className="h-11 rounded-xl border-2 border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-700 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
          >
            <option value="all">Vai trò: Tất cả</option>
            <option value="primary">Vai trò: NCC chính</option>
            <option value="secondary">Vai trò: NCC phụ</option>
          </select>
        </div>
      </div>

      <div className="mt-4 min-h-0 flex-1 overflow-hidden rounded-xl border-2 border-slate-200 bg-white">
        <div className="h-full overflow-auto">
          <table className="w-full min-w-[1320px] border-collapse bg-white">
            <thead className="sticky top-0 z-10 bg-slate-50">
              <tr className="border-b-2 border-slate-200">
                <th className="w-16 border-x border-slate-200 px-3 py-4 text-center text-sm font-black uppercase text-slate-700">STT</th>
                <th className="border-x border-slate-200 px-3 py-4 text-left text-sm font-black uppercase text-slate-700">Mã nội bộ</th>
                <th className="border-x border-slate-200 px-3 py-4 text-left text-sm font-black uppercase text-slate-700">Tên sản phẩm</th>
                <th className="border-x border-slate-200 px-3 py-4 text-left text-sm font-black uppercase text-slate-700">Nhóm hàng</th>
                <th className="border-x border-slate-200 px-3 py-4 text-left text-sm font-black uppercase text-slate-700">Supplier SKU</th>
                <th className="border-x border-slate-200 px-3 py-4 text-center text-sm font-black uppercase text-slate-700">ĐVT</th>
                <th className="border-x border-slate-200 px-3 py-4 text-left text-sm font-black uppercase text-slate-700">Thuộc tính</th>
                <th className="border-x border-slate-200 px-3 py-4 text-left text-sm font-black uppercase text-slate-700">Vị trí</th>
                <th className="border-x border-slate-200 px-3 py-4 text-center text-sm font-black uppercase text-slate-700">Tối thiểu</th>
                <th className="border-x border-slate-200 px-3 py-4 text-right text-sm font-black uppercase text-slate-700">Giá nhập</th>
                <th className="border-x border-slate-200 px-3 py-4 text-center text-sm font-black uppercase text-slate-700">NCC chính</th>
                <th className="sticky right-0 w-28 border-l border-slate-200 bg-slate-50 px-3 py-4 text-center text-sm font-black uppercase text-slate-700 shadow-[-4px_0_12px_rgba(0,0,0,0.03)]">
                  Thao tác
                </th>
              </tr>
            </thead>
            <tbody>
              {paginatedLinks.length ? (
                paginatedLinks.map((link, index) => (
                  <tr key={link.id} className="group border-b border-slate-200 transition hover:bg-cyan-50/50">
                    <td className="border-x border-slate-200 px-3 py-4 text-center text-sm text-slate-700">
                      {startIndex + index}
                    </td>
                    <td className="border-x border-slate-200 px-3 py-4 text-sm font-black uppercase text-slate-800">
                      {link.product?.internalSku || '-'}
                    </td>
                    <td className="border-x border-slate-200 px-3 py-4 text-sm font-semibold text-slate-700">
                      {link.product?.name || '-'}
                    </td>
                    <td className="border-x border-slate-200 px-3 py-4 text-sm font-semibold text-slate-700">
                      {link.itemGroup || '-'}
                    </td>
                    <td className="border-x border-slate-200 px-3 py-4 text-sm font-bold text-slate-700">
                      {link.supplierSku || '-'}
                    </td>
                    <td className="border-x border-slate-200 px-3 py-4 text-center text-sm text-slate-700">
                      {link.product?.unit || '-'}
                    </td>
                    <td className="border-x border-slate-200 px-3 py-4 text-sm text-slate-700">
                      {link.managementType || '-'}
                    </td>
                    <td className="border-x border-slate-200 px-3 py-4 text-sm text-slate-700">
                      {link.storagePosition || '-'}
                    </td>
                    <td className="border-x border-slate-200 px-3 py-4 text-center text-sm font-bold text-slate-700">
                      {link.product?.minimumStock ?? 0}
                    </td>
                    <td className="border-x border-slate-200 px-3 py-4 text-right text-sm font-black text-slate-800">
                      {formatMoney(link.purchasePrice, profile?.currency || 'VND')}
                    </td>
                    <td className="border-x border-slate-200 px-3 py-4 text-center">
                      <span className={`inline-flex items-center gap-1 rounded-lg border px-3 py-1 text-xs font-bold ${link.isPrimary ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-100 text-slate-600'}`}>
                        {link.isPrimary && <CheckCircle2 className="h-3.5 w-3.5" />}
                        {link.isPrimary ? 'Có' : 'Không'}
                      </span>
                    </td>
                    <td className="sticky right-0 border-l border-slate-200 bg-white px-3 py-4 text-center align-middle shadow-[-4px_0_12px_rgba(0,0,0,0.03)] group-hover:bg-cyan-50/50">
                      <div className="flex items-center justify-center gap-2">
                        <button type="button" onClick={() => onEdit(link)} title="Sửa" className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-50 text-cyan-600 transition-colors hover:bg-cyan-100">
                          <Pencil size={18} strokeWidth={2} />
                        </button>
                        <button type="button" onClick={() => onDelete(link)} title="Xóa" className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-50 text-red-600 transition-colors hover:bg-red-100">
                          <Trash2 size={18} strokeWidth={2} />
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
                <button type="button" className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-600 text-sm font-bold text-white">{currentPage}</button>
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
