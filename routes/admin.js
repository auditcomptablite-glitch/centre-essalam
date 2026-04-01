const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../config/database');
const { isAdmin } = require('../middleware/auth');

// ============ DASHBOARD ============
router.get('/dashboard', isAdmin, async (req, res) => {
  try {
    const [[{ totalStudents }]] = await db.query('SELECT COUNT(*) AS totalStudents FROM students');
    const [[{ totalTeachers }]] = await db.query("SELECT COUNT(*) AS totalTeachers FROM users WHERE role = 'teacher'");
    const [[{ totalSessions }]] = await db.query('SELECT COUNT(*) AS totalSessions FROM sessions');

    // BUG FIX 1: totalPaid — lire depuis students.amount_paid (source de vérité)
    // La table payments peut être vide si aucun paiement n'a été enregistré via le formulaire
    // amount_paid dans students est mis à jour à chaque paiement
    const [[{ totalPaid }]] = await db.query('SELECT COALESCE(SUM(amount_paid), 0) AS totalPaid FROM students');

    // BUG FIX 2: unpaidCount — inclure 'غير مدفوع' ET 'مدفوع جزئياً'
    // Avant: != 'مدفوع' — correct en théorie, mais les 2 élèves étaient marqués 'مدفوع'
    // Le vrai problème: lors de l'inscription, financial_status = 'غير مدفوع' par défaut (OK)
    // mais si l'admin marque comme payé via le formulaire, le statut change correctement.
    // On garde la logique != 'مدفوع' qui est correcte, et on ajoute le compte par statut.
    const [[{ unpaidCount }]] = await db.query("SELECT COUNT(*) AS unpaidCount FROM students WHERE financial_status != 'مدفوع'");

    const [recentStudents] = await db.query(
      `SELECT s.full_name, l.name AS level_name, s.financial_status, s.created_at
       FROM students s JOIN levels l ON s.level_id = l.id
       ORDER BY s.created_at DESC LIMIT 5`
    );

    res.render('admin/dashboard', {
      title: 'لوحة الإدارة',
      user: req.session.user,
      stats: { totalStudents, totalTeachers, totalSessions, totalPaid, unpaidCount },
      recentStudents,
      error: req.flash('error'),
      success: req.flash('success')
    });
  } catch (err) {
    console.error(err);
    res.render('admin/dashboard', {
      title: 'لوحة الإدارة', user: req.session.user,
      stats: {}, recentStudents: [], error: ['خطأ في تحميل البيانات'], success: []
    });
  }
});

// ============ STUDENTS ============
router.get('/students', isAdmin, async (req, res) => {
  try {
    const { level_id, subject_id, financial_status, search } = req.query;
    let query = `
      SELECT s.id, s.full_name, s.phone, s.parent_phone, l.name AS level_name,
             s.financial_status, s.amount_paid, s.amount_due, s.registration_date,
             GROUP_CONCAT(sub.name ORDER BY sub.name SEPARATOR '، ') AS subjects
      FROM students s
      JOIN levels l ON s.level_id = l.id
      LEFT JOIN student_subjects ss ON s.id = ss.student_id
      LEFT JOIN subjects sub ON ss.subject_id = sub.id
      WHERE 1=1`;
    const params = [];

    if (level_id) { query += ' AND s.level_id = ?'; params.push(level_id); }
    if (subject_id) { query += ' AND ss.subject_id = ?'; params.push(subject_id); }
    if (financial_status) { query += ' AND s.financial_status = ?'; params.push(financial_status); }
    if (search) { query += ' AND s.full_name LIKE ?'; params.push(`%${search}%`); }

    query += ' GROUP BY s.id ORDER BY s.full_name';

    const [students] = await db.query(query, params);
    const [levels] = await db.query('SELECT * FROM levels ORDER BY id');
    const [subjects] = await db.query('SELECT * FROM subjects ORDER BY name');

    res.render('admin/students', {
      title: 'إدارة التلاميذ', user: req.session.user,
      students, levels, subjects,
      filters: { level_id, subject_id, financial_status, search },
      error: req.flash('error'), success: req.flash('success')
    });
  } catch (err) {
    console.error(err);
    req.flash('error', 'حدث خطأ');
    res.redirect('/admin/dashboard');
  }
});

