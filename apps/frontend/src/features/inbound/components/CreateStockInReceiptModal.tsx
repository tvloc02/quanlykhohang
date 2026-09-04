import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Calendar, Building2, CheckCircle2, Printer } from 'lucide-react';
const API_BASE_URL = 'http://localhost:3000/api';

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
  };
}

function parseMoney(value: string | number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatMoney(value: number) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value || 0);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('vi-VN').format(value || 0);
}

function formatDate(value?: string | number | Date | null) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

export function numberToVietnameseWords(amount: number): string {
  if (!amount || Number.isNaN(amount) || amount === 0) return 'Không đồng';
  
  const units = ['', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];
  
  function readBlock(num: number, showHundreds: boolean): string {
    let hundred = Math.floor(num / 100);
    let ten = Math.floor((num % 100) / 10);
    let unit = num % 10;
    let str = '';

    if (hundred > 0 || showHundreds) {
      str += units[hundred] + ' trăm ';
    }

    if (ten > 1) {
      str += units[ten] + ' mươi ';
      if (unit === 1) str += 'mốt';
      else if (unit === 5) str += 'lăm';
      else if (unit > 0) str += units[unit];
    } else if (ten === 1) {
      str += 'mười ';
      if (unit === 5) str += 'lăm';
      else if (unit > 0) str += units[unit];
    } else {
      if (showHundreds && unit > 0) str += 'lẻ ';
      if (unit > 0) str += units[unit];
    }

    return str.trim();
  }

  const bigUnits = ['', 'nghìn', 'triệu', 'tỷ', 'nghìn tỷ', 'triệu tỷ'];
  let strNum = Math.floor(Math.abs(amount)).toString();
  let blocks: number[] = [];

  while (strNum.length > 0) {
    blocks.push(parseInt(strNum.slice(-3), 10));
    strNum = strNum.slice(0, -3);
  }

  let parts: string[] = [];
  for (let i = blocks.length - 1; i >= 0; i--) {
    let b = blocks[i];
    if (b > 0) {
      let bStr = readBlock(b, i < blocks.length - 1);
      let uStr = bigUnits[i];
      parts.push(`${bStr} ${uStr}`.trim());
    }
  }

  let result = parts.join(' ').trim();
  if (!result) return 'Không đồng';
  
  result = result.charAt(0).toUpperCase() + result.slice(1) + ' đồng';
  return result.replace(/\s+/g, ' ');
}

