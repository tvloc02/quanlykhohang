import re

file_path = r'd:\ĐỒ ÁN TỐT NGHIỆP\Quản lý kho\apps\frontend\src\features\inbound\pages\AssemblyPage.tsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# ADD IMPORTS
if "getStoredCatalogCategories" not in content:
    imports = """import {
  ArrowRight,
  CheckCircle2,
  FileText,
  RefreshCw,
  Search,
  ShoppingCart,
  X,
  PlusCircle,
  Settings2,
  Clock3,
  Download,
  Eye,
  Package
} from 'lucide-react';
import {
  getActiveItemGroupCategories,
  getStoredCatalogCategories,
} from '../../shared/utils/catalogCategories';
import { getStoredWarehouses } from '../../shared/utils/warehouseAssignments';
"""
    content = re.sub(r"import \{\n[^\}]+} from 'lucide-react';", imports, content)

# UPDATE STATE FOR DISTFORM
state_old = """  const [distForm, setDistForm] = React.useState({
    orderId: '',
    detailId: '',
    productId: '',
    categoryId: '',
    price: '',
    qtyToSell: '1',
    // New fields
    mode: 'existing' as 'existing' | 'new',
    targetProductId: '',
    newProductSku: '',
    newProductName: '',
  });"""

state_new = """  const [catalogCategories, setCatalogCategories] = React.useState(() => getStoredCatalogCategories());
  const [warehouses, setWarehouses] = React.useState(() => getStoredWarehouses());

  React.useEffect(() => {
    const syncMasterData = () => {
      setCatalogCategories(getStoredCatalogCategories());
      setWarehouses(getStoredWarehouses());
    };
    window.addEventListener('storage', syncMasterData);
    return () => window.removeEventListener('storage', syncMasterData);
  }, []);

  const categoryOptions = getActiveItemGroupCategories(catalogCategories);
  const unitOptions = catalogCategories.filter((category) => category.type === 'unit' && category.status === 'active');
  const managementTypeOptions = catalogCategories.filter(
    (category) => category.type === 'management-attribute' && category.status === 'active',
  );
  const locationOptions = catalogCategories.filter(
    (category) => category.type === 'storage-position' && category.status === 'active',
  );

  const [distForm, setDistForm] = React.useState({
    orderId: '',
    detailId: '',
    productId: '',
    categoryId: '',
    price: '',
    qtyToSell: '1',
    mode: 'existing' as 'existing' | 'new',
    targetProductId: '',
    // Full product fields
    newProductSku: '',
    newProductName: '',
    newProductCategory: '',
    newProductUnit: '',
    newProductDefaultWarehouse: '',
    newProductLocation: '',
    newProductManagementType: '',
    newProductSupplier: '',
    newProductImages: [] as string[],
  });"""
if state_old in content:
    content = content.replace(state_old, state_new)
else:
    print("Could not find state_old")

# UPDATE OPEN MODAL
open_old = """    setDistForm({
      orderId: '',
      detailId: '',
      productId: row.productId,
      categoryId: p?.category?.id || categories[0]?.id || '',
      price: p?.price ? String(p.price) : '0',
      qtyToSell: String(row.remainingQty),
      mode: 'existing',
      targetProductId: '',
      newProductSku: '',
      newProductName: '',
    });"""

open_new = """    setDistForm({
      orderId: '',
      detailId: '',
      productId: row.productId,
      categoryId: '',
      price: '0',
      qtyToSell: String(row.remainingQty),
      mode: 'existing',
      targetProductId: '',
      newProductSku: '',
      newProductName: '',
      newProductCategory: categoryOptions[0]?.name || '',
      newProductUnit: unitOptions[0]?.name || '',
      newProductDefaultWarehouse: warehouses[0]?.name || '',
      newProductLocation: locationOptions[0]?.name || '',
      newProductManagementType: managementTypeOptions[0]?.name || '',
      newProductSupplier: '',
      newProductImages: [],
    });"""
if open_old in content:
    content = content.replace(open_old, open_new)
else:
    print("Could not find open_old")


