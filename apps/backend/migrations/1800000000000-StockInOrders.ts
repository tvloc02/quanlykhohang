import { MigrationInterface, QueryRunner } from 'typeorm';

export class StockInOrders1800000000000 implements MigrationInterface {
  name = 'StockInOrders1800000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS \`stock_in_orders\` (
      \`id\` bigint NOT NULL AUTO_INCREMENT,
      \`orderCode\` varchar(255) NOT NULL,
      \`sourcePurchaseOrderId\` bigint NULL,
      \`sourcePurchaseOrderNo\` varchar(255) NULL,
      \`status\` varchar(255) NOT NULL DEFAULT 'DRAFT',
      \`currentStepUserId\` varchar(255) NULL,
      \`currentStepUserEmail\` varchar(255) NULL,
      \`note\` text NULL,
      \`completedAt\` datetime NULL,
      \`createdAt\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
      \`updatedAt\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      UNIQUE INDEX \`IDX_stock_in_orders_orderCode\` (\`orderCode\`),
      INDEX \`IDX_stock_in_orders_sourcePurchaseOrderId\` (\`sourcePurchaseOrderId\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

    await queryRunner.query(`CREATE TABLE IF NOT EXISTS \`stock_in_order_details\` (
      \`id\` bigint NOT NULL AUTO_INCREMENT,
      \`stockInOrderId\` bigint NOT NULL,
      \`productId\` bigint NOT NULL,
      \`warehouseCode\` varchar(255) NULL,
      \`requestedQty\` int NOT NULL DEFAULT 0,
      \`actualQty\` int NOT NULL DEFAULT 0,
      \`unitPrice\` decimal(15,2) NOT NULL DEFAULT 0,
      \`totalLineAmount\` decimal(15,2) NOT NULL DEFAULT 0,
      PRIMARY KEY (\`id\`),
      INDEX \`IDX_stock_in_order_details_stockInOrderId\` (\`stockInOrderId\`),
      INDEX \`IDX_stock_in_order_details_productId\` (\`productId\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

    await this.addConstraintIfNotExists(queryRunner, 'stock_in_orders', 'FK_stock_in_orders_sourcePurchaseOrder',
      `ALTER TABLE \`stock_in_orders\` ADD CONSTRAINT \`FK_stock_in_orders_sourcePurchaseOrder\` FOREIGN KEY (\`sourcePurchaseOrderId\`) REFERENCES \`inbound_receipts\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`);
    await this.addConstraintIfNotExists(queryRunner, 'stock_in_order_details', 'FK_stock_in_order_details_stockInOrder',
      `ALTER TABLE \`stock_in_order_details\` ADD CONSTRAINT \`FK_stock_in_order_details_stockInOrder\` FOREIGN KEY (\`stockInOrderId\`) REFERENCES \`stock_in_orders\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
    await this.addConstraintIfNotExists(queryRunner, 'stock_in_order_details', 'FK_stock_in_order_details_product',
      `ALTER TABLE \`stock_in_order_details\` ADD CONSTRAINT \`FK_stock_in_order_details_product\` FOREIGN KEY (\`productId\`) REFERENCES \`products\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE \`stock_in_order_details\` DROP FOREIGN KEY \`FK_stock_in_order_details_product\``);
    await queryRunner.query(`ALTER TABLE \`stock_in_order_details\` DROP FOREIGN KEY \`FK_stock_in_order_details_stockInOrder\``);
    await queryRunner.query(`ALTER TABLE \`stock_in_orders\` DROP FOREIGN KEY \`FK_stock_in_orders_sourcePurchaseOrder\``);
    await queryRunner.query(`DROP TABLE \`stock_in_order_details\``);
    await queryRunner.query(`DROP TABLE \`stock_in_orders\``);
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
