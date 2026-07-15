import React, { useState, useEffect } from 'react';
import { X, Calendar, User as UserIcon, Building2, Clock3 } from 'lucide-react';
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

export function CreateStockInReceiptModal({
  isOpen,
  onClose,
  onSuccess,
  sourceStockInOrderId,
  sourcePurchaseOrderId,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  sourceStockInOrderId?: string | null;
  sourcePurchaseOrderId?: string | null;
}) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const [users, setUsers] = useState<any[]>([]);
  const [sourceData, setSourceData] = useState<any>(null);
  
  const [receiptCode, setReceiptCode] = useState('');
  const [receiptDate, setReceiptDate] = useState(new Date().toISOString().slice(0, 16));
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<'DRAFT' | 'CREATED'>('DRAFT');
  const [selectedStaffIds, setSelectedStaffIds] = useState<string[]>([]);
  const [items, setItems] = useState<any[]>([]);

  useEffect(() => {
    if (!isOpen) {
      setSourceData(null);
      setReceiptCode('');
      setReceiptDate(new Date().toISOString().slice(0, 16));
      setDescription('');
      setStatus('DRAFT');
      setSelectedStaffIds([]);
      setItems([]);
      return;
    }

    const load = async () => {
      setLoading(true);
      try {
        const uRes = await fetch(`${API_BASE_URL}/users`, { headers: authHeaders() });
        if (uRes.ok) {
          const uData = await uRes.json();
          setUsers(Array.isArray(uData) ? uData : uData.data || []);
        }

        let data = null;
        if (sourceStockInOrderId) {
          const res = await fetch(`${API_BASE_URL}/inbound/stock-in-orders/${sourceStockInOrderId}`, { headers: authHeaders() });
          if (res.ok) data = await res.json();
        } else if (sourcePurchaseOrderId) {
          const res = await fetch(`${API_BASE_URL}/inbound/purchase-orders/${sourcePurchaseOrderId}`, { headers: authHeaders() });
          if (res.ok) data = await res.json();
        }

        if (data) {
          setSourceData(data);
          const mappedItems = (data.details || []).map((d: any) => ({
            id: d.id,
            productId: d.product?.id,
            product: d.product,
            warehouseCode: d.warehouseCode || 'KHO-NVL',
            expectedQty: String(d.expectedQty || d.orderedQty || 0),
            receivedQty: String(d.receivedQty || 0),
            inventoryQty: String(d.expectedQty || d.orderedQty || 0),
            unitPrice: String(d.unitPrice || 0),
          }));
          setItems(mappedItems);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [isOpen, sourceStockInOrderId, sourcePurchaseOrderId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedStaffIds.length === 0) {
      alert('Vui lòng chọn ít nhất một nhân viên kiểm kê.');
      return;
    }
    setSaving(true);
    try {
      const payloadItems = items.map((item: any) => ({
        productId: item.productId,
        warehouseCode: item.warehouseCode,
        orderedQty: Number(item.expectedQty) || 0,
        receivedQty: Number(item.receivedQty) || 0,
        quantity: item.inventoryQty !== undefined ? Number(item.inventoryQty) : (Number(item.expectedQty) || 0),
        unitPrice: Number(item.unitPrice) || 0,
      }));

      const body = {
        receiptCode: receiptCode.trim() || undefined,
        status,
        receiptType: 'PURCHASE_GOODS',
        supplierId: sourceData?.supplier?.id,
        sourceReferenceNo: sourceData?.poNumber || sourceData?.orderCode,
        receiptDate: new Date(receiptDate).toISOString(),
        description,
        assignedStaffIds: selectedStaffIds,
        items: payloadItems,
        warehouseCode: items[0]?.warehouseCode || 'KHO-NVL',
      };

      const endpoint = sourceStockInOrderId 
        ? `${API_BASE_URL}/inbound/stock-in-receipts/from-stock-in-orders/${sourceStockInOrderId}`
        : `${API_BASE_URL}/inbound/stock-in-receipts`;

      const res = await fetch(endpoint, {
        method: 'POST',
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

  const updateItem = (index: number, changes: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], ...changes };
    setItems(newItems);
  };

  if (!isOpen) return null;

  const totalAmount = items.reduce((sum, item) => sum + (parseMoney(item.expectedQty) * parseMoney(item.unitPrice)), 0);
  const totalQuantity = items.reduce((sum, item) => sum + parseMoney(item.expectedQty), 0);
  const supplier = sourceData?.supplier || {};
  
  // Status mapping for PO
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

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
      <form
        id="create-receipt-form"
        onSubmit={handleSubmit}
        className="max-h-[94vh] w-[95vw] max-w-[1500px] overflow-hidden rounded-3xl bg-white shadow-2xl flex flex-col"
      >
        <div className="flex items-start justify-between border-b-2 border-slate-100 px-6 py-4 bg-gradient-to-r from-slate-50 to-white">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-cyan-100 p-2 text-cyan-700">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900">Tạo lệnh nhập kho</h3>
              <p className="text-sm font-medium text-slate-500">Lập lệnh kiểm kê và nhận hàng vào kho từ đơn mua hàng.</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden min-h-0">
          <div className="overflow-y-auto flex-1 px-8 py-6 space-y-6">
            {loading ? (
              <div className="flex h-full items-center justify-center"><p className="text-slate-500 font-bold">Đang tải dữ liệu...</p></div>
            ) : (
              <>
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-[2fr_1fr]">
                  {/* PHÍA TRÁI: THÔNG TIN NHÀ CUNG CẤP & ĐẶT HÀNG */}
                  <div className="rounded-2xl border-2 border-slate-200 bg-gradient-to-br from-slate-50 to-white p-6 flex flex-col h-full">
                    <div>
                      <h4 className="mb-5 text-sm font-black uppercase text-slate-800">Thông tin nhà cung cấp</h4>
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 mb-4">
                        <div>
                          <label className="mb-2 block text-sm font-bold text-slate-700">Nhà cung cấp</label>
                          <input type="text" value={supplier.name || '-'} disabled className="h-11 w-full rounded-xl border-2 border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-700 cursor-not-allowed" />
                        </div>
                        <div>
                          <label className="mb-2 block text-sm font-bold text-slate-700">Mã số thuế</label>
                          <input type="text" value={supplier.taxCode || '-'} disabled className="h-11 w-full rounded-xl border-2 border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-700 cursor-not-allowed" />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 mb-6">
                        <div>
                          <label className="mb-2 block text-sm font-bold text-slate-700">Người liên hệ</label>
                          <input type="text" value={supplier.contactPerson || '-'} disabled className="h-11 w-full rounded-xl border-2 border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-700 cursor-not-allowed" />
                        </div>
                        <div>
                          <label className="mb-2 block text-sm font-bold text-slate-700">Số điện thoại</label>
                          <input type="text" value={supplier.phone || '-'} disabled className="h-11 w-full rounded-xl border-2 border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-700 cursor-not-allowed" />
                        </div>
                      </div>
                    </div>

                    <div className="flex-1 flex flex-col">
                      <h4 className="mb-5 text-sm font-black uppercase text-slate-800">Thông tin đặt hàng</h4>
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 mb-4">
                        <div>
                          <label className="mb-2 block text-sm font-bold text-slate-700">Người đặt hàng</label>
                          <input type="text" value={sourceData?.creatorName || '-'} disabled className="h-11 w-full rounded-xl border-2 border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-700 cursor-not-allowed" />
                        </div>
                        <div>
                          <label className="mb-2 block text-sm font-bold text-slate-700">SĐT người đặt</label>
                          <input type="text" value={sourceData?.creatorPhone || '-'} disabled className="h-11 w-full rounded-xl border-2 border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-700 cursor-not-allowed" />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 mb-4">
                        <div>
                          <label className="mb-2 block text-sm font-bold text-slate-700">Kho hàng</label>
                          <input type="text" value={sourceData?.warehouseCode || '-'} disabled className="h-11 w-full rounded-xl border-2 border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-700 cursor-not-allowed" />
                        </div>
                        <div>
                          <label className="mb-2 block text-sm font-bold text-slate-700">Quản lý (Người duyệt)</label>
                          <input type="text" value={sourceData?.approver?.fullName || sourceData?.approver?.email || '-'} disabled className="h-11 w-full rounded-xl border-2 border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-700 cursor-not-allowed" />
                        </div>
                      </div>
                      <div className="flex-1 flex flex-col min-h-[100px]">
                        <label className="mb-2 block text-sm font-bold text-slate-700">Ghi chú (Đơn hàng)</label>
                        <textarea value={sourceData?.description || '-'} disabled className="w-full flex-1 rounded-2xl border-2 border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 cursor-not-allowed resize-none" />
                      </div>
                    </div>
                  </div>

                  {/* PHÍA GIỮA: THÔNG TIN ĐƠN HÀNG */}
                  <div className="rounded-2xl border-2 border-slate-200 bg-gradient-to-br from-slate-50 to-white p-6 flex flex-col h-full">
                    <h4 className="mb-5 text-sm font-black uppercase text-slate-800">Thông tin đơn hàng</h4>
                    <div className="grid grid-cols-1 gap-6">
                      <div>
                        <label className="mb-2 block text-xs font-bold uppercase text-slate-600">Mã đơn hàng</label>
                        <input type="text" value={sourceData?.poNumber || sourceData?.orderCode || '-'} disabled className="h-11 w-full rounded-xl border-2 border-slate-200 bg-white px-3 text-sm font-bold text-slate-900 cursor-not-allowed" />
                      </div>
                      <div>
                        <label className="mb-2 block text-xs font-bold uppercase text-slate-600">Ngày tạo đơn</label>
                        <input type="text" value={sourceData?.orderDate ? new Date(sourceData.orderDate).toLocaleString('vi-VN') : '-'} disabled className="h-11 w-full rounded-xl border-2 border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 cursor-not-allowed" />
                      </div>
                      <div>
                        <label className="mb-2 block text-xs font-bold uppercase text-slate-600">Ngày giao hàng dự kiến</label>
                        <input type="text" value={sourceData?.expectedDate ? new Date(sourceData.expectedDate).toLocaleString('vi-VN') : '-'} disabled className="h-11 w-full rounded-xl border-2 border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 cursor-not-allowed" />
                      </div>
                      <div>
                        <label className="mb-2 block text-xs font-bold uppercase text-slate-600">Trạng thái đơn hàng</label>
                        <input type="text" value={poStatusMap[sourceData?.status] || sourceData?.status || '-'} disabled className="h-11 w-full rounded-xl border-2 border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 cursor-not-allowed" />
                      </div>

                      <div className="mt-2 rounded-2xl bg-cyan-50 p-5 border border-cyan-100 flex-1 flex flex-col justify-center">
                        <div className="flex justify-between items-center mb-3">
                          <span className="text-xs font-bold uppercase text-cyan-800">Tổng sản phẩm</span>
                          <span className="font-black text-cyan-900 text-lg">{items.length}</span>
                        </div>
                        <div className="flex justify-between items-center mb-3">
                          <span className="text-xs font-bold uppercase text-cyan-800">Tổng số lượng</span>
                          <span className="font-black text-cyan-900 text-lg">{formatMoney(totalQuantity)}</span>
                        </div>
                        <div className="flex justify-between items-center pt-3 border-t border-cyan-200/50">
                          <span className="text-xs font-bold uppercase text-cyan-800">Tổng tiền</span>
                          <span className="font-black text-cyan-700 text-xl">{formatMoney(totalAmount)} ₫</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* BẢNG CHI TIẾT HÀNG HÓA */}
                <div>
                  <h4 className="font-black text-slate-900 mb-3 flex items-center gap-2">Chi tiết hàng hóa</h4>
                  <div className="overflow-hidden rounded-2xl border-2 border-slate-200">
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[800px] bg-white">
                        <thead className="bg-slate-50">
                          <tr className="border-b border-slate-200">
                            <th className="w-10 px-3 py-3 text-center text-xs font-semibold uppercase text-slate-700">STT</th>
                            <th className="w-[30%] px-3 py-3 text-center text-xs font-semibold uppercase text-slate-700">Mặt hàng</th>
                            <th className="w-24 px-3 py-3 text-center text-xs font-semibold uppercase text-slate-700">SL yêu cầu</th>
                            <th className="w-24 px-3 py-3 text-center text-xs font-semibold uppercase text-slate-700">SL đã nhận</th>
                            <th className="w-28 px-3 py-3 text-center text-xs font-semibold uppercase text-slate-700">SL kiểm kê</th>
                            <th className="w-40 px-3 py-3 text-center text-xs font-semibold uppercase text-slate-700">Đơn giá</th>
                            <th className="w-32 px-3 py-3 text-center text-xs font-semibold uppercase text-slate-700">Thành tiền</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 bg-white">
                          {items.map((item, index) => (
                            <tr key={item.id || index} className="hover:bg-slate-50 transition">
                              <td className="px-3 py-3 text-center text-sm text-slate-600">{index + 1}</td>
                              <td className="px-3 py-3">
                                <p className="font-bold text-slate-900">{item.product?.internalSku}</p>
                                <p className="text-sm text-slate-600">{item.product?.name}</p>
                              </td>
                              <td className="px-3 py-3">
                                <input type="number" min={0} value={item.expectedQty} disabled className="h-11 w-full rounded-xl border-2 border-slate-200 bg-slate-50 px-3 text-center text-sm font-medium text-slate-500 cursor-not-allowed" />
                              </td>
                              <td className="px-3 py-3 text-center text-sm font-bold text-slate-700">{item.receivedQty}</td>
                              <td className="px-3 py-3">
                                <input type="number" min={0} value={item.inventoryQty} onChange={(e) => updateItem(index, { inventoryQty: e.target.value })} className="h-11 w-full rounded-xl border-2 border-emerald-200 bg-white px-3 text-center text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 font-black text-emerald-700" />
                              </td>
                              <td className="px-3 py-3">
                                <input type="text" value={formatMoney(item.unitPrice)} disabled className="h-11 w-full rounded-xl border-2 border-slate-200 bg-slate-50 px-3 text-right text-sm font-medium text-slate-500 cursor-not-allowed" />
                              </td>
                              <td className="px-3 py-3 text-right text-sm font-black text-cyan-700">
                                {formatMoney(parseMoney(item.expectedQty) * parseMoney(item.unitPrice))}
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

          <div className="w-[420px] shrink-0 border-l border-slate-200 bg-slate-50 overflow-y-auto flex flex-col">
            <div className="flex flex-col h-full p-6">
              <h3 className="text-lg font-black text-slate-900 mb-6">Tạo Lệnh Nhập Kho</h3>
              
              <div className="space-y-6 flex-1">
                <div>
                  <label className="mb-2 block text-sm font-bold text-slate-700">Mã lệnh nhập kho</label>
                  <input type="text" value={receiptCode} onChange={(e) => setReceiptCode(e.target.value)} placeholder="Để trống để tự động tạo..." className="h-11 w-full rounded-xl border-2 border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 outline-none transition focus:border-cyan-500" />
                </div>
                
                <div>
                  <label className="mb-2 block text-sm font-bold text-slate-700">Trạng thái yêu cầu</label>
                  <select value={status} onChange={(e) => setStatus(e.target.value as any)} className="h-11 w-full rounded-xl border-2 border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 outline-none transition focus:border-cyan-500">
                    <option value="DRAFT">Nháp (Chưa gửi yêu cầu)</option>
                    <option value="CREATED">Tạo mới (Gửi yêu cầu ngay)</option>
                  </select>
                </div>

                <div>
                  <label className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-700">
                    <Calendar className="h-4 w-4 text-cyan-600" />
                    Thời gian nhập kho (Dự kiến)
                  </label>
                  <input type="datetime-local" value={receiptDate} onChange={(e) => setReceiptDate(e.target.value)} required className="h-11 w-full rounded-xl border-2 border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 outline-none transition focus:border-cyan-500" />
                </div>
                
                <div>
                  <label className="mb-2 block text-sm font-bold text-slate-700">Ghi chú kiểm kê / Hướng dẫn</label>
                  <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ví dụ: Kiểm tra kỹ tem mác..." className="h-11 w-full rounded-xl border-2 border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 outline-none transition focus:border-cyan-500" />
                </div>

                <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-4">
                  <div className="flex items-center justify-between mb-4 border-b border-slate-200 pb-3">
                    <p className="text-sm font-bold uppercase text-slate-700 flex items-center gap-2">
                      <UserIcon className="h-4 w-4 text-indigo-600" />
                      Nhân viên kho
                    </p>
                    <label className="flex items-center gap-2 text-sm cursor-pointer text-indigo-700 font-bold hover:text-indigo-800">
                      <input 
                        type="checkbox" 
                        onChange={(e) => {
                          const eligible = users.filter(u => u.roles?.some((r: any) => ['STAFF', 'INVENTORY_STAFF', 'WAREHOUSE_STAFF', 'Nhân viên kho'].includes(r.name) || String(r.name).toLowerCase() === 'staff'));
                          if (e.target.checked) setSelectedStaffIds(eligible.map(u => u.id));
                          else setSelectedStaffIds([]);
                        }} 
                        checked={selectedStaffIds.length > 0 && selectedStaffIds.length === users.filter(u => u.roles?.some((r: any) => ['STAFF', 'INVENTORY_STAFF', 'WAREHOUSE_STAFF', 'Nhân viên kho'].includes(r.name) || String(r.name).toLowerCase() === 'staff')).length} 
                        className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-600" 
                      />
                      Chọn tất cả
                    </label>
                  </div>
                  <div className="grid grid-cols-1 gap-2 max-h-[300px] overflow-y-auto pr-2">
                    {users.filter(u => u.roles?.some((r: any) => ['STAFF', 'INVENTORY_STAFF', 'WAREHOUSE_STAFF', 'Nhân viên kho'].includes(r.name) || String(r.name).toLowerCase() === 'staff')).map((u) => (
                      <label key={u.id} className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 hover:border-indigo-400 transition">
                        <input
                          type="checkbox"
                          checked={selectedStaffIds.includes(u.id)}
                          onChange={(e) => {
                            if (e.target.checked) setSelectedStaffIds([...selectedStaffIds, u.id]);
                            else setSelectedStaffIds(selectedStaffIds.filter((id) => id !== u.id));
                          }}
                          className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-600"
                        />
                        <div>
                          <p className="text-sm font-bold text-slate-900">{u.fullName || u.email}</p>
                          {u.fullName && <p className="text-xs text-slate-500">{u.email}</p>}
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t border-slate-200 p-6 flex flex-col gap-3 bg-white">
              <button type="submit" onClick={() => setStatus('DRAFT')} form="create-receipt-form" disabled={saving || loading || selectedStaffIds.length === 0} className="inline-flex w-full items-center justify-center gap-2 rounded-xl border-2 border-amber-200 bg-amber-50 px-6 py-2.5 text-sm font-bold text-amber-700 shadow-sm transition hover:bg-amber-100 disabled:opacity-60">
                Lưu Nháp
              </button>
              <button type="submit" onClick={() => setStatus('CREATED')} form="create-receipt-form" disabled={saving || loading || selectedStaffIds.length === 0} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-amber-600 px-6 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-amber-700 disabled:opacity-60">
                <Clock3 className="h-4 w-4" />
                {saving ? 'Đang xử lý...' : 'Tạo mới & Giao Việc'}
              </button>
              <button type="button" onClick={onClose} className="mt-2 w-full rounded-xl border-2 border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50">
                Đóng
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
