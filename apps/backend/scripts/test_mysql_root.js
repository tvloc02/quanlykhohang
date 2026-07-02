const mysql = require('mysql2/promise');

const passwords = ['root', '123456', 'password', '', 'admin', 'mysql', 'toor'];

(async () => {
  for (const password of passwords) {
    try {
      const conn = await mysql.createConnection({ host: '127.0.0.1', port: 3306, user: 'root', password });
      await conn.query('SELECT 1');
      console.log('OK root password=', JSON.stringify(password));
      await conn.end();
      return;
    } catch (err) {
      console.log('ERR root password=', JSON.stringify(password), err.message);
    }
  }
})();
