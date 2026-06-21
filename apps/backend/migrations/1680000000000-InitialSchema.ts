import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1680000000000 implements MigrationInterface {
  name = 'InitialSchema1680000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE \`roles\` (
      \`id\` bigint NOT NULL AUTO_INCREMENT,
      \`name\` varchar(255) NOT NULL,
      PRIMARY KEY (\`id\`),
      UNIQUE INDEX \`IDX_roles_name\` (\`name\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

    await queryRunner.query(`CREATE TABLE \`users\` (
      \`id\` bigint NOT NULL AUTO_INCREMENT,
      \`email\` varchar(255) NOT NULL,
      \`password\` varchar(255) NOT NULL,
      \`fullName\` varchar(255) NULL,
      \`phone\` varchar(255) NULL,
      PRIMARY KEY (\`id\`),
      UNIQUE INDEX \`IDX_users_email\` (\`email\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

    await queryRunner.query(`CREATE TABLE \`user_roles\` (
      \`userId\` bigint NOT NULL,
      \`roleId\` bigint NOT NULL,
      PRIMARY KEY (\`userId\`, \`roleId\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

    await queryRunner.query(`CREATE TABLE \`categories\` (
      \`id\` bigint NOT NULL AUTO_INCREMENT,
      \`name\` varchar(255) NOT NULL,
      PRIMARY KEY (\`id\`),
      UNIQUE INDEX \`IDX_categories_name\` (\`name\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

    await queryRunner.query(`CREATE TABLE \`suppliers\` (
      \`id\` bigint NOT NULL AUTO_INCREMENT,
      \`name\` varchar(255) NOT NULL,
      PRIMARY KEY (\`id\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

    await queryRunner.query(`CREATE TABLE \`customers\` (
      \`id\` bigint NOT NULL AUTO_INCREMENT,
      \`name\` varchar(255) NOT NULL,
      \`phone\` varchar(255) NULL,
      PRIMARY KEY (\`id\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

    await queryRunner.query(`CREATE TABLE \`products\` (
      \`id\` bigint NOT NULL AUTO_INCREMENT,
      \`internalSku\` varchar(255) NOT NULL,
      \`supplierBarcode\` varchar(255) NULL,
      \`name\` varchar(255) NOT NULL,
      \`unit\` varchar(255) NULL,
      \`categoryId\` bigint NULL,
      \`minimumStock\` int NOT NULL DEFAULT 0,
      PRIMARY KEY (\`id\`),
      UNIQUE INDEX \`IDX_products_internalSku\` (\`internalSku\`),
      INDEX \`IDX_products_categoryId\` (\`categoryId\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

    await queryRunner.query(`CREATE TABLE \`inbound_receipts\` (
      \`id\` bigint NOT NULL AUTO_INCREMENT,
      \`supplierId\` bigint NULL,
      \`expectedDate\` datetime NULL,
      \`status\` varchar(255) NULL,
      PRIMARY KEY (\`id\`),
      INDEX \`IDX_inbound_receipts_supplierId\` (\`supplierId\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

    await queryRunner.query(`CREATE TABLE \`outbound_orders\` (
      \`id\` bigint NOT NULL AUTO_INCREMENT,
      \`customerId\` bigint NULL,
      \`expectedDate\` datetime NULL,
      \`status\` varchar(255) NULL,
      PRIMARY KEY (\`id\`),
      INDEX \`IDX_outbound_orders_customerId\` (\`customerId\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

    await queryRunner.query(`CREATE TABLE \`inbound_details\` (
      \`id\` bigint NOT NULL AUTO_INCREMENT,
      \`inboundReceiptId\` bigint NOT NULL,
      \`productId\` bigint NOT NULL,
      \`expectedQty\` int NOT NULL DEFAULT 0,
      \`receivedQty\` int NOT NULL DEFAULT 0,
      PRIMARY KEY (\`id\`),
      INDEX \`IDX_inbound_details_inboundReceiptId\` (\`inboundReceiptId\`),
      INDEX \`IDX_inbound_details_productId\` (\`productId\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

    await queryRunner.query(`CREATE TABLE \`outbound_details\` (
      \`id\` bigint NOT NULL AUTO_INCREMENT,
      \`outboundOrderId\` bigint NOT NULL,
      \`productId\` bigint NOT NULL,
      \`requiredQty\` int NOT NULL DEFAULT 0,
      \`pickedQty\` int NOT NULL DEFAULT 0,
      PRIMARY KEY (\`id\`),
      INDEX \`IDX_outbound_details_outboundOrderId\` (\`outboundOrderId\`),
      INDEX \`IDX_outbound_details_productId\` (\`productId\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

    await queryRunner.query(`CREATE TABLE \`picking_tasks\` (
      \`id\` bigint NOT NULL AUTO_INCREMENT,
      \`orderId\` bigint NOT NULL,
      \`assignedTo\` varchar(255) NULL,
      \`status\` varchar(255) NOT NULL DEFAULT 'OPEN',
      \`createdAt\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
      \`updatedAt\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      INDEX \`IDX_picking_tasks_orderId\` (\`orderId\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

    await queryRunner.query(`CREATE TABLE \`stock_balances\` (
      \`id\` bigint NOT NULL AUTO_INCREMENT,
      \`productId\` bigint NOT NULL,
      \`locationCode\` varchar(255) NOT NULL,
      \`totalPhysical\` int NOT NULL DEFAULT 0,
      \`allocated\` int NOT NULL DEFAULT 0,
      \`available\` int NOT NULL DEFAULT 0,
      PRIMARY KEY (\`id\`),
      UNIQUE INDEX \`IDX_stock_balances_product_location\` (\`productId\`, \`locationCode\`),
      INDEX \`IDX_stock_balances_productId\` (\`productId\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

    await queryRunner.query(`ALTER TABLE \`user_roles\` ADD CONSTRAINT \`FK_user_roles_user\` FOREIGN KEY (\`userId\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE \`user_roles\` ADD CONSTRAINT \`FK_user_roles_role\` FOREIGN KEY (\`roleId\`) REFERENCES \`roles\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE \`products\` ADD CONSTRAINT \`FK_products_category\` FOREIGN KEY (\`categoryId\`) REFERENCES \`categories\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE \`inbound_receipts\` ADD CONSTRAINT \`FK_inbound_receipts_supplier\` FOREIGN KEY (\`supplierId\`) REFERENCES \`suppliers\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE \`outbound_orders\` ADD CONSTRAINT \`FK_outbound_orders_customer\` FOREIGN KEY (\`customerId\`) REFERENCES \`customers\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE \`inbound_details\` ADD CONSTRAINT \`FK_inbound_details_inboundReceipt\` FOREIGN KEY (\`inboundReceiptId\`) REFERENCES \`inbound_receipts\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE \`inbound_details\` ADD CONSTRAINT \`FK_inbound_details_product\` FOREIGN KEY (\`productId\`) REFERENCES \`products\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE \`outbound_details\` ADD CONSTRAINT \`FK_outbound_details_outboundOrder\` FOREIGN KEY (\`outboundOrderId\`) REFERENCES \`outbound_orders\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE \`outbound_details\` ADD CONSTRAINT \`FK_outbound_details_product\` FOREIGN KEY (\`productId\`) REFERENCES \`products\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE \`picking_tasks\` ADD CONSTRAINT \`FK_picking_tasks_order\` FOREIGN KEY (\`orderId\`) REFERENCES \`outbound_orders\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE \`stock_balances\` ADD CONSTRAINT \`FK_stock_balances_product\` FOREIGN KEY (\`productId\`) REFERENCES \`products\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE \`stock_balances\` DROP FOREIGN KEY \`FK_stock_balances_product\``);
    await queryRunner.query(`ALTER TABLE \`picking_tasks\` DROP FOREIGN KEY \`FK_picking_tasks_order\``);
    await queryRunner.query(`ALTER TABLE \`outbound_details\` DROP FOREIGN KEY \`FK_outbound_details_product\``);
    await queryRunner.query(`ALTER TABLE \`outbound_details\` DROP FOREIGN KEY \`FK_outbound_details_outboundOrder\``);
    await queryRunner.query(`ALTER TABLE \`inbound_details\` DROP FOREIGN KEY \`FK_inbound_details_product\``);
    await queryRunner.query(`ALTER TABLE \`inbound_details\` DROP FOREIGN KEY \`FK_inbound_details_inboundReceipt\``);
    await queryRunner.query(`ALTER TABLE \`outbound_orders\` DROP FOREIGN KEY \`FK_outbound_orders_customer\``);
    await queryRunner.query(`ALTER TABLE \`inbound_receipts\` DROP FOREIGN KEY \`FK_inbound_receipts_supplier\``);
    await queryRunner.query(`ALTER TABLE \`products\` DROP FOREIGN KEY \`FK_products_category\``);
    await queryRunner.query(`ALTER TABLE \`user_roles\` DROP FOREIGN KEY \`FK_user_roles_role\``);
    await queryRunner.query(`ALTER TABLE \`user_roles\` DROP FOREIGN KEY \`FK_user_roles_user\``);
    await queryRunner.query(`DROP TABLE \`stock_balances\``);
    await queryRunner.query(`DROP TABLE \`picking_tasks\``);
    await queryRunner.query(`DROP TABLE \`outbound_details\``);
    await queryRunner.query(`DROP TABLE \`inbound_details\``);
    await queryRunner.query(`DROP TABLE \`outbound_orders\``);
    await queryRunner.query(`DROP TABLE \`inbound_receipts\``);
    await queryRunner.query(`DROP TABLE \`products\``);
    await queryRunner.query(`DROP TABLE \`customers\``);
    await queryRunner.query(`DROP TABLE \`suppliers\``);
    await queryRunner.query(`DROP TABLE \`categories\``);
    await queryRunner.query(`DROP TABLE \`user_roles\``);
    await queryRunner.query(`DROP TABLE \`users\``);
    await queryRunner.query(`DROP TABLE \`roles\``);
  }
}
