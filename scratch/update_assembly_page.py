import re

file_path = r'd:\ĐỒ ÁN TỐT NGHIỆP\Quản lý kho\apps\frontend\src\features\inbound\pages\AssemblyPage.tsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add state for History Modal and the Distribution Mode Tabs
state_adds = """  const [distForm, setDistForm] = React.useState({
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
  });

  const [historyModalOpen, setHistoryModalOpen] = React.useState(false);
  const [selectedRowHistory, setSelectedRowHistory] = React.useState<OrderDetailRow | null>(null);"""

if "const [historyModalOpen" not in content:
    content = content.replace("""  const [distForm, setDistForm] = React.useState({
    orderId: '',
    detailId: '',
    productId: '',
    categoryId: '',
    price: '',
    qtyToSell: '1',
  });""", state_adds)


# 2. Update openDistributionModal to initialize the new fields
open_dist_old = """    setDistForm({
      orderId: '',
      detailId: '',
      productId: row.productId,
      categoryId: p?.category?.id || categories[0]?.id || '',
      price: p?.price ? String(p.price) : '0',
      qtyToSell: '1',
    });
    setDistributionModalOpen(true);"""
open_dist_new = """    setDistForm({
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
    });
    setDistributionModalOpen(true);"""
content = content.replace(open_dist_old, open_dist_new)


# 3. Update submitDistribution to handle NEW product and use /assemblies/standalone
submit_dist_old = """  const submitDistribution = async () => {
    const qty = parseNumber(distForm.qtyToSell);
    if (qty <= 0) {
      setToast({ type: 'error', message: 'Số lượng bán phải lớn hơn 0' });
      return;
    }

    setSaving(true);
    try {
      // 1. Cập nhật danh mục & giá
      const resProd = await fetch(`${API_BASE_URL}/products/${distForm.productId}`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({
          categoryId: distForm.categoryId || undefined,
          price: parseNumber(distForm.price),
        }),
      });
      if (!resProd.ok) throw new Error('Lỗi cập nhật sản phẩm');

      // 2. Phân phối FIFO qua các details
      const row = rows.find(r => r.productId === distForm.productId);
      if (!row) throw new Error('Không tìm thấy sản phẩm');
      
      let qtyLeft = qty;
      for (const detail of row.details) {
        if (qtyLeft <= 0) break;
        if (detail.remainingQty <= 0) continue;
        
        const distributeQty = Math.min(qtyLeft, detail.remainingQty);
        
        const resAdjust = await fetch(`${API_BASE_URL}/inbound/stock-in-orders/${detail.orderId}/details/${detail.detailId}/distribute`, {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify({ qty: distributeQty }),
        });
        if (!resAdjust.ok) throw new Error((await resAdjust.json()).message || 'Lỗi phân phối hàng');
        
        qtyLeft -= distributeQty;
      }

      setToast({ type: 'success', message: 'Đã phân phối bán hàng thành công!' });
      setDistributionModalOpen(false);
      await loadData();
    } catch (e: any) {
      setToast({ type: 'error', message: e.message });
    } finally {
      setSaving(false);
    }
  };"""

submit_dist_new = """  const submitDistribution = async () => {
    const qty = parseNumber(distForm.qtyToSell);
    if (qty <= 0) {
      setToast({ type: 'error', message: 'Số lượng bán phải lớn hơn 0' });
      return;
    }

    setSaving(true);
    try {
      let finalTargetId = distForm.targetProductId;

      if (distForm.mode === 'new') {
        if (!distForm.newProductSku || !distForm.newProductName) {
          throw new Error('Vui lòng nhập mã và tên sản phẩm mới');
        }
        // Create new product
        const createRes = await fetch(`${API_BASE_URL}/products`, {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify({
            internalSku: distForm.newProductSku,
            name: distForm.newProductName,
            categoryId: distForm.categoryId || undefined,
            price: parseNumber(distForm.price),
          }),
        });
        if (!createRes.ok) throw new Error((await createRes.json()).message || 'Lỗi tạo sản phẩm mới');
        const newProduct = await createRes.json();
        finalTargetId = newProduct.id;
      }

      if (!finalTargetId) throw new Error('Vui lòng chọn hoặc tạo sản phẩm');

      // Use assembly standalone to map stock
      const row = rows.find(r => r.productId === distForm.productId);
      if (!row) throw new Error('Không tìm thấy sản phẩm nguồn');

      const componentsList = [];
      let qtyLeft = qty;
      for (const detail of row.details) {
        if (qtyLeft <= 0) break;
        if (detail.remainingQty <= 0) continue;
        
        const used = Math.min(qtyLeft, detail.remainingQty);
        componentsList.push({
          productId: detail.productId,
          warehouseCode: detail.warehouseCode,
          usedQty: used,
          sourceOrderDetailId: detail.detailId,
        });
        qtyLeft -= used;
      }

      const res = await fetch(`${API_BASE_URL}/inbound/stock-in-orders/assemblies/standalone`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          assembledProductId: finalTargetId,
          assembledQty: qty,
          warehouseCode: row.warehouseCode || 'DEFAULT',
          note: 'Phân phối bán hàng từ Lệnh nhập kho',
          components: componentsList,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).message || 'Lỗi phân phối hàng');

      setToast({ type: 'success', message: 'Đã xuất bán thành công!' });
      setDistributionModalOpen(false);
      await loadData();
    } catch (e: any) {
      setToast({ type: 'error', message: e.message });
    } finally {
      setSaving(false);
    }
  };"""
