import React from 'react';
import { createPortal } from 'react-dom';
import { X, User, Phone, Car, Building, FileText, Calendar, ShieldCheck } from 'lucide-react';
import type { Shipper } from '../services/shipperService';

interface ViewShipperModalProps {
  isOpen: boolean;
  onClose: () => void;
  shipper: Shipper | null;
}

export default function ViewShipperModal({ isOpen, onClose, shipper }: ViewShipperModalProps) {
  if (!isOpen || !shipper) return null;

  return createPortal(
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-md rounded-2xl border-2 border-cyan-600 bg-cyan-600 shadow-2xl overflow-hidden">
        {/* Header Banner */}
        <div className="flex items-center justify-between bg-cyan-600 px-5 py-4 text-white">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/20">
              <User className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="font-black text-base tracking-wide uppercase">THÔNG TIN TÀI XẾ / SHIPPER</h3>
              <p className="text-xs text-cyan-100 font-medium">Mã hệ thống: {shipper.id}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-1.5 text-cyan-100 hover:bg-white/20 hover:text-white transition cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="bg-white p-5 space-y-4 text-xs font-semibold text-slate-700">
          <div className="rounded-xl border-2 border-cyan-100 bg-cyan-50/50 p-4 space-y-3">
            {/* Tên tài xế */}
            <div className="flex items-center justify-between border-b border-cyan-200/60 pb-2">
              <span className="flex items-center gap-1.5 font-bold text-slate-600">
                <User className="h-4 w-4 text-cyan-600" />
                <span>Họ và tên tài xế:</span>
              </span>
              <span className="font-black text-sm text-cyan-950">{shipper.name}</span>
            </div>

            {/* SĐT */}
            <div className="flex items-center justify-between border-b border-cyan-200/60 pb-2">
              <span className="flex items-center gap-1.5 font-bold text-slate-600">
                <Phone className="h-4 w-4 text-cyan-600" />
                <span>Số điện thoại:</span>
              </span>
              <span className="font-black text-sm text-slate-900">{shipper.phone}</span>
            </div>

            {/* Biển số xe */}
            <div className="flex items-center justify-between border-b border-cyan-200/60 pb-2">
              <span className="flex items-center gap-1.5 font-bold text-slate-600">
                <Car className="h-4 w-4 text-cyan-600" />
                <span>Biển số xe / Phương tiện:</span>
              </span>
              <span className="font-black text-xs text-cyan-800 bg-white px-2.5 py-1 rounded-lg border border-cyan-300 uppercase">
                {shipper.vehiclePlate || 'N/A'}
              </span>
            </div>

            {/* Đơn vị */}
            <div className="flex items-center justify-between border-b border-cyan-200/60 pb-2">
              <span className="flex items-center gap-1.5 font-bold text-slate-600">
                <Building className="h-4 w-4 text-cyan-600" />
                <span>Đơn vị / Đội xe:</span>
              </span>
              <span className="font-extrabold text-slate-800">{shipper.company || 'Nội bộ'}</span>
            </div>

            {/* Trạng thái */}
            <div className="flex items-center justify-between border-b border-cyan-200/60 pb-2">
              <span className="flex items-center gap-1.5 font-bold text-slate-600">
                <ShieldCheck className="h-4 w-4 text-cyan-600" />
                <span>Trạng thái hoạt động:</span>
              </span>
              <span className="inline-flex items-center gap-1 font-extrabold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-md border border-emerald-200">
                {shipper.status === 'INACTIVE' ? 'Tạm ngưng' : 'Hoạt động'}
              </span>
            </div>

            {/* Ngày tạo */}
            {shipper.createdDate && (
              <div className="flex items-center justify-between border-b border-cyan-200/60 pb-2">
                <span className="flex items-center gap-1.5 font-bold text-slate-600">
                  <Calendar className="h-4 w-4 text-cyan-600" />
                  <span>Ngày khởi tạo:</span>
                </span>
                <span className="font-bold text-slate-700">
                  {new Date(shipper.createdDate).toLocaleDateString('vi-VN')}
                </span>
              </div>
            )}

            {/* Ghi chú */}
            <div className="pt-1">
              <span className="flex items-center gap-1.5 font-bold text-slate-600 mb-1">
                <FileText className="h-4 w-4 text-cyan-600" />
                <span>Ghi chú bổ sung:</span>
              </span>
              <p className="bg-white p-2.5 rounded-lg border border-cyan-200 text-slate-800 font-semibold italic text-xs leading-relaxed">
                {shipper.note || 'Không có ghi chú bổ sung'}
              </p>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border-2 border-cyan-600 bg-cyan-600 px-6 py-2 text-xs font-bold text-white shadow-md hover:bg-cyan-700 transition cursor-pointer"
            >
              Đóng
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
