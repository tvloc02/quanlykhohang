import React from 'react';

interface ReportPrintFooterProps {
  creatorName?: string;
}

export const ReportPrintFooter: React.FC<ReportPrintFooterProps> = ({ creatorName }) => {
  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
  const resolvedCreator =
    creatorName || currentUser.fullName || currentUser.email?.split('@')[0] || 'System Administrator';

  return (
    <div
      hidden
      className="print-report-footer"
      style={{ display: 'none' }}
    >
      <div className="grid grid-cols-3 gap-8 mt-10 pt-4 text-center text-xs text-slate-900 page-break-inside-avoid">
        <div>
          <p className="font-extrabold uppercase text-slate-900">Người Lập Báo Cáo</p>
          <p className="text-[11px] text-slate-500 italic mt-0.5">(Ký, họ tên)</p>
          <div className="h-20" />
          <p className="font-bold text-slate-900">{resolvedCreator}</p>
        </div>
        <div>
          <p className="font-extrabold uppercase text-slate-900">Kế Toán Trưởng</p>
          <p className="text-[11px] text-slate-500 italic mt-0.5">(Ký, họ tên)</p>
          <div className="h-20" />
          <p className="text-slate-400 italic font-medium">................................................</p>
        </div>
        <div>
          <p className="font-extrabold uppercase text-slate-900">Thủ Trưởng Đơn Vị</p>
          <p className="text-[11px] text-slate-500 italic mt-0.5">(Ký, đóng dấu, họ tên)</p>
          <div className="h-20" />
          <p className="text-slate-400 italic font-medium">................................................</p>
        </div>
      </div>
    </div>
  );
};

export default ReportPrintFooter;
