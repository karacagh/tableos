const router = require('express').Router();
const pool = require('../db');
const auth = require('../middleware/auth');

// Bildirimleri listele (manager + admin)
router.get('/', auth, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT n.*, u.name as sender_name FROM notifications n
      JOIN users u ON n.sender_id = u.id
      ORDER BY n.created_at DESC LIMIT 50
    `);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Bildirim gönder (garson → yönetici)
router.post('/', auth, async (req, res) => {
  try {
    const { message } = req.body;
    const result = await pool.query(
      'INSERT INTO notifications (sender_id, message) VALUES ($1,$2) RETURNING *',
      [req.user.id, message]
    );
    req.io.emit('new_notification', { ...result.rows[0], sender_name: req.user.name });
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
