const express = require('express');
const router = express.Router();
const db = require('../config/database');

// GET /register - استمارة التسجيل
router.get('/', async (req, res) => {
  try {
    const [levels] = await db.query('SELECT * FROM levels ORDER BY sort_order');
    const [subjects] = await db.query('SELECT * FROM subjects ORDER BY name');
    res.render('student/register', {
      title: 'استمارة التسجيل',
      levels,
      subjects,
      error: req.flash('error'),
      success: req.flash('success')
    });
  } catch (err) {
    console.error(err);
    res.render('student/register', { title: 'استمارة التسجيل', levels: [], subjects: [], error: ['حدث خطأ'], success: [] });
  }
});

// POST /register - تسجيل تلميذ جديد
router.post('/', async (req, res) => {
  const conn = await db.getConnection();
  try {
    const { full_name, phone, parent_phone, level_id, subjects, notes } = req.body;

    if (!full_name || !level_id || !subjects) {
      req.flash('error', 'يرجى ملء جميع الحقول الإلزامية واختيار مادة على الأقل');
      return res.redirect('/register');
    }

    const subjectIds = Array.isArray(subjects) ? subjects : [subjects];

    await conn.beginTransaction();

    const [result] = await conn.query(
      'INSERT INTO students (full_name, phone, parent_phone, level_id, notes) VALUES (?, ?, ?, ?, ?)',
      [full_name, phone || null, parent_phone || null, level_id, notes || null]
    );

    const studentId = result.insertId;
    for (const subId of subjectIds) {
      await conn.query(
        'INSERT INTO student_subjects (student_id, subject_id) VALUES (?, ?)',
        [studentId, subId]
      );
    }

    await conn.commit();
    req.flash('success', `تم تسجيل ${full_name} بنجاح! سيتم التواصل معك قريباً.`);
    res.redirect('/register');
  } catch (err) {
    await conn.rollback();
    console.error(err);
    req.flash('error', 'حدث خطأ أثناء التسجيل، يرجى المحاولة مجدداً');
    res.redirect('/register');
  } finally {
    conn.release();
  }
});

module.exports = router;
