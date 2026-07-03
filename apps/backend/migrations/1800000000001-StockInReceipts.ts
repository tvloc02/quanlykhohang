import { MigrationInterface, QueryRunner } from 'typeorm';

export class StockInReceipts1800000000001 implements MigrationInterface {
  name = 'StockInReceipts1800000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS \`stock_in_receipts\` (
      \`id\` bigint NOT NULL AUTO_INCREMENT,
      \`receiptCode\` varchar(255) NOT NULL,
      \`receiptType\` varchar(255) NOT NULL DEFAULT 'PURCHASE_GOODS',
      \`warehouseCode\` varchar(255) NULL,
      \`supplierId\` bigint NULL,
      \`sourceStockInOrderId\` bigint NULL,
      \`sourceReferenceNo\` varchar(255) NULL,
      \`receiptDate\` datetime NOT NULL,
      \`status\` varchar(255) NOT NULL DEFAULT 'DRAFT',
      \`description\` text NULL,
      \`totalAmount\` decimal(15,2) NOT NULL DEFAULT 0,
      \`postedAt\` datetime NULL,
      \`createdAt\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
      \`updatedAt\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      UNIQUE INDEX \`IDX_stock_in_receipts_receiptCode\` (\`receiptCode\`),
      INDEX \`IDX_stock_in_receipts_supplierId\` (\`supplierId\`),
      INDEX \`IDX_stock_in_receipts_sourceStockInOrderId\` (\`sourceStockInOrderId\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

    await queryRunner.query(`CREATE TABLE IF NOT EXISTS \`stock_in_receipt_details\` (
      \`id\` bigint NOT NULL AUTO_INCREMENT,
      \`receiptId\` bigint NOT NULL,
      \`productId\` bigint NOT NULL,
      \`warehouseCode\` varchar(255) NULL,
      \`quantity\` int NOT NULL DEFAULT 0,
      \`unitPrice\` decimal(15,2) NOT NULL DEFAULT 0,
      \`totalLineAmount\` decimal(15,2) NOT NULL DEFAULT 0,
      \`note\` text NULL,
      PRIMARY KEY (\`id\`),
      INDEX \`IDX_stock_in_receipt_details_receiptId\` (\`receiptId\`),
      INDEX \`IDX_stock_in_receipt_details_productId\` (\`productId\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

    await this.addConstraintIfNotExists(queryRunner, 'stock_in_receipts', 'FK_stock_in_receipts_supplier',
      `ALTER TABLE \`stock_in_receipts\` ADD CONSTRAINT \`FK_stock_in_receipts_supplier\` FOREIGN KEY (\`supplierId\`) REFERENCES \`suppliers\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`);
    await this.addConstraintIfNotExists(queryRunner, 'stock_in_receipts', 'FK_stock_in_receipts_sourceStockInOrder',
      `ALTER TABLE \`stock_in_receipts\` ADD CONSTRAINT \`FK_stock_in_receipts_sourceStockInOrder\` FOREIGN KEY (\`sourceStockInOrderId\`) REFERENCES \`stock_in_orders\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`);
    await this.addConstraintIfNotExists(queryRunner, 'stock_in_receipt_details', 'FK_stock_in_receipt_details_receipt',
      `ALTER TABLE \`stock_in_receipt_details\` ADD CONSTRAINT \`FK_stock_in_receipt_details_receipt\` FOREIGN KEY (\`receiptId\`) REFERENCES \`stock_in_receipts\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
    await this.addConstraintIfNotExists(queryRunner, 'stock_in_receipt_details', 'FK_stock_in_receipt_details_product',
      `ALTER TABLE \`stock_in_receipt_details\` ADD CONSTRAINT \`FK_stock_in_receipt_details_product\` FOREIGN KEY (\`productId\`) REFERENCES \`products\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE \`stock_in_receipt_details\` DROP FOREIGN KEY \`FK_stock_in_receipt_details_product\``);
    await queryRunner.query(`ALTER TABLE \`stock_in_receipt_details\` DROP FOREIGN KEY \`FK_stock_in_receipt_details_receipt\``);
    await queryRunner.query(`ALTER TABLE \`stock_in_receipts\` DROP FOREIGN KEY \`FK_stock_in_receipts_sourceStockInOrder\``);
    await queryRunner.query(`ALTER TABLE \`stock_in_receipts\` DROP FOREIGN KEY \`FK_stock_in_receipts_supplier\``);
    await queryRunner.query(`DROP TABLE \`stock_in_receipt_details\``);
    await queryRunner.query(`DROP TABLE \`stock_in_receipts\``);
  }

  private async addConstraintIfNotExists(queryRunner: QueryRunner, table: string, constraintName: string, sql: string): Promise<void> {
    const result = await queryRunner.query(
      `SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND CONSTRAINT_NAME = ?`,
      [table, constraintName],
    );
    if (Number(result[0]?.cnt) === 0) {
      await queryRunner.query(sql);
    }
  }
}
