/**
 * Script tạo dữ liệu demo hoàn chỉnh cho Smart WMS
 */

import { DataSource } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const DB_URL = process.env.DATABASE_URL || 'mysql://kien:123456@localhost:3306/smart_wms_db';

async function seed() {
  const ds = new DataSource({
    type: 'mysql',
    url: DB_URL,
    synchronize: false,
    logging: false,
  });

  await ds.initialize();
  console.log('✅ Kết nối cơ sở dữ liệu thành công');

  const q = ds.query.bind(ds);
  const hash = await bcrypt.hash('123456', 10);

  // ─── 1. ROLES ────────────────────────────────────────────────
  console.log('📦 Tạo vai trò...');
  await q(`INSERT IGNORE INTO roles (id, name) VALUES ('admin','admin'),('manager','manager'),('staff','staff'),('supplier','supplier'),('customer','customer')`);

  // ─── 2. USERS ────────────────────────────────────────────────
  console.log('👤 Tạo tài khoản demo...');
  const users = [
    { email: 'admin@wms.vn', fullName: 'Admin Hệ thống', role: 'admin', dept: 'IT', phone: '0901000001' },
    { email: 'manager@wms.vn', fullName: 'Nguyễn Văn Quản', role: 'manager', dept: 'Quản lý kho', phone: '0901000002' },
    { email: 'staff1@wms.vn', fullName: 'Trần Thị Kho', role: 'staff', dept: 'Nhân viên kho', phone: '0901000003' },
    { email: 'staff2@wms.vn', fullName: 'Lê Minh Hùng', role: 'staff', dept: 'Nhân viên kho', phone: '0901000004' },
    { email: 'ncc1@wms.vn', fullName: 'NCC Hoàng Gia', role: 'supplier', dept: null, phone: '0901000005' },
    { email: 'ncc2@wms.vn', fullName: 'NCC Phú Thành', role: 'supplier', dept: null, phone: '0901000006' },
    { email: 'kh1@wms.vn', fullName: 'Công ty ABC', role: 'customer', dept: null, phone: '0901000007' },
    { email: 'kh2@wms.vn', fullName: 'Cửa hàng XYZ', role: 'customer', dept: null, phone: '0901000008' },
  ];

  for (const u of users) {
    await q(`INSERT IGNORE INTO users (email, password, fullName, phone, status, department) VALUES (?,?,?,?,?,?)`,
      [u.email, hash, u.fullName, u.phone, 'active', u.dept]);
  }
  for (const u of users) {
    const [row] = await q(`SELECT id FROM users WHERE email = ? LIMIT 1`, [u.email]);
    if (row) {
      await q(`INSERT IGNORE INTO user_roles (userId, roleId) VALUES (?, ?)`, [row.id, u.role]);
    }
  }

  // ─── 3. SUPPLIERS ────────────────────────────────────────────
  console.log('🚚 Tạo nhà cung cấp...');
  const suppliers = [
    { name: 'Hoàng Gia Electronics', code: 'NCC-001', email: 'ncc1@wms.vn', phone: '0281234567', addr: '123 Nguyễn Huệ, Q1, TP.HCM', tax: '0301234567' },
    { name: 'Phú Thành Foods', code: 'NCC-002', email: 'ncc2@wms.vn', phone: '0281234568', addr: '456 Lê Lợi, Q3, TP.HCM', tax: '0301234568' },
    { name: 'Minh Tâm Textiles', code: 'NCC-003', email: null, phone: '0281234569', addr: '789 Trần Hưng Đạo, Q5, TP.HCM', tax: '0301234569' },
  ];

  for (const s of suppliers) {
    await q(`INSERT IGNORE INTO suppliers (name, supplierCode, email, phone, address, taxCode, status)
             VALUES (?,?,?,?,?,?,?)`, [s.name, s.code, s.email, s.phone, s.addr, s.tax, 'active']);
    if (s.email) {
      const [usr] = await q(`SELECT id FROM users WHERE email = ? LIMIT 1`, [s.email]);
      const [sup] = await q(`SELECT id FROM suppliers WHERE supplierCode = ? LIMIT 1`, [s.code]);
      if (usr && sup) {
        await q(`UPDATE suppliers SET userId = ? WHERE id = ?`, [usr.id, sup.id]).catch(() => {});
      }
    }
  }

  // ─── 4. CUSTOMERS ────────────────────────────────────────────
  console.log('🏪 Tạo khách hàng...');
  const customers = [
    { name: 'Công ty TNHH ABC', code: 'KH-001', email: 'kh1@wms.vn', phone: '0901111001', addr: '100 Pasteur, Q3, TP.HCM', type: 'B2B' },
    { name: 'Cửa hàng XYZ', code: 'KH-002', email: 'kh2@wms.vn', phone: '0901111002', addr: '200 Hai Bà Trưng, Q1, TP.HCM', type: 'B2C' },
    { name: 'Siêu thị GreenMart', code: 'KH-003', email: null, phone: '0901111003', addr: '300 Võ Văn Tần, Q3, TP.HCM', type: 'B2B' },
  ];
  for (const c of customers) {
    await q(`INSERT IGNORE INTO customers (name, customerCode, email, phone, address, type, status) VALUES (?,?,?,?,?,?,?)`,
      [c.name, c.code, c.email, c.phone, c.addr, c.type, 'active']);
    if (c.email) {
      const [usr] = await q(`SELECT id FROM users WHERE email = ? LIMIT 1`, [c.email]);
      const [cus] = await q(`SELECT id FROM customers WHERE customerCode = ? LIMIT 1`, [c.code]);
      if (usr && cus) {
        await q(`UPDATE customers SET userId = ? WHERE id = ?`, [usr.id, cus.id]).catch(() => {});
      }
    }
  }

  // ─── 5. CATEGORIES ───────────────────────────────────────────
  console.log('📂 Tạo danh mục sản phẩm...');
  const categories = [
    'Điện tử & Phụ kiện', 'Thực phẩm & Đồ uống', 'Vải & May mặc',
    'Văn phòng phẩm', 'Thiết bị công nghiệp', 'Hóa mỹ phẩm',
  ];
  for (const name of categories) {
    await q(`INSERT IGNORE INTO categories (name) VALUES (?)`, [name]);
  }

  // ─── 6. WAREHOUSES ───────────────────────────────────────────
  console.log('🏭 Tạo kho hàng...');
  const warehouses = [
    { id: 'WH-001', code: 'KHO-MAIN', name: 'Kho chính TP.HCM', addr: 'KCN Tân Bình, TP.HCM' },
    { id: 'WH-002', code: 'KHO-HN', name: 'Kho Hà Nội', addr: 'KCN Đông Anh, Hà Nội' },
    { id: 'WH-003', code: 'KHO-DN', name: 'Kho Đà Nẵng', addr: 'KCN Hòa Khánh, Đà Nẵng' },
  ];
  for (const w of warehouses) {
    await q(`INSERT INTO warehouses (id, code, name, address, status, isFrozen) VALUES (?,?,?,?,?,?)
             ON DUPLICATE KEY UPDATE name = VALUES(name), address = VALUES(address)`,
      [w.id, w.code, w.name, w.addr, 'active', false]);
  }

  // ─── 7. PRODUCTS ─────────────────────────────────────────────
  console.log('📦 Tạo sản phẩm...');
  const catRows: any[] = await q(`SELECT id, name FROM categories`);
  const catMap: Record<string, string> = {};
  catRows.forEach((r: any) => catMap[r.name] = r.id);

  const supRows: any[] = await q(`SELECT id FROM suppliers ORDER BY id LIMIT 3`);

  const products = [
    { sku: 'SP-DT-001', name: 'Tai nghe Bluetooth Sony WH-1000XM5', unit: 'Cái', price: 7500000, cat: 'Điện tử & Phụ kiện', sup: 0, min: 20, barcode: 'BC-SONY-WH1000' },
    { sku: 'SP-DT-002', name: 'Ổ cứng SSD Samsung 1TB 870 EVO', unit: 'Cái', price: 2800000, cat: 'Điện tử & Phụ kiện', sup: 0, min: 30, barcode: 'BC-SS-870EVO' },
    { sku: 'SP-DT-003', name: 'Chuột không dây Logitech MX Master 3S', unit: 'Cái', price: 2200000, cat: 'Điện tử & Phụ kiện', sup: 0, min: 25, barcode: 'BC-LG-MX3S' },
    { sku: 'SP-DT-004', name: 'Bàn phím cơ Keychron K8 Pro', unit: 'Cái', price: 2500000, cat: 'Điện tử & Phụ kiện', sup: 0, min: 15, barcode: 'BC-KC-K8PRO' },
    { sku: 'SP-DT-005', name: 'Webcam Logitech C920 HD Pro', unit: 'Cái', price: 1800000, cat: 'Điện tử & Phụ kiện', sup: 0, min: 10, barcode: 'BC-LG-C920' },
    { sku: 'SP-TP-001', name: 'Gạo ST25 Sóc Trăng 5kg', unit: 'Bao', price: 160000, cat: 'Thực phẩm & Đồ uống', sup: 1, min: 100, barcode: 'BC-GAO-ST25' },
    { sku: 'SP-TP-002', name: 'Nước mắm Phú Quốc 500ml', unit: 'Chai', price: 65000, cat: 'Thực phẩm & Đồ uống', sup: 1, min: 200, barcode: 'BC-NM-PQ500' },
    { sku: 'SP-TP-003', name: 'Cà phê hạt Arabica Đà Lạt 500g', unit: 'Gói', price: 185000, cat: 'Thực phẩm & Đồ uống', sup: 1, min: 50, barcode: 'BC-CF-ARAB' },
    { sku: 'SP-TP-004', name: 'Trà xanh Thái Nguyên 200g', unit: 'Hộp', price: 120000, cat: 'Thực phẩm & Đồ uống', sup: 1, min: 80, barcode: 'BC-TRA-TN200' },
    { sku: 'SP-TP-005', name: 'Mật ong rừng Tây Nguyên 350ml', unit: 'Lọ', price: 250000, cat: 'Thực phẩm & Đồ uống', sup: 1, min: 40, barcode: 'BC-MO-TN350' },
    { sku: 'SP-VM-001', name: 'Vải lụa tơ tằm Bảo Lộc (1m)', unit: 'Mét', price: 350000, cat: 'Vải & May mặc', sup: 2, min: 50, barcode: 'BC-VL-BL1M' },
    { sku: 'SP-VM-002', name: 'Áo thun cotton unisex trắng', unit: 'Cái', price: 150000, cat: 'Vải & May mặc', sup: 2, min: 100, barcode: 'BC-AT-UNI-W' },
    { sku: 'SP-VP-001', name: 'Bút bi Thiên Long TL-027', unit: 'Hộp', price: 45000, cat: 'Văn phòng phẩm', sup: 0, min: 200, barcode: 'BC-BB-TL027' },
    { sku: 'SP-VP-002', name: 'Giấy A4 Double A 70gsm', unit: 'Ream', price: 95000, cat: 'Văn phòng phẩm', sup: 0, min: 150, barcode: 'BC-GA4-DA70' },
    { sku: 'SP-CN-001', name: 'Bóng đèn LED Rạng Đông 12W', unit: 'Cái', price: 35000, cat: 'Thiết bị công nghiệp', sup: 2, min: 300, barcode: 'BC-LED-RD12' },
    { sku: 'SP-HM-001', name: 'Nước rửa tay Lifebuoy 500ml', unit: 'Chai', price: 55000, cat: 'Hóa mỹ phẩm', sup: 1, min: 120, barcode: 'BC-NRT-LB500' },
  ];

  for (const p of products) {
    const catId = catMap[p.cat] || null;
    const supId = supRows[p.sup]?.id || null;
    await q(`INSERT IGNORE INTO products (internalSku, supplierBarcode, name, unit, price, categoryId, supplierId, minimumStock, isVisible)
             VALUES (?,?,?,?,?,?,?,?,?)`, [p.sku, p.barcode, p.name, p.unit, p.price, catId, supId, p.min, true]);
  }

  // ─── 8. STOCK BALANCES ───────────────────────────────────────
  console.log('📊 Tạo tồn kho tại các vị trí...');
  const prodRows: any[] = await q(`SELECT id, internalSku FROM products ORDER BY id`);
  const locations = ['A-01-01','A-01-02','A-02-01','A-02-02','B-01-01','B-01-02','B-02-01','C-01-01','C-02-01','D-01-01'];

  for (let i = 0; i < prodRows.length; i++) {
    const loc = locations[i % locations.length];
    const physical = Math.floor(Math.random() * 200) + 50;
    const alloc = Math.floor(Math.random() * Math.min(20, physical));
    const avail = physical - alloc;
    await q(`INSERT INTO stock_balances (productId, locationCode, totalPhysical, allocated, available)
             VALUES (?,?,?,?,?) ON DUPLICATE KEY UPDATE totalPhysical = VALUES(totalPhysical), allocated = VALUES(allocated), available = VALUES(available)`,
      [prodRows[i].id, loc, physical, alloc, avail]);
  }
  for (let i = 0; i < 6; i++) {
    const loc2 = locations[(i + 5) % locations.length];
    const physical2 = Math.floor(Math.random() * 100) + 20;
    await q(`INSERT INTO stock_balances (productId, locationCode, totalPhysical, allocated, available)
             VALUES (?,?,?,?,?) ON DUPLICATE KEY UPDATE totalPhysical = VALUES(totalPhysical)`,
      [prodRows[i].id, loc2, physical2, 0, physical2]);
  }

  // ─── 9. INBOUND RECEIPTS (PO) ────────────────────────────────
  console.log('📋 Tạo phiếu nhập kho mẫu...');
  for (let i = 1; i <= 5; i++) {
    const sup = supRows[(i - 1) % supRows.length];
    const status = i <= 2 ? 'APPROVED' : i <= 4 ? 'IN_TRANSIT' : 'DRAFT';
    const poCode = `PO-2025-${String(i).padStart(4, '0')}`;
    await q(`INSERT IGNORE INTO inbound_receipts (poNumber, supplierId, supplierName, status, description, expectedDate, orderDate, totalAmount)
             VALUES (?,?,?,?,?,NOW(),NOW(),?)`, [poCode, sup?.id, 'Hoàng Gia Electronics', status, `Đơn nhập hàng đợt ${i}`, '15000000.00']);

    const [recRow] = await q(`SELECT id FROM inbound_receipts WHERE poNumber = ? LIMIT 1`, [poCode]);
    if (recRow) {
      for (let j = 0; j < 2; j++) {
        const pIdx = ((i - 1) * 2 + j) % prodRows.length;
        await q(`INSERT IGNORE INTO inbound_details (inboundReceiptId, productId, warehouseCode, expectedQty, receivedQty, unitPrice, totalLineAmount)
                 VALUES (?,?,?,?,?,?,?)`, [recRow.id, prodRows[pIdx].id, locations[j], 50, status === 'APPROVED' ? 50 : 0, '150000.00', '7500000.00']);
      }
    }
  }

  // ─── 10. STOCKTAKE SESSIONS ──────────────────────────────────
  console.log('📝 Tạo phiên kiểm kê mẫu...');
  const stocktakeStatuses = ['APPROVED','COUNTING_DONE','COUNTING','DRAFT'];
  for (let i = 1; i <= 4; i++) {
    const stNo = `KK-2025-${String(i).padStart(4, '0')}`;
    const loc = locations[(i - 1) % locations.length];
    const st = stocktakeStatuses[i - 1];
    await q(`INSERT IGNORE INTO stocktakes (stocktakeNo, locationCode, status, note, assignee, createdBy, purpose, createdAt)
             VALUES (?,?,?,?,?,?,?,NOW())`, [stNo, loc, st, `Phiên kiểm kê tháng 7 - Đợt ${i}`, 'Trần Thị Kho', 'Nguyễn Văn Quản', 'Kiểm kê định kỳ']);

    const [stRow] = await q(`SELECT id FROM stocktakes WHERE stocktakeNo = ? LIMIT 1`, [stNo]);
    if (stRow) {
      for (let j = 0; j < 3 && j < prodRows.length; j++) {
        const pIdx = ((i - 1) * 3 + j) % prodRows.length;
        const sysQty = Math.floor(Math.random() * 100) + 30;
        const countedQty = st === 'DRAFT' ? null : sysQty + Math.floor(Math.random() * 11) - 5;
        const diff = countedQty != null ? countedQty - sysQty : 0;
        await q(`INSERT IGNORE INTO stocktake_details (stocktakeId, productId, systemQty, countedQty, difference, note)
                 VALUES (?,?,?,?,?,?)`, [stRow.id, prodRows[pIdx].id, sysQty, countedQty, diff, null]);
      }
    }
  }

  // ─── 11. OUTBOUND ORDERS ─────────────────────────────────────
  console.log('📤 Tạo đơn xuất kho mẫu...');
  const cusRows: any[] = await q(`SELECT id FROM customers ORDER BY id LIMIT 3`);
  const outStatuses = ['pending','confirmed','shipped','pending','ready_to_ship'];
  for (let i = 1; i <= 5; i++) {
    const oCode = `XK-2025-${String(i).padStart(4, '0')}`;
    const cus = cusRows[(i - 1) % cusRows.length];
    await q(`INSERT IGNORE INTO outbound_orders (orderNo, customerId, status, description, items)
             VALUES (?,?,?,?,?)`, [oCode, cus?.id, outStatuses[i - 1], `Đơn xuất kho số ${i}`, 2]);

    const [outRow] = await q(`SELECT id FROM outbound_orders WHERE orderNo = ? LIMIT 1`, [oCode]);
    if (outRow) {
      for (let j = 0; j < 2; j++) {
        const pIdx = ((i - 1) * 2 + j) % prodRows.length;
        const rqty = Math.floor(Math.random() * 20) + 5;
        const picked = outStatuses[i - 1] === 'shipped' ? rqty : outStatuses[i - 1] === 'ready_to_ship' ? rqty : 0;
        await q(`INSERT IGNORE INTO outbound_details (outboundOrderId, productId, requiredQty, pickedQty, warehouseCode, unitPrice, totalLineAmount)
                 VALUES (?,?,?,?,?,?,?)`, [outRow.id, prodRows[pIdx].id, rqty, picked, locations[j], '150000.00', String(rqty * 150000)]);
      }
    }
  }

  console.log('\n🎉 ĐÃ TẠO DỮ LIỆU DEMO THÀNH CÔNG!');
  console.log('────────────────────────────────────────────');
  console.log('📌 Tài khoản đăng nhập demo (mật khẩu: 123456):');
  console.log('   • Admin:     admin@wms.vn');
  console.log('   • Manager:   manager@wms.vn');
  console.log('   • Staff 1:   staff1@wms.vn');
  console.log('   • Staff 2:   staff2@wms.vn');
  console.log('   • NCC 1:     ncc1@wms.vn');
  console.log('   • NCC 2:     ncc2@wms.vn');
  console.log('   • Khách 1:   kh1@wms.vn');
  console.log('   • Khách 2:   kh2@wms.vn');
  console.log('────────────────────────────────────────────');

  await ds.destroy();
}

seed().catch(e => {
  console.error('❌ Lỗi seed:', e);
  process.exit(1);
});
