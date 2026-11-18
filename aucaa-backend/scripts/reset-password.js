const mysql = require('mysql2/promise');

async function updatePassword() {
  const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: 'aucaa1234',
    database: 'aucaa_db'
  });

  const hash = '$2a$10$T4c/Sw8G.ggOJeQAQee/BuiovwTnohVfrBAU6wQIueexrbvaeNeRC';
  const [result] = await pool.query('UPDATE users SET password = ? WHERE username = ?', [hash, 'admin']);
  console.log('Password updated:', result.affectedRows, 'rows');
  await pool.end();
}

updatePassword().catch(console.error);
