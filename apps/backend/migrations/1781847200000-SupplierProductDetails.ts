import { MigrationInterface, QueryRunner } from 'typeorm';

export class SupplierProductDetails1781847200000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await this.columnExists(queryRunner, 'supplier_products', 'itemGroup'))) {
      await queryRunner.query(`ALTER TABLE \`supplier_products\` ADD \`itemGroup\` varchar(255) NULL`);
    }
    if (!(await this.columnExists(queryRunner, 'supplier_products', 'managementType'))) {
      await queryRunner.query(`ALTER TABLE \`supplier_products\` ADD \`managementType\` varchar(255) NULL`);
    }
    if (!(await this.columnExists(queryRunner, 'supplier_products', 'storagePosition'))) {
      await queryRunner.query(`ALTER TABLE \`supplier_products\` ADD \`storagePosition\` varchar(255) NULL`);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE \`supplier_products\` DROP COLUMN \`storagePosition\``);
    await queryRunner.query(`ALTER TABLE \`supplier_products\` DROP COLUMN \`managementType\``);
    await queryRunner.query(`ALTER TABLE \`supplier_products\` DROP COLUMN \`itemGroup\``);
  }

  private async columnExists(queryRunner: QueryRunner, table: string, column: string): Promise<boolean> {
    const result = await queryRunner.query(
      `SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
      [table, column],
    );
    return Number(result[0]?.cnt) > 0;
  }
}
