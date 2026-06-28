const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

async function main() {
  const fileArg = process.argv[2] || path.join(__dirname, '..', 'db', 'init_smartwms.sql');
  const sql = fs.readFileSync(fileArg, 'utf8');

  const host = process.env.DB_HOST || '127.0.0.1';
  const port = process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306;
  const user = process.env.DB_USER || 'root';
  const password = process.env.DB_PASS || 'root';

  console.log(`Connecting ${user}@${host}:${port} ...`);
  const conn = await mysql.createConnection({ host, port, user, password, multipleStatements: true });
  console.log('Connected, executing SQL...');
  await conn.query(sql);
  console.log('SQL executed successfully.');
  await conn.end();
}

main().catch((err) => {
  console.error('Error executing SQL:', err.message || err);
  process.exit(1);
});