// GET /admin/students/:id - تفاصيل تلميذ
router.get('/students/:id', isAdmin, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT s.*, l.name AS level_name FROM students s JOIN levels l ON s.level_id = l.id WHERE s.id = ?`,
      [req.params.id]
    );
    if (rows.length === 0) { req.flash('error', 'التلميذ غير موجود'); return res.redirect('/admin/students'); }

    const [enrolledSubjects] = await db.query(
      `SELECT sub.id, sub.name FROM student_subjects ss JOIN subjects sub ON ss.subject_id = sub.id WHERE ss.student_id = ?`,
      [req.params.id]
    );
    const [attendanceStats] = await db.query(
      `SELECT sub.name AS subject_name,
              COUNT(CASE WHEN a.status = 'حاضر' THEN 1 END) AS present,
              COUNT(CASE WHEN a.status = 'غائب' THEN 1 END) AS absent,
              COUNT(a.id) AS total
       FROM student_subjects ss
       JOIN subjects sub ON ss.subject_id = sub.id
       LEFT JOIN sessions ses ON ses.subject_id = ss.subject_id AND ses.level_id = ?
       LEFT JOIN attendance a ON a.session_id = ses.id AND a.student_id = ?
       WHERE ss.student_id = ?
       GROUP BY sub.id`,
      [rows[0].level_id, req.params.id, req.params.id]
    );
    const [payments] = await db.query(
      'SELECT * FROM payments WHERE student_id = ? ORDER BY payment_date DESC',
      [req.params.id]
    );
    const [levels] = await db.query('SELECT * FROM levels ORDER BY id');
    const [subjects] = await db.query('SELECT * FROM subjects ORDER BY name');

    res.render('admin/student-detail', {
      title: 'تفاصيل التلميذ', user: req.session.user,
      student: rows[0], enrolledSubjects, attendanceStats, payments, levels, subjects,
      error: req.flash('error'), success: req.flash('success')
    });
  } catch (err) {
    console.error(err);
    req.flash('error', 'حدث خطأ');
    res.redirect('/admin/students');
  }
});

// POST /admin/students/:id - تحديث بيانات تلميذ
router.post('/students/:id', isAdmin, async (req, res) => {
  const conn = await db.getConnection();
  try {
    const { full_name, phone, parent_phone, level_id, financial_status, amount_paid, amount_due, notes, subjects } = req.body;
    await conn.beginTransaction();

    await conn.query(
      'UPDATE students SET full_name=?, phone=?, parent_phone=?, level_id=?, financial_status=?, amount_paid=?, amount_due=?, notes=? WHERE id=?',
      [full_name, phone || null, parent_phone || null, level_id, financial_status, amount_paid || 0, amount_due || 0, notes || null, req.params.id]
    );

    await conn.query('DELETE FROM student_subjects WHERE student_id = ?', [req.params.id]);
    const subjectIds = Array.isArray(subjects) ? subjects : (subjects ? [subjects] : []);
    for (const subId of subjectIds) {
      await conn.query('INSERT INTO student_subjects (student_id, subject_id) VALUES (?, ?)', [req.params.id, subId]);
    }

    await conn.commit();
    req.flash('success', 'تم تحديث بيانات التلميذ بنجاح');
    res.redirect(`/admin/students/${req.params.id}`);
  } catch (err) {
    await conn.rollback();
    console.error(err);
    req.flash('error', 'حدث خطأ أثناء التحديث');
    res.redirect(`/admin/students/${req.params.id}`);
  } finally {
    conn.release();
  }
});

// POST /admin/students/:id/delete
router.post('/students/:id/delete', isAdmin, async (req, res) => {
  try {
    await db.query('DELETE FROM students WHERE id = ?', [req.params.id]);
    req.flash('success', 'تم حذف التلميذ');
    res.redirect('/admin/students');
  } catch (err) {
    console.error(err);
    req.flash('error', 'حدث خطأ أثناء الحذف');
    res.redirect('/admin/students');
  }
});

// ============ PAYMENTS ============
router.post('/students/:id/payment', isAdmin, async (req, res) => {
  const conn = await db.getConnection();
  try {
    const { amount, payment_date, payment_month, payment_year, status, notes } = req.body;
    const amountNum = parseFloat(amount) || 0;

    await conn.beginTransaction();

    // Enregistrer le paiement (sans subject_id — colonne absente en production)
    // Pour ajouter subject_id : exécuter ALTER TABLE payments ADD COLUMN subject_id INT NULL
    await conn.query(
      'INSERT INTO payments (student_id, amount, payment_date, payment_month, payment_year, status, notes) VALUES (?,?,?,?,?,?,?)',
      [req.params.id, amountNum, payment_date, payment_month || null, payment_year || null, status, notes || null]
    );

    // BUG FIX 3: Recalculer amount_paid depuis la table payments (somme réelle)
    // ET mettre à jour financial_status de façon cohérente
    const [[{ totalPaidForStudent }]] = await conn.query(
      "SELECT COALESCE(SUM(amount), 0) AS totalPaidForStudent FROM payments WHERE student_id = ? AND status = 'مدفوع'",
      [req.params.id]
    );

    // Déterminer le statut financier selon le montant dû
    const [[student]] = await conn.query('SELECT amount_due FROM students WHERE id = ?', [req.params.id]);
    const amountDue = parseFloat(student.amount_due) || 0;
    let newStatus;
    if (amountDue === 0) {
      // Pas de montant dû défini: utiliser le statut du paiement directement
      newStatus = status;
    } else if (totalPaidForStudent >= amountDue) {
      newStatus = 'مدفوع';
    } else if (totalPaidForStudent > 0) {
      newStatus = 'مدفوع جزئياً';
    } else {
      newStatus = 'غير مدفوع';
    }

    await conn.query(
      'UPDATE students SET financial_status = ?, amount_paid = ? WHERE id = ?',
      [newStatus, totalPaidForStudent, req.params.id]
    );

    await conn.commit();
    req.flash('success', 'تم تسجيل الدفع بنجاح');
    res.redirect(`/admin/students/${req.params.id}`);
  } catch (err) {
    await conn.rollback();
    console.error(err);
    req.flash('error', 'حدث خطأ');
    res.redirect(`/admin/students/${req.params.id}`);
  } finally {
    conn.release();
  }
});

// ============ TEACHERS ============
router.get('/teachers', isAdmin, async (req, res) => {
  try {
    const [teachers] = await db.query(
      `SELECT u.*, COUNT(DISTINCT s.id) AS session_count
       FROM users u
       LEFT JOIN sessions s ON s.teacher_id = u.id
       WHERE u.role = 'teacher'
       GROUP BY u.id ORDER BY u.name`
    );
    res.render('admin/teachers', {
      title: 'إدارة الأساتذة', user: req.session.user, teachers,
      error: req.flash('error'), success: req.flash('success')
    });
  } catch (err) {
    console.error(err);
    res.render('admin/teachers', { title: 'إدارة الأساتذة', user: req.session.user, teachers: [], error: ['خطأ'], success: [] });
  }
});

router.post('/teachers', isAdmin, async (req, res) => {
  try {
    const { name, username, password } = req.body;
    const hashed = await bcrypt.hash(password, 10);
    await db.query("INSERT INTO users (name, username, password, role) VALUES (?, ?, ?, 'teacher')", [name, username, hashed]);
    req.flash('success', `تم إضافة الأستاذ ${name} بنجاح`);
    res.redirect('/admin/teachers');
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') req.flash('error', 'اسم المستخدم مستخدم بالفعل');
    else req.flash('error', 'حدث خطأ');
    res.redirect('/admin/teachers');
  }
});

router.post('/teachers/:id/delete', isAdmin, async (req, res) => {
  try {
    await db.query('DELETE FROM users WHERE id = ? AND role = "teacher"', [req.params.id]);
    req.flash('success', 'تم حذف الأستاذ');
    res.redirect('/admin/teachers');
  } catch (err) {
    req.flash('error', 'حدث خطأ');
    res.redirect('/admin/teachers');
  }
});

// ============ ATTENDANCE OVERVIEW ============
router.get('/attendance', isAdmin, async (req, res) => {
  try {
    const { subject_id, level_id, from_date, to_date } = req.query;
    let query = `
      SELECT ses.session_date, ses.session_time, sub.name AS subject_name, l.name AS level_name,
             u.name AS teacher_name, ses.id AS session_id,
             COUNT(CASE WHEN a.status = 'حاضر' THEN 1 END) AS present,
             COUNT(CASE WHEN a.status = 'غائب' THEN 1 END) AS absent,
             COUNT(a.id) AS total
      FROM sessions ses
      JOIN subjects sub ON ses.subject_id = sub.id
      JOIN levels l ON ses.level_id = l.id
      JOIN users u ON ses.teacher_id = u.id
      LEFT JOIN attendance a ON a.session_id = ses.id
      WHERE 1=1`;
    const params = [];
    if (subject_id) { query += ' AND ses.subject_id = ?'; params.push(subject_id); }
    if (level_id) { query += ' AND ses.level_id = ?'; params.push(level_id); }
    if (from_date) { query += ' AND ses.session_date >= ?'; params.push(from_date); }
    if (to_date) { query += ' AND ses.session_date <= ?'; params.push(to_date); }
    query += ' GROUP BY ses.id ORDER BY ses.session_date DESC';

    const [sessions] = await db.query(query, params);
    const [levels] = await db.query('SELECT * FROM levels ORDER BY id');
    const [subjects] = await db.query('SELECT * FROM subjects ORDER BY name');

    res.render('admin/attendance', {
      title: 'سجل الحضور والغياب', user: req.session.user,
      sessions, levels, subjects, filters: { subject_id, level_id, from_date, to_date },
      error: req.flash('error'), success: req.flash('success')
    });
  } catch (err) {
    console.error(err);
    req.flash('error', 'حدث خطأ');
    res.redirect('/admin/dashboard');
  }
});

// ============ FINANCIAL OVERVIEW ============
router.get('/finance', isAdmin, async (req, res) => {
  try {
    const { month, year, financial_status } = req.query;
    let query = `
      SELECT s.id, s.full_name, l.name AS level_name,
             s.financial_status, s.amount_paid, s.amount_due,
             COALESCE(SUM(p.amount), 0) AS total_payments
      FROM students s
      JOIN levels l ON s.level_id = l.id
      LEFT JOIN payments p ON p.student_id = s.id`;
    const params = [];
    const wheres = [];
    if (month) { wheres.push('p.payment_month = ?'); params.push(month); }
    if (year) { wheres.push('p.payment_year = ?'); params.push(year); }
    if (financial_status) { wheres.push('s.financial_status = ?'); params.push(financial_status); }
    if (wheres.length) query += ' WHERE ' + wheres.join(' AND ');
    query += ' GROUP BY s.id ORDER BY s.financial_status, s.full_name';

    const [students] = await db.query(query, params);

    // BUG FIX 4: Lire totalRevenue depuis students.amount_paid (cohérent avec le dashboard)
    const [[{ totalRevenue }]] = await db.query('SELECT COALESCE(SUM(amount_paid), 0) AS totalRevenue FROM students');
    const [[{ unpaidStudents }]] = await db.query("SELECT COUNT(*) AS unpaidStudents FROM students WHERE financial_status != 'مدفوع'");

    res.render('admin/finance', {
      title: 'الإدارة المالية', user: req.session.user,
      students, totalRevenue, unpaidStudents,
      filters: { month, year, financial_status },
      error: req.flash('error'), success: req.flash('success')
    });
  } catch (err) {
    console.error(err);
    req.flash('error', 'حدث خطأ');
    res.redirect('/admin/dashboard');
  }
});

module.exports = router;
