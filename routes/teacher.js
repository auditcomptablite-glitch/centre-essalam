const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { isAuthenticated } = require('../middleware/auth');

// GET /teacher/dashboard
router.get('/dashboard', isAuthenticated, async (req, res) => {
  try {
    const [levels] = await db.query('SELECT * FROM levels ORDER BY id');
    const [subjects] = await db.query('SELECT * FROM subjects ORDER BY name');
    const [recentSessions] = await db.query(
      `SELECT ses.*, sub.name AS subject_name, l.name AS level_name
       FROM sessions ses
       JOIN subjects sub ON ses.subject_id = sub.id
       JOIN levels l ON ses.level_id = l.id
       WHERE ses.teacher_id = ?
       ORDER BY ses.session_date DESC LIMIT 5`,
      [req.session.user.id]
    );
    res.render('teacher/dashboard', {
      title: 'لوحة الأستاذ',
      user: req.session.user,
      levels,
      subjects,
      recentSessions,
      error: req.flash('error'),
      success: req.flash('success')
    });
  } catch (err) {
    console.error(err);
    res.render('teacher/dashboard', { title: 'لوحة الأستاذ', user: req.session.user, levels: [], subjects: [], recentSessions: [] });
  }
});

// GET /teacher/students?subject_id=&level_id= - قائمة التلاميذ
router.get('/students', isAuthenticated, async (req, res) => {
  try {
    const { subject_id, level_id } = req.query;
    if (!subject_id || !level_id) {
      return res.json({ students: [] });
    }
    // البحث عن التلاميذ المسجلين في المادة والمستوى المحدد
    const [students] = await db.query(
      `SELECT DISTINCT s.id, s.full_name, s.phone
       FROM students s
       JOIN student_subjects ss ON s.id = ss.student_id
       WHERE ss.subject_id = ? AND s.level_id = ? AND s.id > 0
       ORDER BY s.full_name`,
      [subject_id, level_id]
    );
    // إذا لم يوجد أحد، نعيد التلاميذ حسب المستوى فقط (احتياطي للتلاميذ غير المربوطين بمواد)
    if (students.length === 0) {
      const [fallback] = await db.query(
        `SELECT id, full_name, phone FROM students WHERE level_id = ? AND id > 0 ORDER BY full_name`,
        [level_id]
      );
      return res.json({ students: fallback, warning: 'تم عرض جميع تلاميذ هذا المستوى لأنه لا يوجد تلاميذ مسجلون في هذه المادة' });
    }
    res.json({ students });
  } catch (err) {
    console.error(err);
    res.json({ students: [], error: 'حدث خطأ' });
  }
});

