import React, { useState, useEffect, useMemo } from 'react';
import { X, CalendarDays, CheckCircle2, User as UserIcon } from 'lucide-react';
import { getStoredWarehouses, WarehouseRecord } from '../pages/StockInReceiptsPage';

const API_BASE_URL = 'http://localhost:3000/api';

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
  };
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
  
  const [receiptDate, setReceiptDate] = useState(new Date().toISOString().slice(0, 16));
  const [description, setDescription] = useState('');
  const [selectedStaffIds, setSelectedStaffIds] = useState<string[]>([]);

  useEffect(() => {
    if (!isOpen) {
      setSourceData(null);
      setReceiptDate(new Date().toISOString().slice(0, 16));
      setDescription('');
      setSelectedStaffIds([]);
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

        if (sourceStockInOrderId) {
          const res = await fetch(`${API_BASE_URL}/inbound/stock-in-orders/${sourceStockInOrderId}`, { headers: authHeaders() });
          if (res.ok) {
            setSourceData(await res.json());
          }
        } else if (sourcePurchaseOrderId) {
          const res = await fetch(`${API_BASE_URL}/inbound/purchase-orders/${sourcePurchaseOrderId}`, { headers: authHeaders() });
          if (res.ok) {
            setSourceData(await res.json());
          }
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
      if (sourceStockInOrderId) {
        const res = await fetch(`${API_BASE_URL}/inbound/stock-in-receipts/from-stock-in-orders/${sourceStockInOrderId}`, {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify({
            status: 'DRAFT',
            receiptDate: new Date(receiptDate).toISOString(),
            description,
            assignedStaffIds: selectedStaffIds,
            receiptType: 'PURCHASE_GOODS',
          }),
        });
        if (!res.ok) throw new Error('Failed to create from Stock In Order');
      } else if (sourcePurchaseOrderId) {
        const items = sourceData.details?.map((d: any) => ({
          productId: d.product?.id,
          warehouseCode: d.warehouseCode || 'KHO-NVL',
          orderedQty: d.expectedQty,
          receivedQty: d.receivedQty,
          quantity: d.expectedQty,
          unitPrice: d.unitPrice,
        })) || [];
        
        const res = await fetch(`${API_BASE_URL}/inbound/stock-in-receipts`, {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify({
            status: 'DRAFT',
            receiptType: 'PURCHASE_GOODS',
            supplierId: sourceData.supplier?.id,
            sourceReferenceNo: sourceData.poNumber,
            receiptDate: new Date(receiptDate).toISOString(),
            description,
            assignedStaffIds: selectedStaffIds,
            items,
          }),
        });
        if (!res.ok) throw new Error('Failed to create from Purchase Order');
      }
      onSuccess();
    } catch (err) {
      console.error(err);
      alert('Có lỗi xảy ra khi lập lệnh nhập kho!');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between border-b-2 border-slate-100 px-6 py-4 bg-gradient-to-r from-slate-50 to-white">
          <div>
            <h3 className="text-xl font-black text-slate-900">Lập Lệnh Nhập Kho & Kiểm Kê</h3>
            {sourceData && (
              <p className="text-sm font-medium text-slate-500">
                Từ: <span className="font-bold text-slate-700">{sourceData.orderCode || sourceData.poNumber}</span>
              </p>
            )}
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-2 hover:bg-slate-100 transition">
            <X className="h-5 w-5 text-slate-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {loading ? (
            <p className="text-center text-sm font-medium text-slate-500 py-10">Đang tải thông tin...</p>
          ) : (
            <form id="create-receipt-form" onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div>
                  <label className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-700">
                    <CalendarDays className="h-4 w-4 text-cyan-600" />
                    Thời gian nhập kho (Dự kiến)
                  </label>
                  <input
                    type="datetime-local"
                    value={receiptDate}
                    onChange={(e) => setReceiptDate(e.target.value)}
                    required
                    className="h-11 w-full rounded-xl border-2 border-slate-200 bg-white px-4 text-sm outline-none transition focus:border-cyan-500 font-semibold text-slate-700"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-bold text-slate-700">Ghi chú kiểm kê / Hướng dẫn</label>
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Ví dụ: Kiểm tra kỹ tem mác..."
                    className="h-11 w-full rounded-xl border-2 border-slate-200 bg-white px-4 text-sm outline-none transition focus:border-cyan-500 font-semibold text-slate-700"
                  />
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between mb-4 border-b border-slate-200 pb-3">
                  <p className="text-sm font-bold uppercase text-slate-700 flex items-center gap-2">
                    <UserIcon className="h-4 w-4 text-indigo-600" />
                    Nhân viên kho thực hiện
                  </p>
                  <label className="flex items-center gap-2 text-sm cursor-pointer text-indigo-700 font-bold hover:text-indigo-800">
                    <input 
                      type="checkbox" 
                      onChange={(e) => {
                        const eligible = users.filter(u => u.roles?.some((r: any) => ['STAFF', 'INVENTORY_STAFF', 'WAREHOUSE_STAFF', 'Nhân viên kho'].includes(r.name)));
                        if (e.target.checked) setSelectedStaffIds(eligible.map(u => u.id));
                        else setSelectedStaffIds([]);
                      }} 
                      checked={
                        selectedStaffIds.length > 0 && 
                        selectedStaffIds.length === users.filter(u => u.roles?.some((r: any) => ['STAFF', 'INVENTORY_STAFF', 'WAREHOUSE_STAFF', 'Nhân viên kho'].includes(r.name))).length
                      } 
                      className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-600" 
                    />
                    Chọn tất cả
                  </label>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[240px] overflow-y-auto pr-2">
                  {users.filter(u => u.roles?.some((r: any) => ['STAFF', 'INVENTORY_STAFF', 'WAREHOUSE_STAFF', 'Nhân viên kho'].includes(r.name))).length === 0 && (
                    <p className="text-sm text-slate-500 italic col-span-2">Không có nhân viên kho nào trong hệ thống.</p>
                  )}
                  {users.filter(u => u.roles?.some((r: any) => ['STAFF', 'INVENTORY_STAFF', 'WAREHOUSE_STAFF', 'Nhân viên kho'].includes(r.name))).map((u) => (
                    <label key={u.id} className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 bg-white p-3 hover:border-indigo-400 transition shadow-sm">
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
            </form>
          )}
        </div>

        <div className="flex justify-end gap-3 border-t border-slate-100 px-6 py-4 bg-slate-50">
          <button 
            type="button" 
            onClick={onClose}
            className="rounded-xl border-2 border-slate-200 px-6 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-100 transition"
          >
            Hủy
          </button>
          <button 
            type="submit" 
            form="create-receipt-form"
            disabled={saving || loading || selectedStaffIds.length === 0}
            className="inline-flex items-center gap-2 rounded-xl bg-amber-600 px-8 py-2.5 text-sm font-bold text-white shadow-lg transition hover:bg-amber-700 disabled:opacity-60"
          >
            {saving ? 'Đang tạo...' : 'Tạo lệnh & Chuyển giao'}
          </button>
        </div>
      </div>
    </div>
  );
}
