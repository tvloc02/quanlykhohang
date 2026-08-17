import React, { useState } from 'react';
import { X, User, Phone, Car, Building, FileText, Check, Plus } from 'lucide-react';
import { saveShipper, type Shipper } from '../services/shipperService';

interface QuickAddShipperModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newShipper: Shipper) => void;
  initialName?: string;
  initialPhone?: string;
  initialVehiclePlate?: string;
}

export default function QuickAddShipperModal({
  isOpen,
  onClose,
  onSuccess,
  initialName = '',
  initialPhone = '',
  initialVehiclePlate = '',
}: QuickAddShipperModalProps) {
  const [name, setName] = useState(initialName);
  const [phone, setPhone] = useState(initialPhone);
  const [vehiclePlate, setVehiclePlate] = useState(initialVehiclePlate);
  const [company, setCompany] = useState('Đội xe nội bộ');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Vui lòng nhập tên tài xế / shipper');
      return;
    }
    if (!phone.trim()) {
      setError('Vui lòng nhập số điện thoại tài xế');
      return;
    }

    try {
      const newShipper = saveShipper({
        name: name.trim(),
        phone: phone.trim(),
        vehiclePlate: vehiclePlate.trim().toUpperCase(),
        company: company.trim(),
        note: note.trim(),
        status: 'ACTIVE',
      });

      onSuccess(newShipper);
      onClose();
    } catch (err) {
      console.error(err);
      setError('Đã xảy ra lỗi khi lưu thông tin shipper');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-md rounded-2xl border-2 border-cyan-500/40 bg-white shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between bg-gradient-to-r from-cyan-600 to-cyan-700 px-5 py-4 text-white">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/20">
              <Plus className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="font-black text-base tracking-wide">THÊM MỚI TÀI XẾ / SHIPPER</h3>
              <p className="text-xs text-cyan-100 font-medium">Lưu thông tin vận chuyển vào hệ thống</p>
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

        {/* Form Content */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-bold text-red-600">
              {error}
            </div>
          )}

          {/* Tên tài xế */}
          <div>
            <label className="mb-1 block text-xs font-bold text-slate-700 flex items-center gap-1">
              <User className="h-3.5 w-3.5 text-cyan-600" />
              <span>HỌ & TÊN TÀI XẾ / SHIPPER <span className="text-red-500">*</span></span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError(null);
              }}
              placeholder="VD: Tạ Văn Thanh"
              className="h-10 w-full rounded-xl border-2 border-slate-200 bg-white px-3 text-xs font-bold text-slate-900 outline-none transition focus:border-cyan-500"
            />
          </div>

          {/* SĐT liên hệ */}
          <div>
            <label className="mb-1 block text-xs font-bold text-slate-700 flex items-center gap-1">
              <Phone className="h-3.5 w-3.5 text-cyan-600" />
              <span>SỐ ĐIỆN THOẠI LIÊN HỆ <span className="text-red-500">*</span></span>
            </label>
            <input
              type="tel"
              required
              value={phone}
              onChange={(e) => {
                setPhone(e.target.value);
                setError(null);
              }}
              placeholder="VD: 0987654321"
              className="h-10 w-full rounded-xl border-2 border-slate-200 bg-white px-3 text-xs font-bold text-slate-900 outline-none transition focus:border-cyan-500"
            />
          </div>

          {/* Biển số xe / Phương tiện */}
          <div>
            <label className="mb-1 block text-xs font-bold text-slate-700 flex items-center gap-1">
              <Car className="h-3.5 w-3.5 text-cyan-600" />
              <span>BIỂN SỐ XE / PHƯƠNG TIỆN</span>
            </label>
            <input
              type="text"
              value={vehiclePlate}
              onChange={(e) => setVehiclePlate(e.target.value)}
              placeholder="VD: 30L-636.86"
              className="h-10 w-full rounded-xl border-2 border-slate-200 bg-white px-3 text-xs font-black text-slate-900 uppercase outline-none transition focus:border-cyan-500"
            />
          </div>

          {/* Đơn vị / Công ty vận chuyển */}
          <div>
            <label className="mb-1 block text-xs font-bold text-slate-700 flex items-center gap-1">
              <Building className="h-3.5 w-3.5 text-cyan-600" />
              <span>ĐƠN VỊ / ĐỘI XE VẬN CHUYỂN</span>
            </label>
            <input
              type="text"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="VD: Đội xe nội bộ / GHN / Viettel Post"
              className="h-10 w-full rounded-xl border-2 border-slate-200 bg-white px-3 text-xs font-semibold text-slate-900 outline-none transition focus:border-cyan-500"
            />
          </div>

          {/* Ghi chú */}
          <div>
            <label className="mb-1 block text-xs font-bold text-slate-700 flex items-center gap-1">
              <FileText className="h-3.5 w-3.5 text-cyan-600" />
              <span>GHI CHÚ</span>
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Loại xe, thông tin tuyến đường..."
              className="h-10 w-full rounded-xl border-2 border-slate-200 bg-white px-3 text-xs text-slate-900 outline-none transition focus:border-cyan-500"
            />
          </div>

          {/* Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border-2 border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 transition cursor-pointer"
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded-xl border-2 border-cyan-600 bg-cyan-600 px-5 py-2 text-xs font-black text-white shadow-md hover:bg-cyan-700 transition cursor-pointer"
            >
              <Check className="h-4 w-4" />
              <span>Lưu Shipper Mới</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