# UPDATE SUBMIT API
submit_old = """        const createRes = await fetch(`${API_BASE_URL}/products`, {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify({
            internalSku: distForm.newProductSku,
            name: distForm.newProductName,
            categoryId: distForm.categoryId || undefined,
            price: parseNumber(distForm.price),
          }),
        });"""

submit_new = """        const createRes = await fetch(`${API_BASE_URL}/products`, {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify({
            sku: distForm.newProductSku.trim().toUpperCase(),
            internalSku: distForm.newProductSku.trim().toUpperCase(),
            name: distForm.newProductName.trim(),
            category: distForm.newProductCategory.trim(),
            unit: distForm.newProductUnit.trim(),
            defaultWarehouse: distForm.newProductDefaultWarehouse.trim(),
            location: distForm.newProductLocation.trim(),
            managementType: distForm.newProductManagementType.trim(),
            supplier: distForm.newProductSupplier.trim(),
            price: parseNumber(distForm.price),
            stock: 0,
            images: distForm.newProductImages,
          }),
        });"""
if submit_old in content:
    content = content.replace(submit_old, submit_new)
else:
    print("Could not find submit_old")

# UPDATE JSX MODAL
modal_old = r'\{distributionModalOpen && \(\s*<div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">\s*<div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl">[\s\S]*?(?=\{historyModalOpen && selectedRowHistory && \()'

