const mysql = require('mysql2/promise');

const tests = [
  {user:'root', password:'root', host:'127.0.0.1'},
  {user:'root', password:'', host:'127.0.0.1'},
  {user:'root', password:'root', host:'localhost'},
  {user:'root', password:'', host:'localhost'},
  {user:'tvloc02', password:'123456', host:'127.0.0.1'},
  {user:'tvloc02', password:'123456', host:'localhost'},
];

(async () => {
  for (const t of tests) {
    try {
      const conn = await mysql.createConnection({ host: t.host, port: 3306, user: t.user, password: t.password });
      await conn.query('SELECT 1');
      console.log('OK', JSON.stringify(t));
      await conn.end();
    } catch (err) {
      console.log('ERR', JSON.stringify(t), err.message);
    }
  }
})();
