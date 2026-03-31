/**
 * init-db.js
 * تهيئة قاعدة البيانات على Railway
 * Run once to create tables: node init-db.js
 */

require('dotenv').config();
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

async function initDatabase() {
  const mysqlUrl = process.env.MYSQL_URL || process.env.MYSQL_PUBLIC_URL;

  let connection;

  try {
    if (mysqlUrl) {
      connection = await mysql.createConnection(mysqlUrl + '?charset=utf8mb4&multipleStatements=true');
    } else {
      connection = await mysql.createConnection({
        host:     process.env.MYSQLHOST     || 'localhost',
        port:     process.env.MYSQLPORT     || 3306,
        user:     process.env.MYSQLUSER     || 'root',
        password: process.env.MYSQLPASSWORD || '',
        database: process.env.MYSQLDATABASE || 'railway',
        charset:  'utf8mb4',
        multipleStatements: true,
      });
    }

    console.log('✅ تم الاتصال بقاعدة البيانات');

    const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    await connection.query(schema);

    console.log('✅ تم تنفيذ schema.sql بنجاح — الجداول جاهزة!');
    console.log('\n🔑 بيانات الدخول الافتراضية:');
    console.log('   المستخدم : admin');
    console.log('   كلمة المرور : password');
    console.log('\n⚠️  غيّر كلمة المرور فور أول تسجيل دخول!\n');

  } catch (err) {
    console.error('❌ خطأ في تهيئة قاعدة البيانات:', err.message);
    process.exit(1);
  } finally {
    if (connection) await connection.end();
  }
}

initDatabase();
