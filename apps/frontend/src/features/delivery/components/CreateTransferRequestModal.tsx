import React from 'react';
import { X, Plus, Trash2, Search, Package, ChevronDown } from 'lucide-react';
const API_BASE_URL = 'http://localhost:3000/api';
function authHeaders() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${localStorage.getItem('token')}`,
  };
}

interface CustomSelectProps {
  value: string;
  onChange: (val: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  label?: string;
  required?: boolean;
}

function CustomSelect({
  value,
  onChange,
  options,
  placeholder = 'Chọn...',
  disabled,
  className = '',
  label,
  required,
}: CustomSelectProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOption = options.find((o) => o.value === value);

  const selectBody = (
    <div ref={containerRef} className="relative w-full">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={`h-11 w-full rounded-xl border-2 border-cyan-500 bg-white px-4 pr-10 text-left text-sm font-bold text-slate-700 outline-none transition focus:border-cyan-600 focus:ring-4 focus:ring-cyan-500/10 shadow-sm flex items-center justify-between cursor-pointer disabled:bg-slate-50 disabled:text-slate-400 ${className}`}
      >
        <span className="truncate pr-2">{selectedOption ? selectedOption.label : placeholder}</span>
        <ChevronDown className={`h-4 w-4 text-cyan-600 shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {isOpen && !disabled && (
        <div className="absolute left-0 right-0 top-full mt-1.5 max-h-72 overflow-y-auto rounded-xl border-2 border-cyan-500 bg-white p-1.5 shadow-2xl z-[9999] animate-in fade-in duration-100">
          {options.length === 0 ? (
            <div className="px-4 py-3 text-sm font-semibold text-slate-400 text-center">Không có lựa chọn</div>
          ) : (
            options.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
                className={`w-full rounded-lg px-4 py-2.5 text-left text-sm font-bold transition ${
                  option.value === value
                    ? 'bg-cyan-50 text-cyan-700 font-black'
                    : 'text-slate-700 hover:bg-cyan-50/50 hover:text-cyan-600'
                }`}
              >
                {option.label}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );

  if (label) {
    return (
      <div>
        <label className="mb-2 block text-sm font-bold text-slate-700">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
        {selectBody}
      </div>
    );
  }

  return selectBody;
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
          setManagers(Array.isArray(users) ? users.filter((u: any) => u.roles?.some((r: any) => ['admin', 'manager'].includes(String(r.name).toLowerCase()))) : []);
        }
      } catch (err) {
        console.error('Lỗi tải dữ liệu', err);
      }
    }
    loadData();
  }, []);

  const handleAddProducts = (selectedItemsWithQty: { product: Product; quantity: number }[]) => {
    const newItems = selectedItemsWithQty.map(item => ({
      productId: item.product.id,
      product: item.product,
      quantity: item.quantity
    }));
    setItems(newItems);
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
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-md">
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
            <CustomSelect
              label="Kho nguồn"
              required
              value={sourceWarehouse}
              onChange={(val) => setSourceWarehouse(val)}
              placeholder="-- Chọn kho nguồn --"
              options={warehouses
                .filter(w => w.code !== destinationWarehouse)
                .map(w => ({ value: w.code, label: w.name }))}
            />
            <CustomSelect
              label="Kho đích"
              required
              value={destinationWarehouse}
              onChange={(val) => setDestinationWarehouse(val)}
              placeholder="-- Chọn kho đích --"
              options={warehouses
                .filter(w => w.code !== sourceWarehouse)
                .map(w => ({ value: w.code, label: w.name }))}
            />
            <div>
              <label className="mb-2 block text-sm font-bold text-slate-700">Ngày giờ xuất dự kiến <span className="text-red-500">*</span></label>
              <input
                type="datetime-local"
                value={transferDate}
                onChange={(e) => setTransferDate(e.target.value)}
                className="h-11 w-full rounded-xl border-2 border-cyan-500 bg-white px-4 text-sm font-semibold outline-none transition focus:border-cyan-600 focus:ring-4 focus:ring-cyan-500/10 shadow-sm"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-bold text-slate-700">Ngày giờ nhận dự kiến</label>
              <input
                type="datetime-local"
                value={receiveDate}
                onChange={(e) => setReceiveDate(e.target.value)}
                className="h-11 w-full rounded-xl border-2 border-cyan-500 bg-white px-4 text-sm font-semibold outline-none transition focus:border-cyan-600 focus:ring-4 focus:ring-cyan-500/10 shadow-sm"
              />
            </div>
            <CustomSelect
              label="Người quản lý duyệt"
              required
              value={managerId}
              onChange={(val) => setManagerId(val)}
              placeholder="-- Chọn người quản lý duyệt --"
              options={managers
                .filter(m => {
                  const wh = warehouses.find(w => w.code === sourceWarehouse);
                  if (!sourceWarehouse || !wh || !wh.managerIds || wh.managerIds.length === 0) return true;
                  return wh.managerIds.includes(m.id);
                })
                .map(m => ({ value: m.id, label: m.fullName || m.email || m.username || 'Quản lý' }))}
            />
            <div>
              <label className="mb-2 block text-sm font-bold text-slate-700">Ghi chú / Lý do điều chuyển</label>
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Nhập lý do điều chuyển hàng hóa..."
                className="h-11 w-full rounded-xl border-2 border-cyan-500 bg-white px-4 text-sm font-semibold outline-none transition focus:border-cyan-600 focus:ring-4 focus:ring-cyan-500/10 shadow-sm"
              />
            </div>
          </div>

          <div className="mt-8">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-black text-slate-900">Danh sách sản phẩm điều chuyển</h3>
              <button
                type="button"
                onClick={() => setIsProductModalOpen(true)}
                className="inline-flex items-center gap-2 rounded-xl border-2 border-cyan-500 bg-cyan-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-cyan-700 shadow-sm"
              >
                <Plus className="h-4 w-4" />
                Thêm sản phẩm
              </button>
            </div>

            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <table className="w-full min-w-[600px] border-collapse bg-white text-left text-sm">
                <thead className="bg-cyan-50 text-xs uppercase text-slate-800">
                  <tr className="border-b border-slate-200">
                    <th className="w-16 border-x border-slate-200 px-3 py-3.5 text-center font-extrabold text-slate-800">STT</th>
                    <th className="border-x border-slate-200 px-4 py-3.5 font-extrabold text-slate-800">Tên sản phẩm</th>
                    <th className="w-44 border-x border-slate-200 px-4 py-3.5 text-center font-extrabold text-slate-800">Số lượng trong kho</th>
                    <th className="w-44 border-x border-slate-200 px-4 py-3.5 text-center font-extrabold text-slate-800">Số lượng điều chuyển</th>
                    <th className="w-24 border-x border-slate-200 px-4 py-3.5 text-center font-extrabold text-slate-800">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-slate-500 font-semibold">
                        Chưa có sản phẩm nào được chọn
                      </td>
                    </tr>
                  ) : (
                    items.map((item, index) => (
                      <tr key={item.productId} className="hover:bg-cyan-50/30 transition">
                        <td className="border-x border-slate-200 px-3 py-3 text-center font-bold text-slate-600">
                          {index + 1}
                        </td>
                        <td className="border-x border-slate-200 px-4 py-3">
                          <div className="font-bold text-slate-900">{item.product.name}</div>
                          <div className="text-xs font-semibold text-slate-500">Mã: {item.product.internalSku} {item.product.unit ? `(${item.product.unit})` : ''}</div>
                        </td>
                        <td className="border-x border-slate-200 px-4 py-3 text-center">
                          <span className={`inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-bold ${item.product.totalStock > 0 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                            {item.product.totalStock.toLocaleString('vi-VN')} {item.product.unit || ''}
                          </span>
                        </td>
                        <td className="border-x border-slate-200 px-4 py-3 text-center">
                          <input
                            type="number"
                            min="1"
                            max={item.product.totalStock > 0 ? item.product.totalStock : undefined}
                            value={item.quantity || ''}
                            onChange={(e) => handleQuantityChange(item.productId, e.target.value)}
                            className="h-10 w-28 rounded-xl border-2 border-cyan-500 bg-white px-3 text-center font-bold text-slate-900 outline-none transition focus:border-cyan-600 focus:ring-4 focus:ring-cyan-500/10 shadow-sm"
                          />
                        </td>
                        <td className="border-x border-slate-200 px-4 py-3 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(item.productId)}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-red-50 text-red-600 border border-red-200 transition hover:bg-red-100 hover:text-red-700 shadow-sm"
                            title="Xóa sản phẩm"
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
          initialItems={items.map(i => ({ productId: i.productId, quantity: i.quantity }))}
          onClose={() => setIsProductModalOpen(false)}
          onConfirm={handleAddProducts}
        />
      )}
    </div>
  );
}

function ProductSelectionModal({
  products,
  initialItems,
  onClose,
  onConfirm
}: {
  products: Product[];
  initialItems: { productId: string; quantity: number }[];
  onClose: () => void;
  onConfirm: (items: { product: Product; quantity: number }[]) => void;
}) {
  const [search, setSearch] = React.useState('');
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(() => new Set(initialItems.map(i => i.productId)));
  const [quantities, setQuantities] = React.useState<Record<string, number>>(() => {
    const q: Record<string, number> = {};
    initialItems.forEach(i => q[i.productId] = i.quantity);
    return q;
  });

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase()) || 
    p.internalSku.toLowerCase().includes(search.toLowerCase())
  );

  const handleConfirm = () => {
    const result = products
      .filter(p => selectedIds.has(p.id))
      .map(p => ({
        product: p,
        quantity: quantities[p.id] || 1
      }));
    onConfirm(result);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
      <div className="flex h-[80vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 className="text-xl font-black text-slate-900">Chọn sản phẩm</h2>
          <button onClick={onClose} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="border-b border-slate-200 bg-slate-50 p-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-cyan-500" />
            <input
              type="text"
              placeholder="Tìm kiếm theo mã, tên sản phẩm..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-11 w-full rounded-xl border-2 border-cyan-500 bg-white pl-11 pr-4 text-sm font-semibold outline-none transition focus:border-cyan-600 focus:ring-4 focus:ring-cyan-500/10 shadow-sm"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 bg-slate-50/50">
          {filteredProducts.length === 0 ? (
            <div className="py-12 text-center text-slate-500">Không tìm thấy sản phẩm phù hợp</div>
          ) : (
            <div className="grid gap-3">
              {filteredProducts.map(p => (
                <div
                  key={p.id}
                  className={`flex items-center gap-4 rounded-xl border-2 p-4 transition ${selectedIds.has(p.id) ? 'border-cyan-500 bg-cyan-50/30 shadow-sm' : 'border-slate-200 bg-white hover:border-slate-300'}`}
                >
                  <div
                    className={`flex h-6 w-6 flex-shrink-0 cursor-pointer items-center justify-center rounded-md border-2 transition ${selectedIds.has(p.id) ? 'border-cyan-500 bg-cyan-500' : 'border-slate-300 bg-white'}`}
                    onClick={() => {
                      const next = new Set(selectedIds);
                      if (next.has(p.id)) {
                        next.delete(p.id);
                      } else {
                        next.add(p.id);
                        if (!quantities[p.id]) {
                          setQuantities(prev => ({ ...prev, [p.id]: 1 }));
                        }
                      }
                      setSelectedIds(next);
                    }}
                  >
                    {selectedIds.has(p.id) && <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                  </div>
                  <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-xl bg-slate-100 border border-slate-200">
                    <Package className="h-7 w-7 text-slate-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-slate-900 truncate">{p.name}</div>
                    <div className="text-sm text-slate-500 mt-0.5">Mã: {p.internalSku}</div>
                  </div>
                  <div className="flex flex-col items-end gap-2 flex-shrink-0">
                    <div className="text-sm font-semibold text-slate-700 bg-slate-100 px-3 py-1 rounded-lg border border-slate-200">
                      Tồn kho: <span className={`ml-1 ${p.totalStock > 0 ? "text-emerald-600 font-bold" : "text-red-500 font-bold"}`}>{p.totalStock}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-slate-600">SL chuyển:</span>
                      <input
                        type="number"
                        min="1"
                        max={p.totalStock > 0 ? p.totalStock : undefined}
                        value={quantities[p.id] || ''}
                        onChange={(e) => {
                          const val = parseInt(e.target.value);
                          setQuantities(prev => ({ ...prev, [p.id]: isNaN(val) ? 0 : val }));
                          if (val > 0) {
                            const next = new Set(selectedIds);
                            next.add(p.id);
                            setSelectedIds(next);
                          } else if (val === 0 || isNaN(val)) {
                            const next = new Set(selectedIds);
                            next.delete(p.id);
                            setSelectedIds(next);
                          }
                        }}
                        className="w-24 rounded-lg border-2 border-slate-200 px-3 py-1.5 text-right font-bold text-slate-900 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20"
                        placeholder="0"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-6 py-4">
          <div className="text-sm font-bold text-slate-700">Đã chọn: <span className="text-cyan-600 text-lg">{selectedIds.size}</span> sản phẩm</div>
          <div className="flex gap-3">
            <button onClick={onClose} className="rounded-xl border-2 border-slate-200 bg-white px-5 py-2.5 font-bold text-slate-600 transition hover:bg-slate-50">
              Hủy
            </button>
            <button onClick={handleConfirm} className="rounded-xl bg-cyan-600 px-5 py-2.5 font-bold text-white shadow-sm transition hover:bg-cyan-700">
              Xác nhận
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
