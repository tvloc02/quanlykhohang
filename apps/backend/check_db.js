const mysql = require('mysql2/promise');
async function run() {
  const conn = await mysql.createConnection({
    host: '127.0.0.1',
    user: 'tvloc02',
    password: '123456',
    database: 'smart_wms'
  });
  const [dbs] = await conn.query('SHOW DATABASES');
  console.log('Databases:', dbs);
  const [maxR] = await conn.query('SELECT id, poNumber, status, description, orderDate FROM inbound_receipts ORDER BY id DESC LIMIT 10');
  console.log('Top 10 inbound_receipts:', maxR);
  const [colsId] = await conn.query('SHOW COLUMNS FROM inbound_details');
  console.log('inbound_details cols:', colsId.map(c => c.Field));
  const [recentDetails] = await conn.query('SELECT * FROM inbound_details ORDER BY id DESC LIMIT 10');
  console.log('Top 10 inbound_details:', recentDetails);
  await conn.end();
}
run();
