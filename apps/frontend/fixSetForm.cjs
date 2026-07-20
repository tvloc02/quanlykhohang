const fs = require('fs');
let content = fs.readFileSync('src/features/products/Products.tsx', 'utf-8');

const tSearch = `      price: product.price,\r
      stock: product.stock,\r
      images: [],\r
    });`;

const tReplace = `      price: product.price,\r
      stock: product.stock,\r
      images: product.images || [],\r
      isVisible: product.isVisible || false,\r
    });`;

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
        console.log('Not found');
    }
}
