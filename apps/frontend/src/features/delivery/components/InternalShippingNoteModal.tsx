import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  Printer,
  Save,
  X,
  Plus,
  Trash2,
  FileCheck,
} from 'lucide-react';
import { numberToWordsVietnamese } from '../../../shared/utils/numberToWords';
import React, { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { Printer, Save, X, Plus, Trash2, FileCheck } from "lucide-react";
import { numberToWordsVietnamese } from "../../../shared/utils/numberToWords";

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
  formNo?: string;
  standardReference?: string;
  senderName: string;
  commandNo: string;
  commandDate?: string;
  commandBy?: string;
  commandReason?: string;
  sourceAddress: string;
  transporterName: string;
  contractNo?: string;
  vehicle: string;
  exporterTaxCode: string;
  dateStr: string;
  symbol: string;
  noteNo: string;
  receiverName: string;
  destinationAddress: string;
  items: ShippingNoteItem[];
  creatorName?: string;
  exportStorekeeper?: string;
  importStorekeeper?: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  initialData?: Partial<InternalShippingNoteData> | any | null;
  onSave?: (data: InternalShippingNoteData) => void;
  setToast?: (toast: { type: 'success' | 'error'; message: string }) => void;
  setToast?: (toast: { type: "success" | "error"; message: string }) => void;
};

const defaultItems: ShippingNoteItem[] = [
  {
    id: '1',
    productName: 'Iphone 15 Promax',
    productCode: 'HH851678',
    unit: 'Cái',
    id: "1",
    productName: "Iphone 15 Promax",
    productCode: "HH851678",
    unit: "Cái",
    quantityExported: 100,
    quantityImported: 100,
    price: 25000000,
  },
];

