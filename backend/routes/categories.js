const router = require('express').Router();
const pool = require('../db');
const auth = require('../middleware/auth');
const roles = require('../middleware/roles');

router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM categories WHERE is_active=true ORDER BY sort_order');
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', auth, roles('admin','manager'), async (req, res) => {
  try {
    const { name, sort_order, image_url } = req.body;
    const result = await pool.query(
      'INSERT INTO categories (name, sort_order, image_url) VALUES ($1,$2,$3) RETURNING *',
      [name, sort_order || 0, image_url || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', auth, roles('admin','manager'), async (req, res) => {
  try {
    const { name, sort_order, is_active, image_url } = req.body;
    const result = await pool.query(
      'UPDATE categories SET name=$1, sort_order=$2, is_active=$3, image_url=$4 WHERE id=$5 RETURNING *',
      [name, sort_order, is_active, image_url || null, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', auth, roles('admin','manager'), async (req, res) => {
  try {
    await pool.query('UPDATE categories SET is_active=false WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
