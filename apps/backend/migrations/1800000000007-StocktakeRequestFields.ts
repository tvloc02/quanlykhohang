import { MigrationInterface, QueryRunner } from 'typeorm';

export class StocktakeRequestFields1800000000007 implements MigrationInterface {
  name = 'StocktakeRequestFields1800000000007';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await this.columnExists(queryRunner, 'stocktakes', 'branch'))) {
      await queryRunner.query(`ALTER TABLE ` + '`stocktakes`' + ` ADD COLUMN ` + '`branch`' + ` varchar(100) NULL`);
    }
    if (!(await this.columnExists(queryRunner, 'stocktakes', 'dueDate'))) {
      await queryRunner.query(`ALTER TABLE ` + '`stocktakes`' + ` ADD COLUMN ` + '`dueDate`' + ` datetime NULL`);
    }
    if (!(await this.columnExists(queryRunner, 'stocktakes', 'purpose'))) {
      await queryRunner.query(`ALTER TABLE ` + '`stocktakes`' + ` ADD COLUMN ` + '`purpose`' + ` varchar(255) NULL`);
    }
    if (!(await this.columnExists(queryRunner, 'stocktakes', 'reference'))) {
      await queryRunner.query(`ALTER TABLE ` + '`stocktakes`' + ` ADD COLUMN ` + '`reference`' + ` varchar(255) NULL`);
    }
    if (!(await this.columnExists(queryRunner, 'stocktakes', 'requestNo'))) {
      await queryRunner.query(`ALTER TABLE ` + '`stocktakes`' + ` ADD COLUMN ` + '`requestNo`' + ` varchar(50) NULL`);
      await queryRunner.query(`ALTER TABLE ` + '`stocktakes`' + ` ADD UNIQUE INDEX ` + '`IDX_stocktakes_requestNo`' + ` (` + '`requestNo`' + `)`);
    }
    if (!(await this.columnExists(queryRunner, 'stocktakes', 'requestDate'))) {
      await queryRunner.query(`ALTER TABLE ` + '`stocktakes`' + ` ADD COLUMN ` + '`requestDate`' + ` datetime NULL`);
    }
    if (!(await this.columnExists(queryRunner, 'stocktakes', 'checkBy'))) {
      await queryRunner.query(`ALTER TABLE ` + '`stocktakes`' + ` ADD COLUMN ` + '`checkBy`' + ` varchar(50) NULL`);
    }
    if (!(await this.columnExists(queryRunner, 'stocktakes', 'detailBy'))) {
      await queryRunner.query(`ALTER TABLE ` + '`stocktakes`' + ` ADD COLUMN ` + '`detailBy`' + ` varchar(50) NULL`);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await this.columnExists(queryRunner, 'stocktakes', 'detailBy')) {
      await queryRunner.query(`ALTER TABLE ` + '`stocktakes`' + ` DROP COLUMN ` + '`detailBy`);
    }
    if (await this.columnExists(queryRunner, 'stocktakes', 'checkBy')) {
      await queryRunner.query(`ALTER TABLE ` + '`stocktakes`' + ` DROP COLUMN ` + '`checkBy`);
    }
    if (await this.columnExists(queryRunner, 'stocktakes', 'requestDate')) {
      await queryRunner.query(`ALTER TABLE ` + '`stocktakes`' + ` DROP COLUMN ` + '`requestDate`);
    }
    if (await this.columnExists(queryRunner, 'stocktakes', 'requestNo')) {
      await queryRunner.query(`ALTER TABLE ` + '`stocktakes`' + ` DROP INDEX ` + '`IDX_stocktakes_requestNo`);
      await queryRunner.query(`ALTER TABLE ` + '`stocktakes`' + ` DROP COLUMN ` + '`requestNo`);
    }
    if (await this.columnExists(queryRunner, 'stocktakes', 'reference')) {
      await queryRunner.query(`ALTER TABLE ` + '`stocktakes`' + ` DROP COLUMN ` + '`reference`);
    }
    if (await this.columnExists(queryRunner, 'stocktakes', 'purpose')) {
      await queryRunner.query(`ALTER TABLE ` + '`stocktakes`' + ` DROP COLUMN ` + '`purpose`);
    }
    if (await this.columnExists(queryRunner, 'stocktakes', 'dueDate')) {
      await queryRunner.query(`ALTER TABLE ` + '`stocktakes`' + ` DROP COLUMN ` + '`dueDate`);
    }
    if (await this.columnExists(queryRunner, 'stocktakes', 'branch')) {
      await queryRunner.query(`ALTER TABLE ` + '`stocktakes`' + ` DROP COLUMN ` + '`branch`);
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
