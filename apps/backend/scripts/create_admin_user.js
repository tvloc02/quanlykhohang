const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

async function main() {
  const db = {
    host: '127.0.0.1',
    port: 3306,
    user: 'root',
    password: '123456',
    database: 'smart_wms',
  };

  const email = 'admin@example.com';
  const password = 'Admin@123';
  const fullName = 'System Administrator';
  const phone = '0123456789';
  const roleName = 'admin';

  const conn = await mysql.createConnection(db);
  console.log('Connected to MySQL');

  const [roleRows] = await conn.query('SELECT id FROM roles WHERE name = ?', [roleName]);
  let roleId;
  if (roleRows.length === 0) {
    const [result] = await conn.query('INSERT INTO roles (`name`) VALUES (?)', [roleName]);
    roleId = result.insertId;
    console.log('Created role', roleName, 'id=', roleId);
  } else {
    roleId = roleRows[0].id;
    console.log('Found existing role', roleName, 'id=', roleId);
  }

  const [userRows] = await conn.query('SELECT id FROM users WHERE email = ?', [email]);
  let userId;
  if (userRows.length === 0) {
    const hashed = await bcrypt.hash(password, 10);
    const [result] = await conn.query(
      'INSERT INTO users (email, password, fullName, phone) VALUES (?, ?, ?, ?)',
      [email, hashed, fullName, phone],
    );
    userId = result.insertId;
    console.log('Created admin user', email, 'id=', userId);
  } else {
    userId = userRows[0].id;
    console.log('Admin user already exists', email, 'id=', userId);
    const hashed = await bcrypt.hash(password, 10);
    await conn.query('UPDATE users SET password = ?, fullName = ?, phone = ? WHERE id = ?', [hashed, fullName, phone, userId]);
    console.log('Updated admin password and info');
  }

  const [roleAssignRows] = await conn.query('SELECT 1 FROM user_roles WHERE userId = ? AND roleId = ?', [userId, roleId]);
  if (roleAssignRows.length === 0) {
    await conn.query('INSERT INTO user_roles (userId, roleId) VALUES (?, ?)', [userId, roleId]);
    console.log('Assigned admin role to user');
  } else {
    console.log('User already has admin role');
  }

  await conn.end();
  console.log('Done');
}

main().catch((err) => {
  console.error('Error creating admin user:', err.message || err);
  process.exit(1);
});
