const mysql = require('mysql2/promise');

async function run() {
  const conn = await mysql.createConnection('mysql://tvloc02:123456@127.0.0.1:3306/smart_wms');
  
  // Search for 92 or 90 across inbound tables
  const [inbounds] = await conn.query('SELECT * FROM inbound_receipts WHERE id IN (90, 92) OR receiptNo LIKE "%9333%" OR receiptNo LIKE "%92%"');
  console.log('INBOUND_RECEIPTS:', JSON.stringify(inbounds, null, 2));

  if (inbounds.length > 0) {
    const ids = inbounds.map(o => o.id);
    const [details] = await conn.query(`SELECT * FROM inbound_details WHERE inboundReceiptId IN (${ids.join(',')})`);
    console.log('INBOUND_DETAILS:', JSON.stringify(details, null, 2));
  }

  // Also check stock_in_receipts
  const [stockReceipts] = await conn.query('SELECT * FROM stock_in_receipts WHERE id IN (90, 92)');
  console.log('STOCK_IN_RECEIPTS:', JSON.stringify(stockReceipts, null, 2));

  await conn.end();
}

run().catch(console.error);
