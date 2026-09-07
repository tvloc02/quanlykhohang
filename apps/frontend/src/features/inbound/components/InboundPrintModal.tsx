import React, { useEffect, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Printer, X, Plus, Trash2 } from 'lucide-react';
import type { InboundReceiptOrder } from '../Inbound';
import { numberToWordsVietnamese } from '../../../shared/utils/numberToWords';

interface WarehouseOption {
  id?: string;
  code?: string;
  name?: string;
  address?: string;
}

interface InboundPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: InboundReceiptOrder | null;
  warehouses?: WarehouseOption[];
  featureMode?: string;
}

interface PrintItem {
  id: string;
  productName: string;
  productSku: string;
  unit: string;
  qtyDoc: number;
  qtyActual: number;
  price: number;
}

const API_BASE_URL = 'http://localhost:3000/api';

export default function InboundPrintModal({
  isOpen,
  onClose,
  order,
  warehouses = [],
  featureMode,
}: InboundPrintModalProps) {
  const [settings, setSettings] = useState<any>(null);

  // 1. Company & Header State
  const [companyName, setCompanyName] = useState('Công Ty TNHH Dịch Vụ Kế Toán Thiên Ứng');
  const [department, setDepartment] = useState('Bộ phận: Kho vận');
  const [taxCode, setTaxCode] = useState('0101234567');
  const [templateCode, setTemplateCode] = useState('Mẫu số 01-VT');
  const [templateStandard, setTemplateStandard] = useState(
    'Ban hành theo Thông tư số 200/2014/TT-BTC ngày 22/12/2014 của Bộ Tài chính'
  );

  // 2. Voucher info
  const [voucherTitle, setVoucherTitle] = useState('PHIẾU NHẬP KHO');
  const [dateDay, setDateDay] = useState(String(new Date().getDate()).padStart(2, '0'));
  const [dateMonth, setDateMonth] = useState(String(new Date().getMonth() + 1).padStart(2, '0'));
  const [dateYear, setDateYear] = useState(String(new Date().getFullYear()));
  const [receiptNo, setReceiptNo] = useState('');
  const [debitAccount, setDebitAccount] = useState('156');
  const [creditAccount, setCreditAccount] = useState('331');

  // 3. Deliverer & Source & Warehouse
  const [delivererName, setDelivererName] = useState('');
  const [sourceDocText, setSourceDocText] = useState('');
  const [warehouseName, setWarehouseName] = useState('');
  const [warehouseLocation, setWarehouseLocation] = useState('');
  const [reason, setReason] = useState('');

  // 4. Items Table
  const [items, setItems] = useState<PrintItem[]>([]);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [vatAmount, setVatAmount] = useState(0);

  // 5. Attached Docs
  const [attachedDocs, setAttachedDocs] = useState('');

  // 6. Signatures (4 vị trí Mẫu 01-VT)
  const [creatorSign, setCreatorSign] = useState('');
  const [delivererSign, setDelivererSign] = useState('');
  const [storekeeperSign, setStorekeeperSign] = useState('');
  const [chiefAccountantSign, setChiefAccountantSign] = useState('');

  // Fetch settings from API
  useEffect(() => {
    if (!isOpen) return;
    fetch(`${API_BASE_URL}/settings`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setSettings(data);
      })
      .catch(() => {});
  }, [isOpen]);

  // Sync state when order or settings load
  useEffect(() => {
    if (!isOpen || !order) return;

    const s = settings || {};

    // 1. Company
    setCompanyName(s.companyName || 'Công Ty TNHH Dịch Vụ Kế Toán Thiên Ứng');
    setDepartment(s.department || 'Bộ phận: Kho vận');
    setTaxCode(s.taxCode || '0101234567');
    setTemplateCode('Mẫu số 01-VT');
    setTemplateStandard(
      s.templateStandard || 'Ban hành theo Thông tư số 200/2014/TT-BTC ngày 22/12/2014 của Bộ Tài chính'
    );

    // 2. Title
    const isReturn = featureMode === 'return-supplier';
    setVoucherTitle(isReturn ? 'PHIẾU XUẤT TRẢ NHÀ CUNG CẤP' : 'PHIẾU NHẬP KHO');

    // Date
    let orderDateObj = new Date();
    if (order.orderDate) {
      const parsed = new Date(order.orderDate);
      if (!Number.isNaN(parsed.getTime())) orderDateObj = parsed;
    }
    setDateDay(String(orderDateObj.getDate()).padStart(2, '0'));
    setDateMonth(String(orderDateObj.getMonth() + 1).padStart(2, '0'));
    setDateYear(String(orderDateObj.getFullYear()));

    setReceiptNo(order.receiptNo || '');
    setDebitAccount(isReturn ? '331' : '156');
    setCreditAccount(isReturn ? '156' : s.creditAccount || '331');

    // 3. Deliverer & Source & Warehouse
    setDelivererName(order.employeeName || order.supplier || 'Nguyễn Văn Giao');
    const dateFormatted = `${String(orderDateObj.getDate()).padStart(2, '0')}/${String(orderDateObj.getMonth() + 1).padStart(2, '0')}/${orderDateObj.getFullYear()}`;
    const poNum = order.poNumber || order.receiptNo?.slice(-7) || '0000012';
    setSourceDocText(`Hóa đơn số ${poNum} ngày ${dateFormatted} của ${order.supplier || 'Nhà cung cấp'}`);

    const whCode = order.warehouseCode;
    const foundWh = warehouses.find(
      (w) => w.code === whCode || w.name === whCode || w.id === whCode
    );
    setWarehouseName(foundWh ? `[${foundWh.code}] ${foundWh.name}` : whCode || 'Kho Tổng (KHO-NVL)');
    setWarehouseLocation(foundWh?.address || s.address || 'Hà Nội, Việt Nam');
    setReason(
      order.description ||
        (isReturn ? 'Xuất trả hàng lỗi / không đạt quy chuẩn cho nhà cung cấp' : 'Nhập kho mua hàng hóa theo đơn')
    );

    // 4. Items
    if (order.details && order.details.length > 0) {
      const mapped: PrintItem[] = order.details.map((d: any, i: number) => {
        const qtyVal = Number(d.qty || d.actualQty || d.requestedQty || 1);
        const priceVal = Number(d.price || d.unitPrice || 0);
        return {
          id: String(d.id || i + 1),
          productName: d.productName || `Sản phẩm ${i + 1}`,
          productSku: d.productSku || '-',
          unit: d.unit || 'Cái',
          qtyDoc: Number(d.requestedQty || qtyVal),
          qtyActual: qtyVal,
          price: priceVal,
        };
      });
      setItems(mapped);
    } else {
      setItems([
        {
          id: '1',
          productName: 'Hàng hóa nhập kho',
          productSku: 'SKU001',
          unit: 'Cái',
          qtyDoc: 1,
          qtyActual: 1,
          price: 100000,
        },
      ]);
    }

    setDiscountAmount(Number(order.discount || 0));
    setVatAmount(Number(order.vatAmount || 0));

    // 5. Attached Docs
    setAttachedDocs(`01 Hóa đơn GTGT số ${poNum} kèm biên bản giao nhận hàng hóa`);

    // 6. Signatures (4 vị trí chuẩn Mẫu 01-VT)
    const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
    const currentUserName = currentUser.fullName || currentUser.email?.split('@')[0] || 'Quản lý kho';

    setCreatorSign(order.employeeName || currentUserName || s.creatorName || 'Vũ Hữu Dũng');
    setDelivererSign(order.supplier || 'Nguyễn Văn Giao');
    setStorekeeperSign(s.storekeeperName || 'Nguyễn Thị Thúy');
    setChiefAccountantSign(s.chiefAccountantName || 'Trần Thị Hồng Mơ');
  }, [isOpen, order, settings, featureMode, warehouses]);

  // Keyboard shortcut Ctrl+P / Escape
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

  // Items manipulation
  const handleItemChange = (index: number, field: keyof PrintItem, value: any) => {
    setItems((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const handleAddItem = () => {
    setItems((prev) => [
      ...prev,
      {
        id: String(Date.now()),
        productName: 'Hàng hóa mới',
        productSku: 'SKU-NEW',
        unit: 'Cái',
        qtyDoc: 1,
        qtyActual: 1,
        price: 0,
      },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  // Calculations
  const subtotalAmount = useMemo(() => {
    return items.reduce((sum, item) => sum + Number(item.qtyActual || 0) * Number(item.price || 0), 0);
  }, [items]);

  const totalPayment = useMemo(() => {
    return Math.max(0, subtotalAmount - Number(discountAmount || 0) + Number(vatAmount || 0));
  }, [subtotalAmount, discountAmount, vatAmount]);

  const totalPaymentWords = useMemo(() => {
    return numberToWordsVietnamese(totalPayment);
  }, [totalPayment]);

  if (!isOpen || !order) return null;

  return createPortal(
    <div className="inbound-print-modal fixed inset-0 z-[99999] flex items-center justify-center bg-black/50 p-2 sm:p-5 backdrop-blur-xs overflow-y-auto print:static print:block print:inset-auto print:p-0 print:m-0 print:bg-white print:overflow-visible">
      {/* Container Dialog */}
      <div className="flex w-full max-w-5xl max-h-[96vh] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl border border-slate-200 print:block print:max-h-none print:h-auto print:shadow-none print:w-full print:rounded-none print:border-none print:m-0 print:p-0">
        {/* Top Control Bar (Hidden on print - Light Neutral, No Black, No Cyan) */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-5 py-3 text-slate-800 print:hidden">
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-700 font-bold text-xs border border-blue-200">
              01
            </span>
            <div>
              <h2 className="text-sm sm:text-base font-black uppercase tracking-wide text-slate-900">
                Xem trước & Chỉnh sửa Phiếu nhập kho (Mẫu số 01-VT)
              </h2>
              <p className="text-xs text-slate-500">
                Có thể chỉnh sửa trực tiếp nội dung trước khi in • Bản in đen trắng chuẩn A4
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-blue-700 cursor-pointer"
            >
              <Printer className="h-4 w-4" />
              In Phiếu (Ctrl+P)
            </button>

            <button
              type="button"
              onClick={onClose}
              className="rounded-xl p-1.5 text-slate-400 transition hover:bg-slate-200 hover:text-slate-700 cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Printable Document Container */}
        <div className="overflow-y-auto bg-slate-100 p-4 sm:p-6 print:p-0 print:m-0 print:bg-white">
          <style>{`
            @media print {
              @page {
                size: A4 portrait;
                margin: 0 !important;
              }
              html, body {
                margin: 0 !important;
                padding: 0 !important;
                height: auto !important;
                min-height: 0 !important;
                background: #fff !important;
              }
              .inbound-print-modal {
                position: static !important;
                display: block !important;
                width: 100% !important;
                height: auto !important;
                min-height: 0 !important;
                margin: 0 !important;
                padding: 0 !important;
                background: #fff !important;
                overflow: visible !important;
                inset: auto !important;
              }
              .inbound-print-modal > div {
                display: block !important;
                max-height: none !important;
                height: auto !important;
                width: 100% !important;
                margin: 0 !important;
                padding: 0 !important;
                border: none !important;
                box-shadow: none !important;
                border-radius: 0 !important;
              }
              .inbound-print-modal .overflow-y-auto {
                overflow: visible !important;
                padding: 0 !important;
                margin: 0 !important;
                background: transparent !important;
              }
              .inbound-print-paper {
                box-shadow: none !important;
                border: none !important;
                border-radius: 0 !important;
                padding: 8mm 15mm 12mm 15mm !important;
                margin: 0 auto !important;
                width: 100% !important;
                max-width: 100% !important;
              }
              .print-hide {
                display: none !important;
              }
              .print-show-val {
                display: inline !important;
              }
              .print-hide-input {
                display: none !important;
              }
            }
            .print-show-val {
              display: none;
            }
          `}</style>

          {/* VÙNG GIẤY IN A4 (CHUẨN ĐEN TRẮNG, TIMES NEW ROMAN) */}
          <div
            className="inbound-print-paper mx-auto w-full max-w-[880px] rounded-lg border border-slate-300 bg-white p-6 sm:p-10 shadow-md text-black leading-normal"
            style={{ fontFamily: "'Times New Roman', Times, serif" }}
          >
            {/* Header 2 bên: Đơn vị & Mẫu số 01-VT */}
            <div className="flex justify-between items-start mb-2 text-xs sm:text-sm gap-4">
              <div className="flex-1 space-y-1">
                <div className="flex items-start gap-1">
                  <span className="font-semibold text-slate-800 whitespace-nowrap pt-0.5">Đơn vị:</span>
                  <span className="print-hide-input flex-1">
                    <textarea
                      rows={2}
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      className="w-full font-bold uppercase text-black border-b border-dotted border-slate-400 bg-transparent px-1 focus:border-black outline-none text-xs sm:text-sm resize-none overflow-hidden leading-snug"
                      placeholder="Nhập tên đơn vị / công ty"
                    />
                  </span>
                  <span className="print-show-val font-bold uppercase text-black flex-1">
                    {companyName}
                  </span>
                </div>

                <div className="flex items-baseline gap-1">
                  <span className="font-semibold text-slate-800 whitespace-nowrap">Bộ phận:</span>
                  <span className="print-hide-input flex-1">
                    <input
                      type="text"
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      className="w-full italic text-black border-b border-dotted border-slate-400 bg-transparent px-1 focus:border-black outline-none text-xs sm:text-sm"
                    />
                  </span>
                  <span className="print-show-val italic text-black flex-1">
                    {department}
                  </span>
                </div>

                <div className="flex items-baseline gap-1">
                  <span className="font-semibold text-slate-800 whitespace-nowrap">Mã số thuế:</span>
                  <span className="print-hide-input flex-1">
                    <input
                      type="text"
                      value={taxCode}
                      onChange={(e) => setTaxCode(e.target.value)}
                      className="w-full font-bold text-black border-b border-dotted border-slate-400 bg-transparent px-1 focus:border-black outline-none text-xs sm:text-sm"
                    />
                  </span>
                  <span className="print-show-val font-bold text-black flex-1">
                    {taxCode}
                  </span>
                </div>
              </div>

              {/* Góc phải: Mẫu số 01-VT & Thông tư */}
              <div className="text-right text-xs sm:text-sm w-64 shrink-0 space-y-0.5">
                <div className="flex justify-end items-center gap-1 font-bold">
                  <span className="print-hide-input">
                    <input
                      type="text"
                      value={templateCode}
                      onChange={(e) => setTemplateCode(e.target.value)}
                      className="w-32 text-right font-black text-black border-b border-dotted border-slate-400 bg-transparent px-1 focus:border-black outline-none text-xs sm:text-sm"
                    />
                  </span>
                  <span className="print-show-val font-black text-black">
                    {templateCode}
                  </span>
                </div>

                <div className="italic text-[11px] sm:text-xs text-slate-700 leading-tight">
                  <span className="print-hide-input block">
                    <textarea
                      rows={2}
                      value={templateStandard}
                      onChange={(e) => setTemplateStandard(e.target.value)}
                      className="w-full text-right italic text-[11px] sm:text-xs text-black border-b border-dotted border-slate-400 bg-transparent px-1 focus:border-black outline-none resize-none overflow-hidden leading-snug"
                    />
                  </span>
                  <span className="print-show-val block">
                    ({templateStandard})
                  </span>
                </div>
              </div>
            </div>

            {/* Tiêu đề chính */}
            <div className="text-center my-3">
              <div className="inline-block w-full max-w-md">
                <span className="print-hide-input block">
                  <input
                    type="text"
                    value={voucherTitle}
                    onChange={(e) => setVoucherTitle(e.target.value)}
                    className="w-full text-center text-xl sm:text-2xl font-black uppercase tracking-wider text-black border-b border-dotted border-slate-400 bg-transparent focus:border-black outline-none"
                  />
                </span>
                <span className="print-show-val block text-xl sm:text-2xl font-black uppercase tracking-wider text-black">
                  {voucherTitle}
                </span>
              </div>

              {/* Ngày tháng năm */}
              <div className="flex justify-center items-center gap-1 text-xs sm:text-sm italic text-black mt-1">
                <span>Ngày</span>
                <span className="print-hide-input">
                  <input
                    type="text"
                    value={dateDay}
                    onChange={(e) => setDateDay(e.target.value)}
                    className="w-8 text-center italic border-b border-dotted border-slate-400 bg-transparent focus:border-black outline-none"
                  />
                </span>
                <span className="print-show-val font-semibold">{dateDay}</span>

                <span>tháng</span>
                <span className="print-hide-input">
                  <input
                    type="text"
                    value={dateMonth}
                    onChange={(e) => setDateMonth(e.target.value)}
                    className="w-8 text-center italic border-b border-dotted border-slate-400 bg-transparent focus:border-black outline-none"
                  />
                </span>
                <span className="print-show-val font-semibold">{dateMonth}</span>

                <span>năm</span>
                <span className="print-hide-input">
                  <input
                    type="text"
                    value={dateYear}
                    onChange={(e) => setDateYear(e.target.value)}
                    className="w-14 text-center italic border-b border-dotted border-slate-400 bg-transparent focus:border-black outline-none"
                  />
                </span>
                <span className="print-show-val font-semibold">{dateYear}</span>
              </div>

              {/* Số phiếu & Nợ/Có góc phải */}
              <div className="flex justify-end items-center gap-6 text-xs sm:text-sm text-black mt-1.5 pr-1">
                <div className="flex items-center gap-1">
                  <span>Số:</span>
                  <span className="print-hide-input">
                    <input
                      type="text"
                      value={receiptNo}
                      onChange={(e) => setReceiptNo(e.target.value)}
                      className="w-36 font-bold border-b border-dotted border-slate-400 bg-transparent px-1 focus:border-black outline-none text-xs sm:text-sm"
                    />
                  </span>
                  <span className="print-show-val font-bold">{receiptNo}</span>
                </div>

                <div className="flex items-center gap-1">
                  <span>Nợ:</span>
                  <span className="print-hide-input">
                    <input
                      type="text"
                      value={debitAccount}
                      onChange={(e) => setDebitAccount(e.target.value)}
                      className="w-14 text-center font-bold border-b border-dotted border-slate-400 bg-transparent px-1 focus:border-black outline-none text-xs sm:text-sm"
                    />
                  </span>
                  <span className="print-show-val font-bold">{debitAccount}</span>
                </div>

                <div className="flex items-center gap-1">
                  <span>Có:</span>
                  <span className="print-hide-input">
                    <input
                      type="text"
                      value={creditAccount}
                      onChange={(e) => setCreditAccount(e.target.value)}
                      className="w-14 text-center font-bold border-b border-dotted border-slate-400 bg-transparent px-1 focus:border-black outline-none text-xs sm:text-sm"
                    />
                  </span>
                  <span className="print-show-val font-bold">{creditAccount}</span>
                </div>
              </div>
            </div>

            {/* Thông tin người giao, chứng từ, kho */}
            <div className="space-y-1.5 text-xs sm:text-sm text-black mb-3 border-t border-black pt-2">
              <div className="flex items-baseline gap-1.5">
                <span className="shrink-0 whitespace-nowrap">- Họ và tên người giao hàng:</span>
                <span className="print-hide-input flex-1">
                  <input
                    type="text"
                    value={delivererName}
                    onChange={(e) => setDelivererName(e.target.value)}
                    className="w-full font-bold border-b border-dotted border-slate-400 bg-transparent px-1 focus:border-black outline-none text-xs sm:text-sm"
                  />
                </span>
                <span className="print-show-val font-bold flex-1">{delivererName}</span>
              </div>

              <div className="flex items-baseline gap-1.5">
                <span className="shrink-0 whitespace-nowrap">- Theo:</span>
                <span className="print-hide-input flex-1">
                  <input
                    type="text"
                    value={sourceDocText}
                    onChange={(e) => setSourceDocText(e.target.value)}
                    className="w-full border-b border-dotted border-slate-400 bg-transparent px-1 focus:border-black outline-none text-xs sm:text-sm"
                  />
                </span>
                <span className="print-show-val flex-1">{sourceDocText}</span>
              </div>

              <div className="grid grid-cols-12 gap-2">
                <div className="col-span-12 sm:col-span-6 flex items-baseline gap-1.5">
                  <span className="shrink-0 whitespace-nowrap">- Nhập tại kho:</span>
                  <span className="print-hide-input flex-1">
                    <input
                      type="text"
                      value={warehouseName}
                      onChange={(e) => setWarehouseName(e.target.value)}
                      className="w-full font-bold border-b border-dotted border-slate-400 bg-transparent px-1 focus:border-black outline-none text-xs sm:text-sm"
                    />
                  </span>
                  <span className="print-show-val font-bold flex-1">{warehouseName}</span>
                </div>

                <div className="col-span-12 sm:col-span-6 flex items-baseline gap-1.5">
                  <span className="shrink-0 whitespace-nowrap">Địa điểm:</span>
                  <span className="print-hide-input flex-1">
                    <input
                      type="text"
                      value={warehouseLocation}
                      onChange={(e) => setWarehouseLocation(e.target.value)}
                      className="w-full border-b border-dotted border-slate-400 bg-transparent px-1 focus:border-black outline-none text-xs sm:text-sm"
                    />
                  </span>
                  <span className="print-show-val flex-1">{warehouseLocation}</span>
                </div>
              </div>

              <div className="flex items-baseline gap-1.5">
                <span className="shrink-0 whitespace-nowrap">- Lý do nhập kho:</span>
                <span className="print-hide-input flex-1">
                  <input
                    type="text"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="w-full border-b border-dotted border-slate-400 bg-transparent px-1 focus:border-black outline-none text-xs sm:text-sm"
                  />
                </span>
                <span className="print-show-val flex-1">{reason}</span>
              </div>
            </div>

            {/* BẢNG HÀNG HÓA MẪU 01-VT (ĐEN TRẮNG, KHÔNG MÀU MÈ) */}
            <div className="overflow-x-auto w-full mb-3">
              <table
                className="w-full border-collapse text-xs text-black text-left"
                style={{ borderCollapse: 'collapse', border: '1px solid #000000', width: '100%' }}
              >
                <thead>
                  <tr className="bg-transparent text-black font-bold uppercase text-[11px] sm:text-xs">
                    <th style={{ border: '1px solid #000000', padding: '5px' }} className="text-center w-8">
                      STT
                    </th>
                    <th style={{ border: '1px solid #000000', padding: '5px' }} className="text-center min-w-[180px]">
                      Tên, nhãn hiệu, quy cách, phẩm chất vật tư, dụng cụ, sản phẩm, hàng hóa
                    </th>
                    <th style={{ border: '1px solid #000000', padding: '5px' }} className="text-center w-20">
                      Mã số
                    </th>
                    <th style={{ border: '1px solid #000000', padding: '5px' }} className="text-center w-14">
                      Đơn vị tính
                    </th>
                    <th style={{ border: '1px solid #000000', padding: '0' }} className="text-center" colSpan={2}>
                      <div style={{ borderBottom: '1px solid #000000', padding: '3px' }} className="font-bold">
                        Số lượng
                      </div>
                      <div className="flex w-full">
                        <span style={{ borderRight: '1px solid #000000', padding: '3px', width: '50%' }} className="font-bold">
                          Theo CT
                        </span>
                        <span style={{ padding: '3px', width: '50%' }} className="font-bold">
                          Thực nhập
                        </span>
                      </div>
                    </th>
                    <th style={{ border: '1px solid #000000', padding: '5px' }} className="text-center w-24">
                      Đơn giá
                    </th>
                    <th style={{ border: '1px solid #000000', padding: '5px' }} className="text-center w-28">
                      Thành tiền
                    </th>
                    <th style={{ border: '1px solid #000000', padding: '5px' }} className="text-center w-10 print-hide">
                      Thao tác
                    </th>
                  </tr>
                  {/* Dòng đánh mã cột A B C D 1 2 3 4 */}
                  <tr className="bg-transparent text-center italic text-[11px] font-medium text-black">
                    <th style={{ border: '1px solid #000000', padding: '2px' }} className="text-center">A</th>
                    <th style={{ border: '1px solid #000000', padding: '2px' }} className="text-center">B</th>
                    <th style={{ border: '1px solid #000000', padding: '2px' }} className="text-center">C</th>
                    <th style={{ border: '1px solid #000000', padding: '2px' }} className="text-center">D</th>
                    <th style={{ border: '1px solid #000000', padding: '2px' }} className="text-center w-12">1</th>
                    <th style={{ border: '1px solid #000000', padding: '2px' }} className="text-center w-12">2</th>
                    <th style={{ border: '1px solid #000000', padding: '2px' }} className="text-center">3</th>
                    <th style={{ border: '1px solid #000000', padding: '2px' }} className="text-center">4</th>
                    <th style={{ border: '1px solid #000000', padding: '2px' }} className="text-center print-hide"></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it, idx) => {
                    const lineTotal = Number(it.qtyActual || 0) * Number(it.price || 0);

                    return (
                      <tr key={it.id || idx}>
                        <td style={{ border: '1px solid #000000', padding: '4px' }} className="text-center font-medium">
                          {idx + 1}
                        </td>
                        {/* Tên hàng */}
                        <td style={{ border: '1px solid #000000', padding: '4px' }}>
                          <span className="print-hide-input">
                            <input
                              type="text"
                              value={it.productName}
                              onChange={(e) => handleItemChange(idx, 'productName', e.target.value)}
                              className="w-full font-bold text-black border-b border-dotted border-slate-300 bg-transparent px-1 focus:border-black outline-none"
                            />
                          </span>
                          <span className="print-show-val font-bold">{it.productName}</span>
                        </td>
                        {/* Mã SKU */}
                        <td style={{ border: '1px solid #000000', padding: '4px' }} className="text-center">
                          <span className="print-hide-input">
                            <input
                              type="text"
                              value={it.productSku}
                              onChange={(e) => handleItemChange(idx, 'productSku', e.target.value)}
                              className="w-full text-center font-mono text-xs text-black border-b border-dotted border-slate-300 bg-transparent px-1 focus:border-black outline-none"
                            />
                          </span>
                          <span className="print-show-val font-mono">{it.productSku}</span>
                        </td>
                        {/* ĐVT */}
                        <td style={{ border: '1px solid #000000', padding: '4px' }} className="text-center">
                          <span className="print-hide-input">
                            <input
                              type="text"
                              value={it.unit}
                              onChange={(e) => handleItemChange(idx, 'unit', e.target.value)}
                              className="w-full text-center text-black border-b border-dotted border-slate-300 bg-transparent px-1 focus:border-black outline-none"
                            />
                          </span>
                          <span className="print-show-val">{it.unit}</span>
                        </td>
                        {/* SL Theo chứng từ */}
                        <td style={{ border: '1px solid #000000', padding: '4px' }} className="text-center">
                          <span className="print-hide-input">
                            <input
                              type="number"
                              min={0}
                              value={it.qtyDoc}
                              onChange={(e) => handleItemChange(idx, 'qtyDoc', Number(e.target.value))}
                              className="w-full text-center font-bold text-black border-b border-dotted border-slate-300 bg-transparent px-1 focus:border-black outline-none"
                            />
                          </span>
                          <span className="print-show-val font-bold">{it.qtyDoc}</span>
                        </td>
                        {/* SL Thực nhập */}
                        <td style={{ border: '1px solid #000000', padding: '4px' }} className="text-center">
                          <span className="print-hide-input">
                            <input
                              type="number"
                              min={0}
                              value={it.qtyActual}
                              onChange={(e) => handleItemChange(idx, 'qtyActual', Number(e.target.value))}
                              className="w-full text-center font-bold text-black border-b border-dotted border-slate-300 bg-transparent px-1 focus:border-black outline-none"
                            />
                          </span>
                          <span className="print-show-val font-bold">{it.qtyActual}</span>
                        </td>
                        {/* Đơn giá */}
                        <td style={{ border: '1px solid #000000', padding: '4px' }} className="text-right">
                          <span className="print-hide-input">
                            <input
                              type="number"
                              min={0}
                              value={it.price}
                              onChange={(e) => handleItemChange(idx, 'price', Number(e.target.value))}
                              className="w-full text-right text-black border-b border-dotted border-slate-300 bg-transparent px-1 focus:border-black outline-none"
                            />
                          </span>
                          <span className="print-show-val">{Number(it.price || 0).toLocaleString('vi-VN')}</span>
                        </td>
                        {/* Thành tiền */}
                        <td style={{ border: '1px solid #000000', padding: '4px' }} className="text-right font-bold">
                          {lineTotal.toLocaleString('vi-VN')}
                        </td>
                        {/* Thao tác xóa dòng */}
                        <td style={{ border: '1px solid #000000', padding: '4px' }} className="text-center print-hide">
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(idx)}
                            disabled={items.length <= 1}
                            className="text-slate-400 hover:text-red-600 disabled:opacity-30 transition p-1 cursor-pointer"
                            title="Xóa dòng"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}

                  {/* Dòng Cộng tổng tiền hàng (ĐEN TRẮNG) */}
                  <tr className="bg-transparent font-black text-black">
                    <td style={{ border: '1px solid #000000', padding: '5px' }} className="text-center uppercase tracking-wider font-extrabold">
                      Cộng
                    </td>
                    <td style={{ border: '1px solid #000000', padding: '5px' }} className="text-center font-bold">x</td>
                    <td style={{ border: '1px solid #000000', padding: '5px' }} className="text-center font-bold">x</td>
                    <td style={{ border: '1px solid #000000', padding: '5px' }} className="text-center font-bold">x</td>
                    <td style={{ border: '1px solid #000000', padding: '5px' }} className="text-center font-bold">
                      {items.reduce((sum, it) => sum + Number(it.qtyDoc || 0), 0)}
                    </td>
                    <td style={{ border: '1px solid #000000', padding: '5px' }} className="text-center font-bold">
                      {items.reduce((sum, it) => sum + Number(it.qtyActual || 0), 0)}
                    </td>
                    <td style={{ border: '1px solid #000000', padding: '5px' }} className="text-center font-bold">x</td>
                    <td style={{ border: '1px solid #000000', padding: '5px' }} className="text-right font-black text-sm sm:text-base">
                      {subtotalAmount.toLocaleString('vi-VN')}
                    </td>
                    <td style={{ border: '1px solid #000000', padding: '5px' }} className="text-center print-hide"></td>
                  </tr>

                  {/* Chiết khấu (nếu có) */}
                  {(discountAmount > 0 || discountAmount === 0) && (
                    <tr className="bg-transparent text-black">
                      <td colSpan={7} style={{ border: '1px solid #000000', padding: '4px' }} className="text-right italic font-semibold">
                        Chiết khấu thương mại:
                      </td>
                      <td style={{ border: '1px solid #000000', padding: '4px' }} className="text-right font-semibold">
                        <span className="print-hide-input">
                          <input
                            type="number"
                            min={0}
                            value={discountAmount}
                            onChange={(e) => setDiscountAmount(Number(e.target.value))}
                            className="w-24 text-right border-b border-dotted border-slate-300 bg-transparent px-1 focus:border-black outline-none"
                          />
                        </span>
                        <span className="print-show-val">
                          {discountAmount > 0 ? `-${discountAmount.toLocaleString('vi-VN')}` : '0'}
                        </span>
                      </td>
                      <td style={{ border: '1px solid #000000', padding: '4px' }} className="text-center print-hide"></td>
                    </tr>
                  )}

                  {/* Thuế GTGT VAT (nếu có) */}
                  {(vatAmount > 0 || vatAmount === 0) && (
                    <tr className="bg-transparent text-black">
                      <td colSpan={7} style={{ border: '1px solid #000000', padding: '4px' }} className="text-right italic font-semibold">
                        Thuế GTGT (VAT):
                      </td>
                      <td style={{ border: '1px solid #000000', padding: '4px' }} className="text-right font-semibold">
                        <span className="print-hide-input">
                          <input
                            type="number"
                            min={0}
                            value={vatAmount}
                            onChange={(e) => setVatAmount(Number(e.target.value))}
                            className="w-24 text-right border-b border-dotted border-slate-300 bg-transparent px-1 focus:border-black outline-none"
                          />
                        </span>
                        <span className="print-show-val">
                          {vatAmount > 0 ? `+${vatAmount.toLocaleString('vi-VN')}` : '0'}
                        </span>
                      </td>
                      <td style={{ border: '1px solid #000000', padding: '4px' }} className="text-center print-hide"></td>
                    </tr>
                  )}

                  {/* Tổng tiền thanh toán */}
                  <tr className="bg-transparent font-black text-black">
                    <td colSpan={7} style={{ border: '1px solid #000000', padding: '6px' }} className="text-right uppercase tracking-wider font-extrabold text-xs sm:text-sm">
                      Tổng tiền thanh toán:
                    </td>
                    <td style={{ border: '1px solid #000000', padding: '6px' }} className="text-right font-black text-sm sm:text-base">
                      {totalPayment.toLocaleString('vi-VN')}
                    </td>
                    <td style={{ border: '1px solid #000000', padding: '6px' }} className="text-center print-hide"></td>
                  </tr>
                </tbody>
              </table>

              {/* Nút thêm dòng (Ẩn khi in) */}
              <div className="mt-2 flex justify-start print-hide">
                <button
                  type="button"
                  onClick={handleAddItem}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                >
                  <Plus size={14} /> Thêm dòng hàng hóa
                </button>
              </div>
            </div>

            {/* Tổng số tiền viết bằng chữ & Chứng từ gốc */}
            <div className="space-y-1 text-xs sm:text-sm text-black mb-4">
              <div className="flex items-baseline gap-1.5">
                <span className="shrink-0">
                  - Tổng số tiền (Viết bằng chữ):
                </span>
                <span className="print-hide-input flex-1">
                  <input
                    type="text"
                    value={totalPaymentWords}
                    onChange={(e) => {}}
                    readOnly
                    className="w-full italic font-bold border-b border-dotted border-slate-400 bg-transparent px-1 focus:border-black outline-none text-xs sm:text-sm"
                  />
                </span>
                <span className="print-show-val italic font-bold flex-1">{totalPaymentWords}</span>
              </div>

              <div className="flex items-baseline gap-1.5">
                <span className="shrink-0">- Số chứng từ gốc kèm theo:</span>
                <span className="print-hide-input flex-1">
                  <input
                    type="text"
                    value={attachedDocs}
                    onChange={(e) => setAttachedDocs(e.target.value)}
                    className="w-full border-b border-dotted border-slate-400 bg-transparent px-1 focus:border-black outline-none text-xs sm:text-sm"
                  />
                </span>
                <span className="print-show-val flex-1">{attachedDocs}</span>
              </div>
            </div>

            {/* 4 KHỐI CHỮ KÝ CHUẨN MẪU 01-VT (ĐEN TRẮNG, CÓ THỂ SỬA TÊN) */}
            <div className="text-right text-xs sm:text-sm italic text-black mb-2">
              Ngày {dateDay} tháng {dateMonth} năm {dateYear}
            </div>

            <div className="grid grid-cols-4 gap-2 text-center text-xs text-black page-break-inside-avoid">
              {/* 1. Người lập phiếu */}
              <div className="flex flex-col justify-between min-h-[110px]">
                <div>
                  <p className="font-bold uppercase text-[11px] sm:text-xs">Người lập phiếu</p>
                  <p className="text-[10px] text-slate-600 italic mt-0.5">(Ký, họ tên)</p>
                </div>
                <div className="pt-8">
                  <span className="print-hide-input block">
                    <input
                      type="text"
                      value={creatorSign}
                      onChange={(e) => setCreatorSign(e.target.value)}
                      className="w-full text-center font-bold text-black border-b border-dotted border-slate-400 bg-transparent px-1 focus:border-black outline-none text-xs"
                    />
                  </span>
                  <span className="print-show-val font-bold block">{creatorSign}</span>
                </div>
              </div>

              {/* 2. Người giao hàng */}
              <div className="flex flex-col justify-between min-h-[110px]">
                <div>
                  <p className="font-bold uppercase text-[11px] sm:text-xs">Người giao hàng</p>
                  <p className="text-[10px] text-slate-600 italic mt-0.5">(Ký, họ tên)</p>
                </div>
                <div className="pt-8">
                  <span className="print-hide-input block">
                    <input
                      type="text"
                      value={delivererSign}
                      onChange={(e) => setDelivererSign(e.target.value)}
                      className="w-full text-center font-bold text-black border-b border-dotted border-slate-400 bg-transparent px-1 focus:border-black outline-none text-xs"
                    />
                  </span>
                  <span className="print-show-val font-bold block">{delivererSign}</span>
                </div>
              </div>

              {/* 3. Thủ kho */}
              <div className="flex flex-col justify-between min-h-[110px]">
                <div>
                  <p className="font-bold uppercase text-[11px] sm:text-xs">Thủ kho</p>
                  <p className="text-[10px] text-slate-600 italic mt-0.5">(Ký, họ tên)</p>
                </div>
                <div className="pt-8">
                  <span className="print-hide-input block">
                    <input
                      type="text"
                      value={storekeeperSign}
                      onChange={(e) => setStorekeeperSign(e.target.value)}
                      className="w-full text-center font-bold text-black border-b border-dotted border-slate-400 bg-transparent px-1 focus:border-black outline-none text-xs"
                    />
                  </span>
                  <span className="print-show-val font-bold block">{storekeeperSign}</span>
                </div>
              </div>

              {/* 4. Kế toán trưởng (hoặc bộ phận có nhu cầu nhập) */}
              <div className="flex flex-col justify-between min-h-[110px]">
                <div>
                  <p className="font-bold uppercase text-[11px] sm:text-xs">Kế toán trưởng</p>
                  <p className="text-[10px] text-slate-600 italic mt-0.5">(Hoặc Giám đốc ký)</p>
                </div>
                <div className="pt-8">
                  <span className="print-hide-input block">
                    <input
                      type="text"
                      value={chiefAccountantSign}
                      onChange={(e) => setChiefAccountantSign(e.target.value)}
                      className="w-full text-center font-bold text-black border-b border-dotted border-slate-400 bg-transparent px-1 focus:border-black outline-none text-xs"
                    />
                  </span>
                  <span className="print-show-val font-bold block">{chiefAccountantSign}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Bottom action buttons (Hidden on print) */}
        <div className="modal-no-print flex items-center justify-between border-t border-slate-200 bg-slate-50 px-5 py-3 print:hidden">
          <p className="text-xs text-slate-500 italic">
            * Mẹo: Nhấn vào các dòng có gạch chân để chỉnh sửa nội dung trước khi bấm in.
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 transition cursor-pointer"
            >
              Đóng
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2 text-xs font-bold text-white hover:bg-blue-700 cursor-pointer shadow-md transition"
            >
              <Printer size={16} /> In Phiếu Nhập Kho
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
