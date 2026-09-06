const mysql = require('mysql2/promise');

async function run() {
  const conn = await mysql.createConnection('mysql://tvloc02:123456@127.0.0.1:3306/smart_wms');
  const [tables] = await conn.query('SHOW TABLES');
  console.log('TABLES:', tables.map(t => Object.values(t)[0]));
  await conn.end();
}

run().catch(console.error);
