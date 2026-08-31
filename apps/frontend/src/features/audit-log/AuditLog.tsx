import React from 'react';
import {
  Search,
  Filter,
  X,
  XCircle,
  CheckCircle,
  History,
  Download,
  FileText,
  UserCheck,
  Activity,
  PlusCircle,
  RefreshCw,
  Trash2,
} from 'lucide-react';

function Toast({ message, type, onClose }: { message: string; type: 'success' | 'error'; onClose: () => void }) {
  React.useEffect(() => {
    if (message) {
      const timer = setTimeout(() => onClose(), 3000);
      return () => clearTimeout(timer);
    }
  }, [message, onClose]);

  if (!message) return null;

  return (
    <div
      className={`fixed top-4 right-4 z-[60] flex items-center gap-3 rounded-xl px-4 py-3 shadow-lg transition-all ${
        type === 'error' ? 'bg-red-50 text-red-600 border border-red-200' : 'bg-emerald-50 text-emerald-600 border border-emerald-200'
      }`}
    >
      {type === 'error' ? <XCircle size={20} /> : <CheckCircle size={20} />}
      <p className="text-sm font-semibold">{message}</p>
      <button onClick={onClose} className="ml-2 rounded-lg p-1 hover:bg-white/50 transition">
        <X size={16} />
      </button>
    </div>
  );
}

interface AuditLogItem {
  id: string;
  actorEmail?: string;
  action: string;
  resource: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

const API_BASE_URL = '/api';

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
  };
}

function getFallbackLogs(): AuditLogItem[] {
  return [];
}

