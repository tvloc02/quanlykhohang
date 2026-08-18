import React from 'react';
import { createPortal } from 'react-dom';
import { Plus, Trash2, X } from 'lucide-react';
import { deliveryApi, type TransferOrderStatus } from '../api/deliveryApi';
import { getStoredWarehouses, mergeStoredWarehouses } from '../../../shared/utils/warehouseAssignments';


type TransferRequestLine = {
  id: string;
  productCode: string;
  productName: string;
  unit: string;
  quantity: number;
  sourceWarehouse: string;
  destinationWarehouse: string;
};

type TransferRequest = {
  id: string;
  requestNumber: string;
  createdDate: string;
  status: 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'COMPLETED';
  description: string;
  createdBy: string;
  sourceWarehouse: string;
  destinationWarehouse: string;
  items: TransferRequestLine[];
};

type Warehouse = {
  id: string;
  code: string;
  name: string;
};

type Row = {
  id: string;
  productCode: string;
  productName: string;
  unit: string;
  quantity: string;
};

type TransferOrderModalProps = {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  setToast: (toast: { type: 'success' | 'error'; message: string }) => void;
  request?: TransferRequest | null;
};

const todayValue = () => new Date().toISOString().slice(0, 10);

const makeRow = (seed?: Partial<Row>): Row => ({
  id: seed?.id || `row-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  productCode: seed?.productCode || '',
  productName: seed?.productName || '',
  unit: seed?.unit || 'Cái',
  quantity: seed?.quantity || '1',
});

function emptyPayload(userName: string) {
  return {
    transferNo: `TRF-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`,
    sourceWarehouse: '',
    destinationWarehouse: '',
    scheduledDate: todayValue(),
    note: '',
    createdBy: userName,
    status: 'DRAFT' as TransferOrderStatus,
    items: [makeRow()],
  };
}

export default function TransferOrderModal({
  open,
  onClose,
  onSaved,
  setToast,
  request,
}: TransferOrderModalProps) {
  const [warehouses, setWarehouses] = React.useState<Warehouse[]>(() => getStoredWarehouses());

  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [transferNo, setTransferNo] = React.useState('');
  const [sourceWarehouse, setSourceWarehouse] = React.useState('');
  const [destinationWarehouse, setDestinationWarehouse] = React.useState('');
  const [scheduledDate, setScheduledDate] = React.useState(todayValue());
  const [note, setNote] = React.useState('');
  const [createdBy, setCreatedBy] = React.useState('');
  const [status, setStatus] = React.useState<TransferOrderStatus>('DRAFT');
  const [items, setItems] = React.useState<Row[]>([makeRow()]);

  React.useEffect(() => {
    if (!open) return;

    const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
    const userName = storedUser.fullName || storedUser.email || 'Nhân viên kho';

    if (request) {
      const reqNum = request.requestNumber || '';
      setTransferNo(`TRF-${reqNum.replace(/^REQ-?/i, '') || Date.now().toString().slice(-4)}`);
      setSourceWarehouse(request.sourceWarehouse || '');
      setDestinationWarehouse(request.destinationWarehouse || '');
      setScheduledDate(todayValue());
      setNote(`Lập phiếu từ yêu cầu ${reqNum}${request.description ? ` - ${request.description}` : ''}`);
      setCreatedBy(request.createdBy || userName);
      setStatus('APPROVED');
      setItems(
        Array.isArray(request.items) && request.items.length > 0
          ? request.items.map((item) =>
              makeRow({
                id: item.id,
                productCode: item.productCode || '',
                productName: item.productName || '',
                unit: item.unit || 'Cái',
                quantity: String(item.quantity || 1),
              })
            )
          : [makeRow()]
      );
    } else {
      const initial = emptyPayload(userName);
      setTransferNo(initial.transferNo);
      setSourceWarehouse(initial.sourceWarehouse);
      setDestinationWarehouse(initial.destinationWarehouse);
      setScheduledDate(initial.scheduledDate);
      setNote(initial.note);
      setCreatedBy(initial.createdBy);
      setStatus(initial.status);
      setItems(initial.items);
    }
  }, [open, request]);

  React.useEffect(() => {
    if (!open) return;

    async function loadWarehouses() {
      try {
        const res = await fetch('http://localhost:3000/api/warehouses', {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
          },
        });
        if (res.ok) {
          const data = await res.json();
          const rawList = Array.isArray(data) ? data : data.data || [];
          setWarehouses(mergeStoredWarehouses(rawList, getStoredWarehouses()));
        }
      } catch (err) {
        console.error('Lỗi tải danh sách kho', err);
      }
    }

    loadWarehouses();
  }, [open]);

  const updateRow = (id: string, field: keyof Row, value: string) => {
    setItems((current) => current.map((row) => (row.id === id ? { ...row, [field]: value } : row)));
  };

  const addRow = () => {
    setItems((current) => [...current, makeRow()]);
  };

  const removeRow = (id: string) => {
    setItems((current) => (current.length > 1 ? current.filter((row) => row.id !== id) : current));
  };

  const warehouseLabel = (code: string) => {
    const found = warehouses.find((wh) => wh.code === code || wh.id === code || wh.name === code);
    if (!found) return code;
    return found.name && found.code && found.name !== found.code ? `${found.name} (${found.code})` : found.name || found.code;
  };

  const handleSubmit = async () => {
    const normalizedItems = items
      .map((item) => ({
        id: item.id,
        productCode: item.productCode.trim(),
        productName: item.productName.trim(),
        unit: item.unit.trim() || 'Cái',
        quantity: Number(item.quantity) || 0,
      }))
      .filter((item) => item.productCode || item.productName);

    if (!sourceWarehouse.trim() || !destinationWarehouse.trim()) {
      setToast({ type: 'error', message: 'Vui lòng chọn kho nguồn và kho đích' });
      return;
    }
    if (sourceWarehouse.trim() === destinationWarehouse.trim()) {
      setToast({ type: 'error', message: 'Kho nguồn và kho đích không được trùng nhau' });
      return;
    }
    if (!normalizedItems.length || normalizedItems.some((item) => !item.productCode || !item.productName || item.quantity <= 0)) {
      setToast({ type: 'error', message: 'Vui lòng nhập đầy đủ thông tin hàng hóa và số lượng hợp lệ' });
      return;
    }

    setIsSubmitting(true);
    try {
      await deliveryApi.createTransferOrder({
        transferNo: transferNo.trim() || undefined,
        requestId: request?.id,
        requestNumber: request?.requestNumber,
        sourceWarehouse: sourceWarehouse.trim(),
        destinationWarehouse: destinationWarehouse.trim(),
        scheduledDate,
        status,
        note: note.trim() || undefined,
        createdBy: createdBy.trim() || undefined,
        items: normalizedItems,
      });
      setToast({ type: 'success', message: 'Đã lưu phiếu điều chuyển thành công!' });
      onSaved();
      onClose();
    } catch (error: any) {
      setToast({ type: 'error', message: error?.message || 'Lỗi khi lưu phiếu điều chuyển' });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 top-0 left-0 w-screen h-screen z-[99999] flex items-center justify-center bg-slate-950/75 p-3 sm:p-6 backdrop-blur-md overflow-y-auto">
      <div className="flex w-full max-w-6xl max-h-[94vh] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl my-auto">
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-6 py-4">
          <div>
            <h2 className="text-xl font-black text-slate-900">Phiếu xuất kho nội bộ</h2>
            <p className="mt-1 text-sm font-medium text-slate-500">
              {request ? `Tạo phiếu từ yêu cầu ${request.requestNumber}` : 'Tạo phiếu xuất kho nội bộ mới giữa các kho'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 bg-white p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="overflow-y-auto p-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <div>
              <label className="mb-2 block text-sm font-bold text-slate-700">Số phiếu xuất kho nội bộ</label>
              <input
                value={transferNo}
                onChange={(event) => setTransferNo(event.target.value)}
                className="h-11 w-full rounded-xl border-2 border-cyan-500 bg-white px-4 text-sm font-semibold outline-none transition focus:border-cyan-600 focus:ring-4 focus:ring-cyan-500/10 shadow-sm"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-bold text-slate-700">Ngày lập</label>
              <input
                type="date"
                value={scheduledDate}
                onChange={(event) => setScheduledDate(event.target.value)}
                className="h-11 w-full rounded-xl border-2 border-cyan-500 bg-white px-4 text-sm font-semibold outline-none transition focus:border-cyan-600 focus:ring-4 focus:ring-cyan-500/10 shadow-sm"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-bold text-slate-700">Người lập</label>
              <input
                value={createdBy}
                onChange={(event) => setCreatedBy(event.target.value)}
                className="h-11 w-full rounded-xl border-2 border-cyan-500 bg-white px-4 text-sm font-semibold outline-none transition focus:border-cyan-600 focus:ring-4 focus:ring-cyan-500/10 shadow-sm"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-bold text-slate-700">Kho cần chuyển (Kho nguồn)</label>
              {request ? (
                <input
                  value={warehouseLabel(sourceWarehouse)}
                  readOnly
                  className="h-11 w-full rounded-xl border-2 border-cyan-500 bg-slate-50 px-4 text-sm font-semibold text-slate-700"
                />
              ) : (
                <select
                  value={sourceWarehouse}
                  onChange={(event) => setSourceWarehouse(event.target.value)}
                  className="h-11 w-full rounded-xl border-2 border-cyan-500 bg-white px-4 text-sm font-semibold text-slate-700 outline-none transition focus:border-cyan-600 focus:ring-4 focus:ring-cyan-500/10 shadow-sm"
                >
                  <option value="">-- Chọn kho nguồn --</option>
                  {warehouses.map((wh) => (
                    <option key={wh.id} value={wh.code || wh.id}>
                      {wh.name ? `${wh.name} (${wh.code})` : wh.code}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <div>
              <label className="mb-2 block text-sm font-bold text-slate-700">Kho nhận (Kho nhập)</label>
              {request ? (
                <input
                  value={warehouseLabel(destinationWarehouse)}
                  readOnly
                  className="h-11 w-full rounded-xl border-2 border-cyan-500 bg-slate-50 px-4 text-sm font-semibold text-slate-700"
                />
              ) : (
                <select
                  value={destinationWarehouse}
                  onChange={(event) => setDestinationWarehouse(event.target.value)}
                  className="h-11 w-full rounded-xl border-2 border-cyan-500 bg-white px-4 text-sm font-semibold text-slate-700 outline-none transition focus:border-cyan-600 focus:ring-4 focus:ring-cyan-500/10 shadow-sm"
                >
                  <option value="">-- Chọn kho nhận --</option>
                  {warehouses.map((wh) => (
                    <option key={wh.id} value={wh.code || wh.id}>
                      {wh.name ? `${wh.name} (${wh.code})` : wh.code}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <div className="md:col-span-2 xl:col-span-3">
              <label className="mb-2 block text-sm font-bold text-slate-700">Ghi chú</label>
              <textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                rows={3}
                className="w-full rounded-xl border-2 border-cyan-500 bg-white px-4 py-3 text-sm font-semibold outline-none transition focus:border-cyan-600 focus:ring-4 focus:ring-cyan-500/10 shadow-sm"
                placeholder="Ghi chú điều chuyển, lý do, hoặc lưu ý đặc biệt"
              />
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-black text-slate-900">Hàng điều chuyển</h3>
                <p className="text-sm text-slate-500">Nhập trực tiếp hoặc dùng dữ liệu từ yêu cầu đã duyệt.</p>
              </div>
              <button
                type="button"
                onClick={addRow}
                className="inline-flex items-center gap-2 rounded-xl border-2 border-cyan-500 bg-white px-4 py-2.5 text-sm font-bold text-cyan-600 transition hover:bg-cyan-50 shadow-sm"
              >
                <Plus className="h-4 w-4" />
                Thêm dòng
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] border-collapse text-left text-sm">
                <thead className="bg-cyan-50 text-slate-800">
                  <tr>
                    <th className="border border-slate-200 px-4 py-3 font-extrabold uppercase">STT</th>
                    <th className="border border-slate-200 px-4 py-3 font-extrabold uppercase">Mã hàng</th>
                    <th className="border border-slate-200 px-4 py-3 font-extrabold uppercase">Tên hàng</th>
                    <th className="border border-slate-200 px-4 py-3 font-extrabold uppercase">ĐVT</th>
                    <th className="border border-slate-200 px-4 py-3 font-extrabold uppercase">Số lượng</th>
                    <th className="border border-slate-200 px-4 py-3 font-extrabold uppercase">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((row, index) => (
                    <tr key={row.id} className="border-b border-slate-200 hover:bg-slate-50">
                      <td className="border border-slate-200 px-4 py-3 text-center font-semibold text-slate-700">{index + 1}</td>
                      <td className="border border-slate-200 px-3 py-2">
                        <input
                          value={row.productCode}
                          onChange={(event) => updateRow(row.id, 'productCode', event.target.value)}
                          className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm font-semibold outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/10"
                        />
                      </td>
                      <td className="border border-slate-200 px-3 py-2">
                        <input
                          value={row.productName}
                          onChange={(event) => updateRow(row.id, 'productName', event.target.value)}
                          className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm font-semibold outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/10"
                        />
                      </td>
                      <td className="border border-slate-200 px-3 py-2">
                        <input
                          value={row.unit}
                          onChange={(event) => updateRow(row.id, 'unit', event.target.value)}
                          className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm font-semibold outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/10"
                        />
                      </td>
                      <td className="border border-slate-200 px-3 py-2">
                        <input
                          type="number"
                          min={1}
                          value={row.quantity}
                          onChange={(event) => updateRow(row.id, 'quantity', event.target.value)}
                          className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm font-semibold outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/10"
                        />
                      </td>
                      <td className="border border-slate-200 px-3 py-2 text-center">
                        <button
                          type="button"
                          onClick={() => removeRow(row.id)}
                          className="inline-flex h-10 w-10 items-center justify-center rounded-lg border-2 border-cyan-500 bg-white text-cyan-600 transition hover:bg-cyan-50 disabled:opacity-40"
                          disabled={items.length === 1}
                          title="Xóa dòng"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-slate-100 bg-slate-50 px-6 py-4">
          <div className="text-sm font-medium text-slate-500">
            {request ? 'Phiếu được tạo từ yêu cầu đã duyệt' : 'Phiếu mới sẽ được lưu ở trạng thái nháp'}
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border-2 border-slate-200 px-5 py-2.5 text-sm font-bold text-slate-600 transition hover:bg-slate-50"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="rounded-xl border-2 border-cyan-500 bg-cyan-600 px-5 py-2.5 text-sm font-bold text-white shadow-md transition hover:bg-cyan-700 disabled:opacity-60"
            >
              {isSubmitting ? 'Đang lưu...' : 'Lưu phiếu điều chuyển'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
