import React, { useEffect, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { Printer, X, Plus, Trash2 } from "lucide-react";
import type { OutboundOrder } from "../Outbound";
import { numberToWordsVietnamese } from "../../../shared/utils/numberToWords";

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

interface PrintItem {
  id: string;
  productName: string;
  productSku: string;
  unit: string;
  qtyReq: number;
  qtyActual: number;
  price: number;
  lossAmount?: number;
  totalDisposalAmount?: number;
}

const API_BASE_URL = "/api";

export default function OutboundPrintModal({
  isOpen,
  onClose,
  order,
  warehouses = [],
  isDisposal = false,
  featureMode,
}: OutboundPrintModalProps) {
  // Settings from backend
  const [settings, setSettings] = useState<any>(null);

  // 1. Company & Header State
  const [companyName, setCompanyName] = useState(
    "Công Ty TNHH Dịch Vụ Kế Toán Thiên Ứng",
  );
  const [department, setDepartment] = useState("Bộ phận: Bán hàng");
  const [taxCode, setTaxCode] = useState("0101234567");
  const [templateCode, setTemplateCode] = useState("Mẫu số 02-VT");
  const [templateStandard, setTemplateStandard] = useState(
    "Ban hành theo Thông tư số 200/2014/TT-BTC ngày 22/12/2014 của Bộ Tài chính",
  );

  // 2. Voucher info
  const [voucherTitle, setVoucherTitle] = useState("PHIẾU XUẤT KHO");
  const [dateDay, setDateDay] = useState(
    String(new Date().getDate()).padStart(2, "0"),
  );
  const [dateMonth, setDateMonth] = useState(
    String(new Date().getMonth() + 1).padStart(2, "0"),
  );
  const [dateYear, setDateYear] = useState(String(new Date().getFullYear()));
  const [orderNo, setOrderNo] = useState("");
  const [debitAccount, setDebitAccount] = useState("632");
  const [creditAccount, setCreditAccount] = useState("156");

  // 3. Receiver & Warehouse
  const [receiverName, setReceiverName] = useState("");
  const [receiverAddress, setReceiverAddress] = useState("");
  const [reason, setReason] = useState("");
  const [warehouseName, setWarehouseName] = useState("");
  const [warehouseLocation, setWarehouseLocation] = useState("");

  // 4. Items Table
  const [items, setItems] = useState<PrintItem[]>([]);

  // 5. Attached Docs
  const [attachedDocs, setAttachedDocs] = useState("");

  // 6. Signatures
  const [creatorSign, setCreatorSign] = useState("");
  const [receiverSign, setReceiverSign] = useState("");
  const [storekeeperSign, setStorekeeperSign] = useState("");
  const [chiefAccountantSign, setChiefAccountantSign] = useState("");
  const [directorSign, setDirectorSign] = useState("");

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

  // Sync state whenever order or settings load
  useEffect(() => {
    if (!isOpen || !order) return;

    const s = settings || {};

    // 1. Company
    setCompanyName(s.companyName || "Công Ty TNHH Dịch Vụ Kế Toán Thiên Ứng");
    setDepartment(s.department || "Bộ phận: Bán hàng");
    setTaxCode(s.taxCode || "0101234567");
    setTemplateCode("Mẫu số 02-VT");
    setTemplateStandard(
      s.templateStandard ||
        "Ban hành theo Thông tư số 200/2014/TT-BTC ngày 22/12/2014 của Bộ Tài chính",
    );

    // 2. Title
    let defaultTitle = isDisposal ? "PHIẾU XUẤT HỦY KHO" : "PHIẾU XUẤT KHO";
    if (featureMode === "retail") defaultTitle = "PHIẾU XUẤT BÁN LẺ";
    if (featureMode === "sales-order") defaultTitle = "PHIẾU XUẤT ĐƠN ĐẶT HÀNG";
    if (featureMode === "quote") defaultTitle = "BẢNG BÁO GIÁ HÀNG HÓA";
    setVoucherTitle(defaultTitle);

    // Date
    const orderDateObj = order.orderDate
      ? new Date(order.orderDate)
      : new Date();
    setDateDay(String(orderDateObj.getDate()).padStart(2, "0"));
    setDateMonth(String(orderDateObj.getMonth() + 1).padStart(2, "0"));
    setDateYear(String(orderDateObj.getFullYear()));

    setOrderNo(order.orderNo || "");
    setDebitAccount(s.debitAccount || "632");
    setCreditAccount(s.creditAccount || "156");

    // 3. Receiver & Warehouse
    setReceiverName(order.customer || s.receiverName || "Phạm Thị Duyên");
    setReceiverAddress(
      order.customerAddress || "Công ty TNHH Thương mại Toàn Phát",
    );
    setReason(
      order.description ||
        (isDisposal
          ? "Xuất hủy hàng hỏng / hết hạn sử dụng"
          : "Xuất bán hàng hóa theo đơn"),
    );

    const whCode = order.branchCode || order.warehouseCode;
    const foundWh = warehouses.find(
      (w) => w.code === whCode || w.name === whCode || w.id === whCode,
    );
    setWarehouseName(
      foundWh ? `[${foundWh.code}] ${foundWh.name}` : whCode || "Kho Thanh Trì",
    );
    setWarehouseLocation(foundWh?.address || s.address || "Hà Nội, Việt Nam");

    // 4. Items
    if (order.details && order.details.length > 0) {
      const mapped: PrintItem[] = order.details.map((d: any, i: number) => ({
        id: String(d.id || i + 1),
        productName: d.productName || `Sản phẩm ${i + 1}`,
        productSku: d.productSku || "-",
        unit: d.unit || "Bộ",
        qtyReq: Number(d.qty || d.requestedQty || 1),
        qtyActual: Number(d.actualQty || d.qty || 1),
        price: Number(d.price || d.unitPrice || 0),
        lossAmount:
          (d as any).lossAmount !== undefined
            ? Number((d as any).lossAmount)
            : undefined,
        totalDisposalAmount:
          (d as any).totalDisposalAmount !== undefined
            ? Number((d as any).totalDisposalAmount)
            : undefined,
      }));
      setItems(mapped);
    } else {
      setItems([
        {
          id: "1",
          productName: "Hàng hóa mẫu",
          productSku: "SP001",
          unit: "Cái",
          qtyReq: 1,
          qtyActual: 1,
          price: 100000,
        },
      ]);
    }

    // 5. Attached Docs
    const dateFormatted = `ngày ${String(orderDateObj.getDate()).padStart(2, "0")}/${String(orderDateObj.getMonth() + 1).padStart(2, "0")}/${orderDateObj.getFullYear()}`;
    setAttachedDocs(
      `01 Hóa đơn GTGT số ${order.orderNo?.slice(-7) || "0000025"} ${dateFormatted}`,
    );

    // 6. Signatures
    setCreatorSign(order.employeeName || s.creatorName || "Vũ Hữu Dũng");
    setReceiverSign(order.customer || s.receiverName || "Phạm Thị Duyên");
    setStorekeeperSign(s.storekeeperName || "Nguyễn Thị Thúy");
    setChiefAccountantSign(s.chiefAccountantName || "Trần Thị Hồng Mơ");
    setDirectorSign(s.directorName || "Nguyễn Thị Thanh Xuyên");
  }, [isOpen, order, settings, isDisposal, featureMode, warehouses]);

  // Keyboard shortcut Ctrl+P / Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "p") {
        e.preventDefault();
        window.print();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Items manipulation
  const handleItemChange = (
    index: number,
    field: keyof PrintItem,
    value: any,
  ) => {
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
        productName: "Hàng hóa mới",
        productSku: "SKU-NEW",
        unit: "Cái",
        qtyReq: 1,
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
  const totalAmount = useMemo(() => {
    return items.reduce((sum, item) => {
      const lineTotal = Number(item.qtyActual || 0) * Number(item.price || 0);
      return (
        sum +
        (isDisposal && item.lossAmount !== undefined
          ? Number(item.lossAmount)
          : lineTotal)
      );
    }, 0);
  }, [items, isDisposal]);

  const totalDisposalSum = useMemo(() => {
    if (!isDisposal) return 0;
    return items.reduce((sum, item) => {
      const lineTotal = Number(item.qtyActual || 0) * Number(item.price || 0);
      const val =
        item.totalDisposalAmount !== undefined
          ? Number(item.totalDisposalAmount)
          : Number(item.price || 0) + lineTotal;
      return sum + val;
    }, 0);
  }, [items, isDisposal]);

  const totalAmountWords = useMemo(() => {
    return numberToWordsVietnamese(totalAmount);
  }, [totalAmount]);

  if (!isOpen || !order) return null;

  return createPortal(
    <div className="outbound-print-modal fixed inset-0 z-[99999] flex items-center justify-center bg-black/50 p-2 sm:p-5 backdrop-blur-xs overflow-y-auto print:static print:block print:inset-auto print:p-0 print:m-0 print:bg-white print:overflow-visible">
      {/* Container Dialog */}
      <div className="flex w-full max-w-5xl max-h-[96vh] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl border border-slate-200 print:block print:max-h-none print:h-auto print:shadow-none print:w-full print:rounded-none print:border-none print:m-0 print:p-0">
        {/* Top Control Bar (Hidden on print - Light Neutral, No Black, No Cyan) */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-5 py-3 text-slate-800 print:hidden">
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-700 font-bold text-xs border border-blue-200">
              02
            </span>
            <div>
              <h2 className="text-sm sm:text-base font-black uppercase tracking-wide text-slate-900">
                Xem trước & Chỉnh sửa Phiếu xuất kho (Mẫu số 02-VT)
              </h2>
              <p className="text-xs text-slate-500">
                Có thể chỉnh sửa trực tiếp nội dung trước khi in • Bản in đen
                trắng chuẩn A4
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
              .outbound-print-modal {
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
              .outbound-print-modal > div {
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
              .outbound-print-modal .overflow-y-auto {
                overflow: visible !important;
                padding: 0 !important;
                margin: 0 !important;
                background: transparent !important;
              }
              .outbound-print-paper {
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
            className="outbound-print-paper mx-auto w-full max-w-[880px] rounded-lg border border-slate-300 bg-white p-6 sm:p-10 shadow-md text-black leading-normal"
            style={{ fontFamily: "'Times New Roman', Times, serif" }}
          >
            {/* Header 2 bên: Đơn vị & Mẫu số 02-VT */}
            <div className="flex justify-between items-start mb-2 text-xs sm:text-sm gap-4">
              <div className="flex-1 space-y-1">
                <div className="flex items-start gap-1">
                  <span className="font-semibold text-slate-800 whitespace-nowrap pt-0.5">
                    Đơn vị:
                  </span>
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
                  <span className="font-semibold text-slate-800 whitespace-nowrap">
                    Bộ phận:
                  </span>
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
                  <span className="font-semibold text-slate-800 whitespace-nowrap">
                    Mã số thuế:
                  </span>
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

              {/* Góc phải: Mẫu số 02-VT & Thông tư */}
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
                <span className="print-show-val font-semibold">
                  {dateMonth}
                </span>

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
                      value={orderNo}
                      onChange={(e) => setOrderNo(e.target.value)}
                      className="w-36 font-bold border-b border-dotted border-slate-400 bg-transparent px-1 focus:border-black outline-none text-xs sm:text-sm"
                    />
                  </span>
                  <span className="print-show-val font-bold">{orderNo}</span>
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
                  <span className="print-show-val font-bold">
                    {debitAccount}
                  </span>
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
                  <span className="print-show-val font-bold">
                    {creditAccount}
                  </span>
                </div>
              </div>
            </div>

            {/* Thông tin người nhận, lý do, kho */}
            <div className="space-y-1.5 text-xs sm:text-sm text-black mb-3 border-t border-black pt-2">
              <div className="grid grid-cols-12 gap-2">
                <div className="col-span-12 sm:col-span-6 flex items-baseline gap-1.5">
                  <span className="shrink-0 whitespace-nowrap">
                    {isDisposal
                      ? "Người thực hiện / Hội đồng:"
                      : "Họ và tên người nhận hàng:"}
                  </span>
                  <span className="print-hide-input flex-1">
                    <input
                      type="text"
                      value={receiverName}
                      onChange={(e) => setReceiverName(e.target.value)}
                      className="w-full font-bold border-b border-dotted border-slate-400 bg-transparent px-1 focus:border-black outline-none text-xs sm:text-sm"
                    />
                  </span>
                  <span className="print-show-val font-bold flex-1">
                    {receiverName}
                  </span>
                </div>

                <div className="col-span-12 sm:col-span-6 flex items-baseline gap-1.5">
                  <span className="shrink-0 whitespace-nowrap">
                    Địa chỉ (bộ phận):
                  </span>
                  <span className="print-hide-input flex-1">
                    <input
                      type="text"
                      value={receiverAddress}
                      onChange={(e) => setReceiverAddress(e.target.value)}
                      className="w-full border-b border-dotted border-slate-400 bg-transparent px-1 focus:border-black outline-none text-xs sm:text-sm"
                    />
                  </span>
                  <span className="print-show-val flex-1">
                    {receiverAddress}
                  </span>
                </div>
              </div>

              <div className="flex items-baseline gap-1.5">
                <span className="shrink-0 whitespace-nowrap">
                  {isDisposal ? "Lý do xuất hủy:" : "Lý do xuất kho:"}
                </span>
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

              <div className="grid grid-cols-12 gap-2">
                <div className="col-span-12 sm:col-span-6 flex items-baseline gap-1.5">
                  <span className="shrink-0 whitespace-nowrap">
                    Xuất tại kho (ngăn lô):
                  </span>
                  <span className="print-hide-input flex-1">
                    <input
                      type="text"
                      value={warehouseName}
                      onChange={(e) => setWarehouseName(e.target.value)}
                      className="w-full font-bold border-b border-dotted border-slate-400 bg-transparent px-1 focus:border-black outline-none text-xs sm:text-sm"
                    />
                  </span>
                  <span className="print-show-val font-bold flex-1">
                    {warehouseName}
                  </span>
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
                  <span className="print-show-val flex-1">
                    {warehouseLocation}
                  </span>
                </div>
              </div>
            </div>

            {/* BẢNG HÀNG HÓA MẪU 02-VT (ĐEN TRẮNG, KHÔNG MÀU MÈ) */}
            <div className="overflow-x-auto w-full mb-3">
              <table
                className="w-full border-collapse text-xs text-black text-left"
                style={{
                  borderCollapse: "collapse",
                  border: "1px solid #000000",
                  width: "100%",
                }}
              >
                <thead>
                  <tr className="bg-transparent text-black font-bold uppercase text-[11px] sm:text-xs">
                    <th
                      style={{ border: "1px solid #000000", padding: "5px" }}
                      className="text-center w-8"
                    >
                      STT
                    </th>
                    <th
                      style={{ border: "1px solid #000000", padding: "5px" }}
                      className="text-center min-w-[180px]"
                    >
                      Tên, nhãn hiệu, quy cách, phẩm chất vật tư, dụng cụ, sản
                      phẩm, hàng hóa
                    </th>
                    <th
                      style={{ border: "1px solid #000000", padding: "5px" }}
                      className="text-center w-20"
                    >
                      Mã số
                    </th>
                    <th
                      style={{ border: "1px solid #000000", padding: "5px" }}
                      className="text-center w-14"
                    >
                      Đơn vị tính
                    </th>
                    <th
                      style={{ border: "1px solid #000000", padding: "0" }}
                      className="text-center"
                      colSpan={2}
                    >
                      <div
                        style={{
                          borderBottom: "1px solid #000000",
                          padding: "3px",
                        }}
                        className="font-bold"
                      >
                        Số lượng
                      </div>
                      <div className="flex w-full">
                        <span
                          style={{
                            borderRight: "1px solid #000000",
                            padding: "3px",
                            width: "50%",
                          }}
                          className="font-bold"
                        >
                          Yêu cầu
                        </span>
                        <span
                          style={{ padding: "3px", width: "50%" }}
                          className="font-bold"
                        >
                          Thực xuất
                        </span>
                      </div>
                    </th>
                    <th
                      style={{ border: "1px solid #000000", padding: "5px" }}
                      className="text-center w-24"
                    >
                      {isDisposal ? "Giá nhập" : "Đơn giá"}
                    </th>
                    <th
                      style={{ border: "1px solid #000000", padding: "5px" }}
                      className="text-center w-28"
                    >
                      {isDisposal ? "Thất thoát" : "Thành tiền"}
                    </th>
                    {isDisposal && (
                      <th
                        style={{ border: "1px solid #000000", padding: "5px" }}
                        className="text-center w-28"
                      >
                        Tổng
                      </th>
                    )}
                    <th
                      style={{ border: "1px solid #000000", padding: "5px" }}
                      className="text-center w-10 print-hide"
                    >
                      Thao tác
                    </th>
                  </tr>
                  {/* Dòng đánh mã cột A B C D 1 2 3 4 */}
                  <tr className="bg-transparent text-center italic text-[11px] font-medium text-black">
                    <th
                      style={{ border: "1px solid #000000", padding: "2px" }}
                      className="text-center"
                    >
                      A
                    </th>
                    <th
                      style={{ border: "1px solid #000000", padding: "2px" }}
                      className="text-center"
                    >
                      B
                    </th>
                    <th
                      style={{ border: "1px solid #000000", padding: "2px" }}
                      className="text-center"
                    >
                      C
                    </th>
                    <th
                      style={{ border: "1px solid #000000", padding: "2px" }}
                      className="text-center"
                    >
                      D
                    </th>
                    <th
                      style={{ border: "1px solid #000000", padding: "2px" }}
                      className="text-center w-12"
                    >
                      1
                    </th>
                    <th
                      style={{ border: "1px solid #000000", padding: "2px" }}
                      className="text-center w-12"
                    >
                      2
                    </th>
                    <th
                      style={{ border: "1px solid #000000", padding: "2px" }}
                      className="text-center"
                    >
                      3
                    </th>
                    <th
                      style={{ border: "1px solid #000000", padding: "2px" }}
                      className="text-center"
                    >
                      4
                    </th>
                    {isDisposal && (
                      <th
                        style={{ border: "1px solid #000000", padding: "2px" }}
                        className="text-center"
                      >
                        5
                      </th>
                    )}
                    <th
                      style={{ border: "1px solid #000000", padding: "2px" }}
                      className="text-center print-hide"
                    ></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it, idx) => {
                    const lineTotal =
                      Number(it.qtyActual || 0) * Number(it.price || 0);
                    const lossVal =
                      it.lossAmount !== undefined
                        ? Number(it.lossAmount)
                        : lineTotal;
                    const totalVal =
                      it.totalDisposalAmount !== undefined
                        ? Number(it.totalDisposalAmount)
                        : Number(it.price || 0) + lineTotal;

                    return (
                      <tr key={it.id || idx}>
                        <td
                          style={{
                            border: "1px solid #000000",
                            padding: "4px",
                          }}
                          className="text-center font-medium"
                        >
                          {idx + 1}
                        </td>
                        {/* Tên hàng */}
                        <td
                          style={{
                            border: "1px solid #000000",
                            padding: "4px",
                          }}
                        >
                          <span className="print-hide-input">
                            <input
                              type="text"
                              value={it.productName}
                              onChange={(e) =>
                                handleItemChange(
                                  idx,
                                  "productName",
                                  e.target.value,
                                )
                              }
                              className="w-full font-bold text-black border-b border-dotted border-slate-300 bg-transparent px-1 focus:border-black outline-none"
                            />
                          </span>
                          <span className="print-show-val font-bold">
                            {it.productName}
                          </span>
                        </td>
                        {/* Mã SKU */}
                        <td
                          style={{
                            border: "1px solid #000000",
                            padding: "4px",
                          }}
                          className="text-center"
                        >
                          <span className="print-hide-input">
                            <input
                              type="text"
                              value={it.productSku}
                              onChange={(e) =>
                                handleItemChange(
                                  idx,
                                  "productSku",
                                  e.target.value,
                                )
                              }
                              className="w-full text-center font-mono text-xs text-black border-b border-dotted border-slate-300 bg-transparent px-1 focus:border-black outline-none"
                            />
                          </span>
                          <span className="print-show-val font-mono">
                            {it.productSku}
                          </span>
                        </td>
                        {/* ĐVT */}
                        <td
                          style={{
                            border: "1px solid #000000",
                            padding: "4px",
                          }}
                          className="text-center"
                        >
                          <span className="print-hide-input">
                            <input
                              type="text"
                              value={it.unit}
                              onChange={(e) =>
                                handleItemChange(idx, "unit", e.target.value)
                              }
                              className="w-full text-center text-black border-b border-dotted border-slate-300 bg-transparent px-1 focus:border-black outline-none"
                            />
                          </span>
                          <span className="print-show-val">{it.unit}</span>
                        </td>
                        {/* SL Yêu cầu */}
                        <td
                          style={{
                            border: "1px solid #000000",
                            padding: "4px",
                          }}
                          className="text-center"
                        >
                          <span className="print-hide-input">
                            <input
                              type="number"
                              min={0}
                              value={it.qtyReq}
                              onChange={(e) =>
                                handleItemChange(
                                  idx,
                                  "qtyReq",
                                  Number(e.target.value),
                                )
                              }
                              className="w-full text-center font-bold text-black border-b border-dotted border-slate-300 bg-transparent px-1 focus:border-black outline-none"
                            />
                          </span>
                          <span className="print-show-val font-bold">
                            {it.qtyReq}
                          </span>
                        </td>
                        {/* SL Thực xuất */}
                        <td
                          style={{
                            border: "1px solid #000000",
                            padding: "4px",
                          }}
                          className="text-center"
                        >
                          <span className="print-hide-input">
                            <input
                              type="number"
                              min={0}
                              value={it.qtyActual}
                              onChange={(e) =>
                                handleItemChange(
                                  idx,
                                  "qtyActual",
                                  Number(e.target.value),
                                )
                              }
                              className="w-full text-center font-bold text-black border-b border-dotted border-slate-300 bg-transparent px-1 focus:border-black outline-none"
                            />
                          </span>
                          <span className="print-show-val font-bold">
                            {it.qtyActual}
                          </span>
                        </td>
                        {/* Đơn giá */}
                        <td
                          style={{
                            border: "1px solid #000000",
                            padding: "4px",
                          }}
                          className="text-right"
                        >
                          <span className="print-hide-input">
                            <input
                              type="number"
                              min={0}
                              value={it.price}
                              onChange={(e) =>
                                handleItemChange(
                                  idx,
                                  "price",
                                  Number(e.target.value),
                                )
                              }
                              className="w-full text-right text-black border-b border-dotted border-slate-300 bg-transparent px-1 focus:border-black outline-none"
                            />
                          </span>
                          <span className="print-show-val">
                            {Number(it.price || 0).toLocaleString("vi-VN")}
                          </span>
                        </td>
                        {/* Thành tiền / Thất thoát */}
                        <td
                          style={{
                            border: "1px solid #000000",
                            padding: "4px",
                          }}
                          className="text-right font-bold"
                        >
                          {lossVal.toLocaleString("vi-VN")}
                        </td>
                        {/* Cột Tổng (xuất hủy) */}
                        {isDisposal && (
                          <td
                            style={{
                              border: "1px solid #000000",
                              padding: "4px",
                            }}
                            className="text-right font-bold"
                          >
                            {totalVal.toLocaleString("vi-VN")}
                          </td>
                        )}
                        {/* Thao tác xóa dòng */}
                        <td
                          style={{
                            border: "1px solid #000000",
                            padding: "4px",
                          }}
                          className="text-center print-hide"
                        >
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

                  {/* Dòng Cộng tổng (ĐEN TRẮNG, KHÔNG MÀU MÈ) */}
                  <tr className="bg-transparent font-black text-black">
                    <td
                      style={{ border: "1px solid #000000", padding: "5px" }}
                      className="text-center uppercase tracking-wider font-extrabold"
                    >
                      Cộng
                    </td>
                    <td
                      style={{ border: "1px solid #000000", padding: "5px" }}
                      className="text-center font-bold"
                    >
                      x
                    </td>
                    <td
                      style={{ border: "1px solid #000000", padding: "5px" }}
                      className="text-center font-bold"
                    >
                      x
                    </td>
                    <td
                      style={{ border: "1px solid #000000", padding: "5px" }}
                      className="text-center font-bold"
                    >
                      x
                    </td>
                    <td
                      style={{ border: "1px solid #000000", padding: "5px" }}
                      className="text-center font-bold"
                    >
                      {items.reduce(
                        (sum, it) => sum + Number(it.qtyReq || 0),
                        0,
                      )}
                    </td>
                    <td
                      style={{ border: "1px solid #000000", padding: "5px" }}
                      className="text-center font-bold"
                    >
                      {items.reduce(
                        (sum, it) => sum + Number(it.qtyActual || 0),
                        0,
                      )}
                    </td>
                    <td
                      style={{ border: "1px solid #000000", padding: "5px" }}
                      className="text-center font-bold"
                    >
                      x
                    </td>
                    <td
                      style={{ border: "1px solid #000000", padding: "5px" }}
                      className="text-right font-black text-sm sm:text-base"
                    >
                      {totalAmount.toLocaleString("vi-VN")}
                    </td>
                    {isDisposal && (
                      <td
                        style={{ border: "1px solid #000000", padding: "5px" }}
                        className="text-right font-black text-sm sm:text-base"
                      >
                        {totalDisposalSum.toLocaleString("vi-VN")}
                      </td>
                    )}
                    <td
                      style={{ border: "1px solid #000000", padding: "5px" }}
                      className="text-center print-hide"
                    ></td>
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
                  {isDisposal ? "Tổng thất thoát" : "Tổng số tiền"}{" "}
                  <span className="italic">(Viết bằng chữ)</span>:
                </span>
                <span className="print-hide-input flex-1">
                  <input
                    type="text"
                    value={totalAmountWords}
                    onChange={(e) => {}}
                    readOnly
                    className="w-full italic font-bold border-b border-dotted border-slate-400 bg-transparent px-1 focus:border-black outline-none text-xs sm:text-sm"
                  />
                </span>
                <span className="print-show-val italic font-bold flex-1">
                  {totalAmountWords}
                </span>
              </div>

              <div className="flex items-baseline gap-1.5">
                <span className="shrink-0">Số chứng từ gốc kèm theo:</span>
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

            {/* 5 KHỐI CHỮ KÝ CHUẨN MẪU 02-VT (ĐEN TRẮNG, CÓ THỂ SỬA TÊN) */}
            <div className="text-right text-xs sm:text-sm italic text-black mb-2">
              Ngày {dateDay} tháng {dateMonth} năm {dateYear}
            </div>

            <div className="grid grid-cols-5 gap-2 text-center text-xs text-black page-break-inside-avoid">
              {/* 1. Người lập phiếu */}
              <div className="flex flex-col justify-between min-h-[110px]">
                <div>
                  <p className="font-bold uppercase text-[11px] sm:text-xs">
                    Người lập phiếu
                  </p>
                  <p className="text-[10px] text-slate-600 italic mt-0.5">
                    (Ký, họ tên)
                  </p>
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
                  <span className="print-show-val font-bold block">
                    {creatorSign}
                  </span>
                </div>
              </div>

              {/* 2. Người nhận hàng */}
              <div className="flex flex-col justify-between min-h-[110px]">
                <div>
                  <p className="font-bold uppercase text-[11px] sm:text-xs">
                    Người nhận hàng
                  </p>
                  <p className="text-[10px] text-slate-600 italic mt-0.5">
                    (Ký, họ tên)
                  </p>
                </div>
                <div className="pt-8">
                  <span className="print-hide-input block">
                    <input
                      type="text"
                      value={receiverSign}
                      onChange={(e) => setReceiverSign(e.target.value)}
                      className="w-full text-center font-bold text-black border-b border-dotted border-slate-400 bg-transparent px-1 focus:border-black outline-none text-xs"
                    />
                  </span>
                  <span className="print-show-val font-bold block">
                    {receiverSign}
                  </span>
                </div>
              </div>

              {/* 3. Thủ kho */}
              <div className="flex flex-col justify-between min-h-[110px]">
                <div>
                  <p className="font-bold uppercase text-[11px] sm:text-xs">
                    Thủ kho
                  </p>
                  <p className="text-[10px] text-slate-600 italic mt-0.5">
                    (Ký, họ tên)
                  </p>
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
                  <span className="print-show-val font-bold block">
                    {storekeeperSign}
                  </span>
                </div>
              </div>

              {/* 4. Kế toán trưởng */}
              <div className="flex flex-col justify-between min-h-[110px]">
                <div>
                  <p className="font-bold uppercase text-[11px] sm:text-xs">
                    Kế toán trưởng
                  </p>
                  <p className="text-[10px] text-slate-600 italic mt-0.5">
                    (Ký, họ tên)
                  </p>
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
                  <span className="print-show-val font-bold block">
                    {chiefAccountantSign}
                  </span>
                </div>
              </div>

              {/* 5. Giám đốc */}
              <div className="flex flex-col justify-between min-h-[110px]">
                <div>
                  <p className="font-bold uppercase text-[11px] sm:text-xs">
                    Giám đốc
                  </p>
                  <p className="text-[10px] text-slate-600 italic mt-0.5">
                    (Ký, họ tên, đóng dấu)
                  </p>
                </div>
                <div className="pt-8">
                  <span className="print-hide-input block">
                    <input
                      type="text"
                      value={directorSign}
                      onChange={(e) => setDirectorSign(e.target.value)}
                      className="w-full text-center font-bold text-black border-b border-dotted border-slate-400 bg-transparent px-1 focus:border-black outline-none text-xs"
                    />
                  </span>
                  <span className="print-show-val font-bold block">
                    {directorSign}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Bottom action buttons (Hidden on print) */}
        <div className="modal-no-print flex items-center justify-between border-t border-slate-200 bg-slate-50 px-5 py-3 print:hidden">
          <p className="text-xs text-slate-500 italic">
            * Mẹo: Nhấn vào các dòng có gạch chân để chỉnh sửa nội dung trước
            khi bấm in.
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
              <Printer size={16} /> In Phiếu Xuất Kho
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
