const mysql = require('mysql2/promise');
async function run() {
  const conn = await mysql.createConnection({
    host: '127.0.0.1',
    user: 'tvloc02',
    password: '123456',
    database: 'smart_wms'
  });
  
  const [tables] = await conn.query('SHOW TABLES');
  for (const t of tables) {
    const tableName = Object.values(t)[0];
    try {
      const [rows] = await conn.query(`SELECT id FROM ${tableName} WHERE id = 90 OR id = '90' OR id = 92 OR id = '92'`);
      if (rows.length > 0) {
        console.log(`Found in table ${tableName}:`, rows.map(r => r.id));
      }
    } catch (e) {}
  }
  await conn.end();
}
run();
