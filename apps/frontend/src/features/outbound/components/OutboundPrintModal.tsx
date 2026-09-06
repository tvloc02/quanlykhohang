import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Printer, X } from 'lucide-react';
import type { OutboundOrder } from '../Outbound';
import { numberToWordsVietnamese } from '../../../shared/utils/numberToWords';

interface WarehouseOption {
  id: string;
  code: string;
  name: string;
  address?: string;
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

const API_BASE_URL = 'http://localhost:3000/api';

const nfc = (str: any) => (str ? String(str).normalize('NFC') : '');

export default function OutboundPrintModal({
  isOpen,
  onClose,
  order,
  warehouses = [],
  isDisposal = false,
  featureMode,
}: OutboundPrintModalProps) {
  const [settings, setSettings] = useState<any>({
    companyName: 'Công Ty TNHH Dịch Vụ Kế Toán Thiên Ứng',
    department: 'Bộ phận: Bán hàng',
    taxCode: '0101234567',
    address: 'Lô B11, số 9a, ngõ 181 Xuân Thủy, phường Cầu Giấy, Hà Nội',
    phone: '024.3756.8888',
    email: 'ketoanthienung@gmail.com',
    website: 'ketoanthienung.vn',
    debitAccount: '632',
    creditAccount: '156',
    creatorName: 'Vũ Hữu Dũng',
    receiverName: 'Phạm Thị Duyên',
    storekeeperName: 'Nguyễn Thị Thúy',
    chiefAccountantName: 'Trần Thị Hồng Mơ',
    directorName: 'Nguyễn Thị Thanh Xuyên',
    templateStandard: 'Kèm theo Thông tư số 200/2014/TT-BTC ngày 22/12/2014 của Bộ trưởng Bộ Tài chính',
  });

  useEffect(() => {
    if (!isOpen) return;
    fetch(`${API_BASE_URL}/settings`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && data.companyName) {
          setSettings((prev: any) => ({ ...prev, ...data }));
        }
      })
      .catch(() => {});
  }, [isOpen]);

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
  const foundWh = warehouses.find(
    (w) => w.code === warehouseCode || w.name === warehouseCode || w.id === warehouseCode
  );
  const warehouseName = foundWh ? `[${foundWh.code}] ${foundWh.name}` : warehouseCode || 'Kho Thanh Trì';
  const warehouseLocation = foundWh?.address || settings.address || 'Hà Nội, Việt Nam';

  let titleText = isDisposal ? 'PHIẾU XUẤT HỦY KHO' : 'PHIẾU XUẤT KHO';
  if (featureMode === 'retail') titleText = 'PHIẾU XUẤT BÁN LẺ';
  if (featureMode === 'sales-order') titleText = 'PHIẾU XUẤT ĐƠN ĐẶT HÀNG';
  if (featureMode === 'quote') titleText = 'BẢNG BÁO GIÁ HÀNG HÓA';

  const orderDateObj = order.orderDate ? new Date(order.orderDate) : new Date();
  const day = String(orderDateObj.getDate()).padStart(2, '0');
  const month = String(orderDateObj.getMonth() + 1).padStart(2, '0');
  const year = orderDateObj.getFullYear();
  const dateFormattedText = `Ngày ${day} tháng ${month} năm ${year}`;

  const totalAmount = Number(order.totalAmount || 0);
  const totalAmountWords = numberToWordsVietnamese(totalAmount);

  const details = order.details || [];
  const minRows = 5;
  const emptyRowsCount = Math.max(0, minRows - details.length);

  return createPortal(
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-900/70 p-2 sm:p-4 backdrop-blur-xs overflow-y-auto">
      {/* ─── CSS CHO BẢN IN CHUẨN KHỔ A4 PORTRAIT ─── */}
      <style>{`
        @page {
          size: A4 portrait;
          margin: 6mm 8mm;
        }
        @media print {
          body * {
            visibility: hidden !important;
          }
          #printable-form-02vt,
          #printable-form-02vt * {
            visibility: visible !important;
          }
          #printable-form-02vt {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 8mm !important;
            background: #ffffff !important;
            color: #000000 !important;
            border: 3px double #0284c7 !important;
            box-shadow: none !important;
            font-size: 10.5pt !important;
            line-height: 1.35 !important;
            font-family: "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .modal-no-print {
            display: none !important;
          }
        }
      `}</style>

      {/* ─── MODAL DIALOG ─── */}
      <div className="w-full max-w-4xl rounded-2xl bg-white dark:bg-slate-900 p-4 sm:p-6 shadow-2xl border-2 border-cyan-500 my-auto">
        {/* Modal Top Controls */}
        <div className="modal-no-print mb-4 flex items-center justify-between border-b-2 border-cyan-100 dark:border-indigo-900/40 pb-3">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-cyan-100 text-cyan-800 font-bold text-xs">
              02
            </span>
            <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-slate-100 uppercase tracking-wide">
              Xem trước Phiếu xuất kho - Mẫu số 02-VT
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-4 py-2 text-xs font-bold text-white hover:bg-cyan-700 cursor-pointer shadow-md transition"
            >
              <Printer size={16} /> In Phiếu
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition cursor-pointer"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* ─── VÙNG IN PHIẾU XUẤT KHO MẪU SỐ 02-VT ─── */}
        <div
          id="printable-form-02vt"
          className="relative bg-white text-slate-900 p-6 sm:p-8 rounded-xl border-[3px] border-double border-cyan-600 shadow-sm font-sans leading-relaxed select-text"
          style={{ fontFamily: '"Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif' }}
        >
          {/* Header 2 bên: Công ty & Mẫu số 02-VT */}
          <div className="flex justify-between items-start mb-2 text-xs sm:text-sm">
            <div className="max-w-[55%]">
              <h3 className="font-extrabold text-sm sm:text-base text-slate-950 uppercase tracking-tight leading-snug">
                {nfc(settings.companyName || 'Công Ty TNHH Dịch Vụ Kế Toán Thiên Ứng')}
              </h3>
              <p className="text-xs text-slate-700 italic mt-0.5">
                {nfc(settings.department || 'Bộ phận: Bán hàng')}
              </p>
              {settings.taxCode && (
                <p className="text-xs text-slate-600">
                  Mã số thuế: <strong>{nfc(settings.taxCode)}</strong>
                </p>
              )}
            </div>

            <div className="text-right text-xs sm:text-sm max-w-[45%]">
              <p className="font-black text-sm sm:text-base text-slate-950">Mẫu số 02-VT</p>
              <p className="text-[11px] sm:text-xs text-slate-600 italic leading-tight mt-0.5">
                ({nfc(settings.templateStandard || 'Kèm theo Thông tư số 200/2014/TT-BTC ngày 22/12/2014 của Bộ trưởng Bộ Tài chính')})
              </p>
            </div>
          </div>

          {/* Tiêu đề chính */}
          <div className="text-center my-3">
            <h1 className="text-xl sm:text-2xl font-black uppercase tracking-wider text-slate-950">
              {nfc(titleText)}
            </h1>
            <p className="text-xs sm:text-sm italic text-slate-700 mt-1">
              {nfc(dateFormattedText)}
            </p>

            {/* Số phiếu & Nợ/Có góc phải */}
            <div className="flex justify-end items-center gap-6 text-xs sm:text-sm font-bold text-slate-900 mt-1 pr-2">
              <span>
                Số: <strong className="font-black">{nfc(order.orderNo)}</strong>
              </span>
              <span>
                Nợ: <strong>{nfc(settings.debitAccount || '632')}</strong>
              </span>
              <span>
                Có: <strong>{nfc(settings.creditAccount || '156')}</strong>
              </span>
            </div>
          </div>

          {/* Khối thông tin người nhận, lý do, kho */}
          <div className="space-y-1.5 text-xs sm:text-sm text-slate-900 mb-3 border-t border-slate-300 pt-2">
            <div className="grid grid-cols-12 gap-2">
              <div className="col-span-6 flex">
                <span className="shrink-0 text-slate-700">Họ và tên người nhận hàng:</span>
                <span className="font-bold ml-2 text-slate-950 truncate">
                  {nfc(order.customer || settings.receiverName || 'Nguyễn Thị Thúy')}
                </span>
              </div>
              <div className="col-span-6 flex">
                <span className="shrink-0 text-slate-700">Địa chỉ (bộ phận):</span>
                <span className="font-semibold ml-2 text-slate-950 truncate" title={order.customerAddress}>
                  {nfc(order.customerAddress || 'Công ty TNHH Thương mại Toàn Phát')}
                </span>
              </div>
            </div>

            <div className="flex">
              <span className="shrink-0 text-slate-700">Lý do xuất kho:</span>
              <span className="font-semibold ml-2 text-slate-950">
                {nfc(order.description || (isDisposal ? 'Xuất hủy hàng hỏng / hết hạn sử dụng' : 'Xuất bán hàng hóa theo đơn'))}
              </span>
            </div>

            <div className="grid grid-cols-12 gap-2">
              <div className="col-span-5 flex">
                <span className="shrink-0 text-slate-700">Xuất tại kho (ngăn lô):</span>
                <span className="font-bold ml-2 text-slate-950">{nfc(warehouseName)}</span>
              </div>
              <div className="col-span-7 flex">
                <span className="shrink-0 text-slate-700">Địa điểm:</span>
                <span className="font-semibold ml-2 text-slate-950 truncate" title={warehouseLocation}>
                  {nfc(warehouseLocation)}
                </span>
              </div>
            </div>
          </div>

          {/* ─── BẢNG HÀNG HÓA MẪU 02-VT (HEADER VÀNG KEM, ĐÁNH DẤU A B C D 1 2 3 4) ─── */}
          <div className="overflow-x-auto w-full mb-3 relative">
            <table className="w-full border-collapse border border-slate-900 text-xs sm:text-sm text-slate-900 text-left">
              <thead>
                {/* Dòng tiêu đề 1 */}
                <tr className="bg-[#fef9c3] print:bg-[#fef9c3] font-bold text-center text-slate-950 border-b border-slate-900">
                  <th className="border border-slate-900 p-2 text-center w-10">STT</th>
                  <th className="border border-slate-900 p-2 text-center min-w-[180px]">
                    Tên, nhãn hiệu, quy cách, phẩm chất vật tư, dụng cụ, sản phẩm, hàng hóa
                  </th>
                  <th className="border border-slate-900 p-2 text-center w-24">Mã số</th>
                  <th className="border border-slate-900 p-2 text-center w-16">Đơn vị tính</th>
                  <th className="border border-slate-900 p-1 text-center" colSpan={2}>
                    <div>Số lượng</div>
                    <div className="grid grid-cols-2 border-t border-slate-900 font-normal mt-1">
                      <span className="border-r border-slate-900 p-1 font-bold">Yêu cầu</span>
                      <span className="p-1 font-bold">Thực xuất</span>
                    </div>
                  </th>
                  <th className="border border-slate-900 p-2 text-center w-28">Đơn giá</th>
                  <th className="border border-slate-900 p-2 text-center w-32">Thành tiền</th>
                </tr>
                {/* Dòng đánh mã cột A B C D 1 2 3 4 */}
                <tr className="bg-[#fef08a] print:bg-[#fef08a] text-center italic text-xs font-semibold text-slate-800 border-b border-slate-900">
                  <th className="border border-slate-900 p-0.5 text-center">A</th>
                  <th className="border border-slate-900 p-0.5 text-center">B</th>
                  <th className="border border-slate-900 p-0.5 text-center">C</th>
                  <th className="border border-slate-900 p-0.5 text-center">D</th>
                  <th className="border border-slate-900 p-0.5 text-center w-14">1</th>
                  <th className="border border-slate-900 p-0.5 text-center w-14">2</th>
                  <th className="border border-slate-900 p-0.5 text-center">3</th>
                  <th className="border border-slate-900 p-0.5 text-center">4</th>
                </tr>
              </thead>
              <tbody>
                {details.map((d, i) => {
                  const lineTotal = d.totalLineAmount || (d.qty * d.price);
                  return (
                    <tr key={i} className="hover:bg-slate-50 transition">
                      <td className="border border-slate-900 p-2 text-center font-medium">{i + 1}</td>
                      <td className="border border-slate-900 p-2 font-bold text-slate-950">{nfc(d.productName)}</td>
                      <td className="border border-slate-900 p-2 text-center font-mono text-xs">{nfc(d.productSku || '-')}</td>
                      <td className="border border-slate-900 p-2 text-center">{nfc(d.unit || 'Bộ')}</td>
                      <td className="border border-slate-900 p-2 text-center font-bold">
                        {String(d.qty).padStart(2, '0')}
                      </td>
                      <td className="border border-slate-900 p-2 text-center font-bold">
                        {String(d.qty).padStart(2, '0')}
                      </td>
                      <td className="border border-slate-900 p-2 text-right font-medium">
                        {Number(d.price || 0).toLocaleString('vi-VN')}
                      </td>
                      <td className="border border-slate-900 p-2 text-right font-bold text-slate-950">
                        {lineTotal.toLocaleString('vi-VN')}
                      </td>
                    </tr>
                  );
                })}

                {/* Các dòng trống mô phỏng sổ kế toán */}
                {Array.from({ length: emptyRowsCount }).map((_, emptyIdx) => (
                  <tr key={`empty-${emptyIdx}`} className="h-7 text-transparent">
                    <td className="border border-slate-900 p-1 text-center">&nbsp;</td>
                    <td className="border border-slate-900 p-1">&nbsp;</td>
                    <td className="border border-slate-900 p-1">&nbsp;</td>
                    <td className="border border-slate-900 p-1">&nbsp;</td>
                    <td className="border border-slate-900 p-1">&nbsp;</td>
                    <td className="border border-slate-900 p-1">&nbsp;</td>
                    <td className="border border-slate-900 p-1">&nbsp;</td>
                    <td className="border border-slate-900 p-1">&nbsp;</td>
                  </tr>
                ))}

                {/* Dòng Cộng tổng (Nền xanh lá cây nhạt chuẩn mẫu) */}
                <tr className="bg-[#86efac]/80 print:bg-[#86efac]/80 font-black text-slate-950 border-t-2 border-slate-900">
                  <td className="border border-slate-900 p-2 text-center uppercase tracking-wider font-extrabold">
                    Cộng
                  </td>
                  <td className="border border-slate-900 p-2 text-center font-bold">x</td>
                  <td className="border border-slate-900 p-2 text-center font-bold">x</td>
                  <td className="border border-slate-900 p-2 text-center font-bold">x</td>
                  <td className="border border-slate-900 p-2 text-center font-bold">x</td>
                  <td className="border border-slate-900 p-2 text-center font-bold">x</td>
                  <td className="border border-slate-900 p-2 text-center font-bold">x</td>
                  <td className="border border-slate-900 p-2 text-right font-black text-base">
                    {totalAmount.toLocaleString('vi-VN')}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Tổng tiền viết bằng chữ & Chứng từ gốc */}
          <div className="space-y-1 text-xs sm:text-sm text-slate-900 mb-4">
            <p>
              Tổng số tiền <span className="italic">(Viết bằng chữ)</span>:{' '}
              <strong className="italic font-bold text-slate-950">{nfc(totalAmountWords)}</strong>
            </p>
            <p>
              Số chứng từ gốc kèm theo:{' '}
              <span className="font-semibold">
                01 Hóa đơn GTGT số {order.orderNo?.slice(-7) || '0000025'} {nfc(dateFormattedText)}
              </span>
            </p>
          </div>

          {/* ─── 5 KHỐI CHỮ KÝ CHUẨN MẪU 02-VT ─── */}
          <div className="text-right text-xs sm:text-sm italic text-slate-800 mb-2">
            {nfc(dateFormattedText)}
          </div>

          <div className="grid grid-cols-5 gap-2 text-center text-xs sm:text-sm text-slate-950 page-break-inside-avoid">
            {/* 1. Người lập phiếu */}
            <div className="flex flex-col justify-between min-h-[120px]">
              <div>
                <p className="font-black uppercase text-[12px] sm:text-xs">Người lập phiếu</p>
                <p className="text-[11px] text-slate-600 italic mt-0.5">(Ký, họ tên)</p>
              </div>
              <div className="pt-8">
                <p className="font-bold text-slate-950">{nfc(order.employeeName || settings.creatorName || 'Vũ Hữu Dũng')}</p>
              </div>
            </div>

            {/* 2. Người nhận hàng */}
            <div className="flex flex-col justify-between min-h-[120px]">
              <div>
                <p className="font-black uppercase text-[12px] sm:text-xs">Người nhận hàng</p>
                <p className="text-[11px] text-slate-600 italic mt-0.5">(Ký, họ tên)</p>
              </div>
              <div className="pt-8">
                <p className="font-bold text-slate-950">{nfc(order.customer || settings.receiverName || 'Phạm Thị Duyên')}</p>
              </div>
            </div>

            {/* 3. Thủ kho */}
            <div className="flex flex-col justify-between min-h-[120px]">
              <div>
                <p className="font-black uppercase text-[12px] sm:text-xs">Thủ kho</p>
                <p className="text-[11px] text-slate-600 italic mt-0.5">(Ký, họ tên)</p>
              </div>
              <div className="pt-8">
                <p className="font-bold text-slate-950">{nfc(settings.storekeeperName || 'Nguyễn Thị Thúy')}</p>
              </div>
            </div>

            {/* 4. Kế toán trưởng */}
            <div className="flex flex-col justify-between min-h-[120px]">
              <div>
                <p className="font-black uppercase text-[12px] sm:text-xs">Kế toán trưởng</p>
                <p className="text-[11px] text-slate-600 italic mt-0.5">(Ký, họ tên)</p>
              </div>
              <div className="pt-8">
                <p className="font-bold text-slate-950">{nfc(settings.chiefAccountantName || 'Trần Thị Hồng Mơ')}</p>
              </div>
            </div>

            {/* 5. Giám đốc */}
            <div className="flex flex-col justify-between min-h-[120px]">
              <div>
                <p className="font-black uppercase text-[12px] sm:text-xs">Giám đốc</p>
                <p className="text-[11px] text-slate-600 italic mt-0.5">(Ký, họ tên, đóng dấu)</p>
              </div>
              <div className="pt-8">
                <p className="font-bold text-slate-950">{nfc(settings.directorName || 'Nguyễn Thị Thanh Xuyên')}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Bottom action buttons */}
        <div className="modal-no-print mt-4 flex justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border-2 border-slate-300 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 transition cursor-pointer"
          >
            Đóng
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-5 py-2 text-xs font-bold text-white hover:bg-cyan-700 cursor-pointer shadow-md transition"
          >
            <Printer size={16} /> In Phiếu Xuất Kho
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
