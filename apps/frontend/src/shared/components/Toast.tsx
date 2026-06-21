import React from 'react';

type ToastProps = {
  message: string;
  type: 'error' | 'success';
  onClose: () => void;
};

export default function Toast({ message, type, onClose }: ToastProps) {
  if (!message) return null;

  const isError = type === 'error';

  return (
    <div className="fixed right-6 top-24 z-[70] w-[calc(100vw-3rem)] max-w-sm">
      <div
        role="alert"
        className={`flex items-start justify-between gap-4 rounded-2xl border-2 px-4 py-3 text-sm font-semibold shadow-2xl shadow-slate-900/10 ${
          isError
            ? 'border-red-200 bg-red-50 text-red-700'
            : 'border-emerald-200 bg-emerald-50 text-emerald-700'
        }`}
      >
        <span className="leading-6">{message}</span>
        <button
          type="button"
          onClick={onClose}
          className={`rounded-lg px-2 text-lg leading-6 transition ${
            isError ? 'hover:bg-red-100' : 'hover:bg-emerald-100'
          }`}
          aria-label="Đóng thông báo"
        >
          ×
        </button>
      </div>
    </div>
  );
}
