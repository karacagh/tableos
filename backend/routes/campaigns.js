const router = require('express').Router();
const pool = require('../db');
const auth = require('../middleware/auth');
const roles = require('../middleware/roles');

// Tüm kampanyaları getir (herkese açık — müşteri menüsü için)
router.get('/', async (req, res) => {
  try {
    const campaigns = await pool.query(`
      SELECT c.*,
        json_agg(json_build_object(
          'product_id', cp.product_id,
          'product_name', p.name,
          'original_price', cp.original_price,
          'image_url', p.image_url
        )) as products
      FROM campaigns c
      LEFT JOIN campaign_products cp ON cp.campaign_id = c.id
      LEFT JOIN products p ON p.id = cp.product_id
      WHERE c.is_active = true
      GROUP BY c.id
      ORDER BY c.sort_order, c.created_at DESC
    `);
    res.json(campaigns.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Kampanya oluştur
router.post('/', auth, roles('admin','manager'), async (req, res) => {
  const client = await pool.connect();
  try {
    const { name, description, campaign_price, image_url, product_ids, sort_order } = req.body;
    await client.query('BEGIN');

    const result = await client.query(
      'INSERT INTO campaigns (name, description, campaign_price, image_url, sort_order) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [name, description, campaign_price, image_url, sort_order || 0]
    );
    const campaign = result.rows[0];

    for (const pid of product_ids) {
      const product = await client.query('SELECT price FROM products WHERE id=$1', [pid]);
      if (product.rows[0]) {
        await client.query(
          'INSERT INTO campaign_products (campaign_id, product_id, original_price) VALUES ($1,$2,$3)',
          [campaign.id, pid, product.rows[0].price]
        );
      }
    }

    await client.query('COMMIT');
    res.status(201).json(campaign);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally { client.release(); }
});

// Kampanya güncelle
router.put('/:id', auth, roles('admin','manager'), async (req, res) => {
  const client = await pool.connect();
  try {
    const { name, description, campaign_price, image_url, is_active, product_ids } = req.body;
    await client.query('BEGIN');

    const result = await client.query(
      'UPDATE campaigns SET name=$1, description=$2, campaign_price=$3, image_url=$4, is_active=$5 WHERE id=$6 RETURNING *',
      [name, description, campaign_price, image_url, is_active, req.params.id]
    );

    if (product_ids) {
      await client.query('DELETE FROM campaign_products WHERE campaign_id=$1', [req.params.id]);
      for (const pid of product_ids) {
        const product = await client.query('SELECT price FROM products WHERE id=$1', [pid]);
        if (product.rows[0]) {
          await client.query(
            'INSERT INTO campaign_products (campaign_id, product_id, original_price) VALUES ($1,$2,$3)',
            [req.params.id, pid, product.rows[0].price]
          );
        }
      }
    }

    await client.query('COMMIT');
    res.json(result.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally { client.release(); }
});

// Kampanya sil
router.delete('/:id', auth, roles('admin','manager'), async (req, res) => {
  try {
    await pool.query('UPDATE campaigns SET is_active=false WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
