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

module.exports = router;
