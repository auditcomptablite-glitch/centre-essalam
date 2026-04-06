'use strict';

const express = require('express');
const session = require('express-session');
const compression = require('compression');
const helmet = require('helmet');
const bcrypt = require('bcryptjs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

// ── Prisma singleton (important pour la RAM) ──────────────────────────────────
const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'production' ? [] : ['error'],
});

const app = express();
const PORT = process.env.PORT || 3000;

// ── Constantes métier ─────────────────────────────────────────────────────────
const NIVEAUX_LABELS = {
  AC1: '1ère AC', AC2: '2ème AC', AC3: '3ème AC',
  TC: 'Tronc Commun', BAC1: '1ère BAC', BAC2: '2ème BAC',
};
const MATIERES_LABELS = {
  MATHEMATIQUES: 'Mathématiques', PHYSIQUE: 'Physique', SVT: 'SVT',
  ECONOMIE: 'Économie', FRANCAIS: 'Français', LETTRES: 'Lettres',
  STE: 'STE', STM: 'STM', SI: 'SI',
};
const MOIS_LABELS = [
  '', 'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(compression());
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", 'cdn.jsdelivr.net'],
      styleSrc: ["'self'", "'unsafe-inline'", 'cdn.jsdelivr.net', 'fonts.googleapis.com'],
      fontSrc: ["'self'", 'fonts.gstatic.com', 'cdn.jsdelivr.net'],
      imgSrc: ["'self'", 'data:'],
      connectSrc: ["'self'", 'cdn.jsdelivr.net'],
    },
  },
}));
app.use(express.urlencoded({ extended: true, limit: '50kb' }));
app.use(express.json({ limit: '50kb' }));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.set('view cache', process.env.NODE_ENV === 'production');

// ── Session ───────────────────────────────────────────────────────────────────
const sessionConfig = {
  secret: process.env.SESSION_SECRET || 'centre-soutien-secret-2024',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false,
    httpOnly: true,
    maxAge: 8 * 60 * 60 * 1000, // 8 heures
  },
};

// Utilise le store MySQL si disponible pour économiser la RAM
if (process.env.MYSQL_URL) {
  try {
    const MySQLStore = require('connect-mysql')(session);
    sessionConfig.store = new MySQLStore({
      config: { url: process.env.MYSQL_URL },
    });
  } catch (e) {
    console.log('MySQL session store indisponible, utilisation mémoire.');
  }
}
app.use(session(sessionConfig));

// ── Helpers locals ────────────────────────────────────────────────────────────
app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  res.locals.NIVEAUX_LABELS = NIVEAUX_LABELS;
  res.locals.MATIERES_LABELS = MATIERES_LABELS;
  res.locals.MOIS_LABELS = MOIS_LABELS;
  next();
});

// ── Guards ────────────────────────────────────────────────────────────────────
const requireAuth = (req, res, next) => {
  if (!req.session.user) return res.redirect('/login');
  next();
};
const requireAdmin = (req, res, next) => {
  if (!req.session.user || req.session.user.role !== 'ADMIN') return res.redirect('/login');
  next();
};
const requireProf = (req, res, next) => {
  if (!req.session.user || req.session.user.role !== 'PROFESSOR') return res.redirect('/login');
  next();
};

// ═══════════════════════════════════════════════════════════════════════════════
// AUTH ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

app.get('/', (req, res) => res.redirect('/login'));

app.get('/login', (req, res) => {
  if (req.session.user) {
    return res.redirect(req.session.user.role === 'ADMIN' ? '/admin' : '/prof');
  }
  res.render('login', { error: null });
});

app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.render('login', { error: 'Veuillez remplir tous les champs.' });
  }
  try {
    const user = await prisma.user.findUnique({
      where: { username: username.trim() },
      select: { id: true, username: true, password: true, role: true, matiere: true },
    });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.render('login', { error: 'Identifiants incorrects.' });
    }
    req.session.user = { id: user.id, username: user.username, role: user.role, matiere: user.matiere };
    return res.redirect(user.role === 'ADMIN' ? '/admin' : '/prof');
  } catch (e) {
    console.error(e);
    res.render('login', { error: 'Erreur serveur.' });
  }
});

