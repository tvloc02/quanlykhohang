const fs = require('fs');
let content = fs.readFileSync('src/features/products/Products.tsx', 'utf-8');

// 1. Add isVisible to buildEmptyForm
content = content.replace(
  'images: [],\n  };\n}',
  'images: [],\n    isVisible: false,\n  };\n}'
);

// 2. Add isVisible to openProductModal
content = content.replace(
  'images: [],\n    });\n    setModalMode(mode);',
  'images: product.images || [],\n      isVisible: product.isVisible || false,\n    });\n    setModalMode(mode);'
);

// 3. Add isVisible to saveProductLocally
content = content.replace(
  'images: form.images,\n    };\n    const nextProducts',
  'images: form.images,\n      isVisible: form.isVisible,\n    };\n    const nextProducts'
);

// 4. Add isVisible to handleSubmit payload
content = content.replace(
  'images: form.images.filter(Boolean),\n      };',
  'images: form.images.filter(Boolean),\n        isVisible: form.isVisible,\n      };'
);

// 5. Replace 'Nhóm hàng' with 'Danh mục'
content = content.replace(
  '<th className="border-x border-slate-200 px-3 py-4 text-center text-sm font-black uppercase text-slate-700">Nhóm hàng</th>',
  '<th className="border-x border-slate-200 px-3 py-4 text-center text-sm font-black uppercase text-slate-700">Danh mục</th>'
);

// 6. Add checkbox in modal
const priceDiv = `<div>
                      <label className="mb-1.5 block text-xs font-bold text-slate-600">Giá bán (₫) <span className="text-red-500">*</span></label>
                      <input type="number" min="0" value={form.price} onChange={(e) => setForm((c) => ({ ...c, price: e.target.value ? Number(e.target.value) : '' }))} readOnly={modalMode === 'view'} className="h-9 w-full rounded-lg border-2 border-slate-200 px-3 text-sm outline-none transition focus:border-cyan-500 read-only:bg-slate-50" placeholder="0" required />
                    </div>`;
const priceAndCheckbox = priceDiv + `
                    <div className="flex items-center gap-2 mt-6">
                      <input type="checkbox" id="isVisible" checked={form.isVisible} onChange={(e) => setForm(c => ({...c, isVisible: e.target.checked}))} disabled={modalMode === 'view'} className="h-4 w-4 rounded border-slate-300 accent-cyan-600 cursor-pointer" />
                      <label htmlFor="isVisible" className="text-sm font-bold text-slate-700 cursor-pointer">Hiển thị sản phẩm ở trang bán hàng (Shop)</label>
                    </div>`;
content = content.replace(priceDiv, priceAndCheckbox);

fs.writeFileSync('src/features/products/Products.tsx', content);