modal_new = """{distributionModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-3 backdrop-blur-sm">
          <div className="flex w-full max-w-[95vw] flex-col" style={{ height: '92vh', borderRadius: '1rem', background: '#fff', boxShadow: '0 25px 60px rgba(0,0,0,0.18)' }}>
            <div className="flex shrink-0 items-center justify-between border-b-2 border-slate-100 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-cyan-50 p-2 text-cyan-600">
                  <Package className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-800">Phân phối bán hàng</h2>
                  <p className="text-sm font-medium text-slate-500">Chuyển nguồn hàng vào danh mục Sản phẩm Bán</p>
                </div>
              </div>
              <button type="button" onClick={() => setDistributionModalOpen(false)} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition">
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="p-6 shrink-0 border-b border-slate-100">
              <div className="flex gap-2 p-1 bg-slate-100 rounded-xl w-full max-w-md mx-auto">
                <button
                  type="button"
                  onClick={() => setDistForm(d => ({ ...d, mode: 'existing' }))}
                  className={`flex-1 rounded-lg py-2 text-sm font-bold transition ${distForm.mode === 'existing' ? 'bg-white shadow text-cyan-700' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  Chọn sản phẩm có sẵn
                </button>
                <button
                  type="button"
                  onClick={() => setDistForm(d => ({ ...d, mode: 'new' }))}
                  className={`flex-1 rounded-lg py-2 text-sm font-bold transition ${distForm.mode === 'new' ? 'bg-white shadow text-cyan-700' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  Tạo sản phẩm mới
                </button>
              </div>
            </div>

            <div className="flex min-h-0 flex-1 divide-x divide-slate-100 overflow-hidden">
              {distForm.mode === 'new' && (
                <>
                  {/* CỘT 1: Ảnh sản phẩm */}
                  <div className="w-44 shrink-0 flex flex-col gap-2 overflow-y-auto p-4 bg-slate-50/60">
                    <p className="text-xs font-black uppercase tracking-wider text-slate-400 mb-1">Ảnh sản phẩm</p>
                    <div className="relative">
                      {distForm.newProductImages[0] ? (
                        <div className="group relative">
                          <img src={distForm.newProductImages[0]} alt="Ảnh chính" className="w-full aspect-square object-cover rounded-xl border-2 border-cyan-400" />
                          <span className="absolute top-1 left-1 rounded-md bg-cyan-500 px-1.5 py-0.5 text-[10px] font-bold text-white">Chính</span>
                          <button type="button" onClick={() => setDistForm((c) => ({ ...c, newProductImages: c.newProductImages.filter((_, i) => i !== 0) }))} className="absolute top-1 right-1 hidden group-hover:flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white text-xs">×</button>
                        </div>
                      ) : (
                        <label className="flex flex-col items-center justify-center w-full aspect-square rounded-xl border-2 border-dashed border-slate-300 bg-white cursor-pointer hover:border-cyan-400 transition">
                          <span className="text-2xl text-slate-300">+</span>
                          <span className="text-[10px] text-slate-400 mt-1">Ảnh chính</span>
                          <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (!f) return; const url = URL.createObjectURL(f); setDistForm((c) => { const imgs = [...c.newProductImages]; imgs[0] = url; return { ...c, newProductImages: imgs }; }); }} />
                        </label>
                      )}
                    </div>
                    {[1, 2, 3].map((idx) => (
                      <div key={idx} className="relative">
                        {distForm.newProductImages[idx] ? (
                          <div className="group relative">
                            <img src={distForm.newProductImages[idx]} alt={`Ảnh ${idx + 1}`} className="w-full aspect-square object-cover rounded-xl border border-slate-200" />
                            <button type="button" onClick={() => setDistForm((c) => ({ ...c, newProductImages: c.newProductImages.filter((_, i) => i !== idx) }))} className="absolute top-1 right-1 hidden group-hover:flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white text-xs">×</button>
                          </div>
                        ) : (
                          <label className="flex flex-col items-center justify-center w-full aspect-square rounded-xl border border-dashed border-slate-200 bg-white cursor-pointer hover:border-cyan-400 transition">
                            <span className="text-xl text-slate-300">+</span>
                            <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (!f) return; const url = URL.createObjectURL(f); setDistForm((c) => { const imgs = [...c.newProductImages]; while (imgs.length <= idx) imgs.push(''); imgs[idx] = url; return { ...c, newProductImages: imgs }; }); }} />
                          </label>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* CỘT 2: Thông tin sản phẩm */}
                  <div className="w-[400px] shrink-0 space-y-4 overflow-y-auto p-6">
                    <p className="text-xs font-black uppercase tracking-wider text-slate-400">Thông tin sản phẩm</p>
                    <div>
                      <label className="mb-1.5 block text-xs font-bold text-slate-600">Mã sản phẩm (SKU) <span className="text-red-500">*</span></label>
                      <input value={distForm.newProductSku} onChange={(e) => setDistForm((c) => ({ ...c, newProductSku: e.target.value }))} className="h-9 w-full rounded-lg border-2 border-slate-200 px-3 text-sm uppercase outline-none transition focus:border-cyan-500" placeholder="VD: SP001" />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-bold text-slate-600">Tên sản phẩm <span className="text-red-500">*</span></label>
                      <input value={distForm.newProductName} onChange={(e) => setDistForm((c) => ({ ...c, newProductName: e.target.value }))} className="h-9 w-full rounded-lg border-2 border-slate-200 px-3 text-sm outline-none transition focus:border-cyan-500" placeholder="Nhập tên sản phẩm..." />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-bold text-slate-600">Nhóm danh mục</label>
                      <select value={distForm.newProductCategory} onChange={(e) => setDistForm((c) => ({ ...c, newProductCategory: e.target.value }))} className="h-9 w-full rounded-lg border-2 border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-cyan-500">
                        {categoryOptions.map((cat) => <option key={cat.name} value={cat.name}>{cat.name}</option>)}
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="mb-1.5 block text-xs font-bold text-slate-600">Đơn vị tính</label>
                        <select value={distForm.newProductUnit} onChange={(e) => setDistForm((c) => ({ ...c, newProductUnit: e.target.value }))} className="h-9 w-full rounded-lg border-2 border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-cyan-500">
                          {unitOptions.map((u) => <option key={u.name} value={u.name}>{u.name}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="mb-1.5 block text-xs font-bold text-slate-600">Kho mặc định</label>
                        <select value={distForm.newProductDefaultWarehouse} onChange={(e) => setDistForm((c) => ({ ...c, newProductDefaultWarehouse: e.target.value }))} className="h-9 w-full rounded-lg border-2 border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-cyan-500">
                          {warehouses.map((w) => <option key={w.name} value={w.name}>{w.name}</option>)}
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-bold text-slate-600">Giới thiệu / Ghi chú</label>
                      <textarea value={distForm.newProductSupplier} onChange={(e) => setDistForm((c) => ({ ...c, newProductSupplier: e.target.value }))} rows={3} className="w-full resize-none rounded-lg border-2 border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-cyan-500" placeholder="Mô tả..." />
                    </div>
                  </div>
                </>
              )}

              {distForm.mode === 'existing' && (
                <div className="w-[400px] shrink-0 space-y-4 overflow-y-auto p-6 bg-slate-50/30">
                   <p className="text-xs font-black uppercase tracking-wider text-slate-400">Chọn sản phẩm đích</p>
                   <div>
                    <label className="mb-1.5 block text-xs font-bold text-slate-600">Sản phẩm thương mại <span className="text-red-500">*</span></label>
                    <select
                      value={distForm.targetProductId}
                      onChange={e => setDistForm(c => ({...c, targetProductId: e.target.value}))}
                      className="h-11 w-full rounded-xl border-2 border-slate-200 bg-white px-4 text-sm font-semibold outline-none transition focus:border-cyan-500"
                    >
                      <option value="">-- Chọn sản phẩm --</option>
                      {products.map(p => <option key={p.id} value={p.id}>{p.internalSku} - {p.name}</option>)}
                    </select>
                  </div>
                </div>
              )}

              {/* PHẦN CHUNG: Phân bổ xuất bán */}
              <div className="min-w-0 flex-1 overflow-y-auto p-6 bg-slate-50/50">
                <p className="text-xs font-black uppercase tracking-wider text-slate-400 mb-4">Thông tin Xuất bán & Phân bổ</p>
                
                <div className="space-y-6 max-w-md">
                  <div>
                    <label className="mb-2 block text-sm font-bold text-slate-700">Giá bán gốc (₫) <span className="text-red-500">*</span></label>
                    <input type="number" min="0" value={distForm.price} onChange={(e) => setDistForm((c) => ({ ...c, price: e.target.value }))} className="h-11 w-full rounded-xl border-2 border-slate-200 px-4 text-sm outline-none transition focus:border-cyan-500" placeholder="0" />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-200">
                    <div>
                      <label className="mb-2 block text-sm font-bold text-slate-700">Khả dụng từ Nhập kho</label>
                      <div className="h-11 flex items-center justify-center rounded-xl border-2 border-transparent bg-white shadow-sm text-lg font-black text-slate-600">
                        {rows.find(r => r.productId === distForm.productId)?.remainingQty?.toLocaleString('vi-VN') || 0}
                      </div>
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-bold text-slate-700">Số lượng xuất bán <span className="text-red-500">*</span></label>
                      <input
                        type="number"
                        min="1"
                        max={rows.find(r => r.productId === distForm.productId)?.remainingQty || 0}
                        value={distForm.qtyToSell}
                        onChange={e => setDistForm(c => ({...c, qtyToSell: e.target.value}))}
                        className="h-11 w-full rounded-xl border-2 border-cyan-300 bg-cyan-50 px-4 text-center text-lg font-black text-cyan-700 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
                      />
                    </div>
                  </div>
                </div>
              </div>

            </div>

            <div className="flex justify-end gap-3 border-t-2 border-slate-100 bg-white px-6 py-4 shrink-0" style={{ borderBottomLeftRadius: '1rem', borderBottomRightRadius: '1rem' }}>
              <button type="button" onClick={() => setDistributionModalOpen(false)} className="rounded-xl border-2 border-slate-200 px-6 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50 transition">
                Hủy
              </button>
              <button type="button" disabled={saving} onClick={submitDistribution} className="flex items-center gap-2 rounded-xl bg-amber-600 px-8 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-amber-700 disabled:opacity-60 transition">
                <ShoppingCart className="h-5 w-5" /> {saving ? 'Đang xử lý...' : 'Xác nhận xuất bán'}
              </button>
            </div>
          </div>
        </div>
      )}
"""

content = re.sub(modal_old, modal_new, content)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Modal rewritten")
