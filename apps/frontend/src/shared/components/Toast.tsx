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
    <div className="fixed top-6 left-1/2 z-[90] w-full px-4 transform -translate-x-1/2 flex justify-center">
      <div
        role="alert"
        className={`max-w-2xl w-full flex items-center justify-between gap-4 rounded-2xl border-2 px-6 py-4 text-base font-bold shadow-2xl shadow-slate-900/10 ${
          isError
            ? 'border-red-300 bg-red-50 text-red-800'
            : 'border-emerald-300 bg-emerald-50 text-emerald-800'
        }`}
      >
        <span className="leading-7 text-sm md:text-base">{message}</span>
        <button
          type="button"
          onClick={onClose}
          className={`ml-4 rounded-md px-3 py-1 text-lg leading-6 transition ${
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
