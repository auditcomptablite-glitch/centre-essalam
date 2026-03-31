# 🎓 مركز دروس الدعم — Support Center Management System

نظام متكامل لإدارة مركز دروس الدعم مبني بـ **Node.js + Express + MySQL**.

---

## 🚀 التشغيل المحلي (Local Setup)

### 1. تثبيت المتطلبات
```bash
npm install
```

### 2. إعداد قاعدة البيانات
- افتح **DBeaver** وتصل بـ MySQL
- أنشئ قاعدة بيانات جديدة: `support_center`
- شغّل ملف `schema.sql` كاملاً (File > Execute SQL Script)

### 3. إعداد ملف البيئة
```bash
cp .env.example .env
```
ثم عدّل `.env` بمعلومات قاعدة البيانات الخاصة بك:
```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=support_center
SESSION_SECRET=your_random_secret_here
```

### 4. تشغيل التطبيق
```bash
# وضع التطوير (مع إعادة التشغيل التلقائي)
npm run dev

# وضع الإنتاج
npm start
```

التطبيق سيعمل على: **http://localhost:3000**

---

## 🔑 بيانات الدخول الافتراضية

| الدور | اسم المستخدم | كلمة المرور |
|-------|-------------|------------|
| Admin | `admin` | `password` |

> ⚠️ **مهم:** غيّر كلمة المرور فوراً من قاعدة البيانات!

لتغيير كلمة المرور، شغّل في Node.js:
```javascript
const bcrypt = require('bcryptjs');
bcrypt.hash('كلمة_المرور_الجديدة', 10).then(console.log);
```
ثم حدّث قاعدة البيانات:
```sql
UPDATE users SET password = 'الهاش_الجديد' WHERE username = 'admin';
```

---

## 📁 هيكل المشروع

```
support-center/
├── server.js              # نقطة البدء الرئيسية
├── schema.sql             # قاعدة البيانات (MySQL)
├── .env.example           # قالب متغيرات البيئة
├── package.json
├── config/
│   └── database.js        # إعداد الاتصال بـ MySQL
├── middleware/
│   └── auth.js            # التحقق من الصلاحيات
├── routes/
│   ├── auth.js            # تسجيل الدخول/الخروج
│   ├── student.js         # استمارة التسجيل
│   ├── teacher.js         # لوحة الأستاذ
│   └── admin.js           # لوحة الإدارة
├── views/
│   ├── layout.ejs         # القالب الرئيسي
│   ├── 404.ejs
│   ├── auth/login.ejs
│   ├── student/register.ejs
│   ├── teacher/
│   │   ├── dashboard.ejs
│   │   ├── attendance-history.ejs
│   │   └── session-detail.ejs
│   └── admin/
│       ├── dashboard.ejs
│       ├── students.ejs
│       ├── student-detail.ejs
│       ├── teachers.ejs
│       ├── attendance.ejs
│       └── finance.ejs
└── public/
    ├── css/main.css
    └── js/main.js
```

---

## ☁️ النشر على Railway

### الخطوات:
1. ارفع المشروع على **GitHub**:
```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/yourusername/support-center.git
git push -u origin main
```

2. في **Railway** (railway.app):
   - New Project → Deploy from GitHub repo
   - أضف **MySQL Plugin** (Add Service → MySQL)
   - من MySQL service، انسخ `DATABASE_URL`

3. في إعدادات المشروع (Variables):
```
DATABASE_URL=mysql://...  (انسخ من Railway MySQL)
SESSION_SECRET=your_random_long_secret
NODE_ENV=production
PORT=3000
```

4. Railway سينشر تلقائياً عند كل push!

### إنشاء الجداول على Railway:
- في Railway، افتح MySQL Service → Query
- الصق محتوى `schema.sql` وشغّله

---

## 📊 المسارات (Routes)

| المسار | الوصف | الصلاحية |
|--------|-------|---------|
| `GET /register` | استمارة تسجيل التلميذ | عام |
| `POST /register` | إرسال طلب التسجيل | عام |
| `GET /auth/login` | صفحة تسجيل الدخول | عام |
| `POST /auth/login` | تسجيل الدخول | عام |
| `GET /auth/logout` | تسجيل الخروج | مسجل |
| `GET /teacher/dashboard` | لوحة الأستاذ | أستاذ |
| `GET /teacher/students` | قائمة التلاميذ (JSON) | أستاذ |
| `POST /teacher/session` | تسجيل حصة وحضور | أستاذ |
| `GET /teacher/attendance-history` | سجل الحصص | أستاذ |
| `GET /admin/dashboard` | لوحة الإدارة | أدمن |
| `GET /admin/students` | قائمة التلاميذ | أدمن |
| `GET /admin/students/:id` | تفاصيل تلميذ | أدمن |
| `POST /admin/students/:id` | تعديل بيانات | أدمن |
| `GET /admin/teachers` | إدارة الأساتذة | أدمن |
| `POST /admin/teachers` | إضافة أستاذ | أدمن |
| `GET /admin/attendance` | سجل الحضور الكامل | أدمن |
| `GET /admin/finance` | الإدارة المالية | أدمن |
| `POST /admin/students/:id/payment` | تسجيل دفعة | أدمن |

---

## 💡 نصائح للاستخدام

- **ربط بـ Excel/Power BI:** استخدم DBeaver لتصدير جداول `payments` و`students` إلى CSV ثم استوردها في Excel
- **النسخ الاحتياطي:** في DBeaver، كليك يمين على قاعدة البيانات → Tools → Dump Database
- **إضافة أستاذ:** من لوحة الأدمن → الأساتذة → إضافة أستاذ جديد

---

## 🛡️ الأمان

- كلمات المرور مشفرة بـ **bcrypt** (10 rounds)
- الجلسات محمية بـ **express-session**
- التحقق من الصلاحيات على كل مسار
- **لا يوجد** حساب للتلاميذ — الاستمارة عامة ومجهولة

---

Made with ❤️ for Moroccan education centers
