const mysql = require('mysql2/promise');
require('dotenv').config();

let pool;

// دعم Railway MYSQL_URL أو MYSQL_PUBLIC_URL أو الإعدادات الفردية
const mysqlUrl = process.env.MYSQL_URL || process.env.MYSQL_PUBLIC_URL;

if (mysqlUrl) {
  pool = mysql.createPool(mysqlUrl + '?charset=utf8mb4&waitForConnections=true&connectionLimit=10&queueLimit=0');
} else {
  pool = mysql.createPool({
    host:     process.env.MYSQLHOST     || process.env.DB_HOST     || 'localhost',
    port:     process.env.MYSQLPORT     || process.env.DB_PORT     || 3306,
    user:     process.env.MYSQLUSER     || process.env.DB_USER     || 'root',
    password: process.env.MYSQLPASSWORD || process.env.DB_PASSWORD || '',
    database: process.env.MYSQLDATABASE || process.env.DB_NAME     || 'railway',
    charset: 'utf8mb4',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  });
}

// اختبار الاتصال عند البدء
pool.getConnection()
  .then(conn => {
    console.log('✅ تم الاتصال بقاعدة البيانات بنجاح');
    conn.release();
  })
  .catch(err => {
    console.error('❌ خطأ في الاتصال بقاعدة البيانات:', err.message);
  });

module.exports = pool;