app.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/login'));
});

// ═══════════════════════════════════════════════════════════════════════════════
// ADMIN ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

// Dashboard Admin
app.get('/admin', requireAdmin, async (req, res) => {
  const now = new Date();
  const mois = now.getMonth() + 1;
  const annee = now.getFullYear();

  try {
    // Stats rapides (selects minimaux)
    const [totalStudents, totalProfs, paiementsMois] = await Promise.all([
      prisma.student.count(),
      prisma.user.count({ where: { role: 'PROFESSOR' } }),
      prisma.paiement.findMany({
        where: { mois, annee },
        select: { studentId: true, paye: true, montant: true, student: { select: { nom: true, prenom: true, niveau: true } } },
      }),
    ]);

    const payes = paiementsMois.filter(p => p.paye);
    const impayes = paiementsMois.filter(p => !p.paye);
    const totalEncaisse = payes.reduce((s, p) => s + Number(p.montant), 0);

    res.render('admin_dashboard', {
      totalStudents, totalProfs, payes, impayes,
      totalEncaisse, mois, annee,
      MOIS_LABELS,
    });
  } catch (e) {
    console.error(e);
    res.status(500).send('Erreur serveur');
  }
});

// ── Gestion Élèves ────────────────────────────────────────────────────────────
app.get('/admin/etudiants', requireAdmin, async (req, res) => {
  const { niveau, search } = req.query;
  const where = {};
  if (niveau) where.niveau = niveau;
  if (search) where.OR = [
    { nom: { contains: search } },
    { prenom: { contains: search } },
  ];
  try {
    const students = await prisma.student.findMany({
      where,
      select: {
        id: true, nom: true, prenom: true, niveau: true, telephone: true,
        inscriptions: { select: { matiere: true } },
      },
      orderBy: [{ niveau: 'asc' }, { nom: 'asc' }],
    });
    res.render('admin_etudiants', { students, query: req.query, NIVEAUX_LABELS, MATIERES_LABELS });
  } catch (e) {
    console.error(e);
    res.status(500).send('Erreur serveur');
  }
});

app.post('/admin/etudiants/add', requireAdmin, async (req, res) => {
  const { nom, prenom, niveau, telephone, matieres } = req.body;
  const matieresArr = Array.isArray(matieres) ? matieres : (matieres ? [matieres] : []);
  try {
    await prisma.student.create({
      data: {
        nom: nom.trim(), prenom: prenom.trim(), niveau, telephone: telephone?.trim() || null,
        inscriptions: { create: matieresArr.map(m => ({ matiere: m })) },
      },
    });
    res.redirect('/admin/etudiants');
  } catch (e) {
    console.error(e);
    res.redirect('/admin/etudiants?error=1');
  }
});

app.post('/admin/etudiants/:id/delete', requireAdmin, async (req, res) => {
  await prisma.student.delete({ where: { id: parseInt(req.params.id) } });
  res.redirect('/admin/etudiants');
});

// ── Gestion Professeurs ───────────────────────────────────────────────────────
app.get('/admin/profs', requireAdmin, async (req, res) => {
  try {
    const profs = await prisma.user.findMany({
      where: { role: 'PROFESSOR' },
      select: { id: true, username: true, matiere: true, createdAt: true },
      orderBy: { username: 'asc' },
    });
    res.render('admin_profs', { profs, MATIERES_LABELS, error: req.query.error });
  } catch (e) {
    res.status(500).send('Erreur serveur');
  }
});

app.post('/admin/profs/add', requireAdmin, async (req, res) => {
  const { username, password, matiere } = req.body;
  try {
    const count = await prisma.user.count({ where: { role: 'PROFESSOR' } });
    if (count >= 20) return res.redirect('/admin/profs?error=max');
    const hash = await bcrypt.hash(password, 10);
    await prisma.user.create({ data: { username: username.trim(), password: hash, role: 'PROFESSOR', matiere } });
    res.redirect('/admin/profs');
  } catch (e) {
    res.redirect('/admin/profs?error=exists');
  }
});

app.post('/admin/profs/:id/delete', requireAdmin, async (req, res) => {
  await prisma.user.delete({ where: { id: parseInt(req.params.id) } });
  res.redirect('/admin/profs');
});

