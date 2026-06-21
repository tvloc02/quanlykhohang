import { MigrationInterface, QueryRunner } from 'typeorm';

export class SupplierAccountAndProducts1781847100000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE \`suppliers\` ADD \`supplierCode\` varchar(255) NULL`);
    await queryRunner.query(`UPDATE \`suppliers\` SET \`supplierCode\` = CONCAT('NCC', LPAD(\`id\`, 3, '0')) WHERE \`supplierCode\` IS NULL`);
    await queryRunner.query(`ALTER TABLE \`suppliers\` MODIFY \`supplierCode\` varchar(255) NOT NULL`);
    await queryRunner.query(`CREATE UNIQUE INDEX \`IDX_suppliers_supplierCode\` ON \`suppliers\` (\`supplierCode\`)`);
    await queryRunner.query(`ALTER TABLE \`suppliers\` ADD \`taxCode\` varchar(255) NULL`);
    await queryRunner.query(`ALTER TABLE \`suppliers\` ADD \`status\` varchar(255) NOT NULL DEFAULT 'active'`);
    await queryRunner.query(`ALTER TABLE \`suppliers\` ADD \`contactPerson\` varchar(255) NULL`);
    await queryRunner.query(`ALTER TABLE \`suppliers\` ADD \`phone\` varchar(255) NULL`);
    await queryRunner.query(`ALTER TABLE \`suppliers\` ADD \`email\` varchar(255) NULL`);
    await queryRunner.query(`ALTER TABLE \`suppliers\` ADD \`address\` varchar(255) NULL`);
    await queryRunner.query(`ALTER TABLE \`suppliers\` ADD \`leadTimeDays\` int NOT NULL DEFAULT 0`);
    await queryRunner.query(`ALTER TABLE \`suppliers\` ADD \`paymentTerms\` varchar(255) NULL`);
    await queryRunner.query(`ALTER TABLE \`suppliers\` ADD \`currency\` varchar(255) NOT NULL DEFAULT 'VND'`);
    await queryRunner.query(`ALTER TABLE \`suppliers\` ADD \`priorityLevel\` varchar(255) NOT NULL DEFAULT 'secondary'`);
    await queryRunner.query(`ALTER TABLE \`suppliers\` ADD \`userId\` bigint NULL`);
    await queryRunner.query(`CREATE UNIQUE INDEX \`IDX_suppliers_userId\` ON \`suppliers\` (\`userId\`)`);

    await queryRunner.query(`CREATE TABLE \`supplier_products\` (
      \`id\` bigint NOT NULL AUTO_INCREMENT,
      \`supplierId\` bigint NULL,
      \`productId\` bigint NULL,
      \`supplierSku\` varchar(255) NULL,
      \`purchasePrice\` decimal(15,2) NOT NULL DEFAULT 0,
      \`isPrimary\` tinyint NOT NULL DEFAULT 0,
      PRIMARY KEY (\`id\`),
      UNIQUE INDEX \`IDX_supplier_products_supplier_product\` (\`supplierId\`, \`productId\`),
      INDEX \`IDX_supplier_products_supplierId\` (\`supplierId\`),
      INDEX \`IDX_supplier_products_productId\` (\`productId\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

    await queryRunner.query(`ALTER TABLE \`suppliers\` ADD CONSTRAINT \`FK_suppliers_user\` FOREIGN KEY (\`userId\`) REFERENCES \`users\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE \`supplier_products\` ADD CONSTRAINT \`FK_supplier_products_supplier\` FOREIGN KEY (\`supplierId\`) REFERENCES \`suppliers\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE \`supplier_products\` ADD CONSTRAINT \`FK_supplier_products_product\` FOREIGN KEY (\`productId\`) REFERENCES \`products\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE \`supplier_products\` DROP FOREIGN KEY \`FK_supplier_products_product\``);
    await queryRunner.query(`ALTER TABLE \`supplier_products\` DROP FOREIGN KEY \`FK_supplier_products_supplier\``);
    await queryRunner.query(`ALTER TABLE \`suppliers\` DROP FOREIGN KEY \`FK_suppliers_user\``);
    await queryRunner.query(`DROP TABLE \`supplier_products\``);
    await queryRunner.query(`DROP INDEX \`IDX_suppliers_userId\` ON \`suppliers\``);
    await queryRunner.query(`ALTER TABLE \`suppliers\` DROP COLUMN \`userId\``);
    await queryRunner.query(`ALTER TABLE \`suppliers\` DROP COLUMN \`priorityLevel\``);
    await queryRunner.query(`ALTER TABLE \`suppliers\` DROP COLUMN \`currency\``);
    await queryRunner.query(`ALTER TABLE \`suppliers\` DROP COLUMN \`paymentTerms\``);
    await queryRunner.query(`ALTER TABLE \`suppliers\` DROP COLUMN \`leadTimeDays\``);
    await queryRunner.query(`ALTER TABLE \`suppliers\` DROP COLUMN \`address\``);
    await queryRunner.query(`ALTER TABLE \`suppliers\` DROP COLUMN \`email\``);
    await queryRunner.query(`ALTER TABLE \`suppliers\` DROP COLUMN \`phone\``);
    await queryRunner.query(`ALTER TABLE \`suppliers\` DROP COLUMN \`contactPerson\``);
    await queryRunner.query(`ALTER TABLE \`suppliers\` DROP COLUMN \`status\``);
    await queryRunner.query(`ALTER TABLE \`suppliers\` DROP COLUMN \`taxCode\``);
    await queryRunner.query(`DROP INDEX \`IDX_suppliers_supplierCode\` ON \`suppliers\``);
    await queryRunner.query(`ALTER TABLE \`suppliers\` DROP COLUMN \`supplierCode\``);
  }
}
