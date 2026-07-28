import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';

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

export default function CreateTransferOrderPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const request = (location.state as { request?: TransferRequest } | null)?.request;

  const [transferNumber, setTransferNumber] = React.useState(request ? `${request.requestNumber.replace('REQ', 'TRF')}` : 'TRF-2026-000');
  const [note, setNote] = React.useState(request ? `Lập phiếu từ yêu cầu ${request.requestNumber}` : '');

  const totalQuantity = request?.items.reduce((sum, item) => sum + item.quantity, 0) ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <div className="inline-flex items-center gap-2.5 rounded-xl border-2 border-cyan-500 bg-cyan-600 px-4 py-2 text-white shadow-md">
            <h1 className="text-lg font-bold tracking-tight text-white">Lập Phiếu Điều Chuyển</h1>
          </div>
          <p className="mt-2 text-sm font-medium text-slate-500">
            {request
              ? 'Nhập phiếu điều chuyển dựa trên yêu cầu đã duyệt hoặc chọn lại kho để thực hiện chuyển hàng.'
              : 'Tạo phiếu điều chuyển mới giữa các kho và ghi nhận chuyển hàng.'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-cyan-500 bg-white px-4 py-2.5 text-sm font-bold text-cyan-600 transition hover:bg-cyan-50 shadow-sm"
        >
          <ArrowLeft className="h-4 w-4" />
          Quay lại
        </button>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="rounded-2xl border-2 border-cyan-500 bg-white p-6 shadow-sm">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm font-bold text-slate-700">Số phiếu điều chuyển</label>
              <input
                value={transferNumber}
                onChange={(event) => setTransferNumber(event.target.value)}
                className="mt-2 h-11 w-full rounded-xl border-2 border-cyan-500 px-4 text-sm font-semibold outline-none focus:border-cyan-600 focus:ring-4 focus:ring-cyan-500/10 shadow-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700">Ngày lập</label>
              <input
                type="date"
                defaultValue={new Date().toISOString().slice(0, 10)}
                className="mt-2 h-11 w-full rounded-xl border-2 border-cyan-500 px-4 text-sm font-semibold outline-none focus:border-cyan-600 focus:ring-4 focus:ring-cyan-500/10 shadow-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700">Kho nguồn</label>
              <input
                value={request?.sourceWarehouse ?? ''}
                readOnly
                className="mt-2 h-11 w-full rounded-xl border-2 border-cyan-500 bg-slate-50 px-4 text-sm font-semibold text-slate-700"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700">Kho đích</label>
              <input
                value={request?.destinationWarehouse ?? ''}
                readOnly
                className="mt-2 h-11 w-full rounded-xl border-2 border-cyan-500 bg-slate-50 px-4 text-sm font-semibold text-slate-700"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-bold text-slate-700">Ghi chú</label>
              <textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                rows={4}
                className="mt-2 w-full rounded-xl border-2 border-cyan-500 px-4 py-3 text-sm font-semibold outline-none focus:border-cyan-600 focus:ring-4 focus:ring-cyan-500/10 shadow-sm"
                placeholder="Ghi chú nội dung điều chuyển hoặc các yêu cầu đặc biệt"
              />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border-2 border-cyan-500 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3 text-slate-800">
            <CheckCircle2 className="h-5 w-5 text-cyan-600" />
            <div>
              <p className="text-sm font-bold uppercase tracking-wide text-cyan-700">Tóm tắt yêu cầu</p>
              <p className="mt-2 text-xl font-black text-slate-900">{request ? request.requestNumber : 'Không có yêu cầu'}</p>
            </div>
          </div>

          <div className="mt-6 space-y-3 text-sm text-slate-600">
            <div className="rounded-xl border border-cyan-200 bg-cyan-50/40 p-4">
              <div className="font-bold text-slate-700">Nhân viên lập</div>
              <div className="font-semibold text-slate-900 mt-0.5">{request?.createdBy ?? '-'}</div>
            </div>
            <div className="rounded-xl border border-cyan-200 bg-cyan-50/40 p-4">
              <div className="font-bold text-slate-700">Mô tả yêu cầu</div>
              <div className="font-semibold text-slate-900 mt-0.5">{request?.description ?? 'Không có mô tả thêm'}</div>
            </div>
            <div className="rounded-xl border border-cyan-200 bg-cyan-50/40 p-4">
              <div className="font-bold text-slate-700">Tổng số lượng</div>
              <div className="font-bold text-cyan-700 text-base mt-0.5">{totalQuantity} đơn vị</div>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-black text-slate-900">Danh sách hàng điều chuyển</h2>
            <p className="text-sm text-slate-500">Kiểm tra số lượng trước khi lập phiếu điều chuyển.</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px] border-collapse text-left text-sm">
            <thead className="bg-cyan-50 text-slate-800">
              <tr>
                <th className="border border-slate-200 px-4 py-3 font-extrabold uppercase">STT</th>
                <th className="border border-slate-200 px-4 py-3 font-extrabold uppercase">Mã hàng</th>
                <th className="border border-slate-200 px-4 py-3 font-extrabold uppercase">Tên hàng</th>
                <th className="border border-slate-200 px-4 py-3 font-extrabold uppercase">ĐVT</th>
                <th className="border border-slate-200 px-4 py-3 font-extrabold uppercase">SL đề nghị</th>
              </tr>
            </thead>
            <tbody>
              {request?.items.length ? (
                request.items.map((item, index) => (
                  <tr key={item.id} className="border-b border-slate-200 hover:bg-slate-50">
                    <td className="border border-slate-200 px-4 py-3">{index + 1}</td>
                    <td className="border border-slate-200 px-4 py-3 font-bold text-slate-900">{item.productCode}</td>
                    <td className="border border-slate-200 px-4 py-3">{item.productName}</td>
                    <td className="border border-slate-200 px-4 py-3">{item.unit}</td>
                    <td className="border border-slate-200 px-4 py-3 font-bold text-cyan-700">{item.quantity}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="border border-slate-200 px-4 py-8 text-center text-slate-500">
                    Chưa có hàng hóa để hiển thị. Vui lòng chọn yêu cầu điều chuyển hoặc thêm hàng.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="rounded-xl border-2 border-slate-200 px-5 py-3 text-sm font-bold text-slate-600 transition hover:bg-slate-50"
        >
          Hủy
        </button>
        <button
          type="button"
          className="rounded-xl border-2 border-cyan-500 bg-cyan-600 px-5 py-3 text-sm font-bold text-white shadow-md transition hover:bg-cyan-700"
        >
          Lưu phiếu điều chuyển
        </button>
      </div>
    </div>
  );
}
