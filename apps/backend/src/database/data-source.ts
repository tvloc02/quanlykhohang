import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';

dotenv.config();

const databaseUrl = process.env.DATABASE_URL || 'mysql://root:root@localhost:3306/smart_wms';

export const AppDataSource = new DataSource({
  type: 'mysql',
  url: databaseUrl,
  // entities are loaded from the src folders; compiled JS uses dist
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  migrations: [__dirname + '/../../migrations/*{.ts,.js}'],
  synchronize: false,
  logging: false,
});

// Placeholder for database connection configuration and migrations
