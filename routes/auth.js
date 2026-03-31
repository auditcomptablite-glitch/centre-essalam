const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../config/database');

// GET /auth/login
router.get('/login', (req, res) => {
  if (req.session.user) {
    return res.redirect(req.session.user.role === 'admin' ? '/admin/dashboard' : '/teacher/dashboard');
  }
  res.render('auth/login', {
    title: 'تسجيل الدخول',
    error: req.flash('error'),
    success: req.flash('success')
  });
});

// POST /auth/login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      req.flash('error', 'يرجى إدخال اسم المستخدم وكلمة المرور');
      return res.redirect('/auth/login');
    }

    const [rows] = await db.query('SELECT * FROM users WHERE username = ?', [username]);
    if (rows.length === 0) {
      req.flash('error', 'اسم المستخدم أو كلمة المرور غير صحيحة');
      return res.redirect('/auth/login');
    }

    const user = rows[0];
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      req.flash('error', 'اسم المستخدم أو كلمة المرور غير صحيحة');
      return res.redirect('/auth/login');
    }

    req.session.user = { id: user.id, name: user.name, username: user.username, role: user.role };
    res.redirect(user.role === 'admin' ? '/admin/dashboard' : '/teacher/dashboard');
  } catch (err) {
    console.error(err);
    req.flash('error', 'حدث خطأ، يرجى المحاولة مجدداً');
    res.redirect('/auth/login');
  }
});

// GET /auth/logout
router.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/auth/login');
});

module.exports = router;