content = content.replace(submit_dist_old, submit_dist_new)


# 4. Update the buttons in the row to trigger history
row_buttons_old = """                            <button
                              type="button"
                              onClick={() => alert('Xem chi tiết đang phát triển')}
                              className="flex h-10 w-10 items-center justify-center rounded-xl border-2 border-cyan-200 bg-cyan-50 text-cyan-600 transition hover:bg-cyan-100 hover:text-cyan-700 hover:border-cyan-300"
                              title="Xem chi tiết"
                            >
                              <Eye className="h-5 w-5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => openDistributionModal(row)}
                              className="flex h-10 w-10 items-center justify-center rounded-xl border-2 border-cyan-200 bg-cyan-50 text-cyan-600 transition hover:bg-cyan-100 hover:text-cyan-700 hover:border-cyan-300"
                              title="Xuất bán"
                            >
                              <ShoppingCart className="h-5 w-5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => alert('Cấu hình sản phẩm đang phát triển')}
                              className="flex h-10 w-10 items-center justify-center rounded-xl border-2 border-cyan-200 bg-cyan-50 text-cyan-600 transition hover:bg-cyan-100 hover:text-cyan-700 hover:border-cyan-300"
                              title="Cấu hình"
                            >
                              <Settings2 className="h-5 w-5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => alert('Lịch sử nhập kho đang phát triển')}
                              className="flex h-10 w-10 items-center justify-center rounded-xl border-2 border-cyan-200 bg-cyan-50 text-cyan-600 transition hover:bg-cyan-100 hover:text-cyan-700 hover:border-cyan-300"
                              title="Lịch sử"
                            >
                              <Clock3 className="h-5 w-5" />
                            </button>"""

row_buttons_new = """                            <button
                              type="button"
                              onClick={() => { setSelectedRowHistory(row); setHistoryModalOpen(true); }}
                              className="flex h-10 w-10 items-center justify-center rounded-xl border-2 border-cyan-200 bg-cyan-50 text-cyan-600 transition hover:bg-cyan-100 hover:text-cyan-700 hover:border-cyan-300"
                              title="Xem chi tiết"
                            >
                              <Eye className="h-5 w-5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => openDistributionModal(row)}
                              className="flex h-10 w-10 items-center justify-center rounded-xl border-2 border-cyan-200 bg-cyan-50 text-cyan-600 transition hover:bg-cyan-100 hover:text-cyan-700 hover:border-cyan-300"
                              title="Xuất bán"
                            >
                              <ShoppingCart className="h-5 w-5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => { setSelectedRowHistory(row); setHistoryModalOpen(true); }}
                              className="flex h-10 w-10 items-center justify-center rounded-xl border-2 border-cyan-200 bg-cyan-50 text-cyan-600 transition hover:bg-cyan-100 hover:text-cyan-700 hover:border-cyan-300"
                              title="Cấu hình"
                            >
                              <Settings2 className="h-5 w-5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => { setSelectedRowHistory(row); setHistoryModalOpen(true); }}
                              className="flex h-10 w-10 items-center justify-center rounded-xl border-2 border-cyan-200 bg-cyan-50 text-cyan-600 transition hover:bg-cyan-100 hover:text-cyan-700 hover:border-cyan-300"
                              title="Lịch sử"
                            >
                              <Clock3 className="h-5 w-5" />
                            </button>"""
content = content.replace(row_buttons_old, row_buttons_new)


