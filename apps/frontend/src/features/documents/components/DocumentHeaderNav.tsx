import React from 'react';
import {
  Printer,
  Save,
  Layers,
  FileCheck,
} from 'lucide-react';

type Props = {
  activeDocType: 'sales-invoice' | 'stock-in-note' | 'stock-out-note' | 'transfer-note';
  selectedTemplate: string;
  onTemplateChange: (template: string) => void;
  onPrint: () => void;
  onSave?: () => void;
};

export default function DocumentHeaderNav({
  activeDocType,
  selectedTemplate,
  onTemplateChange,
  onPrint,
  onSave,
}: Props) {
  return (
    <div className="mb-6 space-y-4 no-print">
      {/* Top Header Title */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-2xl bg-white p-5 shadow-sm border border-slate-200">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-cyan-600 text-white shadow-md">
            <FileCheck className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Hệ Thống Lập Chứng Từ Doanh Nghiệp</h1>
            <p className="text-xs text-slate-500 font-medium">
              Quản lý, tạo mới và in chứng từ trực tiếp từ cơ sở dữ liệu hệ thống
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5">
            <Layers className="h-4 w-4 text-slate-500" />
            <span className="text-xs font-bold text-slate-600">Đổi Mẫu:</span>
            <select
              value={selectedTemplate}
              onChange={(e) => onTemplateChange(e.target.value)}
              className="bg-transparent text-xs font-bold text-slate-800 outline-none cursor-pointer"
            >
              <option value="STANDARD">Mẫu Tiêu Chuẩn</option>
              <option value="DETAILED">Mẫu Chi Tiết</option>
              <option value="OFFICIAL">Mẫu Bộ Tài Chính</option>
            </select>
          </div>

          <button
            type="button"
            onClick={onPrint}
            className="inline-flex items-center gap-2 rounded-xl border-2 border-cyan-500 bg-white px-4 py-2 text-sm font-bold text-cyan-600 shadow-sm transition hover:bg-cyan-50"
          >
            <Printer className="h-4 w-4" />
            In Chứng Từ
          </button>

          {onSave && (
            <button
              type="button"
              onClick={onSave}
              className="inline-flex items-center gap-2 rounded-xl border-2 border-cyan-500 bg-cyan-600 px-4 py-2 text-sm font-bold text-white shadow-md transition hover:bg-cyan-700"
            >
              <Save className="h-4 w-4" />
              Lưu Chứng Từ
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
