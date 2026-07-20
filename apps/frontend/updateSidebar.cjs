const fs = require('fs');
let content = fs.readFileSync('src/shared/components/Sidebar.tsx', 'utf-8');

// Add HeartHandshake to imports
if (!content.includes('HeartHandshake')) {
    content = content.replace('Home,', 'HeartHandshake,\n  Home,');
}

// Add menu item
const menuItem = "  { icon: HeartHandshake, label: 'Khách hàng', path: '/customers', badge: null },\n";
if (!content.includes("label: 'Khách hàng'")) {
    content = content.replace("  { icon: Truck, label: 'Nhà cung cấp'", menuItem + "  { icon: Truck, label: 'Nhà cung cấp'");
}

fs.writeFileSync('src/shared/components/Sidebar.tsx', content);
console.log('Sidebar updated');
