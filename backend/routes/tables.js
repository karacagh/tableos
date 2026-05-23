const router = require('express').Router();
const pool = require('../db');
const auth = require('../middleware/auth');
const roles = require('../middleware/roles');

// Tüm masalar
router.get('/', auth, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM tables WHERE is_active=true ORDER BY zone, number');
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Masa ekle
router.post('/', auth, roles('admin','manager'), async (req, res) => {
  try {
    const { number, name, capacity, zone } = req.body;
    const qr_code = `https://monetcafe.net/menu?table=${number}&zone=${encodeURIComponent(zone || 'İçeri')}`;
    const result = await pool.query(
      'INSERT INTO tables (number, name, capacity, qr_code, zone) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [number, name || `Masa ${number}`, capacity || 4, qr_code, zone || 'İçeri']
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Masa güncelle
router.put('/:id', auth, roles('admin','manager'), async (req, res) => {
  try {
    const { name, capacity, is_active, zone } = req.body;
    const result = await pool.query(
      'UPDATE tables SET name=$1, capacity=$2, is_active=$3, zone=$4 WHERE id=$5 RETURNING *',
      [name, capacity, is_active, zone, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Masa sil
router.delete('/:id', auth, roles('admin','manager'), async (req, res) => {
  try {
    await pool.query('UPDATE tables SET is_active=false WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
