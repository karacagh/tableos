const router = require('express').Router();
const pool = require('../db');
const auth = require('../middleware/auth');
const roles = require('../middleware/roles');

// Açık adisyonlar
router.get('/', auth, roles('admin','manager','cashier'), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT b.*, t.number as table_number,
        json_agg(json_build_object(
          'order_id', bo.order_id
        )) as orders
      FROM bills b
      LEFT JOIN tables t ON b.table_id = t.id
      LEFT JOIN bill_orders bo ON b.id = bo.bill_id
      WHERE b.status = 'open'
      GROUP BY b.id, t.number
      ORDER BY b.opened_at DESC
    `);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Adisyon aç
router.post('/', auth, roles('admin','manager','cashier'), async (req, res) => {
  try {
    const { table_id, order_ids, total } = req.body;
    const result = await pool.query(
      'INSERT INTO bills (table_id, cashier_id, total) VALUES ($1,$2,$3) RETURNING *',
      [table_id, req.user.id, total]
    );
    const bill = result.rows[0];
    for (const oid of order_ids) {
      await pool.query('INSERT INTO bill_orders (bill_id, order_id) VALUES ($1,$2)', [bill.id, oid]);
    }
    res.status(201).json(bill);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Adisyon kapat (ödeme al)
router.patch('/:id/close', auth, roles('admin','manager','cashier'), async (req, res) => {
  try {
    const { payment_method } = req.body;
    const result = await pool.query(
      'UPDATE bills SET status=$1, payment_method=$2, closed_at=NOW() WHERE id=$3 RETURNING *',
      ['paid', payment_method, req.params.id]
    );
    req.io.emit('bill_closed', result.rows[0]);
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Hesap bölme
router.post('/:id/split', auth, roles('admin','manager','cashier'), async (req, res) => {
  try {
    const { item_ids, payment_method } = req.body;
    const bill = await pool.query('SELECT * FROM bills WHERE id=$1', [req.params.id]);
    if (!bill.rows[0]) return res.status(404).json({ error: 'Adisyon bulunamadı' });

    // Seçilen kalemleri ödenmiş işaretle
    for (const item_id of item_ids) {
      await pool.query(
        'INSERT INTO bill_items (bill_id, order_item_id, is_paid, paid_at, payment_method) VALUES ($1,$2,true,NOW(),$3) ON CONFLICT DO NOTHING',
        [req.params.id, item_id, payment_method]
      );
    }

    // Tüm kalemler ödendi mi kontrol et
    const unpaid = await pool.query(`
      SELECT oi.id FROM order_items oi
      JOIN bill_orders bo ON bo.order_id = oi.order_id
      LEFT JOIN bill_items bi ON bi.order_item_id = oi.id AND bi.bill_id = $1
      WHERE bo.bill_id = $1 AND (bi.is_paid IS NULL OR bi.is_paid = false)
    `, [req.params.id]);

    if (unpaid.rows.length === 0) {
      await pool.query(
        'UPDATE bills SET status=$1, payment_method=$2, closed_at=NOW() WHERE id=$3',
        ['paid', payment_method, req.params.id]
      );
      req.io.emit('bill_closed', { bill_id: req.params.id });
    }

    res.json({ success: true, remaining_items: unpaid.rows.length });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Adisyon kalem detayları
router.get('/:id/items', auth, roles('admin','manager','cashier'), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        oi.id, oi.order_id, oi.product_id, oi.quantity, oi.unit_price, oi.note,
        p.name,
        CASE WHEN bi.is_paid = true THEN true ELSE false END as is_paid
      FROM bill_orders bo
      JOIN order_items oi ON oi.order_id = bo.order_id
      JOIN products p ON p.id = oi.product_id
      LEFT JOIN bill_items bi ON bi.order_item_id = oi.id AND bi.bill_id = $1
      WHERE bo.bill_id = $1
      ORDER BY oi.id
    `, [req.params.id]);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Kalem iptal
router.patch('/:id/cancel-item', auth, roles('admin','manager','cashier'), async (req, res) => {
  try {
    const { order_item_id } = req.body;
    await pool.query('DELETE FROM order_items WHERE id=$1', [order_item_id]);

    // Adisyon toplamını güncelle
    const total = await pool.query(`
      SELECT COALESCE(SUM(oi.quantity * oi.unit_price), 0) as total
      FROM order_items oi
      JOIN bill_orders bo ON bo.order_id = oi.order_id
      WHERE bo.bill_id = $1
    `, [req.params.id]);

    await pool.query('UPDATE bills SET total=$1 WHERE id=$2', [total.rows[0].total, req.params.id]);
    req.io.emit('bill_updated', { bill_id: req.params.id });
    res.json({ success: true, new_total: total.rows[0].total });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
