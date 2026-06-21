import * as bcrypt from 'bcryptjs';
import { AppDataSource } from '../data-source';
import { Category } from '../../entities/category.entity';
import { Customer } from '../../entities/customer.entity';
import { Product } from '../../entities/product.entity';
import { Role } from '../../entities/role.entity';
import { Supplier } from '../../entities/supplier.entity';
import { User } from '../../entities/user.entity';
import { Warehouse } from '../../entities/warehouse.entity';
import { StockBalance } from '../../inventory/entities/stock-balance.entity';
import { DataSource } from 'typeorm';

async function ensureWarehouseTable(dataSource: DataSource) {
  await dataSource.query(`
    CREATE TABLE IF NOT EXISTS \`warehouses\` (
      \`id\` varchar(64) NOT NULL,
      \`code\` varchar(50) NOT NULL,
      \`name\` varchar(255) NOT NULL,
      \`address\` varchar(500) NULL,
      \`status\` enum('active', 'inactive') NOT NULL DEFAULT 'active',
      \`managerIds\` text NOT NULL,
      \`staffIds\` text NOT NULL,
      \`createdAt\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
      \`updatedAt\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      UNIQUE KEY \`IDX_warehouses_code\` (\`code\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

async function seed(): Promise<void> {
  const dataSource = await AppDataSource.initialize();
  await ensureWarehouseTable(dataSource);

  const roleRepository = dataSource.getRepository(Role);
  const userRepository = dataSource.getRepository(User);
  const categoryRepository = dataSource.getRepository(Category);
  const supplierRepository = dataSource.getRepository(Supplier);
  const customerRepository = dataSource.getRepository(Customer);
  const productRepository = dataSource.getRepository(Product);
  const stockRepository = dataSource.getRepository(StockBalance);
  const warehouseRepository = dataSource.getRepository(Warehouse);

  const roles = await Promise.all(
    ['admin', 'manager', 'staff', 'supplier'].map(async (name) => {
      let role = await roleRepository.findOne({ where: { name } });
      if (!role) {
        role = roleRepository.create({ name });
        await roleRepository.save(role);
      }
      return role;
    }),
  );

  const adminRole = roles.find((role) => role.name === 'admin');

  const existingAdmin = await userRepository.findOne({
    where: { email: 'admin@example.com' },
    relations: ['roles'],
  });

  if (!existingAdmin && adminRole) {
    const password = await bcrypt.hash('Admin@123', 10);
    const adminUser = userRepository.create({
      email: 'admin@example.com',
      password,
      fullName: 'System Administrator',
      phone: '0123456789',
      roles: [adminRole],
    });
    await userRepository.save(adminUser);
  }

  const defaultCategory = await categoryRepository.findOne({ where: { name: 'General' } });
  const category =
    defaultCategory ||
    categoryRepository.create({
      name: 'General',
    });
  if (!defaultCategory) {
    await categoryRepository.save(category);
  }

  const supplier =
    (await supplierRepository.findOne({ where: { name: 'Default Supplier' } })) ||
    supplierRepository.create({ name: 'Default Supplier' });
  if (!supplier.id) {
    await supplierRepository.save(supplier);
  }

  const customer =
    (await customerRepository.findOne({ where: { name: 'Default Customer' } })) ||
    customerRepository.create({
      name: 'Default Customer',
      phone: '0987654321',
    });
  if (!customer.id) {
    await customerRepository.save(customer);
  }

  const sampleProduct =
    (await productRepository.findOne({ where: { internalSku: 'SKU-001' } })) ||
    productRepository.create({
      internalSku: 'SKU-001',
      supplierBarcode: 'SUP-001',
      name: 'Sample Product',
      unit: 'pcs',
      category,
      supplier,
      minimumStock: 5,
    });
  if (!sampleProduct.id) {
    await productRepository.save(sampleProduct);
  }

  const existingStock = await stockRepository.findOne({
    where: { product: { id: sampleProduct.id }, locationCode: 'DEFAULT-LOC' },
  });

  if (!existingStock && sampleProduct.id) {
    const stockBalance = stockRepository.create({
      product: sampleProduct,
      locationCode: 'DEFAULT-LOC',
      totalPhysical: 100,
      allocated: 10,
      available: 90,
    });
    await stockRepository.save(stockBalance);
  }

  const defaultWarehouses = [
    {
      code: 'KHO-MAIN',
      name: 'Kho trung tâm',
      address: 'TP. Hồ Chí Minh',
    },
    {
      code: 'KHO-NVL',
      name: 'Kho nguyên vật liệu',
      address: 'Bình Dương',
    },
  ];

  for (const warehouseInput of defaultWarehouses) {
    const existingWarehouse = await warehouseRepository.findOne({ where: { code: warehouseInput.code } });
    if (!existingWarehouse) {
      const warehouse = warehouseRepository.create({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
        code: warehouseInput.code,
        name: warehouseInput.name,
        address: warehouseInput.address,
        status: 'active',
        managerIds: [],
        staffIds: [],
      });
      await warehouseRepository.save(warehouse);
    }
  }

  await dataSource.destroy();
  process.exit(0);
}

seed().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('Seed execution failed:', error);
  process.exit(1);
});
