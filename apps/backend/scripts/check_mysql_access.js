const mysql = require('mysql2/promise');

(async () => {
  try {
    const conn = await mysql.createConnection({
      host: '127.0.0.1',
      port: 3306,
      user: 'tvloc02',
      password: '123456',
      multipleStatements: true,
    });
    const [databases] = await conn.query("SHOW DATABASES LIKE 'smart_wms'");
    const [grants] = await conn.query('SHOW GRANTS FOR CURRENT_USER()');
    console.log('databases=', databases);
    console.log('grants=', grants);
    await conn.end();
  } catch (err) {
    console.error('ERROR', err.message || err);
    process.exit(1);
  }
})();
