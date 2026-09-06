import { DataSource } from "typeorm";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(__dirname, "../../../.env") });
dotenv.config();

export async function runInventorySeed() {
  const databaseUrl =
    process.env.DATABASE_URL || "mysql://root:root@localhost:3306/smart_wms";
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
  console.log(
    "🚀 Connecting to MySQL database to seed inventory & products...",
  );

  // Disable FK checks
  await ds.query("SET FOREIGN_KEY_CHECKS = 0");

  // 1. Ensure Categories exist
  console.log("🌱 Ensuring Categories...");
  await ds.query(`
    INSERT INTO categories (id, name, description) VALUES
    (2, 'Thực phẩm & Đồ uống', 'Các sản phẩm thực phẩm, đồ uống đóng gói, lương thực'),
    (3, 'Thời trang & Vải', 'Các loại vải, trang phục, nguyên phụ liệu may mặc')
    ON DUPLICATE KEY UPDATE name = VALUES(name)
  `);

  // 2. Insert or Update Products
  console.log("🌱 Upserting Target Products...");
  await ds.query(`
    INSERT INTO products (
      id, internalSku, supplierBarcode, name, unit, 
      price, importPrice, wholesalePrice, minimumStock, 
      categoryId, supplierId, isVisible
    ) VALUES
    (8, 'SP-VL-001', '893999000111', 'Vải Lụa Tơ Tằm Cao Cấp', 'Cuộn', 1200000.00, 0.00, 0.00, 0, 3, 4, 1),
    (7, 'SP-TP-006', '893456789012', 'Sữa tươi tiệt trùng Vinamilk 100% 1L (Thùng 12)', 'Thùng', 420000.00, 0.00, 0.00, 0, 2, 3, 1),
    (6, 'SP-TP-001', '893600123456', 'Gạo ST25 Sóc Trăng 5kg', 'Bao', 160000.00, 0.00, 0.00, 0, 2, 3, 1)
    ON DUPLICATE KEY UPDATE
      name = VALUES(name),
      unit = VALUES(unit),
      price = VALUES(price),
      importPrice = VALUES(importPrice),
      wholesalePrice = VALUES(wholesalePrice),
      minimumStock = VALUES(minimumStock),
      categoryId = VALUES(categoryId)
  `);

  // 3. Upsert Stock Balances (Tồn kho thực tế)
  console.log("🌱 Updating Stock Balances for items...");
  await ds.query(`
    INSERT INTO stock_balances (productId, locationCode, totalPhysical, allocated, available) VALUES
    (8, 'KHO-TONG', 0, 0, 0),
    (7, 'KHO-TONG', 100, 0, 100),
    (6, 'KHO-TONG', 50, 0, 50)
    ON DUPLICATE KEY UPDATE
      totalPhysical = VALUES(totalPhysical),
      allocated = VALUES(allocated),
      available = VALUES(available)
  `);

  // Enable FK checks
  await ds.query("SET FOREIGN_KEY_CHECKS = 1");

  console.log(
    "✅ SEED THÀNH CÔNG: Đã thêm tồn kho cho SP-VL-001 (0 Cuộn), SP-TP-006 (100 Thùng), SP-TP-001 (50 Bao)!",
  );
  await ds.destroy();
}

if (require.main === module) {
  runInventorySeed()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("❌ Seeding error:", err);
      process.exit(1);
    });
}
