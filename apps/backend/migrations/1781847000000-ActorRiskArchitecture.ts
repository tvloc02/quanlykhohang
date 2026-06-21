import { MigrationInterface, QueryRunner } from 'typeorm';

export class ActorRiskArchitecture1781847000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`audit_logs\` (
        \`id\` bigint NOT NULL AUTO_INCREMENT,
        \`actorId\` varchar(255) NULL,
        \`actorEmail\` varchar(255) NULL,
        \`action\` varchar(255) NOT NULL,
        \`resource\` varchar(255) NOT NULL,
        \`resourceId\` varchar(255) NULL,
        \`metadata\` text NULL,
        \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        INDEX \`IDX_audit_logs_resource\` (\`resource\`, \`resourceId\`),
        INDEX \`IDX_audit_logs_actor\` (\`actorId\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE \`outbox_events\` (
        \`id\` bigint NOT NULL AUTO_INCREMENT,
        \`eventType\` varchar(255) NOT NULL,
        \`payload\` text NOT NULL,
        \`idempotencyKey\` varchar(255) NULL,
        \`status\` varchar(255) NOT NULL DEFAULT 'PENDING',
        \`retryCount\` int NOT NULL DEFAULT 0,
        \`lastError\` text NULL,
        \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        UNIQUE INDEX \`IDX_outbox_events_idempotencyKey\` (\`idempotencyKey\`),
        INDEX \`IDX_outbox_events_status\` (\`status\`, \`createdAt\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`ALTER TABLE \`products\` ADD \`supplierId\` bigint NULL`);
    await queryRunner.query(`CREATE INDEX \`IDX_products_supplierId\` ON \`products\` (\`supplierId\`)`);
    await queryRunner.query(`CREATE UNIQUE INDEX \`IDX_products_supplier_barcode\` ON \`products\` (\`supplierId\`, \`supplierBarcode\`)`);
    await queryRunner.query(`
      ALTER TABLE \`products\`
      ADD CONSTRAINT \`FK_products_supplier\`
      FOREIGN KEY (\`supplierId\`) REFERENCES \`suppliers\`(\`id\`)
      ON DELETE SET NULL ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE \`products\` DROP FOREIGN KEY \`FK_products_supplier\``);
    await queryRunner.query(`DROP INDEX \`IDX_products_supplier_barcode\` ON \`products\``);
    await queryRunner.query(`DROP INDEX \`IDX_products_supplierId\` ON \`products\``);
    await queryRunner.query(`ALTER TABLE \`products\` DROP COLUMN \`supplierId\``);
    await queryRunner.query(`DROP TABLE \`outbox_events\``);
    await queryRunner.query(`DROP TABLE \`audit_logs\``);
  }
}
