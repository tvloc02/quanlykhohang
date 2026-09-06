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
      style={{
        display: 'none',
        fontFamily: "'Times New Roman', Tinos, 'Liberation Serif', Times, serif",
      }}
    >
      <div className="mb-3 border-b border-black pb-2 text-slate-900 bg-white" style={{ borderColor: '#000000' }}>
        <div className="flex justify-between items-start mb-2 text-xs">
          <div>
            <p className="font-extrabold uppercase text-black text-sm">CÔNG TY TNHH HỆ THỐNG QUẢN LÝ KHO SMART WMS</p>
            <p className="text-[11px] text-slate-700">Hệ thống Quản lý kho hàng chuyên nghiệp</p>
          </div>
          <div className="text-right text-[11px] text-slate-700">
            <p>Mẫu biểu báo cáo hệ thống</p>
            <p>Ngày in: {new Date().toLocaleDateString('vi-VN')} {new Date().toLocaleTimeString('vi-VN')}</p>
          </div>
        </div>
        <div className="text-center my-2">
          <h1 className="text-xl font-black uppercase tracking-wider text-black">
            {title}
          </h1>
          {subtitle && (
            <p className="text-xs text-slate-700 italic mt-0.5">
              {subtitle}
            </p>
          )}
        </div>
        <div className="flex justify-between text-xs font-semibold pt-1 border-t border-black" style={{ borderColor: '#000000' }}>
          <span>Người lập báo cáo: <strong className="text-black font-black">{resolvedCreator}</strong></span>
          {subInfo && (
            <span><strong className="text-black font-black">{subInfo}</strong></span>
          )}
        </div>
      </div>
    </div>
  );
};

export default ReportPrintHeader;