export function CreateStockInReceiptModal({
  isOpen,
  onClose,
  onSuccess,
  sourceStockInOrderId,
  sourcePurchaseOrderId,
  mode = 'create',
  receiptId,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  sourceStockInOrderId?: string | null;
  sourcePurchaseOrderId?: string | null;
  mode?: 'create' | 'edit' | 'view';
  receiptId?: string | null;
}) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  
  const [sourceData, setSourceData] = useState<any>(null);
  const warehouses = React.useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('warehouses') || '[]');
    } catch {
      return [];
    }
  }, []);
  
  const [receiptCode, setReceiptCode] = useState('');
  const [receiptDate, setReceiptDate] = useState(new Date().toISOString().slice(0, 16));
  const [description, setDescription] = useState('');
  const [delivererName, setDelivererName] = useState('');
  const [delivererPhone, setDelivererPhone] = useState('');
  const [invoiceNo, setInvoiceNo] = useState('');
  const [invoiceDate, setInvoiceDate] = useState('');
  const [accountDebit, setAccountDebit] = useState('156');
  const [accountCredit, setAccountCredit] = useState('331');
  const [status, setStatus] = useState<'DRAFT' | 'ASSIGNED' | 'CHECKED' | 'POSTED'>('DRAFT');
  const [items, setItems] = useState<any[]>([]);

  // Bóc tách Tên tài xế & SĐT riêng biệt từ Ghi chú
  useEffect(() => {
    if (sourceData) {
      const rawNote = sourceData.orderDescription || sourceData.description || '';
      const driverMatch = rawNote.match(/(?:Tài xế|Người giao|Lái xe):\s*([^|;\n]+)/i);
      const phoneMatch = rawNote.match(/(?:SĐT|SDT|Điện thoại|Phone):\s*([0-9\s+]+)/i);

      if (driverMatch && driverMatch[1]) {
        setDelivererName(driverMatch[1].trim());
      } else if (sourceData.supplier?.contactPerson) {
        setDelivererName(sourceData.supplier.contactPerson);
      } else if (sourceData.supplier?.name) {
        setDelivererName(sourceData.supplier.name);
      }

      if (phoneMatch && phoneMatch[1]) {
        setDelivererPhone(phoneMatch[1].trim());
      } else if (sourceData.supplier?.phone) {
        setDelivererPhone(sourceData.supplier.phone);
      } else if (sourceData.creatorPhone) {
        setDelivererPhone(sourceData.creatorPhone);
      }
    }
  }, [sourceData]);

  useEffect(() => {
    if (!isOpen) {
      setSourceData(null);
      setReceiptCode('');
      setReceiptDate(new Date().toISOString().slice(0, 16));
      setDescription('');
      setStatus('DRAFT');
      setDelivererName('');
      setDelivererPhone('');
      setItems([]);
      return;
    }

    const load = async () => {
      setLoading(true);
      try {
        let data: any = null;
        if (receiptId && (mode === 'edit' || mode === 'view')) {
          const res = await fetch(`${API_BASE_URL}/inbound/stock-in-receipts/${receiptId}`, { headers: authHeaders() });
          if (res.ok) {
            data = await res.json();
            setSourceData(data);
            setReceiptCode(data.receiptCode || '');
            if (data.receiptDate) setReceiptDate(new Date(data.receiptDate).toISOString().slice(0, 16));
            setDescription(data.description || '');
            setStatus(data.status || 'DRAFT');
            
            const firstWhCode = warehouses[0]?.code || 'KH001';
            const mappedItems = (data.details || []).map((d: any) => ({
              id: d.id,
              productId: d.product?.id,
              product: d.product,
              warehouseCode: (d.warehouseCode && d.warehouseCode !== 'KHO-NVL') ? d.warehouseCode : firstWhCode,
              expectedQty: String(d.orderedQty || 0),
              receivedQty: String(d.receivedQty || 0),
              inventoryQty: String(d.quantity || 0),
              unitPrice: String(d.unitPrice || 0),
            }));
            setItems(mappedItems);
          }
        } else {
          if (sourceStockInOrderId) {
            const res = await fetch(`${API_BASE_URL}/inbound/stock-in-orders/${sourceStockInOrderId}`, { headers: authHeaders() });
            if (res.ok) data = await res.json();
          } else if (sourcePurchaseOrderId) {
            const res = await fetch(`${API_BASE_URL}/inbound/purchase-orders/${sourcePurchaseOrderId}`, { headers: authHeaders() });
            if (res.ok) data = await res.json();
          }

          if (data) {
            setSourceData(data);
            const firstWhCode = warehouses[0]?.code || 'KH001';
            const mappedItems = (data.details || []).map((d: any) => {
              const expected = d.expectedQty !== undefined && d.expectedQty !== null ? d.expectedQty : (d.orderedQty || 0);
              const received = d.receivedQty !== undefined && d.receivedQty !== null && Number(d.receivedQty) > 0 
                ? d.receivedQty 
                : expected;
              const inventory = d.quantity !== undefined && d.quantity !== null && Number(d.quantity) > 0 
                ? d.quantity 
                : received;

              const whCode = d.warehouseCode || data.warehouseCode;
              return {
                id: d.id,
                productId: d.product?.id,
                product: d.product,
                warehouseCode: (whCode && whCode !== 'KHO-NVL') ? whCode : firstWhCode,
                expectedQty: String(expected),
                receivedQty: String(received),
                inventoryQty: String(inventory),
                unitPrice: String(d.unitPrice || 0),
              };
            });
            setItems(mappedItems);
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [isOpen, sourceStockInOrderId, sourcePurchaseOrderId, mode, receiptId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const firstWhCode = warehouses[0]?.code || 'KH001';
      const payloadItems = items.map((item: any) => ({
        productId: item.productId,
        warehouseCode: (item.warehouseCode && item.warehouseCode !== 'KHO-NVL') ? item.warehouseCode : firstWhCode,
        orderedQty: Number(item.expectedQty) || 0,
        receivedQty: Number(item.receivedQty) || 0,
        quantity: item.inventoryQty !== undefined ? Number(item.inventoryQty) : (Number(item.receivedQty) || 0),
        unitPrice: Number(item.unitPrice) || 0,
      }));

      const primaryWhCode = items[0]?.warehouseCode || sourceData?.warehouseCode;
      const body = {
        receiptCode: receiptCode.trim() || undefined,
        status,
        receiptType: 'PURCHASE_GOODS',
        supplierId: sourceData?.supplier?.id,
        sourceReferenceNo: sourceData?.poNumber || sourceData?.orderCode,
        receiptDate: new Date(receiptDate).toISOString(),
        description,
        items: payloadItems,
        warehouseCode: (primaryWhCode && primaryWhCode !== 'KHO-NVL') ? primaryWhCode : firstWhCode,
      };

      let endpoint = '';
      let method = 'POST';

      if ((mode === 'edit' || mode === 'view') && receiptId) {
        endpoint = `${API_BASE_URL}/inbound/stock-in-receipts/${receiptId}`;
        method = 'PUT';
      } else {
        endpoint = sourceStockInOrderId 
          ? `${API_BASE_URL}/inbound/stock-in-receipts/from-stock-in-orders/${sourceStockInOrderId}`
          : `${API_BASE_URL}/inbound/stock-in-receipts`;
      }

      const res = await fetch(endpoint, {
        method,
        headers: authHeaders(),
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        throw new Error(errorData?.message || 'Có lỗi xảy ra khi tạo biên bản nhập kho');
      }
      onSuccess();
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Có lỗi xảy ra khi lập lệnh nhập kho!');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  const totalAmount = items.reduce((sum, item) => sum + (parseMoney(item.expectedQty) * parseMoney(item.unitPrice)), 0);
  const totalQuantity = items.reduce((sum, item) => sum + parseMoney(item.expectedQty), 0);
  const supplier = sourceData?.supplier || {};
  
  const poStatusMap: Record<string, string> = {
    'DRAFT': 'Nháp',
    'CREATED': 'Tạo mới (Chờ duyệt)',
    'APPROVED': 'Chờ NCC xác nhận',
    'SUPPLIER_APPROVED': 'NCC đã xác nhận',
    'PARTIALLY_RECEIVED': 'Nhận một phần',
    'RECEIVED': 'Hoàn thành',
    'COMPLETED': 'Hoàn thành',
    'REJECTED': 'Từ chối',
    'CANCELLED': 'Đã hủy',
  };

  // Smart Warehouse Name Resolution
  const resolvedWarehouseCode = sourceData?.warehouseCode || sourceData?.details?.[0]?.warehouseCode || sourceData?.items?.[0]?.warehouseCode;
  const warehouseObj = warehouses.find((w: any) => w.code === resolvedWarehouseCode || w.id === resolvedWarehouseCode);
  const warehouseName = sourceData?.warehouse?.name 
    ? `${sourceData.warehouse.code || resolvedWarehouseCode || ''} - ${sourceData.warehouse.name}`.replace(/^- /, '')
    : (warehouseObj ? `${warehouseObj.code} - ${warehouseObj.name}` : (sourceData?.warehouseName || (resolvedWarehouseCode ? `${resolvedWarehouseCode} - Kho lưu trữ` : '-')));

  // Smart Approver Name Resolution
  const approverName = sourceData?.approver?.fullName || sourceData?.approver?.name || sourceData?.approver?.email || sourceData?.approverName || sourceData?.approvedBy || '-';

  // Smart Buyer Name & Phone Resolution
  const buyerName = sourceData?.creator?.fullName || sourceData?.creatorName || sourceData?.user?.fullName || sourceData?.createdByName || '-';
  const buyerPhone = sourceData?.creator?.phone || sourceData?.creatorPhone || sourceData?.user?.phone || sourceData?.createdByPhone || '-';

  return createPortal(
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-950/60 p-2 sm:p-4 backdrop-blur-sm overflow-y-auto">
      <form
        id="create-receipt-form"
        onSubmit={handleSubmit}
        className="max-h-[96vh] w-[96vw] max-w-[1550px] overflow-hidden rounded-3xl bg-white shadow-2xl flex flex-col"
      >
        {/* MODAL HEADER */}
        <div className="flex items-center justify-between border-b-2 border-slate-100 px-8 py-4 bg-gradient-to-r from-slate-50 to-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-cyan-100 p-2 text-cyan-700">
              <Building2 className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-900">
                {mode === 'create' ? 'Tạo Phiếu Nhập Kho' : mode === 'edit' ? 'Sửa Phiếu Nhập Kho' : 'Xem Phiếu Nhập Kho'}
              </h3>
              <p className="text-xs font-semibold text-slate-500">
                {mode === 'create' ? 'Ghi nhận hàng hóa đã nhận vào hệ thống lưu kho.' : 'Chi tiết hàng hóa nhập kho.'}
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 cursor-pointer">
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* MODAL BODY CONTENT */}
        <div className="flex flex-1 overflow-hidden min-h-0">
          {/* LEFT PANEL: SUPPLIER & ORDER DETAILS & TABLE */}
          <div className="overflow-y-auto flex-1 px-8 py-6 space-y-6">
            {loading ? (
              <div className="flex h-full items-center justify-center py-20"><p className="text-slate-500 font-bold">Đang tải dữ liệu đơn hàng...</p></div>
            ) : (
              <>
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-[2fr_1fr]">
                  {/* THÔNG TIN NHÀ CUNG CẤP & ĐẶT HÀNG */}
                  <div className="rounded-2xl border-2 border-slate-200 bg-gradient-to-br from-slate-50 to-white p-6 flex flex-col h-full space-y-4">
                    <div>
                      <h4 className="mb-4 text-xs font-black uppercase tracking-wider text-slate-800 border-b border-slate-200 pb-2">Thông tin nhà cung cấp</h4>
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 mb-3">
                        <div>
                          <label className="mb-1.5 block text-xs font-bold text-slate-700">Nhà cung cấp</label>
                          <input type="text" value={supplier.name || '-'} disabled className="h-10 w-full rounded-xl border-2 border-slate-200 bg-slate-50 px-3 text-xs font-bold text-slate-800 cursor-not-allowed" />
                        </div>
                        <div>
                          <label className="mb-1.5 block text-xs font-bold text-slate-700">Mã số thuế</label>
                          <input type="text" value={supplier.taxCode || '-'} disabled className="h-10 w-full rounded-xl border-2 border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-700 cursor-not-allowed" />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div>
                          <label className="mb-1.5 block text-xs font-bold text-slate-700">Người liên hệ</label>
                          <input type="text" value={supplier.contactPerson || '-'} disabled className="h-10 w-full rounded-xl border-2 border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-700 cursor-not-allowed" />
                        </div>
                        <div>
                          <label className="mb-1.5 block text-xs font-bold text-slate-700">Số điện thoại</label>
                          <input type="text" value={supplier.phone || '-'} disabled className="h-10 w-full rounded-xl border-2 border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-700 cursor-not-allowed" />
                        </div>
                      </div>
                    </div>

                    <div className="flex-1 flex flex-col pt-2 border-t border-slate-200 space-y-3">
                      <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 border-b border-slate-200 pb-2">Thông tin đặt hàng</h4>
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div>
                          <label className="mb-1.5 block text-xs font-bold text-slate-700">Người đặt hàng</label>
                          <input type="text" value={buyerName} disabled className="h-10 w-full rounded-xl border-2 border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-700 cursor-not-allowed" />
                        </div>
                        <div>
                          <label className="mb-1.5 block text-xs font-bold text-slate-700">SĐT người đặt</label>
                          <input type="text" value={buyerPhone} disabled className="h-10 w-full rounded-xl border-2 border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-700 cursor-not-allowed" />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div>
                          <label className="mb-1.5 block text-xs font-bold text-slate-700">Kho hàng</label>
                          <input type="text" value={warehouseName} disabled className="h-10 w-full rounded-xl border-2 border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-700 cursor-not-allowed" />
                        </div>
                        <div>
                          <label className="mb-1.5 block text-xs font-bold text-slate-700">Quản lý (Người duyệt)</label>
                          <input type="text" value={approverName} disabled className="h-10 w-full rounded-xl border-2 border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-700 cursor-not-allowed" />
                        </div>
                      </div>
                      <div className="flex-1 flex flex-col min-h-[90px]">
                        <label className="mb-1.5 block text-xs font-bold text-slate-700">Ghi chú (Đơn hàng)</label>
                        <textarea value={sourceData?.orderDescription || (mode === 'create' ? sourceData?.description : '') || '-'} disabled className="w-full flex-1 rounded-xl border-2 border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700 cursor-not-allowed resize-none" />
                      </div>
                    </div>
                  </div>

                  {/* THÔNG TIN ĐƠN HÀNG */}
                  <div className="rounded-2xl border-2 border-slate-200 bg-gradient-to-br from-slate-50 to-white p-6 flex flex-col h-full space-y-4">
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 border-b border-slate-200 pb-2">Thông tin đơn hàng</h4>
                    <div className="space-y-3">
                      <div>
                        <label className="mb-1 block text-xs font-bold uppercase text-slate-600">Mã đơn hàng</label>
                        <input type="text" value={sourceData?.poNumber || sourceData?.orderCode || '-'} disabled className="h-10 w-full rounded-xl border-2 border-slate-200 bg-white px-3 text-xs font-black text-slate-900 cursor-not-allowed" />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-bold uppercase text-slate-600">Ngày tạo đơn</label>
                        <input type="text" value={sourceData?.orderDate ? new Date(sourceData.orderDate).toLocaleString('vi-VN') : '-'} disabled className="h-10 w-full rounded-xl border-2 border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 cursor-not-allowed" />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-bold uppercase text-slate-600">Ngày giao hàng dự kiến</label>
                        <input type="text" value={sourceData?.expectedDate ? new Date(sourceData.expectedDate).toLocaleString('vi-VN') : '-'} disabled className="h-10 w-full rounded-xl border-2 border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 cursor-not-allowed" />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-bold uppercase text-slate-600">Trạng thái đơn hàng</label>
                        <input type="text" value={poStatusMap[sourceData?.orderStatus || sourceData?.status] || sourceData?.orderStatus || sourceData?.status || 'Hoàn thành'} disabled className="h-10 w-full rounded-xl border-2 border-slate-200 bg-white px-3 text-xs font-extrabold text-cyan-800 cursor-not-allowed" />
                      </div>

                      <div className="mt-2 rounded-2xl bg-cyan-50/80 p-4 border border-cyan-200 flex-1 flex flex-col justify-center space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-bold uppercase text-cyan-800">Tổng sản phẩm</span>
                          <span className="font-black text-cyan-950 text-base">{items.length}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-bold uppercase text-cyan-800">Tổng số lượng</span>
                          <span className="font-black text-cyan-950 text-base">{formatNumber(totalQuantity)}</span>
                        </div>
                        <div className="flex justify-between items-center pt-2 border-t border-cyan-200">
                          <span className="text-xs font-bold uppercase text-cyan-800">Tổng tiền</span>
                          <span className="font-black text-cyan-700 text-lg">{formatMoney(totalAmount)}</span>
                        </div>
                        <div className="pt-2 border-t border-cyan-200">
                          <span className="text-[11px] font-bold uppercase text-cyan-800">Bằng chữ:</span>
                          <p className="text-xs font-bold text-cyan-950 italic mt-0.5">{numberToVietnameseWords(totalAmount)}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* BẢNG CHI TIẾT HÀNG HÓA */}
                <div>
                  <h4 className="font-black text-slate-900 mb-3 text-sm flex items-center gap-2">Chi tiết hàng hóa</h4>
                  <div className="overflow-hidden rounded-2xl border-2 border-slate-200 shadow-2xs">
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[800px] bg-white">
                        <thead className="bg-slate-50">
                          <tr className="border-b border-slate-200">
                            <th className="w-12 border border-slate-200 px-3 py-3 text-center text-xs font-extrabold uppercase text-slate-700">STT</th>
                            <th className="w-[35%] border border-slate-200 px-3 py-3 text-left text-xs font-extrabold uppercase text-slate-700">Mặt hàng</th>
                            <th className="w-32 border border-slate-200 px-3 py-3 text-center text-xs font-extrabold uppercase text-slate-700">SL YÊU CẦU</th>
                            <th className="w-36 border border-slate-200 px-3 py-3 text-center text-xs font-extrabold uppercase text-cyan-800 bg-cyan-50">SL THỰC NHẬN</th>
                            <th className="w-36 border border-slate-200 px-3 py-3 text-right text-xs font-extrabold uppercase text-slate-700">ĐƠN GIÁ</th>
                            <th className="w-40 border border-slate-200 px-3 py-3 text-right text-xs font-extrabold uppercase text-slate-700">THÀNH TIỀN</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 bg-white">
                          {items.map((item, index) => (
                            <tr key={item.id || index} className="hover:bg-slate-50 transition">
                              <td className="border border-slate-200 px-3 py-3 text-center text-xs font-bold text-slate-600">{index + 1}</td>
                              <td className="border border-slate-200 px-3 py-3">
                                <p className="font-bold text-slate-900 text-xs">{item.product?.internalSku}</p>
                                <p className="text-xs text-slate-600 font-medium">{item.product?.name}</p>
                              </td>
                              <td className="border border-slate-200 px-3 py-3 text-center text-xs font-bold text-slate-700">
                                {formatNumber(parseMoney(item.expectedQty))}
                              </td>
                              <td className="border border-slate-200 px-3 py-3 text-center bg-cyan-50/50">
                                <span className="font-black text-cyan-700 text-sm">
                                  {formatNumber(parseMoney(item.receivedQty || item.expectedQty))}
                                </span>
                              </td>
                              <td className="border border-slate-200 px-3 py-3 text-right text-xs font-semibold text-slate-700">
                                {formatMoney(parseMoney(item.unitPrice))}
                              </td>
                              <td className="border border-slate-200 px-3 py-3 text-right text-xs font-black text-cyan-800">
                                {formatMoney(parseMoney(item.receivedQty || item.expectedQty) * parseMoney(item.unitPrice))}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* RIGHT PANEL: SETTINGS FOR STOCK-IN RECEIPT SHEET */}
          <div className="w-[380px] shrink-0 border-l border-slate-200 bg-slate-50/70 overflow-y-auto flex flex-col p-6 space-y-4">
            <h3 className="text-base font-black text-slate-900 border-b border-slate-200 pb-3">Thông tin Phiếu Nhập Kho</h3>
            
            <div className="space-y-3.5 flex-1">
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700">Mã phiếu nhập kho</label>
                <input type="text" value={receiptCode} onChange={(e) => setReceiptCode(e.target.value)} disabled={mode === 'view'} placeholder="Để trống để tự động tạo..." className="h-10 w-full rounded-xl border-2 border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 outline-none transition focus:border-cyan-500 disabled:bg-slate-50 disabled:cursor-not-allowed" />
              </div>
              
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700">Trạng thái phiếu</label>
                <select value={status} onChange={(e) => setStatus(e.target.value as any)} disabled={mode === 'view'} className="h-10 w-full rounded-xl border-2 border-slate-200 bg-white px-3 text-xs font-bold text-cyan-900 outline-none transition focus:border-cyan-500 disabled:bg-slate-50 disabled:cursor-not-allowed">
                  <option value="DRAFT">Nháp (Chưa gửi yêu cầu)</option>
                  <option value="ASSIGNED">Đã tiếp nhận (Chờ nhập kho)</option>
                  <option value="CHECKED">Đã kiểm đếm (Chờ duyệt)</option>
                  <option value="POSTED">Hoàn thành (Ghi sổ)</option>
                </select>
              </div>

              <div>
                <label className="mb-1 flex items-center gap-1.5 text-xs font-bold text-slate-700">
                  <Calendar className="h-3.5 w-3.5 text-cyan-600" />
                  Thời gian nhập kho
                </label>
                <input type="datetime-local" value={receiptDate} onChange={(e) => setReceiptDate(e.target.value)} disabled={mode === 'view'} required className="h-10 w-full rounded-xl border-2 border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 outline-none transition focus:border-cyan-500 disabled:bg-slate-50 disabled:cursor-not-allowed" />
              </div>

              {/* THÔNG TIN NGƯỜI GIAO HÀNG */}
              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-200">
                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-700">Họ tên người giao (Tài xế)</label>
                  <input type="text" value={delivererName} onChange={(e) => setDelivererName(e.target.value)} disabled={mode === 'view'} placeholder="Tên tài xế..." className="h-10 w-full rounded-xl border-2 border-slate-200 bg-white px-3 text-xs font-bold text-slate-800 outline-none focus:border-cyan-500 disabled:bg-slate-50" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-700">SĐT tài xế / người giao</label>
                  <input type="text" value={delivererPhone} onChange={(e) => setDelivererPhone(e.target.value)} disabled={mode === 'view'} placeholder="SĐT tài xế..." className="h-10 w-full rounded-xl border-2 border-slate-200 bg-white px-3 text-xs font-bold text-slate-800 outline-none focus:border-cyan-500 disabled:bg-slate-50" />
                </div>
              </div>
              
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700">Ghi chú nhập kho / Hướng dẫn</label>
                <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} disabled={mode === 'view'} placeholder="Ví dụ: Kiểm tra kỹ tem mác..." className="w-full rounded-xl border-2 border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 outline-none transition focus:border-cyan-500 disabled:bg-slate-50 disabled:cursor-not-allowed resize-none" />
              </div>
            </div>
          </div>
        </div>

        {/* FOOTER ACTION BAR: ALL 4 BUTTONS GROUPED ON THE RIGHT */}
        <div className="border-t-2 border-slate-200 bg-white px-8 py-4 flex items-center justify-end gap-3 shrink-0 shadow-md z-10">
          <button
            type="button"
            onClick={() => setIsPrinting(true)}
            className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-cyan-600 bg-cyan-50 px-5 py-2.5 text-xs font-extrabold text-cyan-700 transition hover:bg-cyan-100 cursor-pointer"
          >
            <Printer className="h-4 w-4" />
            <span>In Phiếu Nhập Kho (Mẫu 01-VT)</span>
          </button>

          {mode !== 'view' && (
            <button
              type="button"
              onClick={() => {
                setStatus('DRAFT');
                setTimeout(() => {
                  const form = document.getElementById('create-receipt-form') as HTMLFormElement;
                  if (form) form.requestSubmit();
                }, 50);
              }}
              disabled={saving}
              className="inline-flex items-center justify-center rounded-xl border-2 border-amber-300 bg-amber-50 px-6 py-2.5 text-xs font-extrabold text-amber-800 transition hover:bg-amber-100 disabled:opacity-60 cursor-pointer"
            >
              Lưu Nháp
            </button>
          )}

          {mode !== 'view' && (
            <button
              type="button"
              onClick={() => {
                setStatus('ASSIGNED');
                setTimeout(() => {
                  const form = document.getElementById('create-receipt-form') as HTMLFormElement;
                  if (form) form.requestSubmit();
                }, 50);
              }}
              disabled={saving}
              className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-cyan-500 bg-cyan-600 px-7 py-2.5 text-xs font-black text-white shadow-md transition hover:bg-cyan-700 disabled:opacity-60 cursor-pointer active:scale-95"
            >
              <CheckCircle2 className="h-4 w-4" />
              <span>{mode === 'create' ? 'Tạo mới Phiếu Nhập Kho' : 'Cập nhật Phiếu Nhập Kho'}</span>
            </button>
          )}

          {mode === 'view' && status === 'DRAFT' && (
            <button
              type="button"
              onClick={() => {
                setStatus('ASSIGNED');
                setTimeout(() => {
                  const form = document.getElementById('create-receipt-form') as HTMLFormElement;
                  if (form) form.requestSubmit();
                }, 50);
              }}
              disabled={saving}
              className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-cyan-500 bg-cyan-600 px-7 py-2.5 text-xs font-black text-white shadow-md transition hover:bg-cyan-700 disabled:opacity-60 cursor-pointer"
            >
              <CheckCircle2 className="h-4 w-4" />
              <span>Xác Nhận Nhập Kho</span>
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center justify-center rounded-xl border-2 border-slate-200 bg-white px-6 py-2.5 text-xs font-bold text-slate-700 transition hover:bg-slate-100 cursor-pointer"
          >
            Đóng
          </button>
        </div>
      </form>

      {/* PRINT PREVIEW MODAL FOR PHIẾU NHẬP KHO (Mẫu 01-VT) */}
      {isPrinting && (
        <div className="fixed inset-0 z-[100000] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-3xl bg-white p-8 shadow-2xl text-slate-900">
            <div className="flex justify-between items-start mb-6 border-b border-slate-300 pb-4">
              <div>
                <h4 className="font-black text-slate-900 uppercase tracking-wide text-base">CÔNG TY CỔ PHẦN KHO HÀNG VIỆT NAM</h4>
                <p className="text-xs text-slate-600">Địa chỉ: Số 123 Đường Kho Hàng, Q. Cầu Giấy, Hà Nội</p>
              </div>
              <div className="text-right">
                <p className="font-bold text-xs">Mẫu số 01 - VT</p>
                <p className="text-[11px] text-slate-500 italic">(Ban hành theo Thông tư số 133/2016/TT-BTC<br/>ngày 26/08/2016 của Bộ Tài chính)</p>
              </div>
            </div>

            <div className="text-center my-6">
              <h2 className="text-2xl font-black tracking-wide text-slate-900 uppercase">PHIẾU NHẬP KHO</h2>
              <p className="text-xs italic text-slate-600 mt-1">
                {receiptDate ? `Ngày ${new Date(receiptDate).getDate()} tháng ${new Date(receiptDate).getMonth() + 1} năm ${new Date(receiptDate).getFullYear()}` : 'Ngày ... tháng ... năm ...'}
              </p>
              <div className="flex justify-center gap-8 text-xs font-semibold mt-3">
                <span>Số: <strong>{receiptCode || sourceData?.poNumber || 'PNK-AUTO'}</strong></span>
                <span>Nợ: <strong>{accountDebit || '156'}</strong></span>
                <span>Có: <strong>{accountCredit || '331'}</strong></span>
              </div>
            </div>

            <div className="space-y-2 text-sm text-slate-800 mb-6">
              <p>- Họ và tên người giao: <strong>{delivererName || supplier.contactPerson || supplier.name || '...'}</strong> (SĐT: <strong>{delivererPhone || '...'}</strong>)</p>
              <p>- Theo Hóa đơn/Chứng từ số: <strong>{invoiceNo || sourceData?.poNumber || '...'}</strong> {invoiceDate ? `ngày ${formatDate(invoiceDate)}` : (sourceData?.orderDate ? `ngày ${formatDate(sourceData.orderDate)}` : '')} của <strong>{supplier.name || '...'}</strong></p>
              <p>- Nhập tại kho: <strong>{warehouseName}</strong></p>
              <p>- Diễn giải: <strong>{description || sourceData?.description || 'Nhập kho mua hàng theo hợp đồng/PO'}</strong></p>
            </div>

            <table className="w-full border-collapse border border-slate-900 text-xs mb-4">
              <thead>
                <tr className="bg-slate-100">
                  <th rowSpan={2} className="border border-slate-900 px-2 py-2 text-center w-10">STT</th>
                  <th rowSpan={2} className="border border-slate-900 px-2 py-2 text-left">Tên, nhãn hiệu, quy cách vật tư, hàng hóa</th>
                  <th rowSpan={2} className="border border-slate-900 px-2 py-2 text-center w-24">Mã số SKU</th>
                  <th rowSpan={2} className="border border-slate-900 px-2 py-2 text-center w-16">ĐVT</th>
                  <th colSpan={2} className="border border-slate-900 px-2 py-1 text-center">Số lượng</th>
                  <th rowSpan={2} className="border border-slate-900 px-2 py-2 text-right w-28">Đơn giá</th>
                  <th rowSpan={2} className="border border-slate-900 px-2 py-2 text-right w-32">Thành tiền</th>
                </tr>
                <tr className="bg-slate-100">
                  <th className="border border-slate-900 px-2 py-1 text-center w-20">Theo chứng từ</th>
                  <th className="border border-slate-900 px-2 py-1 text-center w-20">Thực nhập</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => (
                  <tr key={idx}>
                    <td className="border border-slate-900 px-2 py-1.5 text-center">{idx + 1}</td>
                    <td className="border border-slate-900 px-2 py-1.5 font-bold">{item.product?.name || item.productId}</td>
                    <td className="border border-slate-900 px-2 py-1.5 text-center font-mono">{item.product?.internalSku || '-'}</td>
                    <td className="border border-slate-900 px-2 py-1.5 text-center">{item.product?.unit || 'Cái'}</td>
                    <td className="border border-slate-900 px-2 py-1.5 text-center">{formatNumber(parseMoney(item.expectedQty))}</td>
                    <td className="border border-slate-900 px-2 py-1.5 text-center font-bold">{formatNumber(parseMoney(item.inventoryQty || item.receivedQty))}</td>
                    <td className="border border-slate-900 px-2 py-1.5 text-right">{formatNumber(parseMoney(item.unitPrice))}</td>
                    <td className="border border-slate-900 px-2 py-1.5 text-right font-bold">{formatNumber(parseMoney(item.expectedQty) * parseMoney(item.unitPrice))}</td>
                  </tr>
                ))}
                <tr className="font-bold bg-slate-50">
                  <td colSpan={4} className="border border-slate-900 px-2 py-2 text-center">Cộng</td>
                  <td className="border border-slate-900 px-2 py-2 text-center">{formatNumber(totalQuantity)}</td>
                  <td className="border border-slate-900 px-2 py-2 text-center">{formatNumber(items.reduce((s, i) => s + parseMoney(i.inventoryQty || i.receivedQty), 0))}</td>
                  <td className="border border-slate-900 px-2 py-2 text-right">x</td>
                  <td className="border border-slate-900 px-2 py-2 text-right text-sm font-black">{formatMoney(totalAmount)}</td>
                </tr>
              </tbody>
            </table>

            <p className="text-xs text-slate-800 font-semibold mb-6">
              - Tổng số tiền (viết bằng chữ): <em className="font-bold text-slate-900">{numberToVietnameseWords(totalAmount)}</em>
            </p>

            <div className="grid grid-cols-4 gap-4 text-center text-xs mt-8 mb-12">
              <div>
                <p className="font-bold uppercase">Người lập phiếu</p>
                <p className="italic text-slate-500">(Ký, họ tên)</p>
              </div>
              <div>
                <p className="font-bold uppercase">Người giao hàng</p>
                <p className="italic text-slate-500">(Ký, họ tên)</p>
              </div>
              <div>
                <p className="font-bold uppercase">Thủ kho</p>
                <p className="italic text-slate-500">(Ký, họ tên)</p>
              </div>
              <div>
                <p className="font-bold uppercase">Kế toán trưởng</p>
                <p className="italic text-slate-500">(Ký, họ tên)</p>
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-200 pt-4 no-print">
              <button type="button" onClick={() => setIsPrinting(false)} className="px-5 py-2.5 rounded-xl border-2 border-slate-300 font-bold text-slate-700 hover:bg-slate-100 transition cursor-pointer">Đóng</button>
              <button type="button" onClick={() => window.print()} className="px-5 py-2.5 rounded-xl bg-cyan-600 text-white font-bold hover:bg-cyan-700 transition flex items-center gap-2 cursor-pointer">
                <Printer className="h-4 w-4" />
                In phiếu ngay
              </button>
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body
  );
}
