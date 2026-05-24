const router = require('express').Router();
const pool = require('../db');
const auth = require('../middleware/auth');

// Bildirimleri listele
router.get('/', auth, async (req, res) => {
  try {
    const { target_role } = req.query;
    let filter = '';
    const params = [];
    if (target_role && target_role !== 'all') {
      params.push(target_role);
      filter = `AND (n.target_role = $${params.length} OR n.target_role = 'all')`;
    }
    const result = await pool.query(`
      SELECT n.*, u.name as sender_name, u.role as sender_role
      FROM notifications n
      JOIN users u ON n.sender_id = u.id
      WHERE 1=1 ${filter}
      ORDER BY n.created_at DESC LIMIT 100
    `, params);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Bildirim gönder (garson → yönetici)
router.post('/', auth, async (req, res) => {
  try {
    const { message, target_role, type } = req.body;
    const result = await pool.query(
      'INSERT INTO notifications (sender_id, message, target_role, type) VALUES ($1,$2,$3,$4) RETURNING *',
      [req.user.id, message, target_role || 'manager', type || 'info']
    );
    req.io.emit('new_notification', {
      ...result.rows[0],
      sender_name: req.user.name,
      sender_role: req.user.role
    });
    res.status(201).json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Okundu işaretle
router.patch('/:id/read', auth, async (req, res) => {
  try {
    await pool.query('UPDATE notifications SET is_read=true WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
