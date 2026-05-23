const router = require('express').Router();
const pool = require('../db');
const auth = require('../middleware/auth');

// Aktif siparişler (garson + mutfak + kasiyer görür)
router.get('/', auth, async (req, res) => {
  try {
    const { date, status } = req.query;
    let dateFilter = '';
    let statusFilter = '';
    const params = [];

    if (date) {
      params.push(date);
      dateFilter = `AND DATE(o.created_at) = $${params.length}`;
    }
    if (status) {
      params.push(status);
      statusFilter = `AND o.status = $${params.length}`;
    }

    const result = await pool.query(`
      SELECT o.*,
        t.number as table_number, t.zone as table_zone,
        w.name as waiter_name,
        k.name as kitchen_name,
        json_agg(json_build_object(
          'id', oi.id,
          'product_id', oi.product_id,
          'name', p.name,
          'quantity', oi.quantity,
          'unit_price', oi.unit_price,
          'note', oi.note
        )) as items
      FROM orders o
      LEFT JOIN tables t ON o.table_id = t.id
      LEFT JOIN users w ON o.waiter_id = w.id
      LEFT JOIN users k ON o.kitchen_user_id = k.id
      LEFT JOIN order_items oi ON o.id = oi.order_id
      LEFT JOIN products p ON oi.product_id = p.id
      WHERE 1=1 ${dateFilter} ${statusFilter}
      GROUP BY o.id, t.number, t.zone, w.name, k.name
      ORDER BY o.created_at DESC
    `, params);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Yeni sipariş (müşteri verir — auth yok)
router.post('/', async (req, res) => {
  const client = await pool.connect();
  try {
    const { table_id, items, note, waiter_id } = req.body;
    await client.query('BEGIN');

    const orderResult = await client.query(
      'INSERT INTO orders (table_id, note, waiter_id) VALUES ($1,$2,$3) RETURNING *',
      [table_id, note, waiter_id || null]
    );
    const order = orderResult.rows[0];

    for (const item of items) {
      const product = await client.query('SELECT price FROM products WHERE id=$1', [item.product_id]);
      const price = product.rows[0].price;
      await client.query(
        'INSERT INTO order_items (order_id, product_id, quantity, unit_price, note) VALUES ($1,$2,$3,$4,$5)',
        [order.id, item.product_id, item.quantity, price, item.note || null]
      );
    }

    await client.query('COMMIT');

    // Socket.io ile tüm panellere bildir
    req.io.emit('new_order', { order_id: order.id, table_id, items });

    res.status(201).json(order);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// Sipariş durumu güncelle (garson/mutfak)
router.patch('/:id/status', auth, async (req, res) => {
  try {
    const { status } = req.body;
    let extra = '';
    let params = [status, req.params.id];

    if (status === 'preparing') {
      extra = ', kitchen_user_id=$3, kitchen_started_at=NOW()';
      params = [status, req.params.id, req.user.id];
    } else if (status === 'delivered') {
      extra = ', delivered_at=NOW()';
    }

    const result = await pool.query(
      `UPDATE orders SET status=$1, updated_at=NOW()${extra} WHERE id=$2 RETURNING *`,
      params
    );
    req.io.emit('order_updated', result.rows[0]);

    // Mutfak hazır deyince garsona bildir
    if (status === 'ready') {
      req.io.emit('order_ready', {
        order_id: result.rows[0].id,
        table_id: result.rows[0].table_id
      });
    }
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
