import { MigrationInterface, QueryRunner } from 'typeorm';

export class WarehousesTable1800000000003 implements MigrationInterface {
  name = 'WarehousesTable1800000000003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`warehouses\` (
        \`id\` varchar(64) NOT NULL,
        \`code\` varchar(50) NOT NULL,
        \`name\` varchar(255) NOT NULL,
        \`address\` varchar(500) NULL,
        \`status\` enum('active', 'inactive') NOT NULL DEFAULT 'active',
        \`managerIds\` text NOT NULL,
        \`staffIds\` text NOT NULL,
        \`createdAt\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updatedAt\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`IDX_warehouses_code\` (\`code\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS \`warehouses\``);
  }
}
