const router = require('express').Router();
const bcrypt = require('bcryptjs');
const pool = require('../db');
const auth = require('../middleware/auth');
const roles = require('../middleware/roles');

// Tüm kullanıcıları listele (admin + manager)
router.get('/', auth, roles('admin','manager'), async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name, email, role, is_active, created_at FROM users ORDER BY created_at DESC'
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Kullanıcı ekle
router.post('/', auth, roles('admin','manager'), async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    const hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO users (name, email, password_hash, role) VALUES ($1,$2,$3,$4) RETURNING id, name, email, role',
      [name, email, hash, role]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Kullanıcı güncelle
router.put('/:id', auth, roles('admin','manager'), async (req, res) => {
  try {
    const { name, role, is_active } = req.body;
    const result = await pool.query(
      'UPDATE users SET name=$1, role=$2, is_active=$3 WHERE id=$4 RETURNING id, name, role, is_active',
      [name, role, is_active, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Kullanıcı sil
router.delete('/:id', auth, roles('admin'), async (req, res) => {
  try {
    await pool.query('UPDATE users SET is_active=false WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
