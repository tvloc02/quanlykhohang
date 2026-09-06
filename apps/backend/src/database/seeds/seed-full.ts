import { DataSource } from "typeorm";
import * as bcrypt from "bcryptjs";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(__dirname, "../../../.env") });
dotenv.config();

export async function runSeed() {
  const databaseUrl =
    process.env.DATABASE_URL || "mysql://root:root@localhost:3306/smart_wms";
  console.log(
    `🔌 Using database URL: ${databaseUrl.replace(/:[^:@]+@/, ":****@")}`,
  );

  const isSsl =
    process.env.DB_SSL === "true" ||
    databaseUrl.includes("tidbcloud") ||
    databaseUrl.includes("ssl=");

  const ds = new DataSource({
    type: "mysql",
    url: databaseUrl,
    ssl: isSsl ? { rejectUnauthorized: true } : false,
    extra: {
      ssl: isSsl ? { rejectUnauthorized: true } : false,
    },
  });

  await ds.initialize();
  console.log("🚀 Connecting to MySQL database for full seeding...");

  const pass = await bcrypt.hash("123456", 10);

  // Disable FK constraints
  await ds.query("SET FOREIGN_KEY_CHECKS = 0");

  // 1. ROLES
  console.log("🌱 Seeding Roles...");
  await ds.query(`
    INSERT IGNORE INTO roles (id, name) VALUES 
    (1, 'admin'),
    (2, 'manager'),
    (3, 'staff'),
    (4, 'supplier'),
    (5, 'customer')
  `);

  // 2. USERS
  console.log("🌱 Seeding Users...");
  await ds.query(`
    INSERT INTO users (id, email, password, fullName, phone, status, department) VALUES 
    (1, 'admin@wms.vn', '${pass}', 'Quản Trị Viên Hệ Thống', '0901234567', 'active', 'Ban Giám Đốc'),
    (2, 'manager.khoa@wms.vn', '${pass}', 'Nguyễn Đăng Khoa', '0902345678', 'active', 'Quản Lý Kho'),
    (3, 'nhanvien@wms.vn', '${pass}', 'Trần Văn Nam', '0903456789', 'active', 'Bộ Phận Kho'),
    (4, 'apple.supplier@wms.vn', '${pass}', 'Apple Vietnam Authorized', '0283999888', 'active', 'Đối Tác NCC'),
    (5, 'minhphat.cust@wms.vn', '${pass}', 'Công Ty Minh Phát', '0988123456', 'active', 'Khách Hàng Doanh Nghiệp')
    ON DUPLICATE KEY UPDATE password = '${pass}', fullName = VALUES(fullName)
  `);

  // Link User Roles
  await ds.query(`
    INSERT IGNORE INTO user_roles (userId, roleId) VALUES 
    (1, 1), (2, 2), (3, 3), (4, 4), (5, 5)
  `);

  // 3. CATEGORIES
  console.log("🌱 Seeding Categories...");
  await ds.query(`
    INSERT INTO categories (id, name, description, code, type, status) VALUES 
    (1, 'Điện tử & Công nghệ', 'Thiết bị điện tử, máy tính, điện thoại, phụ kiện', 'CAT-DT', 'item-group', 'active'),
    (2, 'Thực phẩm & Đồ uống', 'Lương thực, thực phẩm đóng gói, sữa, đồ uống', 'CAT-TP', 'item-group', 'active'),
    (3, 'Thời trang & Vải', 'Vải tơ tằm, vật liệu dệt may cao cấp', 'CAT-VL', 'item-group', 'active'),
    (4, 'Gia dụng & Thiết bị', 'Đồ gia dụng, dụng cụ nhà bếp, thiết bị tiện ích', 'CAT-GD', 'item-group', 'active')
    ON DUPLICATE KEY UPDATE name = VALUES(name)
  `);

  // 4. SUPPLIERS
  console.log("🌱 Seeding Suppliers...");
  await ds.query(`
    INSERT INTO suppliers (id, supplierCode, name, phone, address, taxCode) VALUES 
    (1, 'NCC001', 'Apple Vietnam Authorized Distributor', '0283999888', 'Tòa nhà Phú Mỹ Hưng, Quận 7, TP.HCM', '0308889991'),
    (2, 'NCC002', 'Samsung Electronics Vietnam', '0222388899', 'KCN Yên Phong, Bắc Ninh', '2300123456'),
    (3, 'NCC003', 'Phú Thành Foods Co., Ltd', '0281234568', '456 Lê Lợi, Quận 3, TP.HCM', '0301234568'),
    (4, 'NCC004', 'Minh Tâm Textiles', '0281234569', '789 Trần Hưng Đạo, Quận 5, TP.HCM', '0301234569')
    ON DUPLICATE KEY UPDATE name = VALUES(name)
  `);

  // 5. CUSTOMERS
  console.log("🌱 Seeding Customers...");
  await ds.query(`
    INSERT INTO customers (id, customerCode, name, phone, address, type, status) VALUES 
    (1, 'KH001', 'Công ty TNHH Công Nghệ Minh Phát', '0988123456', '15 Nguyễn Thị Minh Khai, Quận 1, TP.HCM', 'B2B', 'active'),
    (2, 'KH002', 'Siêu thị Điện máy Xanh TP.HCM', '0283811223', '128 Trần Quang Khải, Quận 1, TP.HCM', 'B2B', 'active'),
    (3, 'KH003', 'Tập đoàn Bán Lẻ WinMart', '0283822110', '72 Lê Thánh Tôn, Quận 1, TP.HCM', 'B2B', 'active'),
    (4, 'KH999', 'Khách hàng bán lẻ', '0901234567', 'TP.HCM', 'B2C', 'active')
    ON DUPLICATE KEY UPDATE name = VALUES(name)
  `);

  // 6. WAREHOUSES
  console.log("🌱 Seeding Warehouses...");
  await ds.query(`
    INSERT INTO warehouses (id, code, name, address, status, isFrozen, managerIds, staffIds) VALUES 
    ('wh-1', 'KHO-TONG', 'Kho Tổng SPX Express (TP.HCM)', '123 Quốc lộ 1A, Bình Chánh, TP.HCM', 'active', 0, '2', '3'),
    ('wh-2', 'KHO-HN', 'Kho Trung Tâm Hà Nội', 'KCN Bắc Thăng Long, Đông Anh, Hà Nội', 'active', 0, '2', '3'),
    ('wh-3', 'KHO-BD', 'Kho Nguyên Vật Liệu Bình Dương', 'KCN VSIP 1, Thuận An, Bình Dương', 'active', 0, '2', '3'),
    ('wh-4', 'KHO-CUCHI', 'Kho Lạnh Củ Chi', 'Tỉnh lộ 8, Củ Chi, TP.HCM', 'active', 0, '2', '3')
    ON DUPLICATE KEY UPDATE name = VALUES(name)
  `);

  // 7. PRODUCTS
  console.log("🌱 Seeding Products...");
  await ds.query(`
    INSERT INTO products (id, internalSku, supplierBarcode, name, unit, price, minimumStock, categoryId, supplierId) VALUES 
    (1, 'SP-DT-006', '885909123456', 'MacBook Pro 14 inch M3 Max 36GB/1TB', 'Cái', 64500000, 5, 1, 1),
    (2, 'SP-DT-007', '194253987654', 'iPhone 15 Pro Max 256GB Natural Titanium', 'Cái', 34990000, 10, 1, 1),
    (3, 'SP-DT-001', '490552499988', 'Tai nghe Bluetooth Sony WH-1000XM5', 'Cái', 7500000, 15, 1, 2),
    (4, 'SP-DT-002', '880609112233', 'Ổ cứng SSD Samsung 1TB 870 EVO', 'Cái', 2800000, 20, 1, 2),
    (5, 'SP-DT-003', '097855112244', 'Chuột không dây Logitech MX Master 3S', 'Cái', 2200000, 25, 1, 2),
    (6, 'SP-TP-001', '893600123456', 'Gạo ST25 Sóc Trăng 5kg', 'Bao', 160000, 50, 2, 3),
    (7, 'SP-TP-006', '893456789012', 'Sữa tươi tiệt trùng Vinamilk 100% 1L (Thùng 12)', 'Thùng', 420000, 100, 2, 3),
    (8, 'SP-VL-001', '893999000111', 'Vải Lụa Tơ Tằm Cao Cấp', 'Cuộn', 1200000, 30, 3, 4)
    ON DUPLICATE KEY UPDATE name = VALUES(name)
  `);

  // 8. INBOUND RECEIPTS (PHIEU NHAP KHO)
  console.log("🌱 Seeding Inbound Receipts...");
  await ds.query(`
    INSERT INTO inbound_receipts (id, poNumber, supplierName, supplierId, status, receiptType, creatorName, description, totalAmount, orderDate) VALUES 
    (1, 'PNK-2026-0001', 'Apple Vietnam Authorized Distributor', 1, 'completed', 'stock_in', 'Trần Văn Nam', 'Nhập đợt 1 MacBook & iPhone chính hãng', 639900000.00, NOW()),
    (2, 'PNK-2026-0002', 'Samsung Electronics Vietnam', 2, 'completed', 'stock_in', 'Nguyễn Đăng Khoa', 'Nhập SSD Samsung & Tai nghe Sony', 135000000.00, NOW()),
    (3, 'PNK-2026-0003', 'Phú Thành Foods Co., Ltd', 3, 'pending', 'stock_in', 'Trần Văn Nam', 'Nhập kho thực phẩm đợt giữa tháng 8', 42500000.00, NOW())
    ON DUPLICATE KEY UPDATE poNumber = VALUES(poNumber)
  `);

  await ds.query(`
    INSERT INTO inbound_details (id, inboundReceiptId, productId, warehouseCode, expectedQty, receivedQty, unitPrice, totalLineAmount) VALUES 
    (1, 1, 1, 'KHO-TONG', 5, 5, 58000000.00, 290000000.00),
    (2, 1, 2, 'KHO-TONG', 10, 10, 34990000.00, 349900000.00),
    (3, 2, 4, 'KHO-HN', 20, 20, 2200000.00, 44000000.00),
    (4, 2, 3, 'KHO-HN', 15, 15, 6000000.00, 90000000.00),
    (5, 3, 6, 'KHO-CUCHI', 50, 50, 130000.00, 6500000.00),
    (6, 3, 7, 'KHO-CUCHI', 100, 100, 360000.00, 36000000.00)
    ON DUPLICATE KEY UPDATE warehouseCode = VALUES(warehouseCode)
  `);

  // 9. OUTBOUND ORDERS (PHIEU XUAT KHO)
  console.log("🌱 Seeding Outbound Orders...");
  await ds.query(`
    INSERT INTO outbound_orders (id, orderNo, branchCode, employeeName, customerName, customerPhone, customerAddress, status, orderType, description, items, subtotal, discount, totalAmount, amountPaid, paymentMethod, orderDate) VALUES 
    (1, 'PXK-2026-0001', 'KHO-TONG', 'Trần Văn Nam', 'Công ty TNHH Công Nghệ Minh Phát', '0988123456', '15 Nguyễn Thị Minh Khai, Quận 1, TP.HCM', 'Đã giao hàng', 'outbound_sales', 'Xuất lô hàng MacBook & iPhone cho DN', 2, 394890000.00, 4890000.00, 390000000.00, 390000000.00, 'BANK_TRANSFER', NOW()),
    (2, 'PXK-2026-0002', 'KHO-HN', 'Nguyễn Đăng Khoa', 'Siêu thị Điện máy Xanh TP.HCM', '0283811223', '128 Trần Quang Khải, Quận 1, TP.HCM', 'Đã giao hàng', 'outbound_sales', 'Xuất linh kiện tai nghe & SSD phân phối', 2, 104000000.00, 2000000.00, 102000000.00, 102000000.00, 'BANK_TRANSFER', NOW()),
    (3, 'PXK-2026-0003', 'KHO-CUCHI', 'Trần Văn Nam', 'Tập đoàn Bán Lẻ WinMart', '0283822110', '72 Lê Thánh Tôn, Quận 1, TP.HCM', 'Chờ xử lý', 'outbound_sales', 'Xuất kho lương thực chuỗi WinMart Củ Chi', 2, 58000000.00, 1000000.00, 57000000.00, 0.00, 'CASH', NOW())
    ON DUPLICATE KEY UPDATE orderNo = VALUES(orderNo)
  `);

  await ds.query(`
    INSERT INTO outbound_details (id, outboundOrderId, productId, productSku, productName, unit, warehouseCode, requiredQty, pickedQty, unitPrice, totalLineAmount) VALUES 
    (1, 1, 1, 'SP-DT-006', 'MacBook Pro 14 inch M3 Max 36GB/1TB', 'Cái', 'KHO-TONG', 3, 3, 64500000.00, 193500000.00),
    (2, 1, 2, 'SP-DT-007', 'iPhone 15 Pro Max 256GB Natural Titanium', 'Cái', 'KHO-TONG', 5, 5, 34990000.00, 174950000.00),
    (3, 2, 4, 'SP-DT-002', 'Ổ cứng SSD Samsung 1TB 870 EVO', 'Cái', 'KHO-HN', 20, 20, 2800000.00, 56000000.00),
    (4, 2, 3, 'SP-DT-001', 'Tai nghe Bluetooth Sony WH-1000XM5', 'Cái', 'KHO-HN', 10, 10, 7500000.00, 75000000.00),
    (5, 3, 6, 'SP-TP-001', 'Gạo ST25 Sóc Trăng 5kg', 'Bao', 'KHO-CUCHI', 100, 0, 160000.00, 16000000.00),
    (6, 3, 7, 'SP-TP-006', 'Sữa tươi tiệt trùng Vinamilk 100% 1L (Thùng 12)', 'Thùng', 'KHO-CUCHI', 100, 0, 420000.00, 42000000.00)
    ON DUPLICATE KEY UPDATE warehouseCode = VALUES(warehouseCode)
  `);

  // 10. STOCK BALANCES (TỒN KHO)
  console.log("🌱 Seeding Stock Balances...");
  await ds.query(`
    INSERT INTO stock_balances (productId, locationCode, totalPhysical, allocated, available) VALUES 
    (1, 'KHO-TONG', 15, 3, 12),
    (2, 'KHO-TONG', 20, 5, 15),
    (3, 'KHO-HN', 25, 10, 15),
    (4, 'KHO-HN', 30, 20, 10),
    (5, 'KHO-TONG', 15, 0, 15),
    (6, 'KHO-TONG', 50, 0, 50),
    (7, 'KHO-TONG', 100, 0, 100),
    (8, 'KHO-TONG', 0, 0, 0)
    ON DUPLICATE KEY UPDATE 
      totalPhysical = VALUES(totalPhysical),
      allocated = VALUES(allocated),
      available = VALUES(available)
  `);

  // Enable FK constraints
  await ds.query("SET FOREIGN_KEY_CHECKS = 1");

  console.log(
    "🎉 ALL DEMO SEED DATA INSERTED SUCCESSFULLY INTO MYSQL DATABASE!",
  );
  await ds.destroy();
}

if (require.main === module) {
  runSeed()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("❌ Seeding error:", err);
      process.exit(1);
    });
}
