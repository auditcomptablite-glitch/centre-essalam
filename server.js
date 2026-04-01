require('dotenv').config();
const express = require('express');
const session = require('express-session');
const flash = require('connect-flash');
const methodOverride = require('method-override');
const path = require('path');
const MySQLStore = require('express-mysql-session')(session);

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================
// Session Store MySQL
// ============================================
const mysqlUrl = process.env.MYSQL_URL || process.env.MYSQL_PUBLIC_URL;

let sessionStoreOptions;
if (mysqlUrl) {
  const url = new URL(mysqlUrl);
  sessionStoreOptions = {
    host:     url.hostname,
    port:     url.port || 3306,
    user:     url.username,
    password: url.password,
    database: url.pathname.replace('/', ''),
  };
} else {
  sessionStoreOptions = {
    host:     process.env.MYSQLHOST     || 'localhost',
    port:     process.env.MYSQLPORT     || 3306,
    user:     process.env.MYSQLUSER     || 'root',
    password: process.env.MYSQLPASSWORD || '',
    database: process.env.MYSQLDATABASE || 'railway',
  };
}

// استخدام جدول مختلف لتجنب التعارض مع جدول sessions الخاص بالحصص
sessionStoreOptions.schema = { tableName: 'user_sessions' };
sessionStoreOptions.clearExpired = true;
sessionStoreOptions.checkExpirationInterval = 900000;
sessionStoreOptions.expiration = 86400000;

const sessionStore = new MySQLStore(sessionStoreOptions);

// ============================================
// إعدادات Express
// ============================================
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride('_method'));

// Session
app.use(session({
  secret: process.env.SESSION_SECRET || 'support_center_secret_key_2024',
  resave: false,
  saveUninitialized: false,
  store: sessionStore,
  cookie: { maxAge: 24 * 60 * 60 * 1000 } // 24 hours
}));

app.use(flash());

// المتغيرات المشتركة في جميع القوالب
app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  res.locals.success = req.flash('success');
  res.locals.error = req.flash('error');
  next();
});

// ============================================
// المسارات
// ============================================
app.get('/', (req, res) => res.redirect('/register'));

app.use('/auth', require('./routes/auth'));
app.use('/register', require('./routes/student'));
app.use('/teacher', require('./routes/teacher'));
app.use('/admin', require('./routes/admin'));

// 404
app.use((req, res) => {
  res.status(404).render('404', { title: 'الصفحة غير موجودة', user: req.session.user || null });
});

// ============================================
// تشغيل الخادم
// ============================================
app.listen(PORT, () => {
  console.log(`\n🚀 المركز يعمل على: http://localhost:${PORT}`);
  console.log(`📝 استمارة التسجيل: http://localhost:${PORT}/register`);
  console.log(`👤 تسجيل دخول: http://localhost:${PORT}/auth/login`);
  console.log(`\n🔑 بيانات الأدمن الافتراضية:`);
  console.log(`   اسم المستخدم: admin`);
  console.log(`   كلمة المرور: password\n`);
});
