const router = require('express').Router();
const pool = require('../db');
const auth = require('../middleware/auth');
const roles = require('../middleware/roles');

// Mesai başlat
router.post('/clockin', auth, async (req, res) => {
  try {
    const result = await pool.query(
      'INSERT INTO shifts (user_id) VALUES ($1) RETURNING *',
      [req.user.id]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Mesai bitir
router.patch('/clockout', auth, async (req, res) => {
  try {
    const result = await pool.query(
      'UPDATE shifts SET clock_out=NOW() WHERE user_id=$1 AND clock_out IS NULL RETURNING *',
      [req.user.id]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Aktif mesailer (manager görür)
router.get('/active', auth, roles('admin','manager'), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT s.*, u.name, u.role FROM shifts s
      JOIN users u ON s.user_id = u.id
      WHERE s.clock_out IS NULL
      ORDER BY s.clock_in DESC
    `);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