# 5. Redesign Distribution Modal UI
dist_modal_old = """      {distributionModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-6 py-4">
              <div>
                <h3 className="text-xl font-black text-slate-900">Phân phối bán hàng</h3>
                <p className="text-sm text-slate-500">Xuất bán trực tiếp sản phẩm từ Đơn hàng</p>
              </div>
              <button onClick={() => setDistributionModalOpen(false)} className="rounded-xl p-2 text-slate-400 hover:bg-slate-200 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="mb-2 block text-sm font-bold text-slate-700">Sản phẩm xuất bán</label>
                <div className="flex justify-between items-center rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
                  <span className="font-bold text-slate-700">{rows.find(r => r.productId === distForm.productId)?.productName}</span>
                  <span className="rounded bg-slate-200 px-2 py-1 text-xs font-bold text-slate-600">{rows.find(r => r.productId === distForm.productId)?.poNumber}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-2 block text-sm font-bold text-slate-700">Danh mục mới</label>
                  <select
                    value={distForm.categoryId}
                    onChange={e => setDistForm(c => ({...c, categoryId: e.target.value}))}
                    className="h-11 w-full rounded-xl border-2 border-slate-200 bg-white px-4 text-sm font-semibold outline-none transition focus:border-cyan-500"
                  >
                    <option value="">-- Trống --</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-bold text-slate-700">Giá bán <span className="text-red-500">*</span></label>
                  <input
                    type="number"
                    value={distForm.price}
                    onChange={e => setDistForm(c => ({...c, price: e.target.value}))}
                    className="h-11 w-full rounded-xl border-2 border-slate-200 bg-white px-4 text-sm font-semibold outline-none transition focus:border-cyan-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-2 block text-sm font-bold text-slate-700">Còn lại khả dụng</label>
                  <div className="h-11 flex items-center justify-center rounded-xl border-2 border-transparent bg-slate-100 text-lg font-black text-slate-600">
                    {formatNumber(rows.find(r => r.productId === distForm.productId)?.remainingQty || 0)}
                  </div>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-bold text-slate-700">Số lượng bán <span className="text-red-500">*</span></label>
                  <input
                    type="number"
                    min="1"
                    max={rows.find(r => r.productId === distForm.productId)?.remainingQty || 0}
                    value={distForm.qtyToSell}
                    onChange={e => setDistForm(c => ({...c, qtyToSell: e.target.value}))}
                    className="h-11 w-full rounded-xl border-2 border-slate-200 bg-white px-4 text-center text-lg font-black text-cyan-700 outline-none transition focus:border-cyan-500"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-200 bg-slate-50 p-6">
              <button onClick={() => setDistributionModalOpen(false)} className="rounded-xl px-5 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-200">
                Hủy
              </button>
              <button disabled={saving} onClick={submitDistribution} className="flex items-center gap-2 rounded-xl bg-amber-600 px-6 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-amber-700 disabled:opacity-60">
                <ShoppingCart className="h-4 w-4" /> {saving ? 'Đang xử lý...' : 'Xác nhận bán'}
              </button>
            </div>
          </div>
        </div>
      )}"""

dist_modal_new = """      {distributionModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-6 py-4">
              <div>
                <h3 className="text-xl font-black text-slate-900">Phân phối bán hàng</h3>
                <p className="text-sm text-slate-500">Chuyển nguồn hàng vào danh mục Sản phẩm Bán</p>
              </div>
              <button onClick={() => setDistributionModalOpen(false)} className="rounded-xl p-2 text-slate-400 hover:bg-slate-200 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="flex gap-2 p-1 bg-slate-100 rounded-xl">
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

              {distForm.mode === 'existing' ? (
                <div>
                  <label className="mb-2 block text-sm font-bold text-slate-700">Sản phẩm đích <span className="text-red-500">*</span></label>
                  <select
                    value={distForm.targetProductId}
                    onChange={e => setDistForm(c => ({...c, targetProductId: e.target.value}))}
                    className="h-11 w-full rounded-xl border-2 border-slate-200 bg-white px-4 text-sm font-semibold outline-none transition focus:border-cyan-500"
                  >
                    <option value="">-- Chọn sản phẩm thương mại --</option>
                    {targetProducts.map(p => <option key={p.id} value={p.id}>{p.internalSku} - {p.name}</option>)}
                  </select>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-2 block text-sm font-bold text-slate-700">Mã sản phẩm (SKU) <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      value={distForm.newProductSku}
                      onChange={e => setDistForm(c => ({...c, newProductSku: e.target.value}))}
                      className="h-11 w-full rounded-xl border-2 border-slate-200 bg-white px-4 text-sm font-semibold outline-none transition focus:border-cyan-500"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-bold text-slate-700">Tên sản phẩm <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      value={distForm.newProductName}
                      onChange={e => setDistForm(c => ({...c, newProductName: e.target.value}))}
                      className="h-11 w-full rounded-xl border-2 border-slate-200 bg-white px-4 text-sm font-semibold outline-none transition focus:border-cyan-500"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-bold text-slate-700">Danh mục</label>
                    <select
                      value={distForm.categoryId}
                      onChange={e => setDistForm(c => ({...c, categoryId: e.target.value}))}
                      className="h-11 w-full rounded-xl border-2 border-slate-200 bg-white px-4 text-sm font-semibold outline-none transition focus:border-cyan-500"
                    >
                      <option value="">-- Trống --</option>
                      {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-bold text-slate-700">Giá bán gốc</label>
                    <input
                      type="number"
                      value={distForm.price}
                      onChange={e => setDistForm(c => ({...c, price: e.target.value}))}
                      className="h-11 w-full rounded-xl border-2 border-slate-200 bg-white px-4 text-sm font-semibold outline-none transition focus:border-cyan-500"
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-100">
                <div>
                  <label className="mb-2 block text-sm font-bold text-slate-700">Khả dụng từ Nhập kho</label>
                  <div className="h-11 flex items-center justify-center rounded-xl border-2 border-transparent bg-slate-100 text-lg font-black text-slate-600">
                    {formatNumber(rows.find(r => r.productId === distForm.productId)?.remainingQty || 0)}
                  </div>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-bold text-slate-700">Số lượng bán <span className="text-red-500">*</span></label>
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

            <div className="flex justify-end gap-3 border-t border-slate-200 bg-slate-50 p-6">
              <button onClick={() => setDistributionModalOpen(false)} className="rounded-xl px-5 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-200">
                Hủy
              </button>
              <button disabled={saving} onClick={submitDistribution} className="flex items-center gap-2 rounded-xl bg-amber-600 px-6 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-amber-700 disabled:opacity-60">
                <ShoppingCart className="h-4 w-4" /> {saving ? 'Đang xử lý...' : 'Xác nhận xuất bán'}
              </button>
            </div>
          </div>
        </div>
      )}"""
