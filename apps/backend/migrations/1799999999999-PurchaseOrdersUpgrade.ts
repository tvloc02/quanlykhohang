import { MigrationInterface, QueryRunner } from 'typeorm';

export class PurchaseOrdersUpgrade1799999999999 implements MigrationInterface {
  name = 'PurchaseOrdersUpgrade1799999999999';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await this.columnExists(queryRunner, 'inbound_receipts', 'poNumber'))) {
      await queryRunner.query(`ALTER TABLE \`inbound_receipts\` ADD \`poNumber\` varchar(255) NULL`);
      await queryRunner.query(`UPDATE \`inbound_receipts\` SET \`poNumber\` = CONCAT('DMH', LPAD(\`id\`, 5, '0')) WHERE \`poNumber\` IS NULL`);
      await queryRunner.query(`ALTER TABLE \`inbound_receipts\` MODIFY \`poNumber\` varchar(255) NOT NULL`);
      if (!(await this.indexExists(queryRunner, 'inbound_receipts', 'IDX_inbound_receipts_poNumber'))) {
        await queryRunner.query(`CREATE UNIQUE INDEX \`IDX_inbound_receipts_poNumber\` ON \`inbound_receipts\` (\`poNumber\`)`);
      }
    }
    if (!(await this.columnExists(queryRunner, 'inbound_receipts', 'orderDate'))) {
      await queryRunner.query(`ALTER TABLE \`inbound_receipts\` ADD \`orderDate\` datetime NULL`);
    }
    if (!(await this.columnExists(queryRunner, 'inbound_receipts', 'description'))) {
      await queryRunner.query(`ALTER TABLE \`inbound_receipts\` ADD \`description\` text NULL`);
    }
    if (!(await this.columnExists(queryRunner, 'inbound_receipts', 'totalAmount'))) {
      await queryRunner.query(`ALTER TABLE \`inbound_receipts\` ADD \`totalAmount\` decimal(15,2) NOT NULL DEFAULT 0`);
    }

    if (!(await this.columnExists(queryRunner, 'inbound_details', 'warehouseCode'))) {
      await queryRunner.query(`ALTER TABLE \`inbound_details\` ADD \`warehouseCode\` varchar(255) NULL`);
    }
    if (!(await this.columnExists(queryRunner, 'inbound_details', 'unitPrice'))) {
      await queryRunner.query(`ALTER TABLE \`inbound_details\` ADD \`unitPrice\` decimal(15,2) NOT NULL DEFAULT 0`);
    }
    if (!(await this.columnExists(queryRunner, 'inbound_details', 'totalLineAmount'))) {
      await queryRunner.query(`ALTER TABLE \`inbound_details\` ADD \`totalLineAmount\` decimal(15,2) NOT NULL DEFAULT 0`);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE \`inbound_details\` DROP COLUMN \`totalLineAmount\``);
    await queryRunner.query(`ALTER TABLE \`inbound_details\` DROP COLUMN \`unitPrice\``);
    await queryRunner.query(`ALTER TABLE \`inbound_details\` DROP COLUMN \`warehouseCode\``);
    await queryRunner.query(`DROP INDEX \`IDX_inbound_receipts_poNumber\` ON \`inbound_receipts\``);
    await queryRunner.query(`ALTER TABLE \`inbound_receipts\` DROP COLUMN \`totalAmount\``);
    await queryRunner.query(`ALTER TABLE \`inbound_receipts\` DROP COLUMN \`description\``);
    await queryRunner.query(`ALTER TABLE \`inbound_receipts\` DROP COLUMN \`orderDate\``);
    await queryRunner.query(`ALTER TABLE \`inbound_receipts\` DROP COLUMN \`poNumber\``);
  }

  private async columnExists(queryRunner: QueryRunner, table: string, column: string): Promise<boolean> {
    const result = await queryRunner.query(
      `SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
      [table, column],
    );
    return Number(result[0]?.cnt) > 0;
  }

  private async indexExists(queryRunner: QueryRunner, table: string, indexName: string): Promise<boolean> {
    const result = await queryRunner.query(
      `SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?`,
      [table, indexName],
    );
    return Number(result[0]?.cnt) > 0;
  }
}
