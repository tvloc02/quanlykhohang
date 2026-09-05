import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Printer, X } from 'lucide-react';
import type { OutboundOrder } from '../Outbound';

interface WarehouseOption {
  id: string;
  code: string;
  name: string;
}

interface OutboundPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: OutboundOrder | null;
  warehouses?: WarehouseOption[];
  isDisposal?: boolean;
  featureMode?: string;
  title?: string;
}

function formatDateDisplay(dateVal?: string | Date | null): string {
  if (!dateVal) return '-';
  const str = String(dateVal).trim();
  const dmyMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})(?:\s*,?\s*(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
  if (dmyMatch) {
    const day = dmyMatch[1].padStart(2, '0');
    const month = dmyMatch[2].padStart(2, '0');
    const year = dmyMatch[3];
    const hh = (dmyMatch[4] || '08').padStart(2, '0');
    const mm = (dmyMatch[5] || '30').padStart(2, '0');
    const ss = (dmyMatch[6] || '00').padStart(2, '0');
    return `${day}/${month}/${year} ${hh}:${mm}:${ss}`;
  }
  const d = new Date(dateVal);
  if (!Number.isNaN(d.getTime())) {
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    const ss = String(d.getSeconds()).padStart(2, '0');
    return `${day}/${month}/${year} ${hh}:${mm}:${ss}`;
  }
  return String(dateVal);
}

export default function OutboundPrintModal({
  isOpen,
  onClose,
  order,
  warehouses = [],
  isDisposal = false,
  featureMode,
}: OutboundPrintModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        window.print();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !order) return null;

  const warehouseCode = order.branchCode || order.warehouseCode;
  const foundWh = warehouses.find((w) => w.code === warehouseCode || w.name === warehouseCode || w.id === warehouseCode);
  const warehouseName = foundWh ? foundWh.name : (warehouseCode || 'Kho Thanh Trì');

  let titleText = isDisposal ? 'BIÊN BẢN XUẤT HỦY HÀNG HÓA' : 'PHIẾU XUẤT BÁN HÀNG';
  if (featureMode === 'retail') titleText = 'PHIẾU XUẤT BÁN LẺ';
  if (featureMode === 'sales-order') titleText = 'ĐƠN ĐẶT HÀNG XUẤT KHO';
  if (featureMode === 'quote') titleText = 'PHIẾU BÁO GIÁ HÀNG HÓA';

  const orderDateStr = formatDateDisplay(order.orderDate || (order as any).createdAt);
  const totalAmount = Number(order.totalAmount || 0);

  return createPortal(
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-900/60 dark:bg-slate-950/80 p-4 backdrop-blur-sm overflow-y-auto">
      {/* ─── STYLE CHO BẢN IN: ĐẶT NẰM TRÊN CÙNG, RỘNG TRÀN TRANG, CHỈ IN NỘI DUNG NÀY ─── */}
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #printable-outbound-order,
          #printable-outbound-order * {
            visibility: visible !important;
          }
          #printable-outbound-order {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 8mm 10mm !important;
            background: #ffffff !important;
            color: #000000 !important;
            border: 2px solid #000000 !important;
            border-radius: 8px !important;
            box-shadow: none !important;
            font-size: 13px !important;
            line-height: 1.5 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .modal-no-print {
            display: none !important;
          }
          @page {
            size: A4 portrait;
            margin: 10mm 12mm;
          }
        }
      `}</style>

      {/* ─── MODAL BOX ─── */}
      <div className="w-full max-w-4xl rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-2xl border-2 border-cyan-500 dark:border-indigo-500 my-auto">
        {/* Modal Topbar */}
        <div className="modal-no-print mb-4 flex items-center justify-between border-b-2 border-cyan-100 dark:border-indigo-900/40 pb-3">
          <h2 className="text-base font-black text-slate-900 dark:text-slate-100">
            {isDisposal ? 'Xem trước Biên Bản Xuất Hủy Hàng Hóa' : 'Xem trước Phiếu Xuất Bán Hàng'}
          </h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 dark:bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-cyan-700 dark:hover:bg-indigo-500 cursor-pointer shadow-md transition"
            >
              <Printer size={16} /> In Phiếu
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl p-1.5 text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-300 transition cursor-pointer"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* ─── NỘI DUNG IN CHÍNH (TO, RỘNG, ĐẦY ĐỦ THÔNG TIN) ─── */}
        <div
          id="printable-outbound-order"
          className="p-5 sm:p-6 border-2 border-slate-300 dark:border-indigo-900/60 rounded-xl space-y-4 text-xs sm:text-sm bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 w-full"
        >
          {/* Header Title */}
          <div className="text-center pb-2">
            <h1 className="text-lg sm:text-xl font-black uppercase tracking-wide text-cyan-950 dark:text-slate-100 print:text-black">
              {titleText}
            </h1>
            <p className="text-slate-600 dark:text-slate-400 print:text-slate-700 font-semibold mt-1 text-xs">
              Mã phiếu: <strong>{order.orderNo}</strong> - Ngày: {orderDateStr}
            </p>
          </div>

          {/* Info 2 columns */}
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 font-semibold text-xs sm:text-sm text-slate-800 dark:text-slate-200 print:text-black">
            <p>
              {isDisposal ? 'Lý do xuất hủy:' : 'Khách hàng:'}{' '}
              <span className="font-extrabold text-slate-950 dark:text-white print:text-black">{order.customer}</span>
            </p>
            <p>
              {isDisposal ? 'Kho xuất hủy:' : 'Kho xuất:'}{' '}
              <span className="font-extrabold text-slate-950 dark:text-white print:text-black">{warehouseName}</span>
            </p>
            {!isDisposal && (
              <p>
                SĐT: <span className="font-bold">{order.customerPhone || '-'}</span>
              </p>
            )}
            <p>
              {isDisposal ? 'Người lập / Giám sát:' : 'Người lập:'}{' '}
              <span className="font-bold text-slate-950 dark:text-white print:text-black">{order.employeeName || 'System Administrator'}</span>
            </p>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border-2 border-slate-400 dark:border-indigo-900/60 print:border-black text-xs sm:text-sm bg-white dark:bg-slate-950">
              <thead className="bg-cyan-100/70 dark:bg-indigo-950 print:bg-slate-200 font-bold text-center text-cyan-950 dark:text-indigo-300 print:text-black">
                <tr>
                  <th className="border border-slate-400 dark:border-indigo-900/60 print:border-black p-2.5 w-12">STT</th>
                  <th className="border border-slate-400 dark:border-indigo-900/60 print:border-black p-2.5 text-left">Tên hàng</th>
                  <th className="border border-slate-400 dark:border-indigo-900/60 print:border-black p-2.5 w-16">ĐVT</th>
                  <th className="border border-slate-400 dark:border-indigo-900/60 print:border-black p-2.5 w-36">Vị trí kệ lấy hàng</th>
                  <th className="border border-slate-400 dark:border-indigo-900/60 print:border-black p-2.5 w-20">SL {isDisposal ? 'hủy' : ''}</th>
                  <th className="border border-slate-400 dark:border-indigo-900/60 print:border-black p-2.5 w-28 text-right">{isDisposal ? 'Giá vốn (đ)' : 'Đơn giá'}</th>
                  <th className="border border-slate-400 dark:border-indigo-900/60 print:border-black p-2.5 w-32 text-right">{isDisposal ? 'Giá trị hủy (đ)' : 'Thành tiền'}</th>
                </tr>
              </thead>
              <tbody>
                {order.details && order.details.length > 0 ? (
                  order.details.map((d, i) => {
                    const shelf = (d as any).locationBin || (d as any).binCode || (d as any).shelf || `Kệ A${(i % 4) + 1}-0${(i % 3) + 1}`;
                    const lineTotal = d.totalLineAmount || (d.qty * d.price);
                    return (
                      <tr key={i} className="text-center print:text-black">
                        <td className="border border-slate-400 dark:border-indigo-900/40 print:border-black p-2.5 dark:text-slate-300 print:text-black font-medium">{i + 1}</td>
                        <td className="border border-slate-400 dark:border-indigo-900/40 print:border-black p-2.5 text-left font-bold text-slate-900 dark:text-slate-100 print:text-black">{d.productName}</td>
                        <td className="border border-slate-400 dark:border-indigo-900/40 print:border-black p-2.5 dark:text-slate-300 print:text-black">{d.unit || 'Cái'}</td>
                        <td className="border border-slate-400 dark:border-indigo-900/40 print:border-black p-2.5 font-bold text-cyan-800 dark:text-indigo-400 print:text-black">{shelf}</td>
                        <td className="border border-slate-400 dark:border-indigo-900/40 print:border-black p-2.5 font-black text-slate-900 dark:text-slate-100 print:text-black">{d.qty}</td>
                        <td className="border border-slate-400 dark:border-indigo-900/40 print:border-black p-2.5 text-right font-medium dark:text-slate-300 print:text-black">{Number(d.price || 0).toLocaleString('vi-VN')}</td>
                        <td className="border border-slate-400 dark:border-indigo-900/40 print:border-black p-2.5 text-right font-bold text-slate-900 dark:text-slate-100 print:text-black">{lineTotal.toLocaleString('vi-VN')}</td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={7} className="border border-slate-400 print:border-black p-3 text-center italic text-slate-500">
                      Không có chi tiết mặt hàng
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Total */}
          <div className="text-right font-black text-sm sm:text-base text-cyan-950 dark:text-slate-100 print:text-black pt-1">
            {isDisposal ? 'Tổng giá trị thiệt hại: ' : 'Tổng tiền: '}
            <span className="text-cyan-700 dark:text-indigo-400 print:text-black font-extrabold ml-1">
              {totalAmount.toLocaleString('vi-VN')} VNĐ
            </span>
          </div>
        </div>

        {/* Modal Bottom action */}
        <div className="modal-no-print mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-300 dark:border-slate-700 px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            Đóng
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 dark:bg-indigo-600 px-5 py-2 text-xs font-bold text-white hover:bg-cyan-700 dark:hover:bg-indigo-500 cursor-pointer shadow-md transition"
          >
            <Printer size={16} /> In Phiếu
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
