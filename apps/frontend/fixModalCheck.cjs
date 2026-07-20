const fs = require('fs');
let content = fs.readFileSync('src/features/products/Products.tsx', 'utf-8');

const target1 = `<div>\r\n                      <label className="mb-1.5 block text-xs font-bold text-slate-600">Giá bán (₫) <span className="text-red-500">*</span></label>\r\n                      <input type="number" min="0" value={form.price} onChange={(e) => setForm((c) => ({ ...c, price: e.target.value ? Number(e.target.value) : '' }))} readOnly={modalMode === 'view'} className="h-9 w-full rounded-lg border-2 border-slate-200 px-3 text-sm outline-none transition focus:border-cyan-500 read-only:bg-slate-50" placeholder="0" required />\r\n                    </div>`;
const target2 = `<div>\n                      <label className="mb-1.5 block text-xs font-bold text-slate-600">Giá bán (₫) <span className="text-red-500">*</span></label>\n                      <input type="number" min="0" value={form.price} onChange={(e) => setForm((c) => ({ ...c, price: e.target.value ? Number(e.target.value) : '' }))} readOnly={modalMode === 'view'} className="h-9 w-full rounded-lg border-2 border-slate-200 px-3 text-sm outline-none transition focus:border-cyan-500 read-only:bg-slate-50" placeholder="0" required />\n                    </div>`;

const replace = `<div>
                      <label className="mb-1.5 block text-xs font-bold text-slate-600">Giá bán (₫) <span className="text-red-500">*</span></label>
                      <input type="number" min="0" value={form.price} onChange={(e) => setForm((c) => ({ ...c, price: e.target.value ? Number(e.target.value) : '' }))} readOnly={modalMode === 'view'} className="h-9 w-full rounded-lg border-2 border-slate-200 px-3 text-sm outline-none transition focus:border-cyan-500 read-only:bg-slate-50" placeholder="0" required />
                    </div>
                    <div className="flex items-center gap-2 pt-2">
                      <input type="checkbox" id="isVisible" checked={form.isVisible} onChange={(e) => setForm(c => ({...c, isVisible: e.target.checked}))} disabled={modalMode === 'view'} className="h-4 w-4 rounded border-slate-300 accent-cyan-600 cursor-pointer" />
                      <label htmlFor="isVisible" className="text-xs font-bold text-slate-700 cursor-pointer leading-tight">Hiển thị sản phẩm ở trang bán hàng (Shop)</label>
                    </div>`;

if (content.includes(target1)) {
    content = content.replace(target1, replace);
} else if (content.includes(target2)) {
    content = content.replace(target2, replace);
}

fs.writeFileSync('src/features/products/Products.tsx', content);
