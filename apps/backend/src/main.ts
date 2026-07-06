import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import helmet from 'helmet';
import * as express from 'express';
import { ValidationPipe } from '@nestjs/common';
import { DataSource } from 'typeorm';

async function ensureWarehouseTable(dataSource: DataSource) {
  await dataSource.query(`
    CREATE TABLE IF NOT EXISTS \`warehouses\` (
      \`id\` varchar(64) NOT NULL,
      \`code\` varchar(50) NOT NULL,
      \`name\` varchar(255) NOT NULL,
      \`address\` varchar(500) NULL,
      \`status\` enum('active', 'inactive') NOT NULL DEFAULT 'active',
      \`managerIds\` text NULL,
      \`staffIds\` text NULL,
      \`createdAt\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
      \`updatedAt\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      UNIQUE KEY \`IDX_warehouses_code\` (\`code\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // Fix existing columns: make TEXT columns nullable (MySQL doesn't allow default values on TEXT)
  try {
    await dataSource.query(`ALTER TABLE \`warehouses\` MODIFY COLUMN \`managerIds\` text NULL`);
    await dataSource.query(`ALTER TABLE \`warehouses\` MODIFY COLUMN \`staffIds\` text NULL`);
  } catch {
    // Ignore errors if columns are already correct
  }
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await ensureWarehouseTable(app.get(DataSource));
  app.use(
    helmet({
      contentSecurityPolicy: false,
      xXssProtection: false,
    }),
  );
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: false }));
  app.enableCors({
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });
  // Prefix all routes with /api so frontend can call /api/*
  app.setGlobalPrefix('api');
  await app.listen(3000);
}
bootstrap();
