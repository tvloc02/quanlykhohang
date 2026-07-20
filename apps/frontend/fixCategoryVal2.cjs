const fs = require('fs');
let content = fs.readFileSync('src/features/products/Products.tsx', 'utf-8');

const tSearch = `    if (categoryOptions.length === 0) {\r
      setError('Vui lòng tạo danh mục loại "Nhóm hàng vật tư hàng hóa" trước khi thêm sản phẩm.');\r
      return;\r
    }`;

const tReplace = `    if (categoryOptions.length === 0) {\r
      setError('Vui lòng tạo danh mục loại "Nhóm hàng vật tư hàng hóa" trước khi thêm sản phẩm.');\r
      return;\r
    }\r
\r
    if (!form.category) {\r
      setError('Vui lòng chọn Danh mục cho sản phẩm.');\r
      return;\r
    }`;

if (content.includes(tSearch)) {
    content = content.replace(tSearch, tReplace);
    fs.writeFileSync('src/features/products/Products.tsx', content);
    console.log('Done 1!');
} else {
    const tSearch2 = tSearch.replace(/\r/g, '');
    const tReplace2 = tReplace.replace(/\r/g, '');
    if (content.includes(tSearch2)) {
        content = content.replace(tSearch2, tReplace2);
        fs.writeFileSync('src/features/products/Products.tsx', content);
        console.log('Done 2!');
    } else {
        console.log('Not found at all');
    }
}
