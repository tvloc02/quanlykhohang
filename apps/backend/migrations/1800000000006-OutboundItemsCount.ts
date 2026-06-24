import { MigrationInterface, QueryRunner } from 'typeorm';

export class OutboundItemsCount1800000000006 implements MigrationInterface {
  name = 'OutboundItemsCount1800000000006';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await this.columnExists(queryRunner, 'outbound_orders', 'items'))) {
      await queryRunner.query(`ALTER TABLE \`outbound_orders\` ADD COLUMN \`items\` int NOT NULL DEFAULT 0`);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await this.columnExists(queryRunner, 'outbound_orders', 'items')) {
      await queryRunner.query(`ALTER TABLE \`outbound_orders\` DROP COLUMN \`items\``);
    }
  }

  private async columnExists(queryRunner: QueryRunner, table: string, column: string): Promise<boolean> {
    const result = await queryRunner.query(
      `SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
      [table, column],
    );
    return Number(result[0]?.cnt) > 0;
  }
}
