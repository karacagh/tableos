const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('DB bağlantı hatası:', err.message);
  } else {
    console.log('Neon DB bağlı:', res.rows[0].now);
  }
});

module.exports = pool;
