import { MigrationInterface, QueryRunner } from 'typeorm';

export class SupplierProductDetails1781847200000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE \`supplier_products\` ADD \`itemGroup\` varchar(255) NULL`);
    await queryRunner.query(`ALTER TABLE \`supplier_products\` ADD \`managementType\` varchar(255) NULL`);
    await queryRunner.query(`ALTER TABLE \`supplier_products\` ADD \`storagePosition\` varchar(255) NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE \`supplier_products\` DROP COLUMN \`storagePosition\``);
    await queryRunner.query(`ALTER TABLE \`supplier_products\` DROP COLUMN \`managementType\``);
    await queryRunner.query(`ALTER TABLE \`supplier_products\` DROP COLUMN \`itemGroup\``);
  }
}
