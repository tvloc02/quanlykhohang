import React from 'react';
import {
  Search,
  Filter,
  X,
  XCircle,
  CheckCircle,
  History,
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

interface AuditLog {
  id: string;
  actorEmail?: string;
  action: string;
  resource: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

const API_BASE_URL = 'http://localhost:3000/api';

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
  };
}

export default function AuditLog() {
  const [logs, setLogs] = React.useState<AuditLog[]>([]);
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
      const response = await fetch(`${API_BASE_URL}/audit-logs`, { headers: authHeaders() });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        if (response.status === 403) {
          throw new Error(data?.message || 'Bạn không có quyền truy cập nhật ký hoạt động.');
        }
        throw new Error(data?.message || 'Không tải được nhật ký hoạt động');
      }

      const data = (await response.json()) as AuditLog[];
      setLogs(data);
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

  const filteredLogs = logs.filter((log) => {
    const keyword = search.trim().toLowerCase();
    return (
      !keyword ||
      log.actorEmail?.toLowerCase().includes(keyword) ||
      log.resource.toLowerCase().includes(keyword) ||
      log.action.toLowerCase().includes(keyword) ||
      (log.metadata ? JSON.stringify(log.metadata).toLowerCase().includes(keyword) : false)
    );
  });

  // Calculate Pagination
  const totalItems = filteredLogs.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const paginatedLogs = filteredLogs.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const startIndex = (currentPage - 1) * pageSize + 1;
  const endIndex = Math.min(currentPage * pageSize, totalItems);

  // Helper cho màu sắc hành động
  const getActionStyles = (action: string) => {
    const act = action.toLowerCase();
    if (act.includes('tạo') || act.includes('thêm')) return 'border-cyan-200 bg-cyan-50 text-cyan-700';
    if (act.includes('cập nhật') || act.includes('sửa')) return 'border-yellow-200 bg-yellow-50 text-yellow-700';
    if (act.includes('xóa')) return 'border-red-200 bg-red-50 text-red-700';
    return 'border-slate-200 bg-slate-50 text-slate-700';
  };

  return (
    <div>
      <Toast
        message={error}
        type="error"
        onClose={() => setError('')}
      />

      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Nhật ký hoạt động</h1>
          <p className="mt-1 text-sm font-medium text-slate-500">
            Theo dõi và tra cứu toàn bộ thao tác của người dùng trên hệ thống.
          </p>
        </div>

        <button
          type="button"
          onClick={loadData}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-white border-2 border-slate-200 px-5 py-2.5 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50"
        >
          <History className="h-4 w-4" />
          Làm mới dữ liệu
        </button>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="h-11 w-full rounded-xl border-2 border-slate-200 bg-white pl-11 pr-4 text-base outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
            placeholder="Tìm kiếm theo người dùng, thao tác, chi tiết..."
          />
        </div>
        <div className="flex justify-start xl:justify-end">
          <button className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border-2 border-slate-200 bg-white px-5 text-sm font-bold text-slate-700 transition hover:bg-slate-50">
            <Filter size={18} className="text-slate-500" />
            Bộ lọc nâng cao
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
                <th className="w-48 border-x border-slate-200 px-3 py-4 text-center text-sm font-black uppercase text-slate-700">Thời gian</th>
                <th className="w-48 border-x border-slate-200 px-3 py-4 text-left text-sm font-black uppercase text-slate-700">Người dùng</th>
                <th className="w-40 border-x border-slate-200 px-3 py-4 text-center text-sm font-black uppercase text-slate-700">Module</th>
                <th className="w-40 border-x border-slate-200 px-3 py-4 text-center text-sm font-black uppercase text-slate-700">Hành động</th>
                <th className="border-x border-slate-200 px-3 py-4 text-left text-sm font-black uppercase text-slate-700">Chi tiết thao tác</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-sm font-medium text-slate-500">
                    Đang tải dữ liệu nhật ký...
                  </td>
                </tr>
              ) : paginatedLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-sm font-medium text-slate-500">
                    Chưa có hoạt động nào được ghi nhận.
                  </td>
                </tr>
              ) : (
                paginatedLogs.map((log, index) => (
                  <tr key={log.id} className="group border-b border-slate-200 transition hover:bg-cyan-50/50">
                    <td className="border-x border-slate-200 px-3 py-4 text-center text-sm text-slate-700">
                      {startIndex + index}
                    </td>
                    <td className="border-x border-slate-200 px-3 py-4 text-center text-sm font-medium text-slate-600">
                      {new Date(log.createdAt).toLocaleString('vi-VN')}
                    </td>
                    <td className="border-x border-slate-200 px-3 py-4 text-left text-sm font-bold text-slate-800">
                      {log.actorEmail || 'Hệ thống'}
                    </td>
                    <td className="border-x border-slate-200 px-3 py-4 text-center align-middle">
                      <span className="inline-flex rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs font-bold text-slate-700 shadow-sm">
                        {log.resource}
                      </span>
                    </td>
                    <td className="border-x border-slate-200 px-3 py-4 text-center align-middle">
                      <span
                        className={`inline-flex rounded-lg border px-3 py-1 text-xs font-bold shadow-sm ${getActionStyles(log.action)}`}
                      >
                        {log.action}
                      </span>
                    </td>
                    <td className="border-x border-slate-200 px-3 py-4 text-left text-sm text-slate-700 max-w-md truncate">
                      <span title={log.metadata ? JSON.stringify(log.metadata, null, 2) : ''}>
                        {log.metadata ? JSON.stringify(log.metadata) : ''}
                      </span>
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