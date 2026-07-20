const fs = require('fs');
let content = fs.readFileSync('src/features/products/Products.tsx', 'utf-8');

const tSearch = `    if (categoryOptions.length === 0) {
      setError('Vui lòng tạo danh mục loại "Nhóm hàng vật tư hàng hóa" trước khi thêm sản phẩm.');
      return;
    }`;

const tReplace = `    if (categoryOptions.length === 0) {
      setError('Vui lòng tạo danh mục loại "Nhóm hàng vật tư hàng hóa" trước khi thêm sản phẩm.');
      return;
    }

    if (!form.category) {
      setError('Vui lòng chọn Danh mục cho sản phẩm.');
      return;
    }`;

if (content.includes(tSearch)) {
    content = content.replace(tSearch, tReplace);
    fs.writeFileSync('src/features/products/Products.tsx', content);
    console.log('Done!');
} else {
    console.log('Not found');
}
