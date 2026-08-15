import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldAlert, Home, ArrowLeft } from 'lucide-react';

export default function AccessDenied({
  title = 'Không có quyền truy cập chức năng này',
  message = 'Tài khoản của bạn chưa được phân quyền sử dụng chức năng này. Vui lòng liên hệ với Quản trị viên hệ thống để được cấp quyền.',
}: {
  title?: string;
  message?: string;
}) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center p-6 text-center animate-in fade-in zoom-in duration-200">
      <div className="relative mb-6">
        <div className="absolute -inset-2 rounded-full bg-red-100 blur-lg opacity-70"></div>
        <div className="relative flex h-24 w-24 items-center justify-center rounded-3xl bg-gradient-to-br from-red-50 to-red-100 border-2 border-red-200 text-red-600 shadow-xl">
          <ShieldAlert className="h-12 w-12" />
        </div>
      </div>

      <div className="inline-flex items-center gap-2 rounded-full bg-red-50 border border-red-200 px-3 py-1 text-xs font-bold text-red-700 uppercase tracking-wider mb-3">
        Lỗi 403 • Quyền truy cập bị từ chối
      </div>

      <h1 className="text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">
        {title}
      </h1>

      <p className="mt-3 max-w-md text-sm text-slate-600 font-medium leading-relaxed">
        {message}
      </p>

      <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-6 py-3 text-sm font-extrabold text-white shadow-md transition hover:bg-cyan-700 active:scale-95 cursor-pointer"
        >
          <Home className="h-4.5 w-4.5" />
          Về Trang chủ
        </Link>
        <button
          type="button"
          onClick={() => window.history.back()}
          className="inline-flex items-center gap-2 rounded-xl border-2 border-slate-300 bg-white px-6 py-3 text-sm font-extrabold text-slate-700 shadow-xs transition hover:bg-slate-100 active:scale-95 cursor-pointer"
        >
          <ArrowLeft className="h-4.5 w-4.5" />
          Quay lại trang trước
        </button>
      </div>
    </div>
  );
}
