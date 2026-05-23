const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db');

// Giriş
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const result = await pool.query(
      'SELECT * FROM users WHERE email = $1 AND is_active = true', [email]
    );
    const user = result.rows[0];
    if (!user) return res.status(401).json({ error: 'Kullanıcı bulunamadı' });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Şifre hatalı' });

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, name: user.name },
      process.env.JWT_SECRET,
      { expiresIn: '12h' }
    );

    res.json({ token, user: { id: user.id, name: user.name, role: user.role } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Mevcut kullanıcı bilgisi
router.get('/me', require('../middleware/auth'), async (req, res) => {
  res.json(req.user);
});

module.exports = router;
