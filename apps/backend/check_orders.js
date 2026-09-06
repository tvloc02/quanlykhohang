const mysql = require('mysql2/promise');

async function run() {
  const conn = await mysql.createConnection('mysql://tvloc02:123456@127.0.0.1:3306/smart_wms');
  
  const [orders] = await conn.query('SELECT * FROM stock_in_orders ORDER BY id DESC LIMIT 5');
  console.log('ORDERS:', JSON.stringify(orders, null, 2));

  if (orders.length > 0) {
    const ids = orders.map(o => o.id);
    const [details] = await conn.query(`SELECT * FROM stock_in_order_details WHERE stockInOrderId IN (${ids.join(',')})`);
    console.log('DETAILS:', JSON.stringify(details, null, 2));
  }

  const [whs] = await conn.query("SELECT id, code, name, subWarehouses FROM warehouses WHERE code = 'KH007' OR id LIKE '%1788674855017%'");
  console.log('WAREHOUSE KH007:', JSON.stringify(whs, null, 2));

  await conn.end();
}

run().catch(console.error);
