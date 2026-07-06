import React from 'react';
import {
  Eye,
  Pencil,
  PlusCircle,
  Search,
  Trash2,
  Truck,
  X,
  XCircle,
  CheckCircle,
  Filter,
} from 'lucide-react';
import { outboundApi, OutboundOrder, OutboundCreatePayload } from './api/outboundApi';
import BarcodeScanner, { ScanBarcodeButton, type ScannedProduct } from '../../shared/components/BarcodeScanner';

// Tích hợp Toast nội bộ để không bị lỗi import
function Toast({ message, type, onClose }: { message: string; type: 'success' | 'error'; onClose: () => void }) {
  React.useEffect(() => {
    if (message) {
      const timer = setTimeout(() => onClose(), 3000);
      return () => clearTimeout(timer);
    }
  }, [message, onClose]);

  if (!message) return null;

  return (
    <div className={`fixed top-4 right-4 z-[60] flex items-center gap-3 rounded-xl px-4 py-3 shadow-lg transition-all ${type === 'error' ? 'bg-red-50 text-red-600 border border-red-200' : 'bg-emerald-50 text-emerald-600 border border-emerald-200'}`}>
      {type === 'error' ? <XCircle size={20} /> : <CheckCircle size={20} />}
      <p className="text-sm font-semibold">{message}</p>
      <button onClick={onClose} className="ml-2 rounded-lg p-1 hover:bg-white/50 transition">
        <X size={16} />
      </button>
    </div>
  );
}

interface ProductOption {
  id: string;
  internalSku: string;
  name: string;
}

interface WarehouseOption {
  id: string;
  code: string;
  name: string;
}

type OutboundDetailRow = {
  id: string;
  productId: string;
  warehouseCode: string;
  requiredQty: number | '';
  unitPrice: number | '';
};

type OutboundForm = {
  orderNo: string;
  customer: string;
  dueDate: string;
  status: OutboundOrder['status'];
  description: string;
  details: OutboundDetailRow[];
};

type ModalMode = 'create' | 'view' | 'edit' | 'delete' | null;

function makeEmptyDetailRow(): OutboundDetailRow {
  return { id: crypto.randomUUID(), productId: '', warehouseCode: '', requiredQty: '', unitPrice: '' };
}

function buildEmptyForm(): OutboundForm {
  return {
    orderNo: '',
    customer: '',
    dueDate: '',
    status: 'pending',
    description: '',
    details: [makeEmptyDetailRow()],
  };
}

const statusColor: Record<OutboundOrder['status'], string> = {
  pending: 'border-yellow-200 bg-yellow-50 text-yellow-700',
  picking: 'border-cyan-200 bg-cyan-50 text-cyan-700',
  READY_TO_SHIP: 'border-blue-200 bg-blue-50 text-blue-700',
  shipped: 'border-emerald-200 bg-emerald-50 text-emerald-700',
};

const statusLabel: Record<OutboundOrder['status'], string> = {
  pending: 'Chờ xử lý',
  picking: 'Đang lấy hàng',
  READY_TO_SHIP: 'Sẵn sàng xuất',
  shipped: 'Đã giao',
};

