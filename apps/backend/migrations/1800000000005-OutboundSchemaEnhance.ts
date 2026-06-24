import { MigrationInterface, QueryRunner } from 'typeorm';

export class OutboundSchemaEnhance1800000000005 implements MigrationInterface {
  name = 'OutboundSchemaEnhance1800000000005';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await this.columnExists(queryRunner, 'outbound_orders', 'orderNo'))) {
      await queryRunner.query(`ALTER TABLE \`outbound_orders\` ADD COLUMN \`orderNo\` varchar(50) NULL`);
    }

    if (!(await this.indexExists(queryRunner, 'outbound_orders', 'IDX_outbound_orders_orderNo'))) {
      await queryRunner.query(`CREATE UNIQUE INDEX \`IDX_outbound_orders_orderNo\` ON \`outbound_orders\` (\`orderNo\`)`);
    }

    if (!(await this.columnExists(queryRunner, 'outbound_orders', 'description'))) {
      await queryRunner.query(`ALTER TABLE \`outbound_orders\` ADD COLUMN \`description\` varchar(500) NULL`);
    }

    if (!(await this.columnExists(queryRunner, 'outbound_details', 'warehouseCode'))) {
      await queryRunner.query(`ALTER TABLE \`outbound_details\` ADD COLUMN \`warehouseCode\` varchar(50) NULL`);
    }

    if (!(await this.columnExists(queryRunner, 'outbound_details', 'unitPrice'))) {
      await queryRunner.query(`ALTER TABLE \`outbound_details\` ADD COLUMN \`unitPrice\` decimal(14,2) NOT NULL DEFAULT '0.00'`);
    }

    if (!(await this.columnExists(queryRunner, 'outbound_details', 'totalLineAmount'))) {
      await queryRunner.query(`ALTER TABLE \`outbound_details\` ADD COLUMN \`totalLineAmount\` decimal(14,2) NOT NULL DEFAULT '0.00'`);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await this.indexExists(queryRunner, 'outbound_orders', 'IDX_outbound_orders_orderNo')) {
      await queryRunner.query(`DROP INDEX \`IDX_outbound_orders_orderNo\` ON \`outbound_orders\``);
    }

    if (await this.columnExists(queryRunner, 'outbound_details', 'totalLineAmount')) {
      await queryRunner.query(`ALTER TABLE \`outbound_details\` DROP COLUMN \`totalLineAmount\``);
    }

    if (await this.columnExists(queryRunner, 'outbound_details', 'unitPrice')) {
      await queryRunner.query(`ALTER TABLE \`outbound_details\` DROP COLUMN \`unitPrice\``);
    }

    if (await this.columnExists(queryRunner, 'outbound_details', 'warehouseCode')) {
      await queryRunner.query(`ALTER TABLE \`outbound_details\` DROP COLUMN \`warehouseCode\``);
    }

    if (await this.columnExists(queryRunner, 'outbound_orders', 'description')) {
      await queryRunner.query(`ALTER TABLE \`outbound_orders\` DROP COLUMN \`description\``);
    }

    if (await this.columnExists(queryRunner, 'outbound_orders', 'orderNo')) {
      await queryRunner.query(`ALTER TABLE \`outbound_orders\` DROP COLUMN \`orderNo\``);
    }
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
