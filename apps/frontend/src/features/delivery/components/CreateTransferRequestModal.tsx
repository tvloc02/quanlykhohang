import React from 'react';
import { X, Plus, Trash2, Search, Package } from 'lucide-react';
const API_BASE_URL = 'http://localhost:3000/api';
function authHeaders() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${localStorage.getItem('token')}`,
  };
}

type Product = {
  id: string;
  internalSku: string;
  name: string;
  unit: string | null;
  totalStock: number;
};

type Warehouse = {
  id: string;
  code: string;
  name: string;
  managerIds: string[];
};

type CreateTransferRequestModalProps = {
  onClose: () => void;
  onSuccess: () => void;
  setToast: (toast: { type: 'success' | 'error'; message: string }) => void;
};

export default function CreateTransferRequestModal({ onClose, onSuccess, setToast }: CreateTransferRequestModalProps) {
  const [sourceWarehouse, setSourceWarehouse] = React.useState('');
  const [destinationWarehouse, setDestinationWarehouse] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [transferDate, setTransferDate] = React.useState('');
  const [receiveDate, setReceiveDate] = React.useState('');
  const [managerId, setManagerId] = React.useState('');
  const [items, setItems] = React.useState<{ productId: string; product: Product; quantity: number }[]>([]);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const [warehouses, setWarehouses] = React.useState<Warehouse[]>([]);
  const [products, setProducts] = React.useState<Product[]>([]);
  const [managers, setManagers] = React.useState<any[]>([]);

  const [isProductModalOpen, setIsProductModalOpen] = React.useState(false);
  const [productSearch, setProductSearch] = React.useState('');

  React.useEffect(() => {
    async function loadData() {
      try {
        const [whRes, prRes, usersRes] = await Promise.all([
          fetch(`${API_BASE_URL}/warehouses`, { headers: authHeaders() }),
          fetch(`${API_BASE_URL}/products`, { headers: authHeaders() }),
          fetch(`${API_BASE_URL}/users`, { headers: authHeaders() })
        ]);
        
        if (whRes.ok) setWarehouses(await whRes.json());
        if (prRes.ok) setProducts(await prRes.json());
        if (usersRes.ok) {
          const users = await usersRes.json();
          // Filter managers (assuming role is manager or admin)
          setManagers(users.filter((u: any) => u.role === 'ADMIN' || u.role === 'MANAGER'));
        }
      } catch (err) {
        console.error('Lỗi tải dữ liệu', err);
      }
    }
    loadData();
  }, []);

  const handleAddProducts = (selectedProducts: Product[]) => {
    const newItems = selectedProducts.filter(p => !items.find(i => i.productId === p.id));
    setItems([...items, ...newItems.map(p => ({ productId: p.id, product: p, quantity: 1 }))]);
    setIsProductModalOpen(false);
    setProductSearch('');
  };

  const handleRemoveItem = (productId: string) => {
    setItems(items.filter(i => i.productId !== productId));
  };

  const handleQuantityChange = (productId: string, quantity: string) => {
    const val = parseInt(quantity) || 0;
    setItems(items.map(i => i.productId === productId ? { ...i, quantity: val } : i));
  };

  const handleSubmit = async (status: 'DRAFT' | 'PENDING') => {
    if (!sourceWarehouse || !destinationWarehouse) {
      setToast({ type: 'error', message: 'Vui lòng chọn kho nguồn và kho đích' });
      return;
    }
    if (sourceWarehouse === destinationWarehouse) {
      setToast({ type: 'error', message: 'Kho nguồn và kho đích không được trùng nhau' });
      return;
    }
    if (!transferDate) {
      setToast({ type: 'error', message: 'Vui lòng chọn ngày giờ chuyển dự kiến' });
      return;
    }
    if (status === 'PENDING' && !managerId) {
      setToast({ type: 'error', message: 'Vui lòng chọn người quản lý duyệt' });
      return;
    }
    if (items.length === 0) {
      setToast({ type: 'error', message: 'Vui lòng chọn ít nhất một sản phẩm' });
      return;
    }

    setIsSubmitting(true);
    try {
      // Fake API call since we don't have a backend endpoint yet for creating this
      await new Promise(resolve => setTimeout(resolve, 800));
      setToast({ type: 'success', message: status === 'DRAFT' ? 'Đã lưu nháp yêu cầu điều chuyển!' : 'Đã gửi yêu cầu điều chuyển thành công!' });
      onSuccess();
    } catch (error: any) {
      setToast({ type: 'error', message: error.message || 'Lỗi hệ thống' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
      <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-6 py-4">
          <div>
            <h2 className="text-xl font-black text-slate-900">Tạo yêu cầu điều chuyển</h2>
            <p className="mt-1 text-sm font-medium text-slate-500">Thiết lập yêu cầu điều chuyển hàng hóa giữa các kho</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl border border-slate-200 bg-white p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-bold text-slate-700">Kho nguồn <span className="text-red-500">*</span></label>
              <select
                value={sourceWarehouse}
                onChange={(e) => setSourceWarehouse(e.target.value)}
                className="h-11 w-full rounded-xl border-2 border-slate-200 bg-white px-4 text-sm font-medium outline-none transition focus:border-cyan-500"
              >
                <option value="">-- Chọn kho nguồn --</option>
                {warehouses
                  .filter(w => w.code !== destinationWarehouse)
                  .map(w => (
                    <option key={w.code} value={w.code}>{w.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-2 block text-sm font-bold text-slate-700">Kho đích <span className="text-red-500">*</span></label>
              <select
                value={destinationWarehouse}
                onChange={(e) => setDestinationWarehouse(e.target.value)}
                className="h-11 w-full rounded-xl border-2 border-slate-200 bg-white px-4 text-sm font-medium outline-none transition focus:border-cyan-500"
              >
                <option value="">-- Chọn kho đích --</option>
                {warehouses
                  .filter(w => w.code !== sourceWarehouse)
                  .map(w => (
                    <option key={w.code} value={w.code}>{w.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-2 block text-sm font-bold text-slate-700">Ngày giờ xuất dự kiến <span className="text-red-500">*</span></label>
              <input
                type="datetime-local"
                value={transferDate}
                onChange={(e) => setTransferDate(e.target.value)}
                className="h-11 w-full rounded-xl border-2 border-slate-200 bg-white px-4 text-sm font-medium outline-none transition focus:border-cyan-500"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-bold text-slate-700">Ngày giờ nhận dự kiến</label>
              <input
                type="datetime-local"
                value={receiveDate}
                onChange={(e) => setReceiveDate(e.target.value)}
                className="h-11 w-full rounded-xl border-2 border-slate-200 bg-white px-4 text-sm font-medium outline-none transition focus:border-cyan-500"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-bold text-slate-700">Người quản lý duyệt <span className="text-red-500">*</span></label>
              <select
                value={managerId}
                onChange={(e) => setManagerId(e.target.value)}
                className="h-11 w-full rounded-xl border-2 border-slate-200 bg-white px-4 text-sm font-medium outline-none transition focus:border-cyan-500"
              >
                <option value="">-- Chọn người quản lý duyệt --</option>
                {managers
                  .filter(m => !sourceWarehouse || warehouses.find(w => w.code === sourceWarehouse)?.managerIds?.includes(m.id))
                  .map(m => (
                    <option key={m.id} value={m.id}>{m.fullName || m.username}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-2 block text-sm font-bold text-slate-700">Ghi chú / Lý do điều chuyển</label>
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Nhập lý do điều chuyển hàng hóa..."
                className="h-11 w-full rounded-xl border-2 border-slate-200 bg-white px-4 text-sm font-medium outline-none transition focus:border-cyan-500"
              />
            </div>
          </div>

          <div className="mt-8">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-black text-slate-900">Danh sách sản phẩm điều chuyển</h3>
              <button
                type="button"
                onClick={() => setIsProductModalOpen(true)}
                className="inline-flex items-center gap-2 rounded-xl bg-cyan-50 px-4 py-2 text-sm font-bold text-cyan-700 transition hover:bg-cyan-100"
              >
                <Plus className="h-4 w-4" />
                Thêm sản phẩm
              </button>
            </div>

            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                  <tr className="border-b border-slate-200">
                    <th className="px-4 py-3 font-semibold">Sản phẩm</th>
                    <th className="px-4 py-3 font-semibold w-24">ĐVT</th>
                    <th className="px-4 py-3 font-semibold w-40">Số lượng điều chuyển</th>
                    <th className="px-4 py-3 font-semibold w-20 text-center">Xóa</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                        Chưa có sản phẩm nào được chọn
                      </td>
                    </tr>
                  ) : (
                    items.map(item => (
                      <tr key={item.productId} className="hover:bg-slate-50">
                        <td className="px-4 py-3">
                          <div className="font-bold text-slate-900">{item.product.name}</div>
                          <div className="text-xs text-slate-500">{item.product.internalSku}</div>
                        </td>
                        <td className="px-4 py-3 text-slate-700">{item.product.unit || '---'}</td>
                        <td className="px-4 py-3">
                          <input
                            type="number"
                            min="1"
                            value={item.quantity || ''}
                            onChange={(e) => handleQuantityChange(item.productId, e.target.value)}
                            className="w-full rounded-lg border-2 border-slate-200 px-3 py-1.5 outline-none transition focus:border-cyan-500"
                          />
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(item.productId)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-red-50 text-red-600 transition hover:bg-red-100"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-slate-100 bg-slate-50 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-xl border-2 border-slate-200 bg-white px-5 py-2.5 font-bold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
          >
            Hủy bỏ
          </button>
          <button
            onClick={() => handleSubmit('DRAFT')}
            disabled={isSubmitting}
            className="inline-flex items-center gap-2 rounded-xl border-2 border-cyan-600 px-5 py-2.5 font-bold text-cyan-600 transition hover:bg-cyan-50 disabled:opacity-50"
          >
            Lưu nháp
          </button>
          <button
            onClick={() => handleSubmit('PENDING')}
            disabled={isSubmitting}
            className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-5 py-2.5 font-bold text-white shadow-sm transition hover:bg-cyan-700 disabled:opacity-50"
          >
            {isSubmitting ? (
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              'Gửi yêu cầu duyệt'
            )}
          </button>
        </div>
      </div>

      {isProductModalOpen && (
        <ProductSelectionModal
          products={products}
          selectedProductIds={items.map(i => i.productId)}
          onClose={() => setIsProductModalOpen(false)}
          onConfirm={handleAddProducts}
        />
      )}
    </div>
  );
}

function ProductSelectionModal({ products, selectedProductIds, onClose, onConfirm }: { products: Product[], selectedProductIds: string[], onClose: () => void, onConfirm: (products: Product[]) => void }) {
  const [search, setSearch] = React.useState('');
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set(selectedProductIds));

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase()) || 
    p.internalSku.toLowerCase().includes(search.toLowerCase())
  );

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const handleConfirm = () => {
    onConfirm(products.filter(p => selectedIds.has(p.id)));
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
      <div className="flex h-[80vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 className="text-xl font-black text-slate-900">Chọn sản phẩm</h2>
          <button onClick={onClose} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="border-b border-slate-200 bg-slate-50 p-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm kiếm theo mã, tên sản phẩm..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-11 w-full rounded-xl border-2 border-slate-200 bg-white pl-11 pr-4 outline-none focus:border-cyan-500"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {filteredProducts.length === 0 ? (
            <div className="py-12 text-center text-slate-500">Không tìm thấy sản phẩm phù hợp</div>
          ) : (
            <div className="grid gap-3">
              {filteredProducts.map(p => (
                <div
                  key={p.id}
                  onClick={() => toggleSelect(p.id)}
                  className={`flex cursor-pointer items-center gap-4 rounded-xl border-2 p-4 transition ${selectedIds.has(p.id) ? 'border-cyan-500 bg-cyan-50/50' : 'border-slate-200 bg-white hover:border-slate-300'}`}
                >
                  <div className={`flex h-6 w-6 items-center justify-center rounded-md border-2 transition ${selectedIds.has(p.id) ? 'border-cyan-500 bg-cyan-500' : 'border-slate-300 bg-white'}`}>
                    {selectedIds.has(p.id) && <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                  </div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100">
                    <Package className="h-6 w-6 text-slate-400" />
                  </div>
                  <div>
                    <div className="font-bold text-slate-900">{p.name}</div>
                    <div className="text-sm text-slate-500">Mã: {p.internalSku} • Tồn kho: {p.totalStock}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-6 py-4">
          <div className="text-sm font-bold text-slate-700">Đã chọn: <span className="text-cyan-600">{selectedIds.size}</span> sản phẩm</div>
          <div className="flex gap-3">
            <button onClick={onClose} className="rounded-xl border border-slate-200 px-5 py-2.5 font-bold text-slate-600 hover:bg-slate-100">
              Hủy
            </button>
            <button onClick={handleConfirm} className="rounded-xl bg-cyan-600 px-5 py-2.5 font-bold text-white hover:bg-cyan-700">
              Xác nhận
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
