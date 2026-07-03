import { MigrationInterface, QueryRunner } from 'typeorm';

export class SupplierAccountAndProducts1781847100000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await this.columnExists(queryRunner, 'suppliers', 'supplierCode'))) {
      await queryRunner.query(`ALTER TABLE \`suppliers\` ADD \`supplierCode\` varchar(255) NULL`);
      await queryRunner.query(`UPDATE \`suppliers\` SET \`supplierCode\` = CONCAT('NCC', LPAD(\`id\`, 3, '0')) WHERE \`supplierCode\` IS NULL`);
      await queryRunner.query(`ALTER TABLE \`suppliers\` MODIFY \`supplierCode\` varchar(255) NOT NULL`);
      if (!(await this.indexExists(queryRunner, 'suppliers', 'IDX_suppliers_supplierCode'))) {
        await queryRunner.query(`CREATE UNIQUE INDEX \`IDX_suppliers_supplierCode\` ON \`suppliers\` (\`supplierCode\`)`);
      }
    }
    if (!(await this.columnExists(queryRunner, 'suppliers', 'taxCode'))) {
      await queryRunner.query(`ALTER TABLE \`suppliers\` ADD \`taxCode\` varchar(255) NULL`);
    }
    if (!(await this.columnExists(queryRunner, 'suppliers', 'status'))) {
      await queryRunner.query(`ALTER TABLE \`suppliers\` ADD \`status\` varchar(255) NOT NULL DEFAULT 'active'`);
    }
    if (!(await this.columnExists(queryRunner, 'suppliers', 'contactPerson'))) {
      await queryRunner.query(`ALTER TABLE \`suppliers\` ADD \`contactPerson\` varchar(255) NULL`);
    }
    if (!(await this.columnExists(queryRunner, 'suppliers', 'phone'))) {
      await queryRunner.query(`ALTER TABLE \`suppliers\` ADD \`phone\` varchar(255) NULL`);
    }
    if (!(await this.columnExists(queryRunner, 'suppliers', 'email'))) {
      await queryRunner.query(`ALTER TABLE \`suppliers\` ADD \`email\` varchar(255) NULL`);
    }
    if (!(await this.columnExists(queryRunner, 'suppliers', 'address'))) {
      await queryRunner.query(`ALTER TABLE \`suppliers\` ADD \`address\` varchar(255) NULL`);
    }
    if (!(await this.columnExists(queryRunner, 'suppliers', 'leadTimeDays'))) {
      await queryRunner.query(`ALTER TABLE \`suppliers\` ADD \`leadTimeDays\` int NOT NULL DEFAULT 0`);
    }
    if (!(await this.columnExists(queryRunner, 'suppliers', 'paymentTerms'))) {
      await queryRunner.query(`ALTER TABLE \`suppliers\` ADD \`paymentTerms\` varchar(255) NULL`);
    }
    if (!(await this.columnExists(queryRunner, 'suppliers', 'currency'))) {
      await queryRunner.query(`ALTER TABLE \`suppliers\` ADD \`currency\` varchar(255) NOT NULL DEFAULT 'VND'`);
    }
    if (!(await this.columnExists(queryRunner, 'suppliers', 'priorityLevel'))) {
      await queryRunner.query(`ALTER TABLE \`suppliers\` ADD \`priorityLevel\` varchar(255) NOT NULL DEFAULT 'secondary'`);
    }
    if (!(await this.columnExists(queryRunner, 'suppliers', 'userId'))) {
      await queryRunner.query(`ALTER TABLE \`suppliers\` ADD \`userId\` bigint NULL`);
      if (!(await this.indexExists(queryRunner, 'suppliers', 'IDX_suppliers_userId'))) {
        await queryRunner.query(`CREATE UNIQUE INDEX \`IDX_suppliers_userId\` ON \`suppliers\` (\`userId\`)`);
      }
    }

    await queryRunner.query(`CREATE TABLE IF NOT EXISTS \`supplier_products\` (
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

    if (!(await this.constraintExists(queryRunner, 'suppliers', 'FK_suppliers_user'))) {
      await queryRunner.query(`ALTER TABLE \`suppliers\` ADD CONSTRAINT \`FK_suppliers_user\` FOREIGN KEY (\`userId\`) REFERENCES \`users\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`);
    }
    if (!(await this.constraintExists(queryRunner, 'supplier_products', 'FK_supplier_products_supplier'))) {
      await queryRunner.query(`ALTER TABLE \`supplier_products\` ADD CONSTRAINT \`FK_supplier_products_supplier\` FOREIGN KEY (\`supplierId\`) REFERENCES \`suppliers\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
    }
    if (!(await this.constraintExists(queryRunner, 'supplier_products', 'FK_supplier_products_product'))) {
      await queryRunner.query(`ALTER TABLE \`supplier_products\` ADD CONSTRAINT \`FK_supplier_products_product\` FOREIGN KEY (\`productId\`) REFERENCES \`products\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
    }
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

  private async constraintExists(queryRunner: QueryRunner, table: string, constraintName: string): Promise<boolean> {
    const result = await queryRunner.query(
      `SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND CONSTRAINT_NAME = ?`,
      [table, constraintName],
    );
    return Number(result[0]?.cnt) > 0;
  }
}
