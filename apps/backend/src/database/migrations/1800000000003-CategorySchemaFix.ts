import { MigrationInterface, QueryRunner } from 'typeorm';

export class CategorySchemaFix1800000000003 implements MigrationInterface {
  name = 'CategorySchemaFix1800000000003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`categories\` ADD COLUMN \`type\` varchar(255) NOT NULL DEFAULT 'item-group'`,
    );
    await queryRunner.query(
      `ALTER TABLE \`categories\` ADD COLUMN \`code\` varchar(255) NOT NULL DEFAULT ''`,
    );
    await queryRunner.query(
      `ALTER TABLE \`categories\` ADD COLUMN \`description\` varchar(255) NOT NULL DEFAULT ''`,
    );
    await queryRunner.query(
      `ALTER TABLE \`categories\` ADD COLUMN \`status\` varchar(255) NOT NULL DEFAULT 'active'`,
    );
    await queryRunner.query(
      `ALTER TABLE \`categories\` ADD COLUMN \`createdAt\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP`,
    );
    await queryRunner.query(
      `UPDATE \`categories\` SET \`code\` = UPPER(REPLACE(\`name\`, ' ', '-')) WHERE \`code\` = ''`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX \`IDX_categories_type_code\` ON \`categories\` (\`type\`, \`code\`)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX \`IDX_categories_type_code\` ON \`categories\``);
    await queryRunner.query(`ALTER TABLE \`categories\` DROP COLUMN \`createdAt\``);
    await queryRunner.query(`ALTER TABLE \`categories\` DROP COLUMN \`status\``);
    await queryRunner.query(`ALTER TABLE \`categories\` DROP COLUMN \`description\``);
    await queryRunner.query(`ALTER TABLE \`categories\` DROP COLUMN \`code\``);
    await queryRunner.query(`ALTER TABLE \`categories\` DROP COLUMN \`type\``);
  }
}
