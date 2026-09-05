import React from 'react';

interface ReportPrintHeaderProps {
  title: string;
  subtitle?: string;
  creatorName?: string;
  subInfo?: string;
}

export const ReportPrintHeader: React.FC<ReportPrintHeaderProps> = ({
  title,
  subtitle,
  creatorName,
  subInfo,
}) => {
  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
  const resolvedCreator =
    creatorName || currentUser.fullName || currentUser.email?.split('@')[0] || 'System Administrator';

  return (
    <div
      hidden
      className="print-report-header"
      style={{ display: 'none' }}
    >
      <div className="mb-4 border-b-2 border-slate-900 pb-2 text-slate-900 bg-white">
        <div className="flex justify-between items-start mb-2 text-xs">
          <div>
            <p className="font-extrabold uppercase text-slate-900 text-sm">CÔNG TY TNHH HỆ THỐNG QUẢN LÝ KHO SMART WMS</p>
            <p className="text-[11px] text-slate-600">Hệ thống Quản lý kho hàng chuyên nghiệp</p>
          </div>
          <div className="text-right text-[11px] text-slate-600">
            <p>Mẫu biểu báo cáo hệ thống</p>
            <p>Ngày in: {new Date().toLocaleDateString('vi-VN')} {new Date().toLocaleTimeString('vi-VN')}</p>
          </div>
        </div>
        <div className="text-center my-2">
          <h1 className="text-xl font-black uppercase tracking-wider text-slate-950">
            {title}
          </h1>
          {subtitle && (
            <p className="text-xs text-slate-600 italic mt-0.5">
              {subtitle}
            </p>
          )}
        </div>
        <div className="flex justify-between text-xs font-semibold pt-1 border-t border-slate-400">
          <span>Người lập báo cáo: <strong className="text-slate-950 font-black">{resolvedCreator}</strong></span>
          {subInfo && (
            <span><strong className="text-slate-950 font-black">{subInfo}</strong></span>
          )}
        </div>
      </div>
    </div>
  );
};

export default ReportPrintHeader;
