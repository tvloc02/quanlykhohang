import React from 'react';
import CreateTransferRequestPage from '../pages/CreateTransferRequestPage';

type CreateTransferRequestModalProps = {
  onClose: () => void;
  onSuccess: (newReq?: any) => void;
  setToast?: (toast: { type: 'success' | 'error'; message: string }) => void;
};

export default function CreateTransferRequestModal({ onClose, onSuccess }: CreateTransferRequestModalProps) {
  return (
    <div className="fixed inset-0 z-[9999] bg-slate-950/80 p-2 sm:p-4 backdrop-blur-sm overflow-y-auto flex flex-col">
      <div className="relative flex-1 w-full max-w-[98%] mx-auto bg-slate-100 rounded-2xl overflow-hidden shadow-2xl flex flex-col">
        <CreateTransferRequestPage
          standalone={false}
          onBack={onClose}
          onSuccess={onSuccess}
        />
      </div>
    </div>
  );
}
