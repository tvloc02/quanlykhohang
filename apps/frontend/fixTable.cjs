const fs = require('fs');
let content = fs.readFileSync('src/features/products/Products.tsx', 'utf-8');

const tSearch = '{product.stock}\r\n                      </span>\r\n                    </td>\r\n                    {/* Thao tác */}';
const tSearch2 = '{product.stock}\n                      </span>\n                    </td>\n                    {/* Thao tác */}';
const tReplace = `{product.stock}
                      </span>
                    </td>
                    {/* Hiện trên Shop */}
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
                    </td>
                    {/* Thao tác */}`;

if (content.includes(tSearch)) {
  content = content.replace(tSearch, tReplace);
} else if (content.includes(tSearch2)) {
  content = content.replace(tSearch2, tReplace);
}

content = content.replace('{/* Nhóm hàng */}', '{/* Danh mục */}');

fs.writeFileSync('src/features/products/Products.tsx', content);
