const pool = require('./db');
const fs = require('fs');
const path = require('path');

async function migrate() {
  try {
    const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    await pool.query(sql);
    console.log('✅ Şema başarıyla kuruldu');
    process.exit(0);
  } catch (err) {
    console.error('❌ Şema hatası:', err.message);
    process.exit(1);
  }
}

migrate();
