const fs = require('fs');
let content = fs.readFileSync('src/features/products/Products.tsx', 'utf-8');

const tSearch1 = `  price: number | '';\r
  stock: number | '';\r
  images: string[];\r
};`;
const tReplace1 = `  price: number | '';\r
  stock: number | '';\r
  images: string[];\r
  isVisible: boolean;\r
};`;

const tSearch1b = `  price: number | '';\n  stock: number | '';\n  images: string[];\n};`;
const tReplace1b = `  price: number | '';\n  stock: number | '';\n  images: string[];\n  isVisible: boolean;\n};`;

if (content.includes(tSearch1)) content = content.replace(tSearch1, tReplace1);
else if (content.includes(tSearch1b)) content = content.replace(tSearch1b, tReplace1b);

const tSearch2 = `      price: Number(form.price),\r
      stock: Number(form.stock),\r
      images: form.images,\r
    };`;
const tReplace2 = `      price: Number(form.price),\r
      stock: Number(form.stock),\r
      images: form.images,\r
      isVisible: form.isVisible,\r
    };`;

const tSearch2b = `      price: Number(form.price),\n      stock: Number(form.stock),\n      images: form.images,\n    };`;
const tReplace2b = `      price: Number(form.price),\n      stock: Number(form.stock),\n      images: form.images,\n      isVisible: form.isVisible,\n    };`;

if (content.includes(tSearch2)) content = content.replace(tSearch2, tReplace2);
else if (content.includes(tSearch2b)) content = content.replace(tSearch2b, tReplace2b);


fs.writeFileSync('src/features/products/Products.tsx', content);
