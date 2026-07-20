import re

file_path = r'd:\ĐỒ ÁN TỐT NGHIỆP\Quản lý kho\apps\frontend\src\features\inbound\pages\AssemblyPage.tsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

modal_old_pattern = r'\{distributionModalOpen && \(\s*<div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-3 backdrop-blur-sm">[\s\S]*?(?=\{historyModalOpen && selectedRowHistory && \()'

modal_new = """{distributionModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-3 backdrop-blur-sm">
          <div className="flex w-full max-w-[95vw] flex-col" style={{ height: '92vh', borderRadius: '1rem', background: '#fff', boxShadow: '0 25px 60px rgba(0,0,0,0.18)' }}>
            <div className="flex shrink-0 items-center justify-between border-b-2 border-slate-100 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-cyan-50 p-2 text-cyan-600">
                  <Package className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-800">{distForm.mode === 'new' ? 'Thêm sản phẩm' : 'Phân phối bán hàng'}</h2>
                  <p className="text-sm font-medium text-slate-500">{distForm.mode === 'new' ? 'Khai báo thông tin sản phẩm và phân bổ theo kho' : 'Chuyển nguồn hàng vào danh mục Sản phẩm Bán'}</p>
                </div>
              </div>
              <button type="button" onClick={() => setDistributionModalOpen(false)} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition">
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="p-4 shrink-0 border-b border-slate-100 bg-slate-50/50 flex justify-center">
              <div className="flex gap-2 p-1 bg-slate-200/70 rounded-xl w-full max-w-md">
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
                  <div className="w-64 shrink-0 space-y-4 overflow-y-auto p-6">
                    <p className="text-xs font-black uppercase tracking-wider text-slate-400">Thông tin sản phẩm</p>
                    <div>
                      <label className="mb-1.5 block text-xs font-bold text-slate-600">Mã sản phẩm <span className="text-red-500">*</span></label>
                      <input value={distForm.newProductSku} onChange={(e) => setDistForm((c) => ({ ...c, newProductSku: e.target.value }))} className="h-9 w-full rounded-lg border-2 border-slate-200 px-3 text-sm uppercase outline-none transition focus:border-cyan-500" placeholder="VD: SP001" required />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-bold text-slate-600">Tên sản phẩm <span className="text-red-500">*</span></label>
                      <input value={distForm.newProductName} onChange={(e) => setDistForm((c) => ({ ...c, newProductName: e.target.value }))} className="h-9 w-full rounded-lg border-2 border-slate-200 px-3 text-sm outline-none transition focus:border-cyan-500" placeholder="Nhập tên sản phẩm..." required />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-bold text-slate-600">Danh mục</label>
                      <select value={distForm.newProductCategory} onChange={(e) => setDistForm((c) => ({ ...c, newProductCategory: e.target.value }))} className="h-9 w-full rounded-lg border-2 border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-cyan-500">
                        {categoryOptions.map((cat: any) => <option key={cat.name} value={cat.name}>{cat.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-bold text-slate-600">Giới thiệu</label>
                      <textarea value={distForm.newProductSupplier} onChange={(e) => setDistForm((c) => ({ ...c, newProductSupplier: e.target.value }))} rows={5} className="w-full resize-none rounded-lg border-2 border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-cyan-500" placeholder="Mô tả ngắn về sản phẩm..." />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-bold text-slate-600">Giá bán (₫) <span className="text-red-500">*</span></label>
                      <input type="number" min="0" value={distForm.price} onChange={(e) => setDistForm((c) => ({ ...c, price: e.target.value }))} className="h-9 w-full rounded-lg border-2 border-slate-200 px-3 text-sm outline-none transition focus:border-cyan-500" placeholder="0" required />
                    </div>
                  </div>
                </>
              )}

              {distForm.mode === 'existing' && (
                <div className="w-80 shrink-0 space-y-4 overflow-y-auto p-6 bg-white border-r border-slate-100">
                   <p className="text-xs font-black uppercase tracking-wider text-slate-400">Chọn sản phẩm đích</p>
                   <div>
                    <label className="mb-1.5 block text-xs font-bold text-slate-600">Sản phẩm thương mại <span className="text-red-500">*</span></label>
                    <select
                      value={distForm.targetProductId}
                      onChange={e => setDistForm(c => ({...c, targetProductId: e.target.value}))}
                      className="h-11 w-full rounded-xl border-2 border-slate-200 bg-white px-4 text-sm font-semibold outline-none transition focus:border-cyan-500"
                    >
                      <option value="">-- Chọn sản phẩm --</option>
                      {products.filter(p => !p.supplier).map(p => <option key={p.id} value={p.id}>{p.internalSku} - {p.name}</option>)}
                    </select>
                  </div>
                </div>
              )}

              {/* CHUNG CHO CẢ 2 MODE: Phân bổ theo kho */}
              <div className="min-w-0 flex-1 overflow-y-auto p-6">
                <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-black uppercase tracking-wider text-slate-400">Phân bổ theo kho</p>
                    <div className="text-sm font-bold text-cyan-700 bg-cyan-50 px-3 py-1 rounded-lg">
                        Khả dụng từ Lệnh Nhập: {rows.find(r => r.productId === distForm.productId)?.remainingQty?.toLocaleString('vi-VN') || 0}
                    </div>
                </div>
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        <th className="sticky left-0 z-10 bg-slate-50 px-4 py-3 text-left font-bold text-slate-700 border-r border-slate-200 min-w-[160px]">Kho</th>
                        <th className="px-4 py-3 text-center font-bold text-slate-700 border-r border-slate-200 min-w-[110px]">Tồn kho / Phân bổ</th>
                        <th className="px-4 py-3 text-center font-bold text-slate-700 border-r border-slate-200 min-w-[100px]">Đã bán</th>
                        <th className="px-4 py-3 text-center font-bold text-slate-700 border-r border-slate-200 min-w-[100px]">Nhập gần nhất (+)</th>
                        <th className="px-4 py-3 text-center font-bold text-slate-700 min-w-[100px]">Xuất gần nhất (−)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {warehouses.length === 0 ? (
                        <tr><td colSpan={5} className="px-4 py-12 text-center text-slate-400">Chưa có kho nào được cấu hình.</td></tr>
                      ) : warehouses.map((wh: any) => {
                        const isDef = distForm.newProductDefaultWarehouse === wh.name || (warehouses.length > 0 && warehouses[0].name === wh.name && !distForm.newProductDefaultWarehouse);
                        return (
                          <tr key={wh.id || wh.name} className={`border-b border-slate-100 transition hover:bg-slate-50 ${isDef ? 'bg-slate-50/80' : ''}`}>
                            <td className="sticky left-0 z-10 bg-inherit border-r border-slate-100 px-4 py-3">
                              <div className="flex items-center gap-2">
                                {isDef && <span className="h-2 w-2 rounded-full bg-cyan-500 shrink-0" />}
                                <div>
                                  <p className="font-semibold text-slate-800">{wh.name}</p>
                                  <p className="text-xs text-slate-400">{wh.code}</p>
                                </div>
                              </div>
                            </td>
                            <td className="border-r border-slate-100 px-3 py-3 text-center">
                              {isDef ? (
                                <input 
                                  type="number" 
                                  min="1" 
                                  max={rows.find(r => r.productId === distForm.productId)?.remainingQty || 0}
                                  value={distForm.qtyToSell} 
                                  onChange={(e) => setDistForm((c) => ({ ...c, qtyToSell: e.target.value, newProductDefaultWarehouse: wh.name }))} 
                                  className="w-full rounded-lg border-2 border-slate-200 px-2 py-1.5 text-center text-sm font-semibold text-slate-800 outline-none focus:border-cyan-500" 
                                  placeholder="0" 
                                  required 
                                />
                              ) : <span className="text-slate-300">—</span>}
                            </td>
                            <td className="border-r border-slate-100 px-4 py-3 text-center text-slate-400">—</td>
                            <td className="border-r border-slate-100 px-4 py-3 text-center text-slate-400">—</td>
                            <td className="px-4 py-3 text-center text-slate-400">—</td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-50 border-t-2 border-slate-200">
                        <td className="sticky left-0 z-10 bg-slate-50 px-4 py-2.5 text-sm font-bold text-slate-600 border-r border-slate-200">Tổng cộng</td>
                        <td className="border-r border-slate-200 px-4 py-2.5 text-center text-sm font-bold text-slate-700">{Number(distForm.qtyToSell) || 0}</td>
                        <td className="border-r border-slate-200 px-4 py-2.5 text-center text-sm font-bold text-slate-400">0</td>
                        <td className="border-r border-slate-200 px-4 py-2.5" />
                        <td className="px-4 py-2.5" />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

            </div>

            <div className="flex justify-end gap-3 border-t-2 border-slate-100 bg-white px-6 py-4 shrink-0" style={{ borderBottomLeftRadius: '1rem', borderBottomRightRadius: '1rem' }}>
              <button type="button" onClick={() => setDistributionModalOpen(false)} className="rounded-xl border-2 border-slate-200 px-6 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50 transition">
                Hủy bỏ
              </button>
              <button type="button" disabled={saving} onClick={submitDistribution} className="flex items-center gap-2 rounded-xl bg-cyan-600 px-8 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-cyan-700 disabled:opacity-60 transition">
                {saving ? 'Đang xử lý...' : (distForm.mode === 'new' ? 'Tạo sản phẩm' : 'Xác nhận xuất bán')}
              </button>
            </div>
          </div>
        </div>
      )}
"""

content = re.sub(modal_old_pattern, modal_new, content)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Modal overwritten to include warehouse matrix in both modes")
