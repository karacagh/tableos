const router = require('express').Router();
const pool = require('../db');
const auth = require('../middleware/auth');
const roles = require('../middleware/roles');

// Tüm ayarları getir
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT key, value FROM settings');
    const settings = {};
    result.rows.forEach(r => { settings[r.key] = r.value; });
    res.json(settings);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Ayar güncelle
router.put('/', auth, roles('admin','manager'), async (req, res) => {
  try {
    const updates = req.body;
    for (const [key, value] of Object.entries(updates)) {
      await pool.query(
        'INSERT INTO settings (key, value, updated_at) VALUES ($1,$2,NOW()) ON CONFLICT (key) DO UPDATE SET value=$2, updated_at=NOW()',
        [key, value]
      );
    }
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