content = content.replace(dist_modal_old, dist_modal_new)


# 6. Add History Modal
history_modal = """      {historyModalOpen && selectedRowHistory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-4xl overflow-hidden rounded-2xl bg-white shadow-2xl flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-6 py-4 shrink-0">
              <div>
                <h3 className="text-xl font-black text-slate-900">Chi tiết & Lịch sử nguồn hàng</h3>
                <p className="text-sm font-bold text-cyan-700 mt-1">{selectedRowHistory.productSku} - {selectedRowHistory.productName}</p>
              </div>
              <button onClick={() => { setHistoryModalOpen(false); setSelectedRowHistory(null); }} className="rounded-xl p-2 text-slate-400 hover:bg-slate-200 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1">
              <div className="overflow-hidden rounded-xl border border-slate-200">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50">
                    <tr className="border-b border-slate-200">
                      <th className="p-4 font-black uppercase text-slate-700">Ngày nhập</th>
                      <th className="border-l border-slate-200 p-4 font-black uppercase text-slate-700">Lệnh Nhập Kho</th>
                      <th className="border-l border-slate-200 p-4 font-black uppercase text-slate-700">Mã Đơn Hàng</th>
                      <th className="border-l border-slate-200 p-4 font-black uppercase text-slate-700">Kho lưu trữ</th>
                      <th className="border-l border-slate-200 p-4 font-black text-center uppercase text-slate-700">Đã nhập</th>
                      <th className="border-l border-slate-200 p-4 font-black text-center uppercase text-slate-700">Khả dụng</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedRowHistory.details.map((d, i) => (
                      <tr key={i} className="border-b border-slate-100 last:border-0 hover:bg-slate-50 transition">
                        <td className="p-4 font-semibold text-slate-600">{d.lastImportDate ? new Date(d.lastImportDate).toLocaleString('vi-VN') : '-'}</td>
                        <td className="border-l border-slate-100 p-4 font-bold text-slate-800">{d.orderCode}</td>
                        <td className="border-l border-slate-100 p-4 font-medium text-slate-600">{d.poNumber}</td>
                        <td className="border-l border-slate-100 p-4 font-medium text-slate-600">{d.warehouseCode}</td>
                        <td className="border-l border-slate-100 p-4 text-center font-black text-slate-400">{formatNumber(d.actualQty)}</td>
                        <td className="border-l border-slate-100 p-4 text-center font-black text-cyan-600">{formatNumber(d.remainingQty)}</td>
                      </tr>
                    ))}
                    {selectedRowHistory.details.length === 0 && (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-slate-500">Không có dữ liệu chi tiết</td>
                      </tr>
                    )}
                  </tbody>
                  <tfoot className="bg-slate-50 border-t border-slate-200">
                    <tr>
                      <td colSpan={4} className="p-4 text-right font-black uppercase text-slate-700">TỔNG CỘNG:</td>
                      <td className="p-4 text-center font-black text-slate-700">{formatNumber(selectedRowHistory.actualQty)}</td>
                      <td className="p-4 text-center font-black text-cyan-700">{formatNumber(selectedRowHistory.remainingQty)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}"""
content = content.replace("    </div>\n  );\n}", history_modal)


with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Done python script")
