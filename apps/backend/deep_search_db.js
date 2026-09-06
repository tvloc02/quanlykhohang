const mysql = require('mysql2/promise');
async function run() {
  const conn = await mysql.createConnection({
    host: '127.0.0.1',
    user: 'tvloc02',
    password: '123456',
    database: 'smart_wms'
  });
  
  // 1. Search inbound_details for L1, L2, L3 or R03
  const [details] = await conn.query("SELECT id, inboundReceiptId, productId, expectedQty, receivedQty, note FROM inbound_details WHERE note LIKE '%R03%' OR note LIKE '%L1%' OR note LIKE '%L2%' OR note LIKE '%L3%'");
  console.log('Inbound details with R03 / L1 / L2 / L3:', details);

  const [colsSb] = await conn.query('SHOW COLUMNS FROM stock_balances');
  console.log('stock_balances cols:', colsSb.map(c => c.Field));
  const [balances] = await conn.query("SELECT * FROM stock_balances WHERE locationCode LIKE '%R03%' OR locationCode LIKE '%L1%' OR locationCode LIKE '%L2%' OR locationCode LIKE '%L3%'");
  console.log('Stock balances for R03 / L1-L3:', balances);

  // 3. Check warehouse KH007 subWarehouses column
  const [wh] = await conn.query("SELECT id, code, name, subWarehouses FROM warehouses WHERE code = 'KH007' OR id LIKE '%1788674855017%'");
  if (wh.length > 0) {
    console.log('Warehouse ID:', wh[0].id, 'Code:', wh[0].code);
    const subs = typeof wh[0].subWarehouses === 'string' ? JSON.parse(wh[0].subWarehouses) : wh[0].subWarehouses;
    if (subs) {
      subs.forEach((s) => {
        (s.racks || []).forEach((r) => {
          if (r.customBins && Object.keys(r.customBins).length > 0) {
            console.log('Rack', r.rackCode, 'customBins:', JSON.stringify(r.customBins, null, 2));
          }
        });
      });
    }
  }

  // 4. Check all inbound_receipts
  const [receipts] = await conn.query("SELECT id, poNumber, status, warehouseCode, totalAmount FROM inbound_receipts ORDER BY id DESC LIMIT 10");
  console.log('Recent 10 receipts:', receipts);

  await conn.end();
}
run();