export default function InternalShippingNoteModal({
  open,
  onClose,
  initialData,
  onSave,
  setToast,
}: Props) {
  // Settings loaded from backend /api/settings
  const [settings, setSettings] = useState<any>(null);

  // Form Fields State
  const [organizationName, setOrganizationName] = useState('Công Ty TNHH Dịch Vụ Kế Toán Thiên Ứng');
  const [organizationAddress, setOrganizationAddress] = useState('Kho Nghệ An (KH007)');
  const [taxCode, setTaxCode] = useState('0101234567');
  const [symbol, setSymbol] = useState('6C26TNB');
  const [noteNo, setNoteNo] = useState('PXC20260907-5052');
  const [organizationName, setOrganizationName] = useState(
    "Công Ty TNHH Dịch Vụ Kế Toán Thiên Ứng",
  );
  const [organizationAddress, setOrganizationAddress] = useState(
    "Kho Nghệ An (KH007)",
  );
  const [taxCode, setTaxCode] = useState("0101234567");
  const [symbol, setSymbol] = useState("6C26TNB");
  const [noteNo, setNoteNo] = useState("PXC20260907-5052");

  // Date parts
  const [dateDay, setDateDay] = useState(String(new Date().getDate()).padStart(2, '0'));
  const [dateMonth, setDateMonth] = useState(String(new Date().getMonth() + 1).padStart(2, '0'));
  const [dateDay, setDateDay] = useState(
    String(new Date().getDate()).padStart(2, "0"),
  );
  const [dateMonth, setDateMonth] = useState(
    String(new Date().getMonth() + 1).padStart(2, "0"),
  );
  const [dateYear, setDateYear] = useState(String(new Date().getFullYear()));

  // Movement & Dispatch order details
  const [commandNo, setCommandNo] = useState('12/LĐĐ-PXC20260907-5052');
  const [commandDay, setCommandDay] = useState(String(new Date().getDate()).padStart(2, '0'));
  const [commandMonth, setCommandMonth] = useState(String(new Date().getMonth() + 1).padStart(2, '0'));
  const [commandYear, setCommandYear] = useState(String(new Date().getFullYear()));
  const [commandBy, setCommandBy] = useState('Ban Giám đốc Công ty');
  const [commandReason, setCommandReason] = useState('Điều chuyển hàng hóa nội bộ phục vụ sản xuất / kinh doanh');
  const [commandNo, setCommandNo] = useState("12/LĐĐ-PXC20260907-5052");
  const [commandDay, setCommandDay] = useState(
    String(new Date().getDate()).padStart(2, "0"),
  );
  const [commandMonth, setCommandMonth] = useState(
    String(new Date().getMonth() + 1).padStart(2, "0"),
  );
  const [commandYear, setCommandYear] = useState(
    String(new Date().getFullYear()),
  );
  const [commandBy, setCommandBy] = useState("Ban Giám đốc Công ty");
  const [commandReason, setCommandReason] = useState(
    "Điều chuyển hàng hóa nội bộ phục vụ sản xuất / kinh doanh",
  );

  const [transporterName, setTransporterName] = useState('Tạ Văn Thanh');
  const [contractNo, setContractNo] = useState('HĐVC-01/2026');
  const [vehicle, setVehicle] = useState('30H-00011');
  const [sourceWarehouse, setSourceWarehouse] = useState('Kho Nghệ An (KH007)');
  const [destinationWarehouse, setDestinationWarehouse] = useState('Kho Chi Nhánh HCM (KH002)');
  const [transporterName, setTransporterName] = useState("Tạ Văn Thanh");
  const [contractNo, setContractNo] = useState("HĐVC-01/2026");
  const [vehicle, setVehicle] = useState("30H-00011");
  const [sourceWarehouse, setSourceWarehouse] = useState("Kho Nghệ An (KH007)");
  const [destinationWarehouse, setDestinationWarehouse] = useState(
    "Kho Chi Nhánh HCM (KH002)",
  );

  // Items table
  const [items, setItems] = useState<ShippingNoteItem[]>(defaultItems);

  // 4 Signatures
  const [creatorName, setCreatorName] = useState('System Administrator');
  const [exportStorekeeper, setExportStorekeeper] = useState('Nguyễn Thị Thúy');
  const [transporterSign, setTransporterSign] = useState('Tạ Văn Thanh');
  const [importStorekeeper, setImportStorekeeper] = useState('Phạm Thị Duyên');
  const [creatorName, setCreatorName] = useState("System Administrator");
  const [exportStorekeeper, setExportStorekeeper] = useState("Nguyễn Thị Thúy");
  const [transporterSign, setTransporterSign] = useState("Tạ Văn Thanh");
  const [importStorekeeper, setImportStorekeeper] = useState("Phạm Thị Duyên");

  // Fetch settings from backend
  useEffect(() => {
    if (!open) return;
    fetch('http://localhost:3000/api/settings')
    fetch("/api/settings")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) {
          setSettings(data);
        }
      })
      .catch((err) => {
        console.error('Không thể tải cài đặt chứng từ:', err);
        console.error("Không thể tải cài đặt chứng từ:", err);
      });
  }, [open]);

  // Sync state when initialData or settings change
  useEffect(() => {
    if (!open) return;

    const s = settings || {};
    const raw = initialData || {};

    // 1. Organization info
    setOrganizationName(raw.senderName || s.companyName || 'Công Ty TNHH Dịch Vụ Kế Toán Thiên Ứng');
    setOrganizationAddress(raw.sourceAddress || raw.sourceWarehouse || s.address || 'Kho Nghệ An (KH007)');
    setTaxCode(raw.exporterTaxCode || s.taxCode || '0101234567');
    setOrganizationName(
      raw.senderName ||
        s.companyName ||
        "Công Ty TNHH Dịch Vụ Kế Toán Thiên Ứng",
    );
    setOrganizationAddress(
      raw.sourceAddress ||
        raw.sourceWarehouse ||
        s.address ||
        "Kho Nghệ An (KH007)",
    );
    setTaxCode(raw.exporterTaxCode || s.taxCode || "0101234567");

    // 2. Codes
    setSymbol(raw.symbol || s.transferSymbol || '6C26TNB');
    const orderNo = raw.noteNo || raw.transferNo || raw.commandNo || 'PXC20260907-5052';
    setSymbol(raw.symbol || s.transferSymbol || "6C26TNB");
    const orderNo =
      raw.noteNo || raw.transferNo || raw.commandNo || "PXC20260907-5052";
    setNoteNo(orderNo);

    // 3. Dates
    let orderDate = new Date();
    if (raw.dateStr) {
      const parts = raw.dateStr.split(/[-/]/);
      if (parts.length === 3) {
        if (parts[0].length === 4) {
          orderDate = new Date(`${parts[0]}-${parts[1]}-${parts[2]}`);
        } else {
          orderDate = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
        }
      }
    } else if (raw.dispatchDate || raw.scheduledDate || raw.createdAt) {
      const d = new Date(raw.dispatchDate || raw.scheduledDate || raw.createdAt);
      const d = new Date(
        raw.dispatchDate || raw.scheduledDate || raw.createdAt,
      );
      if (!Number.isNaN(d.getTime())) orderDate = d;
    }
    const day = String(orderDate.getDate()).padStart(2, '0');
    const month = String(orderDate.getMonth() + 1).padStart(2, '0');
    const day = String(orderDate.getDate()).padStart(2, "0");
    const month = String(orderDate.getMonth() + 1).padStart(2, "0");
    const year = String(orderDate.getFullYear());

    setDateDay(day);
    setDateMonth(month);
    setDateYear(year);

    setCommandDay(day);
    setCommandMonth(month);
    setCommandYear(year);

    // 4. Movement Order / Lệnh điều động
    const defaultCommandNo = raw.commandNo || (orderNo ? `12/LĐĐ-${orderNo}` : s.transferDispatchNo || '12/LĐĐ-PXC20260907-5052');
    const defaultCommandNo =
      raw.commandNo ||
      (orderNo
        ? `12/LĐĐ-${orderNo}`
        : s.transferDispatchNo || "12/LĐĐ-PXC20260907-5052");
    setCommandNo(defaultCommandNo);
    setCommandBy(raw.commandBy || s.transferDispatchBy || 'Ban Giám đốc Công ty');
    setCommandReason(raw.commandReason || s.transferDispatchReason || 'Điều chuyển hàng hóa nội bộ phục vụ sản xuất / kinh doanh');
    setCommandBy(
      raw.commandBy || s.transferDispatchBy || "Ban Giám đốc Công ty",
    );
    setCommandReason(
      raw.commandReason ||
        s.transferDispatchReason ||
        "Điều chuyển hàng hóa nội bộ phục vụ sản xuất / kinh doanh",
    );

    // 5. Transporter & Vehicle
    const driver = raw.transporterName || raw.driverName || s.transferTransporter || 'Tạ Văn Thanh';
    const driver =
      raw.transporterName ||
      raw.driverName ||
      s.transferTransporter ||
      "Tạ Văn Thanh";
    setTransporterName(driver);
    setTransporterSign(driver);
    setContractNo(raw.contractNo || s.transferContractNo || 'HĐVC-01/2026');
    setVehicle(raw.vehicle || raw.vehiclePlate || s.transferVehicle || '30H-00011');
    setContractNo(raw.contractNo || s.transferContractNo || "HĐVC-01/2026");
    setVehicle(
      raw.vehicle || raw.vehiclePlate || s.transferVehicle || "30H-00011",
    );

    // 6. Warehouses
    const srcWh = raw.sourceWarehouse || raw.sourceAddress || 'Kho Nghệ An (KH007)';
    const dstWh = raw.destinationWarehouse || raw.destinationAddress || raw.receiverName || 'Kho Chi Nhánh HCM (KH002)';
    const srcWh =
      raw.sourceWarehouse || raw.sourceAddress || "Kho Nghệ An (KH007)";
    const dstWh =
      raw.destinationWarehouse ||
      raw.destinationAddress ||
      raw.receiverName ||
      "Kho Chi Nhánh HCM (KH002)";
    setSourceWarehouse(srcWh);
    setDestinationWarehouse(dstWh);

    // 7. Signatures
    setCreatorName(raw.creatorName || s.transferCreatorName || s.creatorName || 'System Administrator');
    setExportStorekeeper(raw.exportStorekeeper || s.transferExportStorekeeper || s.storekeeperName || 'Nguyễn Thị Thúy');
    setImportStorekeeper(raw.importStorekeeper || s.transferImportStorekeeper || s.receiverName || 'Phạm Thị Duyên');
    setCreatorName(
      raw.creatorName ||
        s.transferCreatorName ||
        s.creatorName ||
        "System Administrator",
    );
    setExportStorekeeper(
      raw.exportStorekeeper ||
        s.transferExportStorekeeper ||
        s.storekeeperName ||
        "Nguyễn Thị Thúy",
    );
    setImportStorekeeper(
      raw.importStorekeeper ||
        s.transferImportStorekeeper ||
        s.receiverName ||
        "Phạm Thị Duyên",
    );

    // 8. Items
    if (raw.items && raw.items.length > 0) {
      const mappedItems: ShippingNoteItem[] = raw.items.map((it: any, idx: number) => {
        const qtyExp = Number(it.quantityExported ?? it.quantity ?? it.qty ?? 1);
        const qtyImp = Number(it.quantityImported ?? it.quantityExported ?? it.quantity ?? 1);
        const unitPrice = Number(it.price ?? it.unitPrice ?? 25000000);
        return {
          id: String(it.id || idx + 1),
          productName: it.productName || it.name || 'Iphone 15 Promax',
          productCode: it.productCode || it.productSku || it.sku || `HH851678`,
          unit: it.unit || 'Cái',
          quantityExported: qtyExp,
          quantityImported: qtyImp,
          price: unitPrice,
        };
      });
      const mappedItems: ShippingNoteItem[] = raw.items.map(
        (it: any, idx: number) => {
          const qtyExp = Number(
            it.quantityExported ?? it.quantity ?? it.qty ?? 1,
          );
          const qtyImp = Number(
            it.quantityImported ?? it.quantityExported ?? it.quantity ?? 1,
          );
          const unitPrice = Number(it.price ?? it.unitPrice ?? 25000000);
          return {
            id: String(it.id || idx + 1),
            productName: it.productName || it.name || "Iphone 15 Promax",
            productCode:
              it.productCode || it.productSku || it.sku || `HH851678`,
            unit: it.unit || "Cái",
            quantityExported: qtyExp,
            quantityImported: qtyImp,
            price: unitPrice,
          };
        },
      );
      setItems(mappedItems);
    }
  }, [open, initialData, settings]);

  // Handle item changes
  const handleItemChange = (index: number, field: keyof ShippingNoteItem, value: any) => {
  const handleItemChange = (
    index: number,
    field: keyof ShippingNoteItem,
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
        productName: 'Sản phẩm mới',
        productCode: 'SKU-NEW',
        unit: 'Cái',
        productName: "Sản phẩm mới",
        productCode: "SKU-NEW",
        unit: "Cái",
        quantityExported: 1,
        quantityImported: 1,
        price: 100000,
      },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) {
      if (setToast) setToast({ type: 'error', message: 'Phiếu phải có ít nhất 1 mặt hàng!' });
      if (setToast)
        setToast({
          type: "error",
          message: "Phiếu phải có ít nhất 1 mặt hàng!",
        });
      return;
    }
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  // Computations
  const totalQuantityExported = useMemo(
    () => items.reduce((sum, it) => sum + (Number(it.quantityExported) || 0), 0),
    [items]
    () =>
      items.reduce((sum, it) => sum + (Number(it.quantityExported) || 0), 0),
    [items],
  );
  const totalQuantityImported = useMemo(
    () => items.reduce((sum, it) => sum + (Number(it.quantityImported) || 0), 0),
    [items]
    () =>
      items.reduce((sum, it) => sum + (Number(it.quantityImported) || 0), 0),
    [items],
  );
  const totalAmount = useMemo(
    () => items.reduce((sum, it) => sum + (Number(it.quantityExported) || 0) * (Number(it.price) || 0), 0),
    [items]
    () =>
      items.reduce(
        (sum, it) =>
          sum + (Number(it.quantityExported) || 0) * (Number(it.price) || 0),
        0,
      ),
    [items],
  );
  const totalAmountWords = useMemo(() => numberToWordsVietnamese(totalAmount), [totalAmount]);
  const totalAmountWords = useMemo(
    () => numberToWordsVietnamese(totalAmount),
    [totalAmount],
  );

  const formatMoney = (val: number) => {
    return new Intl.NumberFormat('vi-VN').format(val || 0);
    return new Intl.NumberFormat("vi-VN").format(val || 0);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleSave = () => {
    const data: InternalShippingNoteData = {
      senderName: organizationName,
      commandNo,
      commandDate: `${commandDay}/${commandMonth}/${commandYear}`,
      commandBy,
      commandReason,
      sourceAddress: sourceWarehouse,
      transporterName,
      contractNo,
      vehicle,
      exporterTaxCode: taxCode,
      dateStr: `${dateDay}/${dateMonth}/${dateYear}`,
      symbol,
      noteNo,
      receiverName: destinationWarehouse,
      destinationAddress: destinationWarehouse,
      items,
      creatorName,
      exportStorekeeper,
      importStorekeeper,
    };
    if (onSave) onSave(data);
    if (setToast) setToast({ type: 'success', message: 'Đã lưu thông tin phiếu xuất kho kiêm vận chuyển nội bộ!' });
    if (setToast)
      setToast({
        type: "success",
        message: "Đã lưu thông tin phiếu xuất kho kiêm vận chuyển nội bộ!",
      });
    onClose();
  };

  if (!open) return null;

  return createPortal(
    <div className="internal-shipping-modal fixed inset-0 z-[99999] flex items-center justify-center bg-slate-950/80 p-2 sm:p-5 backdrop-blur-xs overflow-y-auto print:static print:block print:inset-auto print:p-0 print:m-0 print:bg-white print:overflow-visible">
      {/* Container Dialog */}
      <div className="flex w-full max-w-5xl max-h-[96vh] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl print:block print:max-h-none print:h-auto print:shadow-none print:w-full print:rounded-none print:border-none print:m-0 print:p-0">
        {/* Top Control Bar (Hidden on print) */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-cyan-700 px-5 py-3 text-white print:hidden">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-white/20 p-2 text-white">
              <FileCheck className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold uppercase tracking-wide">
                Phiếu xuất kho kiêm vận chuyển nội bộ
              </h2>
              <p className="text-xs text-cyan-100">
                Xem trước & In mẫu phiếu điều chuyển kho hàng hóa
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 rounded-xl bg-white px-4 py-2 text-xs font-black text-cyan-800 shadow-sm transition hover:bg-cyan-50 cursor-pointer"
            >
              <Printer className="h-4 w-4 text-cyan-700" />
              In Phiếu (Ctrl+P)
            </button>

            <button
              type="button"
              onClick={onClose}
              className="rounded-xl p-1.5 text-white/80 transition hover:bg-white/20 hover:text-white cursor-pointer"
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
              .internal-shipping-modal {
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
              .internal-shipping-modal > div {
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
              .internal-shipping-modal .overflow-y-auto {
                overflow: visible !important;
                padding: 0 !important;
                margin: 0 !important;
                background: transparent !important;
              }
              .print-paper {
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

          {/* Paper Sheet (A4 ratio) - Matches exactly User Image 2 */}
          <div
            className="print-paper mx-auto w-full max-w-[860px] rounded-lg border border-slate-300 bg-white p-8 sm:p-12 shadow-md text-slate-900 leading-normal"
            style={{ fontFamily: "'Times New Roman', Times, serif" }}
          >
            {/* Organization Info & Symbol/No */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 text-sm">
              {/* Left Column: Tên tổ chức, cá nhân, địa chỉ, MST */}
              <div className="sm:col-span-8 space-y-1.5">
                <div className="flex items-baseline gap-1.5">
                  <span className="font-semibold text-slate-900 whitespace-nowrap">Tên tổ chức, cá nhân:</span>
                  <span className="font-semibold text-slate-900 whitespace-nowrap">
                    Tên tổ chức, cá nhân:
                  </span>
                  <span className="print-hide-input flex-1">
                    <input
                      type="text"
                      value={organizationName}
                      onChange={(e) => setOrganizationName(e.target.value)}
                      className="w-full font-bold text-slate-900 border-b border-dotted border-slate-400 bg-transparent px-1 focus:border-cyan-600 outline-none text-sm"
                    />
                  </span>
                  <span className="print-show-val font-bold text-slate-900 border-b border-dotted border-slate-400 flex-1 px-1">
                    {organizationName}
                  </span>
                </div>

                <div className="flex items-baseline gap-1.5">
                  <span className="font-semibold text-slate-900 whitespace-nowrap">Địa chỉ:</span>
                  <span className="font-semibold text-slate-900 whitespace-nowrap">
                    Địa chỉ:
                  </span>
                  <span className="print-hide-input flex-1">
                    <input
                      type="text"
                      value={organizationAddress}
                      onChange={(e) => setOrganizationAddress(e.target.value)}
                      className="w-full text-slate-800 border-b border-dotted border-slate-400 bg-transparent px-1 focus:border-cyan-600 outline-none text-sm"
                    />
                  </span>
                  <span className="print-show-val text-slate-800 border-b border-dotted border-slate-400 flex-1 px-1">
                    {organizationAddress}
                  </span>
                </div>

                <div className="flex items-baseline gap-1.5">
                  <span className="font-semibold text-slate-900 whitespace-nowrap">Mã số thuế:</span>
                  <span className="font-semibold text-slate-900 whitespace-nowrap">
                    Mã số thuế:
                  </span>
                  <span className="print-hide-input flex-1">
                    <input
                      type="text"
                      value={taxCode}
                      onChange={(e) => setTaxCode(e.target.value)}
                      className="w-full font-bold tracking-wider text-slate-900 border-b border-dotted border-slate-400 bg-transparent px-1 focus:border-cyan-600 outline-none text-sm"
                    />
                  </span>
                  <span className="print-show-val font-bold tracking-wider text-slate-900 border-b border-dotted border-slate-400 flex-1 px-1">
                    {taxCode}
                  </span>
                </div>
              </div>

              {/* Right Column: Ký hiệu & Số */}
              <div className="sm:col-span-4 flex flex-col justify-end space-y-1.5 text-sm sm:pl-4">
                <div className="flex items-baseline justify-start sm:justify-end gap-1.5">
                  <span className="font-semibold text-slate-900 whitespace-nowrap">Ký hiệu:</span>
                  <span className="font-semibold text-slate-900 whitespace-nowrap">
                    Ký hiệu:
                  </span>
                  <span className="print-hide-input">
                    <input
                      type="text"
                      value={symbol}
                      onChange={(e) => setSymbol(e.target.value)}
                      className="w-32 font-bold text-slate-900 border-b border-dotted border-slate-400 bg-transparent px-1 text-center focus:border-cyan-600 outline-none text-sm"
                    />
                  </span>
                  <span className="print-show-val font-bold text-slate-900 border-b border-dotted border-slate-400 w-32 text-center px-1">
                    {symbol}
                  </span>
                </div>

                <div className="flex items-baseline justify-start sm:justify-end gap-1.5">
                  <span className="font-semibold text-slate-900 whitespace-nowrap">Số:</span>
                  <span className="font-semibold text-slate-900 whitespace-nowrap">
                    Số:
                  </span>
                  <span className="print-hide-input">
                    <input
                      type="text"
                      value={noteNo}
                      onChange={(e) => setNoteNo(e.target.value)}
                      className="w-36 font-extrabold text-cyan-900 border-b border-dotted border-slate-400 bg-transparent px-1 text-center focus:border-cyan-600 outline-none text-sm"
                    />
                  </span>
                  <span className="print-show-val font-extrabold text-slate-950 border-b border-dotted border-slate-400 w-36 text-center px-1">
                    {noteNo}
                  </span>
                </div>
              </div>
            </div>

            {/* Document Main Title */}
            <div className="mt-8 text-center space-y-1.5">
              <h1 className="text-xl sm:text-2xl font-black tracking-wider uppercase text-slate-950">
                PHIẾU XUẤT KHO KIÊM VẬN CHUYỂN NỘI BỘ
              </h1>
              <div className="text-sm italic text-slate-800 flex items-center justify-center gap-1 pt-0.5">
                <span>Ngày</span>
                <span className="print-hide-input">
                  <input
                    type="text"
                    value={dateDay}
                    onChange={(e) => setDateDay(e.target.value)}
                    className="w-8 text-center not-italic font-bold border-b border-dotted border-slate-400 bg-transparent outline-none"
                  />
                </span>
                <span className="print-show-val not-italic font-bold px-1 border-b border-dotted border-slate-400 min-w-[24px] text-center">
                  {dateDay}
                </span>

                <span>tháng</span>
                <span className="print-hide-input">
                  <input
                    type="text"
                    value={dateMonth}
                    onChange={(e) => setDateMonth(e.target.value)}
                    className="w-8 text-center not-italic font-bold border-b border-dotted border-slate-400 bg-transparent outline-none"
                  />
                </span>
                <span className="print-show-val not-italic font-bold px-1 border-b border-dotted border-slate-400 min-w-[24px] text-center">
                  {dateMonth}
                </span>

                <span>năm</span>
                <span className="print-hide-input">
                  <input
                    type="text"
                    value={dateYear}
                    onChange={(e) => setDateYear(e.target.value)}
                    className="w-14 text-center not-italic font-bold border-b border-dotted border-slate-400 bg-transparent outline-none"
                  />
                </span>
                <span className="print-show-val not-italic font-bold px-1 border-b border-dotted border-slate-400 min-w-[40px] text-center">
                  {dateYear}
                </span>
              </div>
            </div>

            {/* Movement Details (Căn cứ lệnh điều động số... của... về việc...) */}
            <div className="mt-6 space-y-2 text-sm">
              <div className="flex flex-wrap items-baseline gap-1.5">
                <span className="font-semibold text-slate-900 whitespace-nowrap">Căn cứ lệnh điều động số:</span>
                <span className="font-semibold text-slate-900 whitespace-nowrap">
                  Căn cứ lệnh điều động số:
                </span>
                <span className="print-hide-input flex-1 min-w-[140px]">
                  <input
                    type="text"
                    value={commandNo}
                    onChange={(e) => setCommandNo(e.target.value)}
                    className="w-full font-bold text-slate-900 border-b border-dotted border-slate-400 bg-transparent px-1 focus:border-cyan-600 outline-none"
                  />
                </span>
                <span className="print-show-val font-bold text-slate-900 border-b border-dotted border-slate-400 px-1 min-w-[140px]">
                  {commandNo}
                </span>

                <span className="text-slate-900 whitespace-nowrap ml-3">Ngày</span>
                <span className="text-slate-900 whitespace-nowrap ml-3">
                  Ngày
                </span>
                <span className="print-hide-input">
                  <input
                    type="text"
                    value={commandDay}
                    onChange={(e) => setCommandDay(e.target.value)}
                    className="w-8 text-center border-b border-dotted border-slate-400 bg-transparent outline-none font-bold"
                  />
                </span>
                <span className="print-show-val font-bold border-b border-dotted border-slate-400 px-1 min-w-[24px] text-center">
                  {commandDay}
                </span>

                <span className="text-slate-900 whitespace-nowrap">tháng</span>
                <span className="print-hide-input">
                  <input
                    type="text"
                    value={commandMonth}
                    onChange={(e) => setCommandMonth(e.target.value)}
                    className="w-8 text-center border-b border-dotted border-slate-400 bg-transparent outline-none font-bold"
                  />
                </span>
                <span className="print-show-val font-bold border-b border-dotted border-slate-400 px-1 min-w-[24px] text-center">
                  {commandMonth}
                </span>

                <span className="text-slate-900 whitespace-nowrap">năm</span>
                <span className="print-hide-input">
                  <input
                    type="text"
                    value={commandYear}
                    onChange={(e) => setCommandYear(e.target.value)}
                    className="w-14 text-center border-b border-dotted border-slate-400 bg-transparent outline-none font-bold"
                  />
                </span>
                <span className="print-show-val font-bold border-b border-dotted border-slate-400 px-1 min-w-[40px] text-center">
                  {commandYear}
                </span>
              </div>

              <div className="flex flex-wrap items-baseline gap-1.5">
                <span className="font-semibold text-slate-900 whitespace-nowrap">của</span>
                <span className="font-semibold text-slate-900 whitespace-nowrap">
                  của
                </span>
                <span className="print-hide-input min-w-[180px]">
                  <input
                    type="text"
                    value={commandBy}
                    onChange={(e) => setCommandBy(e.target.value)}
                    className="w-full font-semibold text-slate-900 border-b border-dotted border-slate-400 bg-transparent px-1 focus:border-cyan-600 outline-none"
                  />
                </span>
                <span className="print-show-val font-semibold text-slate-900 border-b border-dotted border-slate-400 px-1 min-w-[180px]">
                  {commandBy}
                </span>

                <span className="font-semibold text-slate-900 whitespace-nowrap ml-3">về việc</span>
                <span className="font-semibold text-slate-900 whitespace-nowrap ml-3">
                  về việc
                </span>
                <span className="print-hide-input flex-1">
                  <input
                    type="text"
                    value={commandReason}
                    onChange={(e) => setCommandReason(e.target.value)}
                    className="w-full text-slate-900 border-b border-dotted border-slate-400 bg-transparent px-1 focus:border-cyan-600 outline-none"
                  />
                </span>
                <span className="print-show-val text-slate-900 border-b border-dotted border-slate-400 flex-1 px-1">
                  {commandReason}
                </span>
              </div>

              <div className="flex flex-wrap items-baseline gap-1.5">
                <span className="font-semibold text-slate-900 whitespace-nowrap">Họ tên người vận chuyển:</span>
                <span className="font-semibold text-slate-900 whitespace-nowrap">
                  Họ tên người vận chuyển:
                </span>
                <span className="print-hide-input flex-1 min-w-[180px]">
                  <input
                    type="text"
                    value={transporterName}
                    onChange={(e) => {
                      setTransporterName(e.target.value);
                      setTransporterSign(e.target.value);
                    }}
                    className="w-full font-bold text-slate-900 border-b border-dotted border-slate-400 bg-transparent px-1 focus:border-cyan-600 outline-none"
                  />
                </span>
                <span className="print-show-val font-bold text-slate-900 border-b border-dotted border-slate-400 px-1 flex-1 min-w-[180px]">
                  {transporterName}
                </span>

                <span className="font-semibold text-slate-900 whitespace-nowrap ml-3">Hợp đồng số:</span>
                <span className="font-semibold text-slate-900 whitespace-nowrap ml-3">
                  Hợp đồng số:
                </span>
                <span className="print-hide-input">
                  <input
                    type="text"
                    value={contractNo}
                    onChange={(e) => setContractNo(e.target.value)}
                    className="w-44 font-semibold text-slate-900 border-b border-dotted border-slate-400 bg-transparent px-1 focus:border-cyan-600 outline-none text-center"
                  />
                </span>
                <span className="print-show-val font-semibold text-slate-900 border-b border-dotted border-slate-400 w-44 text-center px-1">
                  {contractNo}
                </span>
              </div>

              <div className="flex items-baseline gap-1.5">
                <span className="font-semibold text-slate-900 whitespace-nowrap">Phương tiện vận chuyển:</span>
                <span className="font-semibold text-slate-900 whitespace-nowrap">
                  Phương tiện vận chuyển:
                </span>
                <span className="print-hide-input flex-1">
                  <input
                    type="text"
                    value={vehicle}
                    onChange={(e) => setVehicle(e.target.value)}
                    className="w-full font-semibold text-slate-900 border-b border-dotted border-slate-400 bg-transparent px-1 focus:border-cyan-600 outline-none"
                  />
                </span>
                <span className="print-show-val font-semibold text-slate-900 border-b border-dotted border-slate-400 flex-1 px-1">
                  {vehicle}
                </span>
              </div>

              <div className="flex items-baseline gap-1.5">
                <span className="font-semibold text-slate-900 whitespace-nowrap">Xuất tại kho:</span>
                <span className="font-semibold text-slate-900 whitespace-nowrap">
                  Xuất tại kho:
                </span>
                <span className="print-hide-input flex-1">
                  <input
                    type="text"
                    value={sourceWarehouse}
                    onChange={(e) => setSourceWarehouse(e.target.value)}
                    className="w-full font-bold text-slate-900 border-b border-dotted border-slate-400 bg-transparent px-1 focus:border-cyan-600 outline-none"
                  />
                </span>
                <span className="print-show-val font-bold text-slate-900 border-b border-dotted border-slate-400 flex-1 px-1">
                  {sourceWarehouse}
                </span>
              </div>

              <div className="flex items-baseline gap-1.5">
                <span className="font-semibold text-slate-900 whitespace-nowrap">Nhập tại kho:</span>
                <span className="font-semibold text-slate-900 whitespace-nowrap">
                  Nhập tại kho:
                </span>
                <span className="print-hide-input flex-1">
                  <input
                    type="text"
                    value={destinationWarehouse}
                    onChange={(e) => setDestinationWarehouse(e.target.value)}
                    className="w-full font-bold text-slate-900 border-b border-dotted border-slate-400 bg-transparent px-1 focus:border-cyan-600 outline-none"
                  />
                </span>
                <span className="print-show-val font-bold text-slate-900 border-b border-dotted border-slate-400 flex-1 px-1">
                  {destinationWarehouse}
                </span>
              </div>
            </div>

            {/* Table of Goods (Exact columns from reference photo) */}
            <div className="mt-6 overflow-x-auto">
              <table className="w-full border-collapse border border-black text-center text-xs sm:text-sm">
                <thead>
                  <tr className="border-b border-black font-bold text-slate-950">
                    <th rowSpan={2} className="border border-black px-2 py-2 w-10">
                    <th
                      rowSpan={2}
                      className="border border-black px-2 py-2 w-10"
                    >
                      STT
                    </th>
                    <th rowSpan={2} className="border border-black px-3 py-2 text-center min-w-[220px]">
                      Tên nhãn hiệu, quy cách, phẩm chất vật tư (sản phẩm, hàng hóa)
                    <th
                      rowSpan={2}
                      className="border border-black px-3 py-2 text-center min-w-[220px]"
                    >
                      Tên nhãn hiệu, quy cách, phẩm chất vật tư (sản phẩm, hàng
                      hóa)
                    </th>
                    <th rowSpan={2} className="border border-black px-2 py-2 w-24">
                    <th
                      rowSpan={2}
                      className="border border-black px-2 py-2 w-24"
                    >
                      Mã số
                    </th>
                    <th rowSpan={2} className="border border-black px-2 py-2 w-18">
                    <th
                      rowSpan={2}
                      className="border border-black px-2 py-2 w-18"
                    >
                      Đơn vị tính
                    </th>
                    <th colSpan={2} className="border border-black px-2 py-1.5">
                      Số lượng
                    </th>
                    <th rowSpan={2} className="border border-black px-2 py-2 w-24">
                    <th
                      rowSpan={2}
                      className="border border-black px-2 py-2 w-24"
                    >
                      Đơn giá
                    </th>
                    <th rowSpan={2} className="border border-black px-3 py-2 w-28">
                    <th
                      rowSpan={2}
                      className="border border-black px-3 py-2 w-28"
                    >
                      Thành tiền
                    </th>
                    <th rowSpan={2} className="border border-black px-1 py-1 w-8 print-hide">
                    <th
                      rowSpan={2}
                      className="border border-black px-1 py-1 w-8 print-hide"
                    >
                      Thao tác
                    </th>
                  </tr>
                  <tr className="border-b border-black font-bold text-slate-950">
                    <th className="border border-black px-2 py-1.5 w-18">
                      Thực xuất
                    </th>
                    <th className="border border-black px-2 py-1.5 w-18">
                      Thực nhập
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {items.map((item, idx) => {
                    const itemAmount = (Number(item.quantityExported) || 0) * (Number(item.price) || 0);
                    const itemAmount =
                      (Number(item.quantityExported) || 0) *
                      (Number(item.price) || 0);
                    return (
                      <tr key={item.id || idx} className="border-b border-black">
                      <tr
                        key={item.id || idx}
                        className="border-b border-black"
                      >
                        <td className="border border-black px-1 py-1.5 font-medium">
                          {idx + 1}
                        </td>
                        <td className="border border-black px-2 py-1.5 text-left font-bold text-slate-950">
                          <span className="print-hide-input w-full">
                            <input
                              type="text"
                              value={item.productName}
                              onChange={(e) => handleItemChange(idx, 'productName', e.target.value)}
                              onChange={(e) =>
                                handleItemChange(
                                  idx,
                                  "productName",
                                  e.target.value,
                                )
                              }
                              className="w-full font-bold text-slate-900 bg-transparent outline-none"
                            />
                          </span>
                          <span className="print-show-val font-bold text-slate-950">
                            {item.productName}
                          </span>
                        </td>
                        <td className="border border-black px-1 py-1.5 font-medium text-slate-800">
                          <span className="print-hide-input w-full">
                            <input
                              type="text"
                              value={item.productCode}
                              onChange={(e) => handleItemChange(idx, 'productCode', e.target.value)}
                              onChange={(e) =>
                                handleItemChange(
                                  idx,
                                  "productCode",
                                  e.target.value,
                                )
                              }
                              className="w-full text-center font-medium bg-transparent outline-none"
                            />
                          </span>
                          <span className="print-show-val font-medium text-slate-800">
                            {item.productCode}
                          </span>
                        </td>
                        <td className="border border-black px-1 py-1.5 text-slate-800">
                          <span className="print-hide-input w-full">
                            <input
                              type="text"
                              value={item.unit}
                              onChange={(e) => handleItemChange(idx, 'unit', e.target.value)}
                              onChange={(e) =>
                                handleItemChange(idx, "unit", e.target.value)
                              }
                              className="w-full text-center bg-transparent outline-none"
                            />
                          </span>
                          <span className="print-show-val text-slate-800">
                            {item.unit}
                          </span>
                        </td>
                        <td className="border border-black px-1 py-1.5 font-bold text-slate-900">
                          <span className="print-hide-input w-full">
                            <input
                              type="number"
                              value={item.quantityExported}
                              onChange={(e) => handleItemChange(idx, 'quantityExported', Number(e.target.value))}
                              onChange={(e) =>
                                handleItemChange(
                                  idx,
                                  "quantityExported",
                                  Number(e.target.value),
                                )
                              }
                              className="w-full text-center font-bold bg-transparent outline-none"
                            />
                          </span>
                          <span className="print-show-val font-bold text-slate-900">
                            {item.quantityExported}
                          </span>
                        </td>
                        <td className="border border-black px-1 py-1.5 font-bold text-slate-900">
                          <span className="print-hide-input w-full">
                            <input
                              type="number"
                              value={item.quantityImported}
                              onChange={(e) => handleItemChange(idx, 'quantityImported', Number(e.target.value))}
                              onChange={(e) =>
                                handleItemChange(
                                  idx,
                                  "quantityImported",
                                  Number(e.target.value),
                                )
                              }
                              className="w-full text-center font-bold bg-transparent outline-none"
                            />
                          </span>
                          <span className="print-show-val font-bold text-slate-900">
                            {item.quantityImported}
                          </span>
                        </td>
                        <td className="border border-black px-2 py-1.5 text-right font-medium">
                          <span className="print-hide-input w-full">
                            <input
                              type="number"
                              value={item.price}
                              onChange={(e) => handleItemChange(idx, 'price', Number(e.target.value))}
                              onChange={(e) =>
                                handleItemChange(
                                  idx,
                                  "price",
                                  Number(e.target.value),
                                )
                              }
                              className="w-full text-right bg-transparent outline-none"
                            />
                          </span>
                          <span className="print-show-val text-slate-900">
                            {formatMoney(item.price)}
                          </span>
                        </td>
                        <td className="border border-black px-2 py-1.5 text-right font-bold text-slate-950">
                          {formatMoney(itemAmount)}
                        </td>
                        <td className="border border-black px-1 py-1 print-hide text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(idx)}
                            className="rounded p-1 text-red-500 hover:bg-red-50 transition cursor-pointer"
                            title="Xóa dòng"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}

                  {/* Empty rows if items list is short */}
                  {items.length < 3 &&
                    Array.from({ length: 3 - items.length }).map((_, emptyIdx) => (
                      <tr key={`empty-${emptyIdx}`} className="border-b border-black h-7">
                        <td className="border border-black"></td>
                        <td className="border border-black"></td>
                        <td className="border border-black"></td>
                        <td className="border border-black"></td>
                        <td className="border border-black"></td>
                        <td className="border border-black"></td>
                        <td className="border border-black"></td>
                        <td className="border border-black"></td>
                        <td className="border border-black print-hide"></td>
                      </tr>
                    ))}
                    Array.from({ length: 3 - items.length }).map(
                      (_, emptyIdx) => (
                        <tr
                          key={`empty-${emptyIdx}`}
                          className="border-b border-black h-7"
                        >
                          <td className="border border-black"></td>
                          <td className="border border-black"></td>
                          <td className="border border-black"></td>
                          <td className="border border-black"></td>
                          <td className="border border-black"></td>
                          <td className="border border-black"></td>
                          <td className="border border-black"></td>
                          <td className="border border-black"></td>
                          <td className="border border-black print-hide"></td>
                        </tr>
                      ),
                    )}

                  {/* Total Row */}
                  <tr className="border-t-2 border-black font-bold text-slate-950">
                    <td colSpan={4} className="border border-black px-3 py-2 text-right uppercase tracking-wider">
                    <td
                      colSpan={4}
                      className="border border-black px-3 py-2 text-right uppercase tracking-wider"
                    >
                      TỔNG CỘNG:
                    </td>
                    <td className="border border-black px-1 py-2 font-black text-center">
                      {totalQuantityExported}
                    </td>
                    <td className="border border-black px-1 py-2 font-black text-center">
                      {totalQuantityImported}
                    </td>
                    <td className="border border-black"></td>
                    <td className="border border-black px-2 py-2 text-right font-black text-base">
                      {formatMoney(totalAmount)}
                    </td>
                    <td className="border border-black print-hide"></td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Button to add product line (preview mode only) */}
            <div className="mt-2 flex justify-start print-hide">
              <button
                type="button"
                onClick={handleAddItem}
                className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-cyan-600 bg-cyan-50 px-3 py-1.5 text-xs font-bold text-cyan-700 hover:bg-cyan-100 transition cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                Thêm dòng hàng hóa
              </button>
            </div>

            {/* Total Amount in Words */}
            <div className="mt-3 text-sm italic text-slate-800">
              Tổng số tiền (viết bằng chữ): <span className="font-bold text-slate-950 not-italic">{totalAmountWords}</span>
              Tổng số tiền (viết bằng chữ):{" "}
              <span className="font-bold text-slate-950 not-italic">
                {totalAmountWords}
              </span>
            </div>

            {/* 4 Signatures Section (Exact 4 columns from Image 2) */}
            <div className="mt-8 grid grid-cols-4 gap-2 text-center text-sm">
              {/* 1. Người lập */}
              <div className="flex flex-col items-center justify-between min-h-[130px]">
                <div>
                  <div className="font-bold text-slate-950">Người lập</div>
                  <div className="text-xs italic text-slate-600">(ký, ghi rõ họ tên)</div>
                  <div className="text-xs italic text-slate-600">
                    (ký, ghi rõ họ tên)
                  </div>
                </div>
                <div className="w-full pt-14">
                  <span className="print-hide-input w-full">
                    <input
                      type="text"
                      value={creatorName}
                      onChange={(e) => setCreatorName(e.target.value)}
                      className="w-full text-center font-bold text-slate-900 border-b border-dotted border-slate-300 bg-transparent outline-none"
                    />
                  </span>
                  <span className="print-show-val font-bold text-slate-950">
                    {creatorName}
                  </span>
                </div>
              </div>

              {/* 2. Thủ kho xuất */}
              <div className="flex flex-col items-center justify-between min-h-[130px]">
                <div>
                  <div className="font-bold text-slate-950">Thủ kho xuất</div>
                  <div className="text-xs italic text-slate-600">(ký, ghi rõ họ tên)</div>
                  <div className="text-xs italic text-slate-600">
                    (ký, ghi rõ họ tên)
                  </div>
                </div>
                <div className="w-full pt-14">
                  <span className="print-hide-input w-full">
                    <input
                      type="text"
                      value={exportStorekeeper}
                      onChange={(e) => setExportStorekeeper(e.target.value)}
                      className="w-full text-center font-bold text-slate-900 border-b border-dotted border-slate-300 bg-transparent outline-none"
                    />
                  </span>
                  <span className="print-show-val font-bold text-slate-950">
                    {exportStorekeeper}
                  </span>
                </div>
              </div>

              {/* 3. Người vận chuyển */}
              <div className="flex flex-col items-center justify-between min-h-[130px]">
                <div>
                  <div className="font-bold text-slate-950">Người vận chuyển</div>
                  <div className="text-xs italic text-slate-600">(ký, ghi rõ họ tên)</div>
                  <div className="font-bold text-slate-950">
                    Người vận chuyển
                  </div>
                  <div className="text-xs italic text-slate-600">
                    (ký, ghi rõ họ tên)
                  </div>
                </div>
                <div className="w-full pt-14">
                  <span className="print-hide-input w-full">
                    <input
                      type="text"
                      value={transporterSign}
                      onChange={(e) => setTransporterSign(e.target.value)}
                      className="w-full text-center font-bold text-slate-900 border-b border-dotted border-slate-300 bg-transparent outline-none"
                    />
                  </span>
                  <span className="print-show-val font-bold text-slate-950">
                    {transporterSign}
                  </span>
                </div>
              </div>

              {/* 4. Thủ kho nhập */}
              <div className="flex flex-col items-center justify-between min-h-[130px]">
                <div>
                  <div className="font-bold text-slate-950">Thủ kho nhập</div>
                  <div className="text-xs italic text-slate-600">(ký, ghi rõ họ tên)</div>
                  <div className="text-xs italic text-slate-600">
                    (ký, ghi rõ họ tên)
                  </div>
                </div>
                <div className="w-full pt-14">
                  <span className="print-hide-input w-full">
                    <input
                      type="text"
                      value={importStorekeeper}
                      onChange={(e) => setImportStorekeeper(e.target.value)}
                      className="w-full text-center font-bold text-slate-900 border-b border-dotted border-slate-300 bg-transparent outline-none"
                    />
                  </span>
                  <span className="print-show-val font-bold text-slate-950">
                    {importStorekeeper}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Bottom Actions Bar (Hidden on print) */}
        <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-6 py-3.5 print:hidden">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
            <span>Dữ liệu mẫu in được đồng bộ tự động từ Cấu hình hệ thống (Settings).</span>
            <span>
              Dữ liệu mẫu in được đồng bộ tự động từ Cấu hình hệ thống
              (Settings).
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-100 cursor-pointer"
            >
              Hủy / Đóng
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-2 rounded-xl border-2 border-cyan-600 bg-cyan-50 px-5 py-2 text-xs font-black text-cyan-700 transition hover:bg-cyan-100 cursor-pointer"
            >
              <Printer className="h-4 w-4" />
              In Phiếu (Ctrl+P)
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-5 py-2 text-xs font-black text-white shadow-md transition hover:bg-cyan-700 active:scale-95 cursor-pointer"
            >
              <Save className="h-4 w-4" />
              Lưu phiếu
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
    document.body,
  );
}
