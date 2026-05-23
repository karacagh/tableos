const router = require('express').Router();
const pool = require('../db');
const auth = require('../middleware/auth');
const roles = require('../middleware/roles');

// Herkese açık — müşteri menüsü için auth yok
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT p.*, c.name as category_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.is_active = true
      ORDER BY p.is_campaign DESC, c.sort_order, p.sort_order
    `);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', auth, roles('admin','manager'), async (req, res) => {
  try {
    const { category_id, name, description, price, image_url, is_campaign, campaign_price } = req.body;
    const result = await pool.query(
      `INSERT INTO products (category_id, name, description, price, image_url, is_campaign, campaign_price)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [category_id, name, description, price, image_url, is_campaign || false, campaign_price]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', auth, roles('admin','manager'), async (req, res) => {
  try {
    const { category_id, name, description, price, image_url, is_campaign, campaign_price, is_active } = req.body;
    const result = await pool.query(
      `UPDATE products SET category_id=$1, name=$2, description=$3, price=$4,
       image_url=$5, is_campaign=$6, campaign_price=$7, is_active=$8 WHERE id=$9 RETURNING *`,
      [category_id, name, description, price, image_url, is_campaign, campaign_price, is_active, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', auth, roles('admin','manager'), async (req, res) => {
  try {
    await pool.query('UPDATE products SET is_active=false WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