// Hàm thông minh chuyển đổi Thao tác & Metadata thành Mô tả Tiếng Việt dễ hiểu
function formatVietnameseLogDescription(log: AuditLogItem): string {
  const act = (log.action || '').toUpperCase();
  const res = (log.resource || '').toUpperCase();
  const meta = log.metadata || {};

  // Parse metadata object to clean string
  const metaPairs = Object.entries(meta)
    .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`)
    .join(', ');

  if (act.includes('LOCK')) {
    const reason = meta.reason || meta.lockReason || meta.note;
    const target = meta.customer || meta.fullName || meta.email || log.resourceId || 'tài khoản';
    return `Khóa tài khoản của "${target}"${reason ? `. Lý do khóa: "${reason}"` : ''}`;
  }

  if (act.includes('UNLOCK')) {
    const target = meta.customer || meta.fullName || meta.email || log.resourceId || 'tài khoản';
    return `Mở khóa tài khoản hoạt động cho "${target}"`;
  }

  if (act.includes('LOGIN')) {
    return `Đăng nhập vào hệ thống thành công (IP: ${meta.ip || 'Local'})`;
  }

  if (act.includes('LOGOUT')) {
    return `Đăng xuất khỏi hệ thống`;
  }

  if (act.includes('CREATE_USER') || (act.includes('CREATE') && res.includes('NHÂN SỰ'))) {
    return `Thêm mới tài khoản nhân sự "${meta.fullName || meta.email || log.resourceId || ''}" (Chức vụ: ${meta.role || 'Nhân viên'})`;
  }

  if (act.includes('UPDATE_USER') || (act.includes('UPDATE') && res.includes('NHÂN SỰ'))) {
    return `Cập nhật thông tin hồ sơ nhân sự "${meta.fullName || meta.email || log.resourceId || ''}"`;
  }

  if (act.includes('DELETE_USER') || (act.includes('DELETE') && res.includes('NHÂN SỰ'))) {
    return `Xóa tài khoản nhân sự "${meta.email || log.resourceId || ''}" khỏi hệ thống`;
  }

  if (act.includes('CREATE_PRODUCT') || (act.includes('CREATE') && res.includes('SẢN PHẨM'))) {
    return `Tạo mới sản phẩm "${meta.name || meta.sku || log.resourceId || ''}" vào danh mục kho hàng`;
  }

  if (act.includes('UPDATE_PRODUCT') || (act.includes('UPDATE') && res.includes('SẢN PHẨM'))) {
    return `Thay đổi thông tin sản phẩm mã ${meta.sku || meta.name || log.resourceId || ''}${
      meta.field ? ` (${meta.field}: từ ${meta.oldValue} sang ${meta.newValue})` : ''
    }`;
  }

  if (act.includes('DELETE_PRODUCT') || (act.includes('DELETE') && res.includes('SẢN PHẨM'))) {
    return `Xóa bỏ sản phẩm mã ${meta.sku || log.resourceId || ''} khỏi cơ sở dữ liệu`;
  }

  if (act.includes('RECEIPT') || act.includes('STOCK_IN')) {
    return `Thực hiện nhập kho hàng ${meta.poCode ? `theo đơn hàng mua ${meta.poCode}` : ''} tại ${meta.warehouse || 'Kho chính'}`;
  }

  if (act.includes('PO') || act.includes('PURCHASE')) {
    return `Khởi tạo/Cập nhật đơn đặt hàng mua vật tư ${meta.poCode || log.resourceId || ''}`;
  }

  if (act.includes('SETTING') || res.includes('CẤU HÌNH')) {
    return `Cập nhật thiết lập cấu hình hệ thống (${metaPairs || 'Đã lưu thay đổi'})`;
  }

  // General Fallback
  let actionPrefix = 'Thực hiện thao tác';
  if (act.includes('CREATE') || act.includes('ADD')) actionPrefix = 'Thêm mới';
  else if (act.includes('UPDATE') || act.includes('EDIT')) actionPrefix = 'Cập nhật';
  else if (act.includes('DELETE') || act.includes('REMOVE')) actionPrefix = 'Xóa';
  else if (act.includes('VIEW') || act.includes('READ')) actionPrefix = 'Xem thông tin';

  return `${actionPrefix} dữ liệu thuộc phân hệ ${log.resource}${metaPairs ? `. Chi tiết: ${metaPairs}` : ''}`;
}

export default function AuditLog() {
  const [logs, setLogs] = React.useState<AuditLogItem[]>([]);
  const [search, setSearch] = React.useState('');
  const [actionFilter, setActionFilter] = React.useState<'ALL' | 'CREATE' | 'UPDATE' | 'DELETE'>('ALL');
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [success, setSuccess] = React.useState('');

  // Pagination states
  const [pageSize, setPageSize] = React.useState(20);
  const [currentPage, setCurrentPage] = React.useState(1);

  const loadData = React.useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_BASE_URL}/audit-logs`, { headers: authHeaders() });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        if (response.status === 403) {
          throw new Error(data?.message || 'Bạn không có quyền truy cập nhật ký hoạt động.');
        }
        throw new Error(data?.message || 'Không tải được nhật ký hoạt động');
      }

      const data = (await response.json()) as AuditLogItem[];
      setLogs(data.length > 0 ? data : getFallbackLogs());
    } catch {
      setLogs(getFallbackLogs());
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  React.useEffect(() => {
    setCurrentPage(1);
  }, [search, actionFilter]);

  // Compute 4 Stat Counts
  const totalLogsCount = logs.length;
  const createCount = logs.filter((l) => l.action.toUpperCase().includes('CREATE') || l.action.toUpperCase().includes('ADD')).length;
  const updateCount = logs.filter((l) => l.action.toUpperCase().includes('UPDATE') || l.action.toUpperCase().includes('LOCK') || l.action.toUpperCase().includes('EDIT')).length;
  const deleteCount = logs.filter((l) => l.action.toUpperCase().includes('DELETE') || l.action.toUpperCase().includes('REMOVE')).length;

  const filteredLogs = logs.filter((log) => {
    const keyword = search.trim().toLowerCase();
    const matchesSearch =
      !keyword ||
      (log.actorEmail || '').toLowerCase().includes(keyword) ||
      log.resource.toLowerCase().includes(keyword) ||
      log.action.toLowerCase().includes(keyword) ||
      formatVietnameseLogDescription(log).toLowerCase().includes(keyword) ||
      (log.metadata ? JSON.stringify(log.metadata).toLowerCase().includes(keyword) : false);

    const actUpper = log.action.toUpperCase();
    let matchesAction = true;
    if (actionFilter === 'CREATE') {
      matchesAction = actUpper.includes('CREATE') || actUpper.includes('ADD');
    } else if (actionFilter === 'UPDATE') {
      matchesAction = actUpper.includes('UPDATE') || actUpper.includes('LOCK') || actUpper.includes('EDIT');
    } else if (actionFilter === 'DELETE') {
      matchesAction = actUpper.includes('DELETE') || actUpper.includes('REMOVE');
    }

    return matchesSearch && matchesAction;
  });

  // Calculate Pagination
  const totalItems = filteredLogs.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const paginatedLogs = filteredLogs.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const startIndex = totalItems > 0 ? (currentPage - 1) * pageSize + 1 : 0;
  const endIndex = Math.min(currentPage * pageSize, totalItems);

  const getActionBadgeStyle = (action: string) => {
    const act = action.toUpperCase();
    if (act.includes('CREATE') || act.includes('ADD')) return 'border-cyan-300 bg-cyan-50 text-cyan-700 font-extrabold';
    if (act.includes('UPDATE') || act.includes('EDIT')) return 'border-amber-300 bg-amber-50 text-amber-700 font-extrabold';
    if (act.includes('LOCK')) return 'border-red-300 bg-red-50 text-red-700 font-extrabold';
    if (act.includes('DELETE') || act.includes('REMOVE')) return 'border-red-300 bg-red-100 text-red-800 font-black';
    return 'border-slate-300 bg-slate-100 text-slate-700 font-bold';
  };

  const handleExportCSV = () => {
    const rows = filteredLogs.map((log, index) => [
      index + 1,
      new Date(log.createdAt).toLocaleString('vi-VN'),
      log.actorEmail || 'Hệ thống',
      log.resource,
      log.action,
      formatVietnameseLogDescription(log),
    ]);

    const csvContent = [
      ['STT', 'Thời gian', 'Người thực hiện', 'Phân hệ / Đối tượng', 'Mã hành động', 'Mô tả chi tiết (Tiếng Việt)'],
      ...rows,
    ]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'nhat-ky-hoat-dong.csv';
    link.click();
    URL.revokeObjectURL(url);
    setSuccess('Đã xuất file báo cáo nhật ký hoạt động.');
  };

  return (
    <div>
      <Toast
        message={error || success}
        type={error ? 'error' : 'success'}
        onClose={() => {
          setError('');
          setSuccess('');
        }}
      />

      {/* Header matching personnel design */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2.5 rounded-xl border-2 border-cyan-500 bg-cyan-600 px-4 py-2 text-white shadow-md">
            <History className="h-5 w-5 text-cyan-100" />
            <h1 className="text-lg font-bold tracking-tight text-white">Nhật ký hoạt động hệ thống</h1>
          </div>
        </div>

        <div className="flex flex-wrap gap-2.5">
          <button
            type="button"
            onClick={loadData}
            className="inline-flex items-center gap-2 rounded-xl border-2 border-cyan-500 bg-white px-4 py-2 text-sm font-bold text-cyan-600 shadow-sm transition hover:bg-cyan-50 hover:text-cyan-700"
          >
            <RefreshCw className="h-4 w-4" />
            Làm mới
          </button>
          <button
            type="button"
            onClick={handleExportCSV}
            className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-cyan-700"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </button>
        </div>
      </div>

      {/* 4 Stat Overview Buttons matching personnel style */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <button
          type="button"
          onClick={() => setActionFilter('ALL')}
          className={`flex h-[72px] items-center justify-center rounded-xl border-2 border-cyan-500 px-4 shadow-sm transition text-center ${
            actionFilter === 'ALL'
              ? 'bg-cyan-600 text-white'
              : 'bg-white text-cyan-700 hover:bg-cyan-50'
          }`}
        >
          <p className="text-base font-black uppercase">
            {totalLogsCount} TỔNG SỐ NHẬT KÝ
          </p>
        </button>

        <button
          type="button"
          onClick={() => setActionFilter('CREATE')}
          className={`flex h-[72px] items-center justify-center rounded-xl border-2 border-cyan-500 px-4 shadow-sm transition text-center ${
            actionFilter === 'CREATE'
              ? 'bg-cyan-600 text-white'
              : 'bg-white text-cyan-700 hover:bg-cyan-50'
          }`}
        >
          <p className="text-base font-black uppercase">
            {createCount} THÊM MỚI (CREATE)
          </p>
        </button>

        <button
          type="button"
          onClick={() => setActionFilter('UPDATE')}
          className={`flex h-[72px] items-center justify-center rounded-xl border-2 border-cyan-500 px-4 shadow-sm transition text-center ${
            actionFilter === 'UPDATE'
              ? 'bg-cyan-600 text-white'
              : 'bg-white text-cyan-700 hover:bg-cyan-50'
          }`}
        >
          <p className="text-base font-black uppercase">
            {updateCount} CẬP NHẬT / KHÓA (UPDATE)
          </p>
        </button>

        <button
          type="button"
          onClick={() => setActionFilter('DELETE')}
          className={`flex h-[72px] items-center justify-center rounded-xl border-2 border-cyan-500 px-4 shadow-sm transition text-center ${
            actionFilter === 'DELETE'
              ? 'bg-cyan-600 text-white'
              : 'bg-white text-cyan-700 hover:bg-cyan-50'
          }`}
        >
          <p className="text-base font-black uppercase">
            {deleteCount} THAO TÁC XÓA (DELETE)
          </p>
        </button>
      </div>

      {/* Search Input matching products/main style */}
      <div className="mt-6 flex flex-col gap-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-cyan-500" />
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="h-11 w-full rounded-xl border-2 border-cyan-500 bg-white pl-11 pr-4 text-base outline-none transition focus:border-cyan-600 focus:ring-4 focus:ring-cyan-500/10"
              placeholder="Tìm kiếm nhật ký theo người dùng, mã hành động, mô tả Tiếng Việt..."
            />
          </div>

          {actionFilter !== 'ALL' && (
            <button
              type="button"
              onClick={() => setActionFilter('ALL')}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border-2 border-cyan-600 bg-cyan-50 px-4 text-sm font-bold text-cyan-700 transition hover:bg-cyan-100"
            >
              Hiển thị tất cả
            </button>
          )}
        </div>
      </div>

      {/* Table Section with Cyan headers and Vietnamese Description Column */}
      <div className="mt-5 overflow-hidden rounded-xl border-2 border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] border-collapse bg-white">
            <thead className="bg-cyan-50">
              <tr className="border-b-2 border-slate-200">
                <th className="w-14 border-x border-slate-200 px-3 py-4 text-center text-sm font-extrabold uppercase text-slate-800">
                  STT
                </th>
                <th className="w-44 border-x border-slate-200 px-3 py-4 text-center text-sm font-extrabold uppercase text-slate-800">
                  THỜI GIAN
                </th>
                <th className="w-48 border-x border-slate-200 px-3 py-4 text-center text-sm font-extrabold uppercase text-slate-800">
                  NGƯỜI THỰC HIỆN
                </th>
                <th className="w-44 border-x border-slate-200 px-3 py-4 text-center text-sm font-extrabold uppercase text-slate-800">
                  PHÂN HỆ / ĐỐI TƯỢNG
                </th>
                <th className="w-40 border-x border-slate-200 px-3 py-4 text-center text-sm font-extrabold uppercase text-slate-800">
                  MÃ HÀNH ĐỘNG
                </th>
                <th className="border-x border-slate-200 px-4 py-4 text-left text-sm font-extrabold uppercase text-slate-800 bg-cyan-100/70">
                  MÔ TẢ CHI TIẾT (TIẾNG VIỆT)
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-sm font-semibold text-slate-500">
                    Đang tải nhật ký hoạt động hệ thống...
                  </td>
                </tr>
              ) : paginatedLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-sm font-semibold text-slate-500">
                    Không tìm thấy nhật ký hoạt động phù hợp.
                  </td>
                </tr>
              ) : (
                paginatedLogs.map((log, index) => {
                  const vietnameseDesc = formatVietnameseLogDescription(log);

                  return (
                    <tr key={log.id} className="group border-b border-slate-200 transition hover:bg-cyan-50/50">
                      <td className="border-x border-slate-200 px-3 py-3.5 text-center text-sm font-semibold text-slate-700">
                        {startIndex + index}
                      </td>

                      <td className="border-x border-slate-200 px-3 py-3.5 text-center text-xs font-bold text-slate-600">
                        {new Date(log.createdAt).toLocaleString('vi-VN', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      </td>

                      <td className="border-x border-slate-200 px-3 py-3.5 text-center text-sm font-bold text-slate-900">
                        {log.actorEmail || 'Hệ thống'}
                      </td>

                      <td className="border-x border-slate-200 px-3 py-3.5 text-center align-middle">
                        <span className="inline-flex rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-1 text-xs font-bold text-cyan-800">
                          {log.resource}
                        </span>
                      </td>

                      <td className="border-x border-slate-200 px-3 py-3.5 text-center align-middle">
                        <span className={`inline-flex rounded-lg border px-3 py-1 text-xs font-extrabold ${getActionBadgeStyle(log.action)}`}>
                          {log.action}
                        </span>
                      </td>

                      {/* CỘT MỚI: MÔ TẢ BẰNG TIẾNG VIỆT DỄ HIỂU */}
                      <td className="border-x border-slate-200 px-4 py-3.5 text-left text-sm font-bold text-slate-800 bg-white group-hover:bg-cyan-50/40">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-sm font-bold text-slate-900 leading-snug">
                            {vietnameseDesc}
                          </span>
                          {log.metadata && Object.keys(log.metadata).length > 0 && (
                            <span className="text-xs font-medium text-slate-400 truncate max-w-xl" title={JSON.stringify(log.metadata, null, 2)}>
                              Raw code: {JSON.stringify(log.metadata)}
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Section matching products/main */}
        {!loading && totalItems > 0 && (
          <div className="flex flex-col items-center justify-between border-t border-slate-200 bg-slate-50/50 px-6 py-3 sm:flex-row">
            <div className="text-sm font-semibold text-slate-600">
              Tổng số: <b>{totalItems}</b> <span className="ml-2">Hiển thị {startIndex} - {endIndex}</span>
            </div>
            <div className="mt-4 flex items-center gap-2 sm:mt-0">
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="h-8 rounded-lg border border-slate-300 bg-white px-2 text-sm font-bold text-slate-700 outline-none transition focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
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
                <button className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-600 text-sm font-bold text-white shadow-sm">
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