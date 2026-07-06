import { MigrationInterface, QueryRunner } from 'typeorm';

export class AssemblyWorkflow1800000000004 implements MigrationInterface {
  name = 'AssemblyWorkflow1800000000004';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS \`assemblies\` (
      \`id\` bigint NOT NULL AUTO_INCREMENT,
      \`assemblyCode\` varchar(255) NOT NULL,
      \`sourceStockInOrderId\` bigint NOT NULL,
      \`assembledProductId\` bigint NOT NULL,
      \`warehouseCode\` varchar(255) NOT NULL,
      \`quantity\` int NOT NULL DEFAULT 0,
      \`barcode\` varchar(255) NULL,
      \`note\` text NULL,
      \`status\` varchar(255) NOT NULL DEFAULT 'COMPLETED',
      \`recountedQty\` int NULL,
      \`recountedAt\` datetime NULL,
      \`createdAt\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
      \`updatedAt\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      UNIQUE INDEX \`IDX_assemblies_assemblyCode\` (\`assemblyCode\`),
      INDEX \`IDX_assemblies_sourceStockInOrderId\` (\`sourceStockInOrderId\`),
      INDEX \`IDX_assemblies_assembledProductId\` (\`assembledProductId\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

    await queryRunner.query(`CREATE TABLE IF NOT EXISTS \`assembly_details\` (
      \`id\` bigint NOT NULL AUTO_INCREMENT,
      \`assemblyId\` bigint NOT NULL,
      \`componentProductId\` bigint NOT NULL,
      \`usedQty\` int NOT NULL DEFAULT 0,
      \`warehouseCode\` varchar(255) NULL,
      \`sourceOrderDetailId\` varchar(255) NULL,
      PRIMARY KEY (\`id\`),
      INDEX \`IDX_assembly_details_assemblyId\` (\`assemblyId\`),
      INDEX \`IDX_assembly_details_componentProductId\` (\`componentProductId\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

    await this.addConstraintIfNotExists(queryRunner, 'assemblies', 'FK_assemblies_sourceStockInOrder',
      `ALTER TABLE \`assemblies\` ADD CONSTRAINT \`FK_assemblies_sourceStockInOrder\` FOREIGN KEY (\`sourceStockInOrderId\`) REFERENCES \`stock_in_orders\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
    await this.addConstraintIfNotExists(queryRunner, 'assemblies', 'FK_assemblies_assembledProduct',
      `ALTER TABLE \`assemblies\` ADD CONSTRAINT \`FK_assemblies_assembledProduct\` FOREIGN KEY (\`assembledProductId\`) REFERENCES \`products\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`);
    await this.addConstraintIfNotExists(queryRunner, 'assembly_details', 'FK_assembly_details_assembly',
      `ALTER TABLE \`assembly_details\` ADD CONSTRAINT \`FK_assembly_details_assembly\` FOREIGN KEY (\`assemblyId\`) REFERENCES \`assemblies\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
    await this.addConstraintIfNotExists(queryRunner, 'assembly_details', 'FK_assembly_details_componentProduct',
      `ALTER TABLE \`assembly_details\` ADD CONSTRAINT \`FK_assembly_details_componentProduct\` FOREIGN KEY (\`componentProductId\`) REFERENCES \`products\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE \`assembly_details\` DROP FOREIGN KEY \`FK_assembly_details_componentProduct\``);
    await queryRunner.query(`ALTER TABLE \`assembly_details\` DROP FOREIGN KEY \`FK_assembly_details_assembly\``);
    await queryRunner.query(`ALTER TABLE \`assemblies\` DROP FOREIGN KEY \`FK_assemblies_assembledProduct\``);
    await queryRunner.query(`ALTER TABLE \`assemblies\` DROP FOREIGN KEY \`FK_assemblies_sourceStockInOrder\``);
    await queryRunner.query(`DROP TABLE \`assembly_details\``);
    await queryRunner.query(`DROP TABLE \`assemblies\``);
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
