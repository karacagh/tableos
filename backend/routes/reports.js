const router = require('express').Router();
const pool = require('../db');
const auth = require('../middleware/auth');
const roles = require('../middleware/roles');

// Günlük özet rapor
router.get('/daily', auth, roles('admin','manager'), async (req, res) => {
  try {
    const { date } = req.query;
    const reportDate = date || new Date().toISOString().split('T')[0];

    const [orders, bills, topProducts, staffPerf] = await Promise.all([
      // Sipariş özeti
      pool.query(`
        SELECT
          COUNT(*) as total_orders,
          COUNT(CASE WHEN status = 'delivered' THEN 1 END) as delivered,
          COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled,
          COUNT(CASE WHEN status IN ('pending','preparing','ready') THEN 1 END) as active
        FROM orders
        WHERE DATE(created_at) = $1
      `, [reportDate]),

      // Kasa özeti
      pool.query(`
        SELECT
          COUNT(*) as total_bills,
          COALESCE(SUM(CASE WHEN status = 'paid' THEN total END), 0) as total_revenue,
          COUNT(CASE WHEN status = 'paid' AND payment_method = 'cash' THEN 1 END) as cash_count,
          COALESCE(SUM(CASE WHEN status = 'paid' AND payment_method = 'cash' THEN total END), 0) as cash_revenue,
          COUNT(CASE WHEN status = 'paid' AND payment_method = 'card' THEN 1 END) as card_count,
          COALESCE(SUM(CASE WHEN status = 'paid' AND payment_method = 'card' THEN total END), 0) as card_revenue,
          COUNT(CASE WHEN status = 'paid' AND payment_method = 'meal_card' THEN 1 END) as meal_count,
          COALESCE(SUM(CASE WHEN status = 'paid' AND payment_method = 'meal_card' THEN total END), 0) as meal_revenue
        FROM bills
        WHERE DATE(opened_at) = $1
      `, [reportDate]),

      // En çok satan ürünler
      pool.query(`
        SELECT
          p.name,
          SUM(oi.quantity) as total_quantity,
          SUM(oi.quantity * oi.unit_price) as total_revenue
        FROM order_items oi
        JOIN products p ON oi.product_id = p.id
        JOIN orders o ON oi.order_id = o.id
        WHERE DATE(o.created_at) = $1 AND o.status != 'cancelled'
        GROUP BY p.id, p.name
        ORDER BY total_quantity DESC
        LIMIT 10
      `, [reportDate]),

      // Garson performansı
      pool.query(`
        SELECT
          u.name,
          COUNT(o.id) as total_orders,
          COALESCE(SUM(oi_totals.total), 0) as total_revenue,
          AVG(EXTRACT(EPOCH FROM (o.delivered_at - o.created_at))/60)::numeric(10,1) as avg_delivery_mins
        FROM users u
        LEFT JOIN orders o ON o.waiter_id = u.id AND DATE(o.created_at) = $1
        LEFT JOIN (
          SELECT order_id, SUM(quantity * unit_price) as total FROM order_items GROUP BY order_id
        ) oi_totals ON oi_totals.order_id = o.id
        WHERE u.role = 'waiter'
        GROUP BY u.id, u.name
        ORDER BY total_orders DESC
      `, [reportDate]),
    ]);

    res.json({
      date: reportDate,
      orders: orders.rows[0],
      bills: bills.rows[0],
      top_products: topProducts.rows,
      staff_performance: staffPerf.rows,
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Haftalık trend
router.get('/weekly', auth, roles('admin','manager'), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        DATE(b.opened_at) as date,
        COUNT(DISTINCT b.id) as bill_count,
        COALESCE(SUM(CASE WHEN b.status = 'paid' THEN b.total END), 0) as revenue,
        COUNT(DISTINCT o.id) as order_count
      FROM bills b
      LEFT JOIN bill_orders bo ON bo.bill_id = b.id
      LEFT JOIN orders o ON o.id = bo.order_id
      WHERE b.opened_at >= NOW() - INTERVAL '7 days'
      GROUP BY DATE(b.opened_at)
      ORDER BY date ASC
    `);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Tarih aralığı raporu
router.get('/range', auth, roles('admin','manager'), async (req, res) => {
  try {
    const { start, end } = req.query;
    if (!start || !end) return res.status(400).json({ error: 'start ve end gerekli' });

    const [summary, topProducts, staffPerf, dailyBreakdown] = await Promise.all([
      pool.query(`
        SELECT
          COUNT(DISTINCT o.id) as total_orders,
          COUNT(DISTINCT CASE WHEN o.status = 'delivered' THEN o.id END) as delivered_orders,
          COALESCE(SUM(CASE WHEN b.status = 'paid' THEN b.total END), 0) as total_revenue,
          COALESCE(AVG(CASE WHEN b.status = 'paid' THEN b.total END), 0) as avg_bill,
          COUNT(DISTINCT CASE WHEN b.status = 'paid' THEN b.id END) as paid_bills
        FROM orders o
        LEFT JOIN bill_orders bo ON bo.order_id = o.id
        LEFT JOIN bills b ON b.id = bo.bill_id
        WHERE DATE(o.created_at) BETWEEN $1 AND $2
      `, [start, end]),

      pool.query(`
        SELECT p.name,
          SUM(oi.quantity) as total_quantity,
          SUM(oi.quantity * oi.unit_price) as total_revenue
        FROM order_items oi
        JOIN products p ON oi.product_id = p.id
        JOIN orders o ON oi.order_id = o.id
        WHERE DATE(o.created_at) BETWEEN $1 AND $2 AND o.status != 'cancelled'
        GROUP BY p.id, p.name
        ORDER BY total_quantity DESC LIMIT 10
      `, [start, end]),

      pool.query(`
        SELECT u.name,
          COUNT(o.id) as total_orders,
          COALESCE(SUM(oi_totals.total), 0) as total_revenue,
          AVG(EXTRACT(EPOCH FROM (o.delivered_at - o.created_at))/60)::numeric(10,1) as avg_delivery_mins
        FROM users u
        LEFT JOIN orders o ON o.waiter_id = u.id AND DATE(o.created_at) BETWEEN $1 AND $2
        LEFT JOIN (SELECT order_id, SUM(quantity * unit_price) as total FROM order_items GROUP BY order_id) oi_totals ON oi_totals.order_id = o.id
        WHERE u.role = 'waiter'
        GROUP BY u.id, u.name ORDER BY total_orders DESC
      `, [start, end]),

      pool.query(`
        SELECT DATE(b.opened_at) as date,
          COALESCE(SUM(CASE WHEN b.status = 'paid' THEN b.total END), 0) as revenue,
          COUNT(DISTINCT CASE WHEN b.status = 'paid' THEN b.id END) as bill_count
        FROM bills b
        WHERE DATE(b.opened_at) BETWEEN $1 AND $2
        GROUP BY DATE(b.opened_at) ORDER BY date ASC
      `, [start, end]),
    ]);

    const days = Math.max(1, Math.ceil((new Date(end).getTime() - new Date(start).getTime()) / 86400000) + 1);

    res.json({
      ...summary.rows[0],
      avg_daily_revenue: Number(summary.rows[0].total_revenue) / days,
      top_products: topProducts.rows,
      staff_performance: staffPerf.rows,
      daily_breakdown: dailyBreakdown.rows,
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