// ── Gestion Paiements ─────────────────────────────────────────────────────────
app.get('/admin/finance', requireAdmin, async (req, res) => {
  const now = new Date();
  const mois = parseInt(req.query.mois) || now.getMonth() + 1;
  const annee = parseInt(req.query.annee) || now.getFullYear();
  try {
    const students = await prisma.student.findMany({
      select: {
        id: true, nom: true, prenom: true, niveau: true,
        paiements: { where: { mois, annee }, select: { id: true, paye: true, montant: true, datePaiement: true } },
      },
      orderBy: [{ niveau: 'asc' }, { nom: 'asc' }],
    });
    res.render('admin_finance', { students, mois, annee, MOIS_LABELS, NIVEAUX_LABELS });
  } catch (e) {
    console.error(e);
    res.status(500).send('Erreur serveur');
  }
});

app.post('/admin/finance/paiement', requireAdmin, async (req, res) => {
  const { studentId, mois, annee, montant, paye, datePaiement } = req.body;
  const moisInt  = parseInt(mois);
  const anneeInt = parseInt(annee);

  // Compute the datePaiement to store
  let dateToStore = null;
  if (paye === '1') {
    if (datePaiement) {
      // Validate the manual date belongs to the filtered mois/annee
      const d = new Date(datePaiement + 'T00:00:00');
      if ((d.getMonth() + 1) !== moisInt || d.getFullYear() !== anneeInt) {
        return res.status(400).json({ ok: false, error: 'La date doit appartenir au mois/année sélectionné.' });
      }
      dateToStore = d;
    } else {
      // No date provided: default to first day of the filtered month
      dateToStore = new Date(anneeInt, moisInt - 1, 1);
    }
  }

  try {
    await prisma.paiement.upsert({
      where: { studentId_mois_annee: { studentId: parseInt(studentId), mois: moisInt, annee: anneeInt } },
      update: { montant: parseFloat(montant), paye: paye === '1', datePaiement: dateToStore },
      create: {
        studentId: parseInt(studentId), mois: moisInt, annee: anneeInt,
        montant: parseFloat(montant), paye: paye === '1', datePaiement: dateToStore,
      },
    });
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// PROF ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

app.get('/prof', requireProf, async (req, res) => {
  const { id, matiere } = req.session.user;
  const niveau = req.query.niveau || '';
  const date = req.query.date || new Date().toISOString().split('T')[0];
  try {
    const where = {
      inscriptions: { some: { matiere } },
    };
    if (niveau) where.niveau = niveau;

    const students = await prisma.student.findMany({
      where,
      select: {
        id: true, nom: true, prenom: true, niveau: true,
        absences: {
          where: { profId: id, matiere, date: new Date(date) },
          select: { present: true },
        },
      },
      orderBy: [{ niveau: 'asc' }, { nom: 'asc' }],
    });

    res.render('prof_appel', { students, date, niveau, matiere, NIVEAUX_LABELS, MATIERES_LABELS });
  } catch (e) {
    console.error(e);
    res.status(500).send('Erreur serveur');
  }
});

// Liste des séances du prof connecté
app.get('/prof/seances', requireProf, async (req, res) => {
  const { id: profId, matiere } = req.session.user;
  const { dateFrom, dateTo } = req.query;

  const where = { profId };
  if (dateFrom || dateTo) {
    where.date = {};
    if (dateFrom) where.date.gte = new Date(dateFrom);
    if (dateTo)   where.date.lte = new Date(dateTo);
  }

  try {
    const rows = await prisma.absence.findMany({
      where,
      select: { date: true, matiere: true, present: true },
      orderBy: [{ date: 'desc' }],
    });

    // Grouper par (date, matiere)
    const map = new Map();
    for (const r of rows) {
      const key = `${r.date.toISOString().split('T')[0]}__${r.matiere}`;
      if (!map.has(key)) {
        map.set(key, { date: r.date, matiere: r.matiere, total: 0, presents: 0 });
      }
      const s = map.get(key);
      s.total++;
      if (r.present) s.presents++;
    }
    const seances = Array.from(map.values());

    res.render('prof_seances', { seances, matiere, query: req.query, MATIERES_LABELS, NIVEAUX_LABELS });
  } catch (e) {
    console.error(e);
    res.status(500).send('Erreur serveur');
  }
});

// Détail d'une séance du prof connecté
app.get('/prof/seances/detail', requireProf, async (req, res) => {
  const { id: profId } = req.session.user;
  const { date, matiere } = req.query;
  if (!date || !matiere) return res.redirect('/prof/seances');

  try {
    const dateObj = new Date(date);
    const lignes = await prisma.absence.findMany({
      where: { profId, date: dateObj, matiere },
      select: {
        present: true,
        student: { select: { id: true, nom: true, prenom: true, niveau: true } },
      },
      orderBy: [{ student: { niveau: 'asc' } }, { student: { nom: 'asc' } }],
    });

    if (!lignes.length) return res.redirect('/prof/seances');

    const presents = lignes.filter(l => l.present).length;
    const absents  = lignes.length - presents;

    res.render('prof_seance_detail', {
      lignes, date, matiere, presents, absents,
      MATIERES_LABELS, NIVEAUX_LABELS,
    });
  } catch (e) {
    console.error(e);
    res.status(500).send('Erreur serveur');
  }
});

app.post('/prof/appel', requireProf, async (req, res) => {
  const { id: profId, matiere } = req.session.user;
  const { date, presences } = req.body;

  console.log('POST /prof/appel body:', JSON.stringify({ date, presences }));

  if (!date || !presences || typeof presences !== 'object') {
    console.error('Donnees invalides:', { date, presences });
    return res.status(400).send('Donnees invalides');
  }

  const dateObj = new Date(date);
  if (isNaN(dateObj.getTime())) {
    return res.status(400).send('Date invalide');
  }

  try {
    const entries = Object.entries(presences)
      .map(([key, val]) => [parseInt(key, 10), val])
      .filter(([id]) => !isNaN(id) && id > 0);

    console.log('Entrees valides:', entries.length, '/', Object.keys(presences).length);

    const ops = entries.map(([studentId, present]) =>
      prisma.absence.upsert({
        where: { studentId_profId_date_matiere: { studentId, profId, date: dateObj, matiere } },
        update: { present: present === '1' },
        create: { studentId, profId, date: dateObj, matiere, present: present === '1' },
      })
    );

    await prisma.$transaction(ops);
    res.redirect('/prof?date=' + date);
  } catch (e) {
    console.error('Erreur /prof/appel:', e.message, e.meta || '');
    res.status(500).send('Erreur serveur: ' + e.message);
  }
});

// ── Séances (liste groupée des appels enregistrés) ───────────────────────────
app.get('/admin/seances', requireAdmin, async (req, res) => {
  const { profId, matiere, dateFrom, dateTo } = req.query;

  const where = {};
  if (profId)   where.profId  = parseInt(profId);
  if (matiere)  where.matiere = matiere;
  if (dateFrom || dateTo) {
    where.date = {};
    if (dateFrom) where.date.gte = new Date(dateFrom);
    if (dateTo)   where.date.lte = new Date(dateTo);
  }

  try {
    // Récupère toutes les lignes d'absence filtrées
    const rows = await prisma.absence.findMany({
      where,
      select: {
        profId: true, date: true, matiere: true, present: true,
        prof: { select: { username: true } },
      },
      orderBy: [{ date: 'desc' }, { matiere: 'asc' }],
    });

    // Groupe par (profId, date, matiere) → une séance
    const map = new Map();
    for (const r of rows) {
      const key = `${r.profId}__${r.date.toISOString().split('T')[0]}__${r.matiere}`;
      if (!map.has(key)) {
        map.set(key, {
          profId:   r.profId,
          profName: r.prof.username,
          date:     r.date,
          matiere:  r.matiere,
          total:    0,
          presents: 0,
        });
      }
      const s = map.get(key);
      s.total++;
      if (r.present) s.presents++;
    }
    const seances = Array.from(map.values());

    // Liste des profs pour le filtre
    const profs = await prisma.user.findMany({
      where: { role: 'PROFESSOR' },
      select: { id: true, username: true, matiere: true },
      orderBy: { username: 'asc' },
    });

    res.render('admin_seances', {
      seances, profs, query: req.query, MATIERES_LABELS, NIVEAUX_LABELS,
    });
  } catch (e) {
    console.error(e);
    res.status(500).send('Erreur serveur');
  }
});

// Détail d'une séance : profId + date + matiere en query params
app.get('/admin/seances/detail', requireAdmin, async (req, res) => {
  const { profId, date, matiere } = req.query;
  if (!profId || !date || !matiere) return res.redirect('/admin/seances');

  try {
    const dateObj = new Date(date);

    const lignes = await prisma.absence.findMany({
      where: { profId: parseInt(profId), date: dateObj, matiere },
      select: {
        present: true,
        student: { select: { id: true, nom: true, prenom: true, niveau: true } },
        prof:    { select: { username: true } },
      },
      orderBy: [
        { student: { niveau: 'asc' } },
        { student: { nom:    'asc' } },
      ],
    });

    if (!lignes.length) return res.redirect('/admin/seances');

    const profName  = lignes[0].prof.username;
    const presents  = lignes.filter(l => l.present).length;
    const absents   = lignes.length - presents;

    res.render('admin_seance_detail', {
      lignes, profName, profId, date, matiere,
      presents, absents,
      MATIERES_LABELS, NIVEAUX_LABELS,
    });
  } catch (e) {
    console.error(e);
    res.status(500).send('Erreur serveur');
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// INIT ADMIN (à appeler une seule fois via /init-admin?secret=XXX)
// ═══════════════════════════════════════════════════════════════════════════════

app.get('/init-admin', async (req, res) => {
  const secret = process.env.INIT_SECRET || 'init-admin-secret-2024';
  if (req.query.secret !== secret) return res.status(403).send('Forbidden');
  try {
    const exists = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
    if (exists) return res.send('Admin déjà créé.');
    const hash = await bcrypt.hash(process.env.ADMIN_PASSWORD || 'Admin@2024!', 12);
    await prisma.user.create({ data: { username: 'admin', password: hash, role: 'ADMIN' } });
    res.send('✅ Admin créé. Username: admin / Password: Admin@2024! — CHANGEZ-LE !');
  } catch (e) {
    res.status(500).send('Erreur: ' + e.message);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// CHANGEMENT DE MOT DE PASSE (Admin + Professeurs)
// ═══════════════════════════════════════════════════════════════════════════════

app.get('/change-password', requireAuth, (req, res) => {
  res.render('change_password', { error: null, success: null });
});

app.post('/change-password', requireAuth, async (req, res) => {
  const { oldPassword, newPassword, confirmPassword } = req.body;

  if (!oldPassword || !newPassword || !confirmPassword) {
    return res.render('change_password', { error: 'Veuillez remplir tous les champs.', success: null });
  }
  if (newPassword.length < 6) {
    return res.render('change_password', { error: 'Le nouveau mot de passe doit contenir au moins 6 caractères.', success: null });
  }
  if (newPassword !== confirmPassword) {
    return res.render('change_password', { error: 'Les deux nouveaux mots de passe ne correspondent pas.', success: null });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: req.session.user.id },
      select: { password: true },
    });
    if (!(await bcrypt.compare(oldPassword, user.password))) {
      return res.render('change_password', { error: 'Ancien mot de passe incorrect.', success: null });
    }
    const hash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({ where: { id: req.session.user.id }, data: { password: hash } });
    res.render('change_password', { error: null, success: 'Mot de passe changé avec succès !' });
  } catch (e) {
    console.error(e);
    res.render('change_password', { error: 'Erreur serveur.', success: null });
  }
});

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', (req, res) => res.json({ status: 'ok', ts: Date.now() }));

// ── Démarrage ─────────────────────────────────────────────────────────────────
async function start() {
  try {
    await prisma.$connect();
    console.log('✅ Prisma connecté');
    app.listen(PORT, () => console.log(`🚀 Serveur sur http://localhost:${PORT}`));
  } catch (e) {
    console.error('❌ Erreur démarrage:', e);
    process.exit(1);
  }
}

process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

start();
