const router = require('express').Router();
const pool = require('../db');
const auth = require('../middleware/auth');
const roles = require('../middleware/roles');

async function generateBillNumber(client) {
  const now = new Date();
  const dateKey = now.toISOString().slice(2,10).replace(/-/g,'');
  const res = await client.query(
    'INSERT INTO bill_sequences (date_key, last_seq) VALUES ($1, 1) ON CONFLICT (date_key) DO UPDATE SET last_seq = bill_sequences.last_seq + 1 RETURNING last_seq',
    [dateKey]
  );
  return dateKey + String(res.rows[0].last_seq).padStart(3, '0');
}

async function updateBillTotal(client, billId) {
  await client.query(`
    UPDATE bills SET total = (
      SELECT COALESCE(SUM(oi.quantity * oi.unit_price), 0)
      FROM bill_orders bo
      JOIN order_items oi ON oi.order_id = bo.order_id
      LEFT JOIN bill_items bi ON bi.order_item_id = oi.id AND bi.bill_id = $1
      WHERE bo.bill_id = $1 AND (bi.is_paid IS NULL OR bi.is_paid = false)
    ) WHERE id = $1
  `, [billId]);
}

// Aktif adisyonlar
router.get('/', auth, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT b.*, t.number as table_number, t.zone as table_zone,
        COUNT(DISTINCT bo.order_id) as order_count
      FROM bills b
      LEFT JOIN tables t ON b.table_id = t.id
      LEFT JOIN bill_orders bo ON b.id = bo.bill_id
      WHERE b.status = 'open'
      GROUP BY b.id, t.number, t.zone
      ORDER BY b.opened_at DESC
    `);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Masa için aktif adisyon
router.get('/table/:tableId', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT b.*, t.number as table_number, t.zone as table_zone
      FROM bills b
      LEFT JOIN tables t ON b.table_id = t.id
      WHERE b.table_id = $1 AND b.status = 'open'
      ORDER BY b.opened_at DESC LIMIT 1
    `, [req.params.tableId]);
    res.json(result.rows[0] || null);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Adisyon kalemleri
router.get('/:id/items', auth, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT oi.id, oi.order_id, oi.product_id, oi.quantity, oi.unit_price, oi.note,
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

// Yeni adisyon aç
router.post('/', auth, roles('admin','manager','cashier'), async (req, res) => {
  const client = await pool.connect();
  try {
    const { table_id } = req.body;
    const existing = await client.query(
      'SELECT * FROM bills WHERE table_id=$1 AND status=$2',
      [table_id, 'open']
    );
    if (existing.rows[0]) return res.json(existing.rows[0]);
    await client.query('BEGIN');
    const billNumber = await generateBillNumber(client);
    const result = await client.query(
      'INSERT INTO bills (table_id, cashier_id, total, bill_number) VALUES ($1,$2,0,$3) RETURNING *',
      [table_id, req.user.id, billNumber]
    );
    // Masadaki mevcut siparişleri adisyona bağla
    const pendingOrders = await client.query(
      "SELECT id FROM orders WHERE table_id=$1 AND status NOT IN ('cancelled','delivered') AND bill_id IS NULL",
      [table_id]
    );
    for (const o of pendingOrders.rows) {
      await client.query(
        'INSERT INTO bill_orders (bill_id, order_id) VALUES ($1,$2) ON CONFLICT DO NOTHING',
        [result.rows[0].id, o.id]
      );
      await client.query('UPDATE orders SET bill_id=$1 WHERE id=$2', [result.rows[0].id, o.id]);
    }
    // Toplam hesapla
    await client.query(`
      UPDATE bills SET total = (
        SELECT COALESCE(SUM(oi.quantity * oi.unit_price), 0)
        FROM bill_orders bo JOIN order_items oi ON oi.order_id = bo.order_id
        WHERE bo.bill_id = $1
      ) WHERE id = $1
    `, [result.rows[0].id]);
    await client.query('COMMIT');
    const updated = await pool.query('SELECT * FROM bills WHERE id=$1', [result.rows[0].id]);
    req.io.emit('bill_opened', updated.rows[0]);
    res.status(201).json(updated.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally { client.release(); }
});

// Adisyon kapat
router.patch('/:id/close', auth, roles('admin','manager','cashier'), async (req, res) => {
  const client = await pool.connect();
  try {
    const { payment_method } = req.body;
    await client.query('BEGIN');
    const totalRes = await client.query(`
      SELECT COALESCE(SUM(oi.quantity * oi.unit_price), 0) as total
      FROM bill_orders bo
      JOIN order_items oi ON oi.order_id = bo.order_id
      WHERE bo.bill_id = $1
    `, [req.params.id]);
    const result = await client.query(
      'UPDATE bills SET status=$1, payment_method=$2, closed_at=NOW(), total=$3 WHERE id=$4 RETURNING *',
      ['paid', payment_method, totalRes.rows[0].total, req.params.id]
    );
    await client.query(`
      UPDATE orders SET status='delivered', updated_at=NOW()
      WHERE bill_id=$1 OR id IN (SELECT order_id FROM bill_orders WHERE bill_id=$1)
    `, [req.params.id]);
    await client.query('COMMIT');
    req.io.emit('bill_closed', result.rows[0]);
    req.io.emit('customer_screen_paid');
    setTimeout(() => req.io.emit('customer_screen_hide'), 4000);
    res.json(result.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally { client.release(); }
});

// Hesap bölme
router.post('/:id/split', auth, roles('admin','manager','cashier'), async (req, res) => {
  try {
    const { item_ids, payment_method } = req.body;
    for (const item_id of item_ids) {
      await pool.query(
        'INSERT INTO bill_items (bill_id, order_item_id, is_paid, paid_at, payment_method) VALUES ($1,$2,true,NOW(),$3) ON CONFLICT DO NOTHING',
        [req.params.id, item_id, payment_method]
      );
    }
    const unpaid = await pool.query(`
      SELECT oi.id FROM order_items oi
      JOIN bill_orders bo ON bo.order_id = oi.order_id
      LEFT JOIN bill_items bi ON bi.order_item_id = oi.id AND bi.bill_id = $1
      WHERE bo.bill_id = $1 AND (bi.is_paid IS NULL OR bi.is_paid = false)
    `, [req.params.id]);
    if (unpaid.rows.length === 0) {
      const totalRes = await pool.query(`
        SELECT COALESCE(SUM(oi.quantity * oi.unit_price), 0) as total
        FROM bill_orders bo JOIN order_items oi ON oi.order_id = bo.order_id
        WHERE bo.bill_id = $1
      `, [req.params.id]);
      await pool.query(
        'UPDATE bills SET status=$1, payment_method=$2, closed_at=NOW(), total=$3 WHERE id=$4',
        ['paid', payment_method, totalRes.rows[0].total, req.params.id]
      );
      req.io.emit('bill_closed', { bill_id: req.params.id });
    }
    res.json({ success: true, remaining_items: unpaid.rows.length });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Kalem iptal
router.patch('/:id/cancel-item', auth, roles('admin','manager','cashier'), async (req, res) => {
  const client = await pool.connect();
  try {
    const { order_item_id } = req.body;
    await client.query('BEGIN');
    await client.query('DELETE FROM order_items WHERE id=$1', [order_item_id]);
    await updateBillTotal(client, req.params.id);
    await client.query('COMMIT');
    req.io.emit('bill_updated', { bill_id: req.params.id });
    const bill = await pool.query('SELECT * FROM bills WHERE id=$1', [req.params.id]);
    res.json({ success: true, new_total: bill.rows[0].total });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally { client.release(); }
});

module.exports = router;
