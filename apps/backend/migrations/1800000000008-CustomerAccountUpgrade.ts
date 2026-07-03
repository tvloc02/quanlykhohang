import { MigrationInterface, QueryRunner } from 'typeorm';

export class CustomerAccountUpgrade1800000000008 implements MigrationInterface {
  name = 'CustomerAccountUpgrade1800000000008';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add customerCode column
    if (!(await this.columnExists(queryRunner, 'customers', 'customerCode'))) {
      await queryRunner.query(`ALTER TABLE \`customers\` ADD \`customerCode\` varchar(255) NULL`);
      await queryRunner.query(`UPDATE \`customers\` SET \`customerCode\` = CONCAT('KH', LPAD(\`id\`, 3, '0')) WHERE \`customerCode\` IS NULL`);
      await queryRunner.query(`ALTER TABLE \`customers\` MODIFY \`customerCode\` varchar(255) NOT NULL`);
      if (!(await this.indexExists(queryRunner, 'customers', 'IDX_customers_customerCode'))) {
        await queryRunner.query(`CREATE UNIQUE INDEX \`IDX_customers_customerCode\` ON \`customers\` (\`customerCode\`)`);
      }
    }

    // Add email column
    if (!(await this.columnExists(queryRunner, 'customers', 'email'))) {
      await queryRunner.query(`ALTER TABLE \`customers\` ADD \`email\` varchar(255) NULL`);
    }

    // Add address column
    if (!(await this.columnExists(queryRunner, 'customers', 'address'))) {
      await queryRunner.query(`ALTER TABLE \`customers\` ADD \`address\` varchar(500) NULL`);
    }

    // Add type column (B2B / B2C)
    if (!(await this.columnExists(queryRunner, 'customers', 'type'))) {
      await queryRunner.query(`ALTER TABLE \`customers\` ADD \`type\` varchar(50) NOT NULL DEFAULT 'B2C'`);
    }

    // Add status column
    if (!(await this.columnExists(queryRunner, 'customers', 'status'))) {
      await queryRunner.query(`ALTER TABLE \`customers\` ADD \`status\` varchar(50) NOT NULL DEFAULT 'active'`);
    }

    // Add contactPerson column
    if (!(await this.columnExists(queryRunner, 'customers', 'contactPerson'))) {
      await queryRunner.query(`ALTER TABLE \`customers\` ADD \`contactPerson\` varchar(255) NULL`);
    }

    // Add userId column with unique index and FK
    if (!(await this.columnExists(queryRunner, 'customers', 'userId'))) {
      await queryRunner.query(`ALTER TABLE \`customers\` ADD \`userId\` bigint NULL`);
      if (!(await this.indexExists(queryRunner, 'customers', 'IDX_customers_userId'))) {
        await queryRunner.query(`CREATE UNIQUE INDEX \`IDX_customers_userId\` ON \`customers\` (\`userId\`)`);
      }
    }

    if (!(await this.constraintExists(queryRunner, 'customers', 'FK_customers_user'))) {
      await queryRunner.query(`ALTER TABLE \`customers\` ADD CONSTRAINT \`FK_customers_user\` FOREIGN KEY (\`userId\`) REFERENCES \`users\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await this.constraintExists(queryRunner, 'customers', 'FK_customers_user')) {
      await queryRunner.query(`ALTER TABLE \`customers\` DROP FOREIGN KEY \`FK_customers_user\``);
    }
    if (await this.indexExists(queryRunner, 'customers', 'IDX_customers_userId')) {
      await queryRunner.query(`DROP INDEX \`IDX_customers_userId\` ON \`customers\``);
    }
    if (await this.columnExists(queryRunner, 'customers', 'userId')) {
      await queryRunner.query(`ALTER TABLE \`customers\` DROP COLUMN \`userId\``);
    }
    if (await this.columnExists(queryRunner, 'customers', 'contactPerson')) {
      await queryRunner.query(`ALTER TABLE \`customers\` DROP COLUMN \`contactPerson\``);
    }
    if (await this.columnExists(queryRunner, 'customers', 'status')) {
      await queryRunner.query(`ALTER TABLE \`customers\` DROP COLUMN \`status\``);
    }
    if (await this.columnExists(queryRunner, 'customers', 'type')) {
      await queryRunner.query(`ALTER TABLE \`customers\` DROP COLUMN \`type\``);
    }
    if (await this.columnExists(queryRunner, 'customers', 'address')) {
      await queryRunner.query(`ALTER TABLE \`customers\` DROP COLUMN \`address\``);
    }
    if (await this.columnExists(queryRunner, 'customers', 'email')) {
      await queryRunner.query(`ALTER TABLE \`customers\` DROP COLUMN \`email\``);
    }
    if (await this.indexExists(queryRunner, 'customers', 'IDX_customers_customerCode')) {
      await queryRunner.query(`DROP INDEX \`IDX_customers_customerCode\` ON \`customers\``);
    }
    if (await this.columnExists(queryRunner, 'customers', 'customerCode')) {
      await queryRunner.query(`ALTER TABLE \`customers\` DROP COLUMN \`customerCode\``);
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

  private async constraintExists(queryRunner: QueryRunner, table: string, constraintName: string): Promise<boolean> {
    const result = await queryRunner.query(
      `SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND CONSTRAINT_NAME = ?`,
      [table, constraintName],
    );
    return Number(result[0]?.cnt) > 0;
  }
}
