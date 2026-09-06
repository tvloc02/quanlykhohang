const mysql = require('mysql2/promise');

async function run() {
  const conn = await mysql.createConnection('mysql://tvloc02:123456@127.0.0.1:3306/smart_wms');
  
  const [orders] = await conn.query("SELECT * FROM purchase_orders WHERE id = 90 OR poNumber LIKE '%9333%'");
  console.log('PURCHASE_ORDERS:', JSON.stringify(orders, null, 2));

  if (orders.length > 0) {
    const orderId = orders[0].id;
    const [items] = await conn.query('SELECT * FROM purchase_order_items WHERE purchaseOrderId = ?', [orderId]);
    console.log('PO_ITEMS:', JSON.stringify(items, null, 2));
  }

  const [whs] = await conn.query("SELECT * FROM warehouses WHERE code = 'KH007' OR id LIKE '%1788674855017%'");
  console.log('WAREHOUSES:', JSON.stringify(whs, null, 2));

  await conn.end();
}

run().catch(console.error);
