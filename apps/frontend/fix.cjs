const fs = require('fs');
let content = fs.readFileSync('src/features/products/Products.tsx', 'utf-8');

const t1 = '<th className="border-x border-slate-200 px-3 py-4 text-center text-sm font-black uppercase text-slate-700">Tồn kho</th>';
const t2 = '<th className="border-x border-slate-200 px-3 py-4 text-center text-sm font-black uppercase text-slate-700">Tồn kho</th>\n                <th className="border-x border-slate-200 px-3 py-4 text-center text-sm font-black uppercase text-slate-700">Hiện trên Shop</th>';

content = content.replace(t1, t2);

content = content.replace(/colSpan=\{9\}/g, 'colSpan={10}');

const bodySearch = '{product.stock}\n                      </span>\n                    </td>';
const bodyReplace = `{product.stock}
                      </span>
                    </td>
                    <td className="border-x border-slate-200 px-3 py-3 text-center align-middle">
                      <button
                        onClick={async () => {
                          try {
                            const response = await fetch(\`\${API_BASE_URL}/products/\${product.id}\`, {
                              method: 'PUT',
                              headers: authHeaders(),
                              body: JSON.stringify({ isVisible: !product.isVisible }),
                            });
                            if (!response.ok) throw new Error('Cập nhật thất bại');
                            const updatedList = products.map(p => p.id === product.id ? { ...p, isVisible: !p.isVisible } : p);
                            setProducts(updatedList);
                            saveStoredProducts(updatedList);
                          } catch (err) {
                            setError('Không thể cập nhật trạng thái hiển thị');
                          }
                        }}
                        className={\`relative inline-flex h-6 w-11 items-center rounded-full transition-colors \${product.isVisible ? 'bg-cyan-500' : 'bg-slate-300'}\`}
                        title={product.isVisible ? "Đang hiển thị trên Shop" : "Đã ẩn khỏi Shop"}
                      >
                        <span className={\`inline-block h-4 w-4 transform rounded-full bg-white transition-transform \${product.isVisible ? 'translate-x-6' : 'translate-x-1'}\`} />
                      </button>
                    </td>`;

content = content.replace(bodySearch, bodyReplace);

fs.writeFileSync('src/features/products/Products.tsx', content);
