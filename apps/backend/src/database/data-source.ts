import "reflect-metadata";
import { DataSource } from "typeorm";
import * as dotenv from "dotenv";

dotenv.config();

const databaseUrl =
  process.env.DATABASE_URL || "mysql://root:root@localhost:3306/smart_wms";

const isSsl =
  process.env.DB_SSL === "true" ||
  databaseUrl.includes("tidbcloud") ||
  databaseUrl.includes("ssl=");

export const AppDataSource = new DataSource({
  type: "mysql",
  url: databaseUrl,
  // entities are loaded from the src folders; compiled JS uses dist
  entities: [__dirname + "/../**/*.entity{.ts,.js}"],
  migrations: [__dirname + "/../../migrations/*{.ts,.js}"],
  synchronize: false,
  logging: false,
  ssl: isSsl ? { rejectUnauthorized: false } : false,
  extra: {
    ssl: isSsl ? { rejectUnauthorized: false } : false,
  },
});

// Placeholder for database connection configuration and migrations
