import React from 'react';
import { CheckCircle2, XCircle, X } from 'lucide-react';

type ToastProps = {
  message: string;
  type: 'error' | 'success';
  onClose: () => void;
  onUndo?: () => void;
};

export default function Toast({ message, type, onClose, onUndo }: ToastProps) {
  if (!message) return null;

  const isError = type === 'error';

  React.useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => {
      onClose();
    }, 3000);
    return () => clearTimeout(timer);
  }, [message, onClose]);

  return (
    <div className="fixed right-6 top-5 z-[9999] flex justify-end pointer-events-none animate-in fade-in slide-in-from-top-4 duration-200">
      <div
        role="alert"
        className={`pointer-events-auto flex items-center gap-3 rounded-xl border px-4 py-3 shadow-lg max-w-md w-auto transition-all ${
          isError
            ? 'border-red-200 bg-red-50 text-red-600 dark:bg-slate-900 dark:border-red-800 dark:text-red-300'
            : 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:bg-slate-900 dark:border-emerald-800 dark:text-emerald-300'
        }`}
      >
        {isError ? (
          <XCircle className="h-5 w-5 shrink-0 text-red-600" />
        ) : (
          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
        )}
        <span className="text-sm font-semibold flex-1 break-words leading-tight">{message}</span>
        {onUndo && (
          <button
            type="button"
            onClick={() => {
              onUndo();
              onClose();
            }}
            className="ml-1 rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 transition cursor-pointer shrink-0"
          >
            Hoàn tác
          </button>
        )}
        <button
          type="button"
          onClick={onClose}
          className={`flex-shrink-0 rounded-lg p-1 transition cursor-pointer ${
            isError ? 'hover:bg-red-100 text-red-500' : 'hover:bg-emerald-100 text-emerald-600'
          }`}
          aria-label="Đóng thông báo"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

