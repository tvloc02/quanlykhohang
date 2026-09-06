const mysql = require('mysql2/promise');

async function run() {
  const conn = await mysql.createConnection('mysql://tvloc02:123456@127.0.0.1:3306/smart_wms');
  
  const [receipts] = await conn.query('SELECT * FROM inbound_receipts ORDER BY id DESC LIMIT 5');
  console.log('RECEIPTS:', JSON.stringify(receipts, null, 2));

  const [details] = await conn.query('SELECT * FROM inbound_details WHERE inboundReceiptId = ?', [receipts[0].id]);
  console.log('LATEST RECEIPT DETAILS:', JSON.stringify(details, null, 2));

  await conn.end();
}

run().catch(console.error);
