import { MigrationInterface, QueryRunner } from 'typeorm';

export class CategoriesFullCatalog1800000000002 implements MigrationInterface {
  name = 'CategoriesFullCatalog1800000000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE \`categories\` DROP INDEX \`IDX_categories_name\``);
    await queryRunner.query(`ALTER TABLE \`categories\` ADD \`type\` varchar(255) NULL`);
    await queryRunner.query(`ALTER TABLE \`categories\` ADD \`code\` varchar(255) NULL`);
    await queryRunner.query(`ALTER TABLE \`categories\` ADD \`description\` varchar(255) NOT NULL DEFAULT ''`);
    await queryRunner.query(`ALTER TABLE \`categories\` ADD \`status\` varchar(255) NOT NULL DEFAULT 'active'`);
    await queryRunner.query(`ALTER TABLE \`categories\` ADD \`createdAt\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP`);
    await queryRunner.query(`
      UPDATE \`categories\`
      SET
        \`type\` = COALESCE(NULLIF(\`type\`, ''), 'item-group'),
        \`code\` = COALESCE(NULLIF(\`code\`, ''), UPPER(REPLACE(\`name\`, ' ', '-'))),
        \`description\` = COALESCE(\`description\`, ''),
        \`status\` = COALESCE(NULLIF(\`status\`, ''), 'active')
    `);
    await queryRunner.query(`ALTER TABLE \`categories\` MODIFY \`type\` varchar(255) NOT NULL DEFAULT 'item-group'`);
    await queryRunner.query(`ALTER TABLE \`categories\` MODIFY \`code\` varchar(255) NOT NULL`);
    await queryRunner.query(`CREATE UNIQUE INDEX \`IDX_categories_type_code\` ON \`categories\` (\`type\`, \`code\`)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX \`IDX_categories_type_code\` ON \`categories\``);
    await queryRunner.query(`ALTER TABLE \`categories\` DROP COLUMN \`createdAt\``);
    await queryRunner.query(`ALTER TABLE \`categories\` DROP COLUMN \`status\``);
    await queryRunner.query(`ALTER TABLE \`categories\` DROP COLUMN \`description\``);
    await queryRunner.query(`ALTER TABLE \`categories\` DROP COLUMN \`code\``);
    await queryRunner.query(`ALTER TABLE \`categories\` DROP COLUMN \`type\``);
    await queryRunner.query(`ALTER TABLE \`categories\` ADD UNIQUE INDEX \`IDX_categories_name\` (\`name\`)`);
  }
}
