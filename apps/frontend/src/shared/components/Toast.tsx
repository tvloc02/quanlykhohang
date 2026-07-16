import React from 'react';

type ToastProps = {
  message: string;
  type: 'error' | 'success';
  onClose: () => void;
};

export default function Toast({ message, type, onClose }: ToastProps) {
  if (!message) return null;

  const isError = type === 'error';

  React.useEffect(() => {
    if (!message) return;
    const duration = isError ? 6000 : 3000;
    const timer = setTimeout(() => {
      onClose();
    }, duration);
    return () => clearTimeout(timer);
  }, [message, isError, onClose]);

  return (
    <div className="fixed right-4 top-4 z-[90] flex justify-end">
      <div
        role="alert"
        className={`flex items-center gap-3 rounded-xl border px-4 py-3 shadow-xl max-w-sm w-full ${
          isError
            ? 'border-red-200 bg-white text-red-600'
            : 'border-emerald-200 bg-white text-emerald-600'
        }`}
      >
        <span className="text-sm font-bold flex-1 break-words leading-tight">{message}</span>
        <button
          type="button"
          onClick={onClose}
          className={`flex-shrink-0 rounded-lg p-1 transition ${
            isError ? 'hover:bg-red-50 text-red-500' : 'hover:bg-emerald-50 text-emerald-500'
          }`}
          aria-label="Đóng thông báo"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
        </button>
      </div>
    </div>
  );
}
