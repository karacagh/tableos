const router = require('express').Router();
const pool = require('../db');
const auth = require('../middleware/auth');
const roles = require('../middleware/roles');

// Yorum gönder (müşteri — auth yok)
router.post('/', async (req, res) => {
  try {
    const { table_id, order_id, rating_product, rating_ambiance, rating_service, note } = req.body;
    const result = await pool.query(
      `INSERT INTO reviews (table_id, order_id, rating_product, rating_ambiance, rating_service, note)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [table_id, order_id || null, rating_product, rating_ambiance, rating_service, note || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Özet istatistikler
router.get('/stats', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        COUNT(*) as total_reviews,
        ROUND(AVG(rating_product)::numeric, 1) as avg_product,
        ROUND(AVG(rating_ambiance)::numeric, 1) as avg_ambiance,
        ROUND(AVG(rating_service)::numeric, 1) as avg_service,
        ROUND(AVG((rating_product + rating_ambiance + rating_service)::numeric / 3), 1) as avg_overall
      FROM reviews
    `);
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Tüm yorumları getir (admin/manager)
router.get('/', auth, roles('admin','manager'), async (req, res) => {
  try {
    const { date } = req.query;
    let filter = '';
    const params = [];
    if (date) { params.push(date); filter = `WHERE DATE(r.created_at) = $1`; }

    const result = await pool.query(`
      SELECT r.*, t.number as table_number, t.zone as table_zone,
        ROUND((r.rating_product + r.rating_ambiance + r.rating_service)::numeric / 3, 1) as avg_rating
      FROM reviews r
      LEFT JOIN tables t ON r.table_id = t.id
      ${filter}
      ORDER BY r.created_at DESC
    `, params);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
