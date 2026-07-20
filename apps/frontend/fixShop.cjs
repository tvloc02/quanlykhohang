const fs = require('fs');
let content = fs.readFileSync('src/features/shop/Shop.tsx', 'utf-8');

// Update Product interface
content = content.replace(
  '  name: string;\n}',
  '  name: string;\n  price?: number;\n  stock?: number;\n  images?: string[];\n  isVisible?: boolean;\n}'
);

// Update filter
content = content.replace(
  'const filteredProducts = products.filter(p => \n    p.name.toLowerCase().includes(search.toLowerCase()) || \n    p.sku.toLowerCase().includes(search.toLowerCase())\n  );',
  'const filteredProducts = products.filter(p => \n    p.isVisible && \n    (p.name.toLowerCase().includes(search.toLowerCase()) || \n    p.sku.toLowerCase().includes(search.toLowerCase()))\n  );'
);

// Update render
const renderSearch = '<div className="absolute inset-0 flex items-center justify-center text-slate-400 group-hover:scale-110 transition-transform duration-500">\n                      <Package size={64} strokeWidth={1} />\n                    </div>';
const renderReplace = `{product.images?.[0] ? (
                      <img src={product.images[0]} alt={product.name} className="absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center text-slate-400 group-hover:scale-110 transition-transform duration-500">
                        <Package size={64} strokeWidth={1} />
                      </div>
                    )}`;
content = content.replace(renderSearch, renderReplace);

fs.writeFileSync('src/features/shop/Shop.tsx', content);
