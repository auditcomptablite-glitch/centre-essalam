-- ============================================
-- مركز دروس الدعم - قاعدة البيانات
-- Support Center Database Schema
-- ============================================

-- Railway توفر قاعدة البيانات مسبقاً باسم "railway"
-- لا حاجة لـ CREATE DATABASE هنا
-- يمكن تشغيل هذا السكريبت مباشرة على قاعدة بيانات railway

-- ============================================
-- جدول المستخدمين (الأدمن والأساتذة)
-- ============================================
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    username VARCHAR(50) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    role ENUM('admin', 'teacher') NOT NULL DEFAULT 'teacher',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- جدول المواد الدراسية
-- ============================================
CREATE TABLE IF NOT EXISTS subjects (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE
);

-- ============================================
-- جدول المستويات الدراسية
-- ============================================
CREATE TABLE IF NOT EXISTS levels (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    sort_order INT DEFAULT 0
);

-- ============================================
-- جدول التلاميذ
-- ============================================
CREATE TABLE IF NOT EXISTS students (
    id INT AUTO_INCREMENT PRIMARY KEY,
    full_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    parent_phone VARCHAR(20),
    level_id INT NOT NULL,
    registration_date DATE DEFAULT (CURRENT_DATE),
    notes TEXT,
    financial_status ENUM('مدفوع', 'غير مدفوع', 'مدفوع جزئياً') DEFAULT 'غير مدفوع',
    amount_paid DECIMAL(10,2) DEFAULT 0.00,
    amount_due DECIMAL(10,2) DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (level_id) REFERENCES levels(id) ON DELETE RESTRICT
);

-- ============================================
-- جدول ربط التلاميذ بالمواد (Many-to-Many)
-- ============================================
CREATE TABLE IF NOT EXISTS student_subjects (
    id INT AUTO_INCREMENT PRIMARY KEY,
    student_id INT NOT NULL,
    subject_id INT NOT NULL,
    enrollment_date DATE DEFAULT (CURRENT_DATE),
    UNIQUE KEY unique_enrollment (student_id, subject_id),
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE
);

-- ============================================
-- جدول الحصص (Sessions)
-- ============================================
CREATE TABLE IF NOT EXISTS sessions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    subject_id INT NOT NULL,
    level_id INT NOT NULL,
    teacher_id INT NOT NULL,
    session_date DATE NOT NULL,
    session_time TIME,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
    FOREIGN KEY (level_id) REFERENCES levels(id) ON DELETE CASCADE,
    FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ============================================
-- جدول تسجيل الحضور والغياب
-- ============================================
CREATE TABLE IF NOT EXISTS attendance (
    id INT AUTO_INCREMENT PRIMARY KEY,
    session_id INT NOT NULL,
    student_id INT NOT NULL,
    status ENUM('حاضر', 'غائب', 'متأخر') NOT NULL DEFAULT 'حاضر',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_attendance (session_id, student_id),
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
);

-- ============================================
-- جدول المدفوعات
-- ============================================
CREATE TABLE IF NOT EXISTS payments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    student_id INT NOT NULL,
    subject_id INT,
    amount DECIMAL(10,2) NOT NULL,
    payment_date DATE DEFAULT (CURRENT_DATE),
    payment_month VARCHAR(20),
    payment_year INT,
    status ENUM('مدفوع', 'غير مدفوع', 'مدفوع جزئياً') DEFAULT 'مدفوع',
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE SET NULL
);

-- ============================================
-- البيانات الأساسية (Seed Data)
-- ============================================

-- المستويات الدراسية
INSERT IGNORE INTO levels (name, sort_order) VALUES
('الابتدائي', 1),
('الأولى إعدادي', 2),
('الثانية إعدادي', 3),
('الثالثة إعدادي', 4),
('الجذع مشترك', 5),
('الأولى باكالوريا', 6),
('الثانية باكالوريا', 7);

-- المواد الدراسية
INSERT IGNORE INTO subjects (name) VALUES
('الرياضيات'),
('الفيزياء'),
('العلوم الطبيعية'),
('الفرنسية'),
('الآداب'),
('الاقتصاد'),
('علوم المهندس'),
('الميكانيك'),
('الكهرباء');

-- المستخدم الأدمن الافتراضي (كلمة المرور: admin123)
-- تم تشفيرها بـ bcrypt rounds=10
INSERT IGNORE INTO users (name, username, password, role) VALUES
('مدير المركز', 'admin', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin');
-- ملاحظة: قم بتغيير كلمة المرور بعد أول تسجيل دخول!

-- ============================================
-- Views مفيدة للاستعلامات
-- ============================================

-- عرض التلاميذ مع موادهم ومستوياتهم
CREATE OR REPLACE VIEW view_students_full AS
SELECT 
    s.id,
    s.full_name,
    s.phone,
    s.parent_phone,
    l.name AS level_name,
    GROUP_CONCAT(sub.name ORDER BY sub.name SEPARATOR '، ') AS subjects,
    s.financial_status,
    s.amount_paid,
    s.amount_due,
    s.registration_date
FROM students s
JOIN levels l ON s.level_id = l.id
LEFT JOIN student_subjects ss ON s.id = ss.student_id
LEFT JOIN subjects sub ON ss.subject_id = sub.id
GROUP BY s.id;

-- إحصائيات الحضور لكل تلميذ
CREATE OR REPLACE VIEW view_attendance_stats AS
SELECT 
    s.id AS student_id,
    s.full_name,
    sub.name AS subject_name,
    l.name AS level_name,
    COUNT(CASE WHEN a.status = 'حاضر' THEN 1 END) AS present_count,
    COUNT(CASE WHEN a.status = 'غائب' THEN 1 END) AS absent_count,
    COUNT(CASE WHEN a.status = 'متأخر' THEN 1 END) AS late_count,
    COUNT(a.id) AS total_sessions
FROM students s
JOIN student_subjects ss ON s.id = ss.student_id
JOIN subjects sub ON ss.subject_id = sub.id
JOIN levels l ON s.level_id = l.id
LEFT JOIN sessions ses ON ses.subject_id = ss.subject_id AND ses.level_id = s.level_id
LEFT JOIN attendance a ON a.session_id = ses.id AND a.student_id = s.id
GROUP BY s.id, sub.id;
