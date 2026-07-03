import { MigrationInterface, QueryRunner } from 'typeorm';

export class StocktakeRequestFields1800000000007 implements MigrationInterface {
  name = 'StocktakeRequestFields1800000000007';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create the base stocktakes table if it doesn't exist
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS \`stocktakes\` (
      \`id\` bigint NOT NULL AUTO_INCREMENT,
      \`stocktakeNo\` varchar(255) NOT NULL,
      \`locationCode\` varchar(255) NOT NULL,
      \`status\` enum('REQUESTED', 'DRAFT', 'COUNTING', 'COUNTING_DONE', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'DRAFT',
      \`note\` text NULL,
      \`plannedDate\` datetime NULL,
      \`assignee\` varchar(255) NULL,
      \`createdBy\` varchar(255) NULL,
      \`approvedBy\` varchar(255) NULL,
      \`approvedAt\` datetime NULL,
      \`createdAt\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      UNIQUE INDEX \`IDX_stocktakes_stocktakeNo\` (\`stocktakeNo\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

    // Create the stocktake_details table if it doesn't exist
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS \`stocktake_details\` (
      \`id\` bigint NOT NULL AUTO_INCREMENT,
      \`stocktakeId\` bigint NULL,
      \`productId\` bigint NULL,
      \`systemQty\` int NOT NULL DEFAULT 0,
      \`countedQty\` int NULL,
      \`difference\` int NOT NULL DEFAULT 0,
      \`note\` text NULL,
      PRIMARY KEY (\`id\`),
      INDEX \`IDX_stocktake_details_stocktakeId\` (\`stocktakeId\`),
      INDEX \`IDX_stocktake_details_productId\` (\`productId\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

    await this.addConstraintIfNotExists(queryRunner, 'stocktake_details', 'FK_stocktake_details_stocktake',
      `ALTER TABLE \`stocktake_details\` ADD CONSTRAINT \`FK_stocktake_details_stocktake\` FOREIGN KEY (\`stocktakeId\`) REFERENCES \`stocktakes\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
    await this.addConstraintIfNotExists(queryRunner, 'stocktake_details', 'FK_stocktake_details_product',
      `ALTER TABLE \`stocktake_details\` ADD CONSTRAINT \`FK_stocktake_details_product\` FOREIGN KEY (\`productId\`) REFERENCES \`products\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`);

    // Add the request-related fields
    if (!(await this.columnExists(queryRunner, 'stocktakes', 'branch'))) {
      await queryRunner.query(`ALTER TABLE \`stocktakes\` ADD COLUMN \`branch\` varchar(100) NULL`);
    }
    if (!(await this.columnExists(queryRunner, 'stocktakes', 'dueDate'))) {
      await queryRunner.query(`ALTER TABLE \`stocktakes\` ADD COLUMN \`dueDate\` datetime NULL`);
    }
    if (!(await this.columnExists(queryRunner, 'stocktakes', 'purpose'))) {
      await queryRunner.query(`ALTER TABLE \`stocktakes\` ADD COLUMN \`purpose\` varchar(255) NULL`);
    }
    if (!(await this.columnExists(queryRunner, 'stocktakes', 'reference'))) {
      await queryRunner.query(`ALTER TABLE \`stocktakes\` ADD COLUMN \`reference\` varchar(255) NULL`);
    }
    if (!(await this.columnExists(queryRunner, 'stocktakes', 'requestNo'))) {
      await queryRunner.query(`ALTER TABLE \`stocktakes\` ADD COLUMN \`requestNo\` varchar(50) NULL`);
      await queryRunner.query(`ALTER TABLE \`stocktakes\` ADD UNIQUE INDEX \`IDX_stocktakes_requestNo\` (\`requestNo\`)`);
    }
    if (!(await this.columnExists(queryRunner, 'stocktakes', 'requestDate'))) {
      await queryRunner.query(`ALTER TABLE \`stocktakes\` ADD COLUMN \`requestDate\` datetime NULL`);
    }
    if (!(await this.columnExists(queryRunner, 'stocktakes', 'checkBy'))) {
      await queryRunner.query(`ALTER TABLE \`stocktakes\` ADD COLUMN \`checkBy\` varchar(50) NULL`);
    }
    if (!(await this.columnExists(queryRunner, 'stocktakes', 'detailBy'))) {
      await queryRunner.query(`ALTER TABLE \`stocktakes\` ADD COLUMN \`detailBy\` varchar(50) NULL`);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await this.columnExists(queryRunner, 'stocktakes', 'detailBy')) {
      await queryRunner.query(`ALTER TABLE ` + '`stocktakes`' + ` DROP COLUMN ` + '`detailBy`');
    }
    if (await this.columnExists(queryRunner, 'stocktakes', 'checkBy')) {
      await queryRunner.query(`ALTER TABLE ` + '`stocktakes`' + ` DROP COLUMN ` + '`checkBy`');
    }
    if (await this.columnExists(queryRunner, 'stocktakes', 'requestDate')) {
      await queryRunner.query(`ALTER TABLE ` + '`stocktakes`' + ` DROP COLUMN ` + '`requestDate`');
    }
    if (await this.columnExists(queryRunner, 'stocktakes', 'requestNo')) {
      await queryRunner.query(`ALTER TABLE ` + '`stocktakes`' + ` DROP INDEX ` + '`IDX_stocktakes_requestNo`');
      await queryRunner.query(`ALTER TABLE ` + '`stocktakes`' + ` DROP COLUMN ` + '`requestNo`');
    }
    if (await this.columnExists(queryRunner, 'stocktakes', 'reference')) {
      await queryRunner.query(`ALTER TABLE ` + '`stocktakes`' + ` DROP COLUMN ` + '`reference`');
    }
    if (await this.columnExists(queryRunner, 'stocktakes', 'purpose')) {
      await queryRunner.query(`ALTER TABLE ` + '`stocktakes`' + ` DROP COLUMN ` + '`purpose`');
    }
    if (await this.columnExists(queryRunner, 'stocktakes', 'dueDate')) {
      await queryRunner.query(`ALTER TABLE ` + '`stocktakes`' + ` DROP COLUMN ` + '`dueDate`');
    }
    if (await this.columnExists(queryRunner, 'stocktakes', 'branch')) {
      await queryRunner.query(`ALTER TABLE ` + '`stocktakes`' + ` DROP COLUMN ` + '`branch`');
    }
  }

  private async columnExists(queryRunner: QueryRunner, table: string, column: string): Promise<boolean> {
    const result = await queryRunner.query(
      `SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
      [table, column],
    );
    return Number(result[0]?.cnt) > 0;
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
