import React from 'react';
import { createPortal } from 'react-dom';
import { Printer, Save, X, Building2, Truck, FileCheck, CheckCircle2 } from 'lucide-react';

export type ShippingNoteItem = {
  id: string;
  productName: string;
  productCode: string;
  unit: string;
  quantityExported: number;
  quantityImported: number;
  price: number;
};

export type InternalShippingNoteData = {
  formNo?: string; // Mẫu số 03/XKNB
  senderName: string;
  commandNo: string;
  sourceAddress: string;
  transporterName: string;
  vehicle: string;
  exporterTaxCode: string;
  dateStr: string;
  symbol: string;
  noteNo: string;
  receiverName: string;
  destinationAddress: string;
  items: ShippingNoteItem[];
  digitalSignatureCompany?: string;
  digitalSignatureDate?: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  initialData?: Partial<InternalShippingNoteData> | null;
  onSave?: (data: InternalShippingNoteData) => void;
  setToast?: (toast: { type: 'success' | 'error'; message: string }) => void;
};

const defaultItems: ShippingNoteItem[] = [
  {
    id: '1',
    productName: 'Laptop Dell Inspiron',
    productCode: 'D5401',
    unit: 'Chiếc',
    quantityExported: 1,
    quantityImported: 1,
    price: 10000000,
  },
  {
    id: '2',
    productName: 'Laptop Asus Vivobook',
    productCode: 'X1404ZA',
    unit: 'Chiếc',
    quantityExported: 1,
    quantityImported: 1,
    price: 9500000,
  },
];