// POST /teacher/session - إنشاء حصة وتسجيل الحضور
router.post('/session', isAuthenticated, async (req, res) => {
  const conn = await db.getConnection();
  try {
    const { subject_id, level_id, session_date, session_time, attendance, notes } = req.body;

    if (!subject_id || !level_id || !session_date) {
      req.flash('error', 'يرجى تحديد المادة والمستوى والتاريخ');
      return res.redirect('/teacher/dashboard');
    }

    await conn.beginTransaction();

    // Détecter les colonnes disponibles dans sessions
    const [cols] = await conn.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sessions'`
    );
    const colNames = cols.map(c => c.COLUMN_NAME);

    const fields = ['subject_id', 'level_id', 'teacher_id', 'session_date'];
    const values = [subject_id, level_id, req.session.user.id, session_date];

    if (colNames.includes('session_time')) { fields.push('session_time'); values.push(session_time || null); }
    if (colNames.includes('notes'))        { fields.push('notes');        values.push(notes || null); }

    const [sessionResult] = await conn.query(
      `INSERT INTO sessions (${fields.join(', ')}) VALUES (${fields.map(() => '?').join(', ')})`,
      values
    );
    const sessionId = sessionResult.insertId;

    // COMMIT la session d'abord — elle est toujours enregistrée même si l'attendance échoue
    await conn.commit();

    // Insérer l'attendance séparément, erreur par erreur
    let attendanceErrors = 0;
    if (attendance && typeof attendance === 'object') {
      const validStatuses = ['حاضر', 'غائب', 'متأخر'];
      // Récupérer les IDs valides dans students pour éviter les FK violations
      const studentIds = Object.keys(attendance)
        .map(id => parseInt(id, 10))
        .filter(id => !isNaN(id) && id > 0);

      if (studentIds.length > 0) {
        // Vérifier quels IDs existent vraiment dans students
        const [existingRows] = await conn.query(
          `SELECT id FROM students WHERE id IN (${studentIds.map(() => '?').join(',')})`,
          studentIds
        );
        const existingIds = new Set(existingRows.map(r => r.id));

        for (const [studentId, status] of Object.entries(attendance)) {
          const sid = parseInt(studentId, 10);
          if (isNaN(sid) || sid <= 0) continue;
          if (!existingIds.has(sid)) {
            console.warn(`تحذير: الطالب ID=${sid} غير موجود في قاعدة البيانات، تم تجاهله`);
            attendanceErrors++;
            continue;
          }
          const safeStatus = validStatuses.includes(status) ? status : 'حاضر';
          try {
            await conn.query(
              'INSERT INTO attendance (session_id, student_id, status) VALUES (?, ?, ?)',
              [sessionId, sid, safeStatus]
            );
          } catch (attErr) {
            console.warn(`تحذير: تعذر تسجيل حضور الطالب ID=${sid}: ${attErr.message}`);
            attendanceErrors++;
          }
        }
      }
    }

    if (attendanceErrors > 0) {
      req.flash('success', `تم تسجيل الحصة بنجاح (تحذير: ${attendanceErrors} طالب لم يُسجَّل حضوره بسبب بيانات غير صالحة)`);
    } else {
      req.flash('success', 'تم تسجيل الحصة والحضور بنجاح');
    }
    res.redirect('/teacher/dashboard');
  } catch (err) {
    await conn.rollback();
    console.error(err);
    req.flash('error', 'حدث خطأ: ' + err.message);
    res.redirect('/teacher/dashboard');
  } finally {
    conn.release();
  }
});

// GET /teacher/attendance-history - سجل الحضور
router.get('/attendance-history', isAuthenticated, async (req, res) => {
  try {
    const [sessions] = await db.query(
      `SELECT ses.id, ses.session_date, ses.session_time, sub.name AS subject_name, l.name AS level_name,
              COUNT(CASE WHEN a.status = 'حاضر' THEN 1 END) AS present,
              COUNT(CASE WHEN a.status = 'غائب' THEN 1 END) AS absent,
              COUNT(a.id) AS total
       FROM sessions ses
       JOIN subjects sub ON ses.subject_id = sub.id
       JOIN levels l ON ses.level_id = l.id
       LEFT JOIN attendance a ON a.session_id = ses.id
       WHERE ses.teacher_id = ?
       GROUP BY ses.id
       ORDER BY ses.session_date DESC`,
      [req.session.user.id]
    );
    res.render('teacher/attendance-history', {
      title: 'سجل الحصص',
      user: req.session.user,
      sessions,
      error: req.flash('error'),
      success: req.flash('success')
    });
  } catch (err) {
    console.error(err);
    res.render('teacher/attendance-history', { title: 'سجل الحصص', user: req.session.user, sessions: [], error: ['خطأ'], success: [] });
  }
});

// GET /teacher/session/:id - تفاصيل حصة
router.get('/session/:id', isAuthenticated, async (req, res) => {
  try {
    const [sessions] = await db.query(
      `SELECT ses.*, sub.name AS subject_name, l.name AS level_name
       FROM sessions ses
       JOIN subjects sub ON ses.subject_id = sub.id
       JOIN levels l ON ses.level_id = l.id
       WHERE ses.id = ? AND ses.teacher_id = ?`,
      [req.params.id, req.session.user.id]
    );
    if (sessions.length === 0) {
      req.flash('error', 'الحصة غير موجودة');
      return res.redirect('/teacher/attendance-history');
    }
    const [attendanceList] = await db.query(
      `SELECT a.status, s.full_name, s.phone
       FROM attendance a
       JOIN students s ON a.student_id = s.id
       WHERE a.session_id = ?
       ORDER BY s.full_name`,
      [req.params.id]
    );
    res.render('teacher/session-detail', {
      title: 'تفاصيل الحصة',
      user: req.session.user,
      session: sessions[0],
      attendanceList,
      error: req.flash('error'),
      success: req.flash('success')
    });
  } catch (err) {
    console.error(err);
    res.redirect('/teacher/attendance-history');
  }
});

module.exports = router;