export default function Outbound() {
  const [orders, setOrders] = React.useState<OutboundOrder[]>([]);
  const [search, setSearch] = React.useState('');
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState('');
  const [success, setSuccess] = React.useState('');
  const [modalMode, setModalMode] = React.useState<ModalMode>(null);
  const [selectedOrder, setSelectedOrder] = React.useState<OutboundOrder | null>(null);
  const [form, setForm] = React.useState<OutboundForm>(buildEmptyForm());
  const [products, setProducts] = React.useState<ProductOption[]>([]);
  const [warehouses, setWarehouses] = React.useState<WarehouseOption[]>([]);
  const [scannerOpen, setScannerOpen] = React.useState(false);

  const handleProductScanned = React.useCallback((product: ScannedProduct, qty: number) => {
    setForm((current) => {
      const newDetails = [...current.details];
      
      // Nếu dòng cuối cùng đang trống (chưa chọn sản phẩm), thì ghi đè lên dòng đó
      const lastIndex = newDetails.length - 1;
      if (lastIndex >= 0 && !newDetails[lastIndex].productId && !newDetails[lastIndex].requiredQty) {
        newDetails[lastIndex] = {
          ...newDetails[lastIndex],
          productId: product.id,
          requiredQty: qty,
          // Tự động chọn kho đầu tiên có tồn kho, nếu không có thì để trống
          warehouseCode: product.stockBalances?.length > 0 ? product.stockBalances[0].locationCode : '',
        };
      } else {
        // Tìm xem sản phẩm đã có trong danh sách chưa, nếu có tăng số lượng
        const existingIndex = newDetails.findIndex((d) => d.productId === product.id);
        if (existingIndex >= 0) {
          const currentQty = Number(newDetails[existingIndex].requiredQty) || 0;
          newDetails[existingIndex].requiredQty = currentQty + qty;
        } else {
          // Thêm dòng mới
          newDetails.push({
            id: crypto.randomUUID(),
            productId: product.id,
            requiredQty: qty,
            unitPrice: '',
            warehouseCode: product.stockBalances?.length > 0 ? product.stockBalances[0].locationCode : '',
          });
        }
      }
      return { ...current, details: newDetails };
    });
    setSuccess(`Đã thêm ${product.name} (SL: ${qty})`);
  }, []);

  // Pagination states
  const [pageSize, setPageSize] = React.useState(20);
  const [currentPage, setCurrentPage] = React.useState(1);

  const loadData = React.useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const data = await outboundApi.listOrders();
      setOrders(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi hệ thống khi tải dữ liệu');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  React.useEffect(() => {
    const fetchRefs = async () => {
      try {
        const [productsRes, warehousesRes] = await Promise.all([
          fetch('http://localhost:3000/api/products', { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token') || ''}` } }),
          fetch('http://localhost:3000/api/warehouses', { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token') || ''}` } }),
        ]);

        if (productsRes.ok) {
          const data = await productsRes.json();
          setProducts(Array.isArray(data) ? data.map((item: any) => ({ id: String(item.id), internalSku: String(item.internalSku || item.sku || item.id), name: String(item.name || item.internalSku || item.id) })) : []);
        }
        if (warehousesRes.ok) {
          const data = await warehousesRes.json();
          setWarehouses(Array.isArray(data) ? data.map((item: any) => ({ id: String(item.id), code: String(item.code || item.id).toUpperCase(), name: String(item.name || item.code || item.id) })) : []);
        }
      } catch (err) {
        // Ignore reference loading errors, list still works.
      }
    };

    fetchRefs();
  }, []);

  // Reset trang khi filter
  React.useEffect(() => {
    setCurrentPage(1);
  }, [search]);

  const filteredOrders = orders.filter((order) => {
    const keyword = search.trim().toLowerCase();
    return (
      !keyword ||
      order.orderNo.toLowerCase().includes(keyword) ||
      order.customer.toLowerCase().includes(keyword)
    );
  });

  // Calculate Pagination
  const totalItems = filteredOrders.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const paginatedOrders = filteredOrders.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const startIndex = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endIndex = Math.min(currentPage * pageSize, totalItems);

  const closeModal = () => {
    setModalMode(null);
    setSelectedOrder(null);
    setSaving(false);
  };

  const openModal = (mode: ModalMode, order?: OutboundOrder) => {
    setError('');
    setSuccess('');
    setSelectedOrder(order || null);

    if (mode === 'create') {
      setForm(buildEmptyForm());
    } else if (order) {
      setForm({
        orderNo: order.orderNo,
        customer: order.customer,
        dueDate: order.dueDate ? order.dueDate.slice(0, 10) : '',
        status: order.status,
        description: order.description || '',
        details:
          order.details && order.details.length > 0
            ? order.details.map((detail) => ({
                id: crypto.randomUUID(),
                productId: detail.product?.id || '',
                warehouseCode: detail.warehouseCode || '',
                requiredQty: detail.requiredQty,
                unitPrice: detail.unitPrice || '',
              }))
            : [makeEmptyDetailRow()],
      });
    }

    setModalMode(mode);
  };

  const updateDetailRow = (rowId: string, changes: Partial<OutboundDetailRow>) => {
    setForm((current) => ({
      ...current,
      details: current.details.map((row) => (row.id === rowId ? { ...row, ...changes } : row)),
    }));
  };

  const addDetailRow = () => {
    setForm((current) => ({ ...current, details: [...current.details, makeEmptyDetailRow()] }));
  };

  const removeDetailRow = (rowId: string) => {
    setForm((current) => ({
      ...current,
      details: current.details.length > 1
        ? current.details.filter((row) => row.id !== rowId)
        : [makeEmptyDetailRow()],
    }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const validDetails = form.details.filter((row) => row.productId && row.requiredQty !== '' && Number(row.requiredQty) > 0);
    const hasMissingDetail = form.details.some((row) => row.productId ? row.requiredQty === '' || Number(row.requiredQty) <= 0 : false);

    if (!form.orderNo.trim() || !form.customer.trim() || !form.dueDate || validDetails.length === 0 || hasMissingDetail) {
      setError('Vui lòng nhập đầy đủ các thông tin đơn đặt hàng và chi tiết hàng hóa hợp lệ.');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const payload: OutboundCreatePayload = {
        orderNo: form.orderNo.trim().toUpperCase(),
        customer: form.customer.trim(),
        dueDate: form.dueDate,
        status: form.status,
        items: validDetails.length,
        description: form.description.trim() || undefined,
        details: validDetails.map((row) => ({
          productId: row.productId,
          requiredQty: Number(row.requiredQty),
          warehouseCode: row.warehouseCode.trim() || undefined,
          unitPrice: row.unitPrice === '' ? undefined : Number(row.unitPrice),
        })),
      };

      if (modalMode === 'edit' && selectedOrder) {
        await outboundApi.updateOrder(selectedOrder.id, payload);
        setSuccess('Đã cập nhật đơn đặt hàng.');
      } else {
        await outboundApi.createOrder(payload);
        setSuccess('Đã tạo đơn đặt hàng mới.');
      }

      closeModal();
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi khi lưu đơn đặt hàng');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedOrder) return;
    setSaving(true);
    setError('');

    try {
      await outboundApi.deleteOrder(selectedOrder.id);
      setSuccess('Đã xóa đơn đặt hàng.');
      closeModal();
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi khi xóa đơn đặt hàng');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <Toast
        message={error || success}
        type={error ? 'error' : 'success'}
        onClose={() => {
          setError('');
          setSuccess('');
        }}
      />

      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Quản lý đơn đặt hàng</h1>
          <p className="mt-1 text-sm font-medium text-slate-500">
            Theo dõi và quản lý các đơn đặt hàng xuất kho cho khách hàng.
          </p>
        </div>

        <button
          type="button"
          onClick={() => openModal('create')}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-cyan-700"
        >
          <PlusCircle className="h-4 w-4" />
          Tạo đơn đặt hàng
        </button>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="h-11 w-full rounded-xl border-2 border-slate-200 bg-white pl-11 pr-4 text-base outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
            placeholder="Tìm kiếm đơn đặt hàng theo mã SO, khách hàng..."
          />
        </div>
        <div className="flex justify-start xl:justify-end">
          <button className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border-2 border-slate-200 bg-white px-5 text-sm font-bold text-slate-700 transition hover:bg-slate-50">
            <Filter size={18} className="text-slate-500" />
            Lọc đơn đặt hàng
          </button>
        </div>
      </div>

      {/* Wrapper chứa bảng + phân trang dính liền nhau */}
      <div className="mt-5 overflow-hidden rounded-xl border-2 border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1040px] border-collapse bg-white">
            <thead className="bg-slate-50">
              <tr className="border-b-2 border-slate-200">
                <th className="w-16 border-x border-slate-200 px-3 py-4 text-center text-sm font-black uppercase text-slate-700">STT</th>
                <th className="border-x border-slate-200 px-3 py-4 text-center text-sm font-black uppercase text-slate-700">Mã SO</th>
                <th className="border-x border-slate-200 px-3 py-4 text-center text-sm font-black uppercase text-slate-700">Khách hàng</th>
                <th className="border-x border-slate-200 px-3 py-4 text-center text-sm font-black uppercase text-slate-700">Ngày hạn chót</th>
                <th className="border-x border-slate-200 px-3 py-4 text-center text-sm font-black uppercase text-slate-700">Số hàng hóa</th>
                <th className="border-x border-slate-200 px-3 py-4 text-center text-sm font-black uppercase text-slate-700">Trạng thái</th>
                <th className="sticky right-0 w-36 border-l border-slate-200 bg-slate-50 px-3 py-4 text-center text-sm font-black uppercase text-slate-700 shadow-[-4px_0_12px_rgba(0,0,0,0.03)]">
                  Thao tác
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-sm font-medium text-slate-500">
                    Đang tải dữ liệu đơn đặt hàng...
                  </td>
                </tr>
              ) : paginatedOrders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-sm font-medium text-slate-500">
                    Chưa có đơn đặt hàng phù hợp.
                  </td>
                </tr>
              ) : (
                paginatedOrders.map((order, index) => (
                  <tr key={order.id} className="group border-b border-slate-200 transition hover:bg-cyan-50/50">
                    <td className="border-x border-slate-200 px-3 py-4 text-center text-sm text-slate-700">
                      {startIndex + index}
                    </td>
                    <td className="border-x border-slate-200 px-3 py-4 text-center text-sm font-bold text-slate-800">
                      {order.orderNo}
                    </td>
                    <td className="border-x border-slate-200 px-3 py-4 text-center text-sm font-medium text-slate-700">
                      {order.customer}
                    </td>
                    <td className="border-x border-slate-200 px-3 py-4 text-center text-sm text-slate-700">
                      {order.dueDate ? new Date(order.dueDate).toLocaleDateString('vi-VN') : '-'}
                    </td>
                    <td className="border-x border-slate-200 px-3 py-4 text-center text-sm text-slate-700 font-bold">
                      {order.items} <span className="font-medium text-slate-500 text-xs">mặt hàng</span>
                    </td>
                    <td className="border-x border-slate-200 px-3 py-4 text-center align-middle">
                      <span className={`inline-flex rounded-lg border px-3 py-1 text-xs font-bold ${statusColor[order.status]}`}>
                        {statusLabel[order.status]}
                      </span>
                    </td>
                    <td className="sticky right-0 border-l border-slate-200 bg-white px-3 py-4 text-center align-middle shadow-[-4px_0_12px_rgba(0,0,0,0.03)] group-hover:bg-cyan-50/50">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          type="button"
                          className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-50 text-cyan-600 transition-colors hover:bg-cyan-100 hover:text-cyan-700"
                          aria-label="Xem chi tiết"
                          title="Xem chi tiết"
                          onClick={() => openModal('view', order)}
                        >
                          <Eye size={18} strokeWidth={2} />
                        </button>
                        <button
                          type="button"
                          className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-50 text-cyan-600 transition-colors hover:bg-cyan-100 hover:text-cyan-700"
                          aria-label="Sửa đơn đặt hàng"
                          title="Sửa đơn đặt hàng"
                          onClick={() => openModal('edit', order)}
                        >
                          <Pencil size={18} strokeWidth={2} />
                        </button>
                        <button
                          type="button"
                          className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-50 text-cyan-600 transition-colors hover:bg-cyan-100 hover:text-cyan-700"
                          aria-label="Xóa đơn đặt hàng"
                          title="Xóa đơn đặt hàng"
                          onClick={() => openModal('delete', order)}
                        >
                          <Trash2 size={18} strokeWidth={2} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Phân trang */}
        {!loading && totalItems > 0 && (
          <div className="flex flex-col items-center justify-between border-t border-slate-200 bg-slate-50/50 px-6 py-3 sm:flex-row">
            <div className="text-sm text-slate-600">
              Tổng số: <b>{totalItems}</b> <span className="ml-2">Hiển thị {startIndex} - {endIndex}</span>
            </div>
            <div className="mt-4 flex items-center gap-2 sm:mt-0">
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="h-8 rounded-lg border border-slate-300 bg-white px-2 text-sm outline-none transition focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
              >
                <option value={5}>5</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-50"
                >
                  «
                </button>
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-50"
                >
                  ‹
                </button>
                <button className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-600 text-sm font-bold text-white">
                  {currentPage}
                </button>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-50"
                >
                  ›
                </button>
                <button
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-50"
                >
                  »
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {modalMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm transition-all">
          <div className="w-full max-w-3xl rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b-2 border-slate-100 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-cyan-50 p-2 text-cyan-600">
                  <Truck className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-800">
                    {modalMode === 'create' ? 'Tạo đơn đặt hàng mới' : modalMode === 'view' ? 'Chi tiết đơn đặt hàng' : modalMode === 'edit' ? 'Sửa đơn đặt hàng' : 'Xóa đơn đặt hàng'}
                  </h2>
                  <p className="text-sm font-medium text-slate-500">
                    {modalMode === 'view' ? 'Thông tin chỉ xem' : modalMode === 'delete' ? 'Thao tác xóa đơn đặt hàng' : 'Cập nhật thông tin đơn đặt hàng cho khách'}
                  </p>
                </div>
              </div>
              <button type="button" onClick={closeModal} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition">
                <X className="h-5 w-5" />
              </button>
            </div>

            {modalMode === 'delete' ? (
              <div className="px-6 py-5">
                <p className="text-base text-slate-700">
                  Bạn có chắc muốn xóa đơn đặt hàng{' '}
                  <span className="font-black text-slate-950">{selectedOrder?.orderNo}</span> không?
                </p>
                <p className="mt-2 text-sm text-red-500 font-medium">Hành động này không thể hoàn tác.</p>
                <div className="mt-8 flex justify-end gap-3">
                  <button type="button" onClick={closeModal} className="rounded-xl border-2 border-slate-200 px-5 py-2.5 font-bold text-slate-600 hover:bg-slate-50 hover:text-slate-800 transition">
                    Hủy
                  </button>
                  <button 
                    type="button" 
                    onClick={handleDelete} 
                    disabled={saving}
                    className="rounded-xl bg-red-600 px-5 py-2.5 font-bold text-white shadow-sm transition hover:bg-red-700 disabled:opacity-60"
                  >
                    {saving ? 'Đang xóa...' : 'Xóa đơn đặt hàng'}
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="px-6 py-5">
                <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-bold text-slate-700">Mã SO (Sale Order) <span className="text-red-500">*</span></label>
                    <input
                      value={form.orderNo}
                      onChange={(event) => setForm((current) => ({ ...current, orderNo: event.target.value }))}
                      readOnly={modalMode === 'view'}
                      className="h-11 w-full rounded-xl border-2 border-slate-200 px-4 uppercase outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10 read-only:bg-slate-50 read-only:focus:border-slate-200 read-only:focus:ring-0"
                      placeholder="SO-2026-..."
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="mb-2 block text-sm font-bold text-slate-700">Khách hàng <span className="text-red-500">*</span></label>
                    <input
                      value={form.customer}
                      onChange={(event) => setForm((current) => ({ ...current, customer: event.target.value }))}
                      readOnly={modalMode === 'view'}
                      className="h-11 w-full rounded-xl border-2 border-slate-200 px-4 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10 read-only:bg-slate-50 read-only:focus:border-slate-200 read-only:focus:ring-0"
                      placeholder="Tên khách hàng..."
                      required
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-bold text-slate-700">Ngày hạn chót <span className="text-red-500">*</span></label>
                    <input
                      type="date"
                      value={form.dueDate}
                      min={new Date().toISOString().split('T')[0]}
                      onChange={(event) => setForm((current) => ({ ...current, dueDate: event.target.value }))}
                      readOnly={modalMode === 'view'}
                      className="h-11 w-full rounded-xl border-2 border-slate-200 px-4 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10 read-only:bg-slate-50 read-only:focus:border-slate-200 read-only:focus:ring-0"
                      required
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-bold text-slate-700">Trạng thái</label>
                    <select
                      value={form.status}
                      onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as OutboundForm['status'] }))}
                      disabled={modalMode === 'view'}
                      className="h-11 w-full rounded-xl border-2 border-slate-200 bg-white px-4 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10 disabled:bg-slate-50"
                    >
                      <option value="pending">Chờ xử lý</option>
                      <option value="picking">Đang lấy hàng</option>
                      <option value="shipped">Đã giao</option>
                    </select>
                  </div>

                  <div className="md:col-span-2">
                    <label className="mb-2 block text-sm font-bold text-slate-700">Mô tả đơn đặt hàng</label>
                    <textarea
                      value={form.description}
                      onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                      readOnly={modalMode === 'view'}
                      rows={3}
                      className="h-28 w-full rounded-xl border-2 border-slate-200 px-4 py-3 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10 read-only:bg-slate-50 read-only:focus:border-slate-200 read-only:focus:ring-0"
                      placeholder="Ghi chú hoặc thông tin đặc thù cho đơn đặt hàng"
                    />
                  </div>
                </div>

                <div className="mt-8 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-black text-slate-900">Chi tiết hàng xuất</p>
                      <p className="text-sm text-slate-500">Chọn sản phẩm, kho và số lượng cần đặt hàng xuất kho.</p>
                    </div>
                    {modalMode !== 'view' && (
                      <div className="flex gap-2">
                        <ScanBarcodeButton onClick={() => setScannerOpen(true)} />
                        <button
                          type="button"
                          onClick={addDetailRow}
                          className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-cyan-700"
                        >
                          <PlusCircle className="h-4 w-4" />
                          Thêm dòng
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[720px] border-collapse bg-white">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-100 text-left text-xs uppercase tracking-wide text-slate-600">
                          <th className="px-3 py-3">Sản phẩm</th>
                          <th className="px-3 py-3">Kho</th>
                          <th className="px-3 py-3 text-right">Số lượng</th>
                          <th className="px-3 py-3 text-right">Đơn giá</th>
                          <th className="px-3 py-3 text-right">Thành tiền</th>
                          <th className="px-3 py-3 text-center"> </th>
                        </tr>
                      </thead>
                      <tbody>
                        {form.details.map((row) => {
                          const selectedProduct = products.find((item) => item.id === row.productId);
                          const lineTotal = row.requiredQty !== '' && row.unitPrice !== '' ? Number(row.requiredQty) * Number(row.unitPrice) : 0;
                          return (
                            <tr key={row.id} className="border-b border-slate-200">
                              <td className="px-3 py-3 align-top">
                                {modalMode === 'view' ? (
                                  <div className="text-sm font-medium text-slate-700">{selectedProduct?.name || '-'}</div>
                                ) : (
                                  <select
                                    value={row.productId}
                                    onChange={(event) => updateDetailRow(row.id, { productId: event.target.value })}
                                    className="h-11 w-full rounded-xl border-2 border-slate-200 bg-white px-3 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
                                  >
                                    <option value="">Chọn sản phẩm</option>
                                    {products.map((product) => (
                                      <option key={product.id} value={product.id}>{`${product.internalSku} • ${product.name}`}</option>
                                    ))}
                                  </select>
                                )}
                              </td>
                              <td className="px-3 py-3 align-top">
                                {modalMode === 'view' ? (
                                  <div className="text-sm font-medium text-slate-700">{row.warehouseCode || '-'}</div>
                                ) : (
                                  <select
                                    value={row.warehouseCode}
                                    onChange={(event) => updateDetailRow(row.id, { warehouseCode: event.target.value })}
                                    className="h-11 w-full rounded-xl border-2 border-slate-200 bg-white px-3 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
                                  >
                                    <option value="">Chọn kho</option>
                                    {warehouses.map((warehouse) => (
                                      <option key={warehouse.id} value={warehouse.code}>{`${warehouse.code} • ${warehouse.name}`}</option>
                                    ))}
                                  </select>
                                )}
                              </td>
                              <td className="px-3 py-3 align-top">
                                <input
                                  type="number"
                                  min="1"
                                  value={row.requiredQty}
                                  onChange={(event) => updateDetailRow(row.id, { requiredQty: event.target.value ? Number(event.target.value) : '' })}
                                  readOnly={modalMode === 'view'}
                                  className="h-11 w-full rounded-xl border-2 border-slate-200 px-3 text-right outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10 read-only:bg-slate-50 read-only:focus:border-slate-200 read-only:focus:ring-0"
                                  placeholder="0"
                                />
                              </td>
                              <td className="px-3 py-3 align-top">
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={row.unitPrice}
                                  onChange={(event) => updateDetailRow(row.id, { unitPrice: event.target.value ? Number(event.target.value) : '' })}
                                  readOnly={modalMode === 'view'}
                                  className="h-11 w-full rounded-xl border-2 border-slate-200 px-3 text-right outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10 read-only:bg-slate-50 read-only:focus:border-slate-200 read-only:focus:ring-0"
                                  placeholder="0.00"
                                />
                              </td>
                              <td className="px-3 py-3 align-top text-right text-sm font-bold text-slate-800">{lineTotal.toLocaleString('vi-VN')}</td>
                              <td className="px-3 py-3 align-top text-center">
                                {modalMode !== 'view' ? (
                                  <button
                                    type="button"
                                    onClick={() => removeDetailRow(row.id)}
                                    className="inline-flex h-9 min-w-[40px] items-center justify-center rounded-xl bg-red-50 text-red-600 transition hover:bg-red-100"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                ) : null}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="mt-8 flex justify-end gap-3">
                  <button type="button" onClick={closeModal} className="rounded-xl border-2 border-slate-200 px-5 py-2.5 font-bold text-slate-600 hover:bg-slate-50 hover:text-slate-800 transition">
                    {modalMode === 'view' ? 'Đóng' : 'Hủy'}
                  </button>
                  {modalMode !== 'view' && (
                    <button 
                      type="submit" 
                      disabled={saving}
                      className="rounded-xl bg-cyan-600 px-6 py-2.5 font-bold text-white shadow-sm transition hover:bg-cyan-700 disabled:opacity-60"
                    >
                      {saving ? 'Đang lưu...' : modalMode === 'create' ? 'Tạo đơn đặt hàng' : 'Lưu thay đổi'}
                    </button>
                  )}
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Tích hợp Barcode Scanner */}
      <BarcodeScanner
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onProductFound={handleProductScanned}
        title="Quét mã vạch xuất kho"
      />
    </div>
  );
}