export default function InternalShippingNoteModal({
  open,
  onClose,
  initialData,
  onSave,
  setToast,
}: Props) {
  const [senderName, setSenderName] = React.useState('Công Ty Kế Toán Thiên Ưng');
  const [commandNo, setCommandNo] = React.useState('12/LDD-KTTU');
  const [sourceAddress, setSourceAddress] = React.useState('Nhà lô B11, số 9A, ngõ 181 đường Xuân Thủy, Phường Dịch Vọng Hậu, Quận Cầu Giấy, Thành phố Hà Nội');
  const [transporterName, setTransporterName] = React.useState('Tạ Văn Thanh');
  const [vehicle, setVehicle] = React.useState('ô tô bán tải số 30L63686');
  const [exporterTaxCode, setExporterTaxCode] = React.useState('0110329220');
  const [dateStr, setDateStr] = React.useState('23/02/2025');
  const [symbol, setSymbol] = React.useState('6C25NTU');
  const [noteNo, setNoteNo] = React.useState('25');
  const [receiverName, setReceiverName] = React.useState('Nguyễn Thị Mai');
  const [destinationAddress, setDestinationAddress] = React.useState('Số nhà 1, ngách 327/6 phố Vũ Tông Phan, Phường Khương Đình, Quận Thanh Xuân, Thành phố Hà Nội');
  const [items, setItems] = React.useState<ShippingNoteItem[]>(defaultItems);
  const [companySign, setCompanySign] = React.useState('CÔNG TY TNHH ĐÀO TẠO THIÊN ƯNG');

  React.useEffect(() => {
    if (!open) return;
    if (initialData) {
      if (initialData.senderName) setSenderName(initialData.senderName);
      if (initialData.commandNo) setCommandNo(initialData.commandNo);
      if (initialData.sourceAddress) setSourceAddress(initialData.sourceAddress);
      if (initialData.transporterName) setTransporterName(initialData.transporterName);
      if (initialData.vehicle) setVehicle(initialData.vehicle);
      if (initialData.exporterTaxCode) setExporterTaxCode(initialData.exporterTaxCode);
      if (initialData.dateStr) setDateStr(initialData.dateStr);
      if (initialData.symbol) setSymbol(initialData.symbol);
      if (initialData.noteNo) setNoteNo(initialData.noteNo);
      if (initialData.receiverName) setReceiverName(initialData.receiverName);
      if (initialData.destinationAddress) setDestinationAddress(initialData.destinationAddress);
      if (initialData.items && initialData.items.length > 0) setItems(initialData.items);
      if (initialData.digitalSignatureCompany) setCompanySign(initialData.digitalSignatureCompany);
    }
  }, [open, initialData]);

  if (!open) return null;

  const totalAmount = items.reduce((sum, item) => sum + (item.price * item.quantityExported), 0);

  const formatMoney = (val: number) => {
    return new Intl.NumberFormat('vi-VN').format(val);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleSave = () => {
    const data: InternalShippingNoteData = {
      formNo: '03/XKNB',
      senderName,
      commandNo,
      sourceAddress,
      transporterName,
      vehicle,
      exporterTaxCode,
      dateStr,
      symbol,
      noteNo,
      receiverName,
      destinationAddress,
      items,
      digitalSignatureCompany: companySign,
      digitalSignatureDate: dateStr,
    };
    if (onSave) onSave(data);
    if (setToast) setToast({ type: 'success', message: 'Đã lưu phiếu xuất kho kiêm vận chuyển nội bộ!' });
    onClose();
  };

  return createPortal(
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-950/80 p-3 sm:p-6 backdrop-blur-sm overflow-y-auto print:p-0 print:bg-white">
      {/* Container Card */}
      <div className="flex w-full max-w-5xl max-h-[96vh] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl print:max-h-none print:shadow-none print:w-full print:rounded-none">
        
        {/* Modal Top Bar (Hidden on print) */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-cyan-600 px-6 py-4 text-white print:hidden">
          <div className="flex items-center gap-3">
            <FileCheck className="h-6 w-6 text-cyan-200" />
            <div>
              <h2 className="text-lg font-bold">Phiếu Điều Chuyển Hàng Hóa Nội Bộ</h2>
              <p className="text-xs text-cyan-100">Mẫu in phiếu điều chuyển hàng hóa giữa các kho</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-2 rounded-xl bg-white/20 px-4 py-2 text-sm font-bold text-white transition hover:bg-white/30"
            >
              <Printer className="h-4 w-4" />
              In phiếu
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl p-2 text-white/80 transition hover:bg-white/20 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Document Content Box */}
        <div className="overflow-y-auto p-6 sm:p-10 text-slate-900 bg-white print:p-4 font-sans text-base leading-relaxed">
          
          <style>{`
            @media print {
              body * { visibility: hidden; }
              .print-area, .print-area * { visibility: visible; }
              .print-area { position: absolute; left: 0; top: 0; width: 100%; }
              .no-print { display: none !important; }
            }
          `}</style>

          <div className="print-area max-w-4xl mx-auto border-4 border-cyan-500/80 p-6 sm:p-8 rounded-lg shadow-inner print:border-2 print:border-black font-sans">
            
            {/* Header Right Form Code */}
            <div className="text-right font-sans font-bold text-slate-800 text-sm mb-4">
              Mẫu phiếu điều chuyển
            </div>

            {/* Exporter Info */}
            <div className="space-y-1 text-sm font-sans mb-6">
              <div className="flex items-baseline gap-2">
                <span className="font-semibold text-slate-700">Tên đơn vị gửi hàng:</span>
                <input
                  value={senderName}
                  onChange={(e) => setSenderName(e.target.value)}
                  className="font-bold text-slate-900 bg-transparent border-b border-dashed border-slate-300 focus:border-cyan-600 outline-none flex-1 font-sans text-base"
                />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="font-semibold text-slate-700">Theo lệnh điều động số</span>
                <input
                  value={commandNo}
                  onChange={(e) => setCommandNo(e.target.value)}
                  className="font-bold text-slate-900 bg-transparent border-b border-dashed border-slate-300 focus:border-cyan-600 outline-none w-36 font-sans text-base text-center"
                />
                <span className="font-semibold text-slate-700">về việc vận chuyển điều chuyển hàng hóa</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="font-semibold text-slate-700 shrink-0">Địa chỉ kho gửi (kho đi):</span>
                <input
                  value={sourceAddress}
                  onChange={(e) => setSourceAddress(e.target.value)}
                  className="font-medium text-slate-800 bg-transparent border-b border-dashed border-slate-300 focus:border-cyan-600 outline-none flex-1 font-sans text-base"
                />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="font-semibold text-slate-700">Tên người vận chuyển:</span>
                <input
                  value={transporterName}
                  onChange={(e) => setTransporterName(e.target.value)}
                  className="font-medium text-slate-800 bg-transparent border-b border-dashed border-slate-300 focus:border-cyan-600 outline-none flex-1 font-sans text-base"
                />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="font-semibold text-slate-700">Phương tiện vận chuyển:</span>
                <input
                  value={vehicle}
                  onChange={(e) => setVehicle(e.target.value)}
                  className="font-medium text-slate-800 bg-transparent border-b border-dashed border-slate-300 focus:border-cyan-600 outline-none flex-1 font-sans text-base"
                />
              </div>
            </div>

            {/* Document Main Title */}
            <div className="text-center my-6 font-sans">
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-wider uppercase text-slate-900 font-sans">
                PHIẾU ĐIỀU CHUYỂN HÀNG HÓA NỘI BỘ
              </h1>
              <div className="flex items-center justify-between text-sm italic mt-2 px-4 font-sans">
                <div className="flex-1 text-center">
                  <span>Ngày </span>
                  <input
                    value={dateStr}
                    onChange={(e) => setDateStr(e.target.value)}
                    className="not-italic font-bold text-slate-800 bg-transparent border-b border-dashed border-slate-300 text-center w-36 outline-none font-sans"
                  />
                </div>
                <div className="text-right not-italic font-sans text-xs font-semibold text-slate-700 space-y-0.5">
                  <div>Ký hiệu: <input value={symbol} onChange={(e) => setSymbol(e.target.value)} className="w-24 border-b border-dashed border-slate-300 outline-none text-center font-bold font-sans" /></div>
                  <div>Số: <input value={noteNo} onChange={(e) => setNoteNo(e.target.value)} className="w-20 border-b border-dashed border-slate-300 outline-none text-center font-bold text-cyan-700 font-sans" /></div>
                </div>
              </div>
            </div>

            {/* Receiver Info */}
            <div className="space-y-1 text-sm font-sans mb-6">
              <div className="flex items-baseline gap-2">
                <span className="font-semibold text-slate-700">Tên người nhận hàng:</span>
                <input
                  value={receiverName}
                  onChange={(e) => setReceiverName(e.target.value)}
                  className="font-bold text-slate-900 bg-transparent border-b border-dashed border-slate-300 focus:border-cyan-600 outline-none flex-1 font-sans text-base"
                />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="font-semibold text-slate-700 shrink-0">Địa điểm kho nhận (kho đến):</span>
                <input
                  value={destinationAddress}
                  onChange={(e) => setDestinationAddress(e.target.value)}
                  className="font-medium text-slate-800 bg-transparent border-b border-dashed border-slate-300 focus:border-cyan-600 outline-none flex-1 font-sans text-base"
                />
              </div>
            </div>

            {/* Product Table */}
            <div className="overflow-x-auto my-6 font-sans">
              <table className="w-full border-2 border-slate-900 text-center text-sm font-sans border-collapse">
                <thead>
                  <tr className="bg-slate-100/80 text-slate-900 font-bold border-b-2 border-slate-900">
                    <th rowSpan={2} className="border border-slate-900 px-2 py-2.5 w-12">STT</th>
                    <th rowSpan={2} className="border border-slate-900 px-3 py-2.5 text-left">
                      Tên nhãn hiệu, quy cách, phẩm chất vật tư (sản phẩm, hàng hóa)
                    </th>
                    <th rowSpan={2} className="border border-slate-900 px-2 py-2.5 w-24">Mã số</th>
                    <th rowSpan={2} className="border border-slate-900 px-2 py-2.5 w-20">Đơn vị tính</th>
                    <th colSpan={2} className="border border-slate-900 px-2 py-1">Số lượng</th>
                    <th rowSpan={2} className="border border-slate-900 px-3 py-2.5 w-28">Đơn giá</th>
                    <th rowSpan={2} className="border border-slate-900 px-3 py-2.5 w-32">Thành tiền</th>
                  </tr>
                  <tr className="bg-slate-100/80 text-slate-900 font-bold border-b-2 border-slate-900">
                    <th className="border border-slate-900 px-2 py-1.5 w-16">Thực xuất</th>
                    <th className="border border-slate-900 px-2 py-1.5 w-16">Thực nhập</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => (
                    <tr key={item.id || idx} className="border-b border-slate-800 font-sans">
                      <td className="border border-slate-900 px-2 py-2 font-sans text-xs font-semibold">{String(idx + 1).padStart(2, '0')}</td>
                      <td className="border border-slate-900 px-3 py-2 text-left font-bold text-slate-900 font-sans">{item.productName}</td>
                      <td className="border border-slate-900 px-2 py-2 font-sans font-semibold text-slate-700">{item.productCode}</td>
                      <td className="border border-slate-900 px-2 py-2 text-slate-800 font-sans">{item.unit}</td>
                      <td className="border border-slate-900 px-2 py-2 font-sans font-bold text-slate-900">{String(item.quantityExported).padStart(2, '0')}</td>
                      <td className="border border-slate-900 px-2 py-2 font-sans font-bold text-slate-900">{String(item.quantityImported).padStart(2, '0')}</td>
                      <td className="border border-slate-900 px-3 py-2 text-right font-sans">{formatMoney(item.price)}</td>
                      <td className="border border-slate-900 px-3 py-2 text-right font-sans font-bold">{formatMoney(item.price * item.quantityExported)}</td>
                    </tr>
                  ))}
                  {/* Empty rows filler */}
                  {items.length < 3 && (
                    <tr className="border-b border-slate-800 h-8">
                      <td className="border border-slate-900"></td>
                      <td className="border border-slate-900"></td>
                      <td className="border border-slate-900"></td>
                      <td className="border border-slate-900"></td>
                      <td className="border border-slate-900"></td>
                      <td className="border border-slate-900"></td>
                      <td className="border border-slate-900"></td>
                      <td className="border border-slate-900"></td>
                    </tr>
                  )}
                  {/* Total Row */}
                  <tr className="font-sans font-extrabold text-slate-900 bg-slate-50">
                    <td colSpan={7} className="border border-slate-900 px-4 py-2.5 text-right uppercase tracking-wider text-sm">
                      Tổng cộng:
                    </td>
                    <td className="border border-slate-900 px-3 py-2.5 text-right text-base text-cyan-900 font-extrabold">
                      {formatMoney(totalAmount)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Footer Digital Signature */}
            <div className="mt-8 text-center font-sans space-y-2">
              <div className="font-extrabold text-slate-900 uppercase tracking-widest text-base">
                THỦ TRƯỞNG ĐƠN VỊ
              </div>
              <div className="text-xs italic text-slate-500">(Chữ ký số)</div>
              
              <div className="inline-flex flex-col items-center justify-center border-2 border-emerald-500 bg-emerald-50/50 p-4 rounded-xl mt-4 shadow-sm">
                <div className="flex items-center gap-2 text-emerald-700 font-bold text-sm">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  <span>Đã được ký điện tử bởi</span>
                </div>
                <input
                  value={companySign}
                  onChange={(e) => setCompanySign(e.target.value)}
                  className="font-black text-slate-900 text-center uppercase tracking-wider text-sm mt-1 bg-transparent border-b border-dashed border-emerald-400 outline-none w-80"
                />
                <div className="text-xs font-semibold text-emerald-700 mt-1">
                  Ngày: {dateStr}
                </div>
              </div>
            </div>

          </div>

        </div>

        {/* Modal Bottom Actions (Hidden on print) */}
        <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-6 py-4 print:hidden">
          <div className="text-xs font-medium text-slate-500">
            Mẫu phiếu điều chuyển hàng hóa nội bộ giữa các chi nhánh / kho
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border-2 border-slate-300 bg-white px-5 py-2.5 text-sm font-bold text-slate-600 transition hover:bg-slate-100"
            >
              Hủy / Đóng
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="rounded-xl border-2 border-cyan-500 bg-white px-5 py-2.5 text-sm font-bold text-cyan-600 shadow-sm transition hover:bg-cyan-50 flex items-center gap-2"
            >
              <Printer className="h-4 w-4" />
              In phiếu điều chuyển
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="rounded-xl border-2 border-cyan-500 bg-cyan-600 px-6 py-2.5 text-sm font-bold text-white shadow-md transition hover:bg-cyan-700 flex items-center gap-2"
            >
              <Save className="h-4 w-4" />
              Lưu phiếu điều chuyển
            </button>
          </div>
        </div>

      </div>
    </div>,
    document.body
  );
}
