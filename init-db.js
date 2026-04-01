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

    // 1. تنفيذ schema.sql
    const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    await connection.query(schema);
    console.log('✅ تم تنفيذ schema.sql بنجاح — الجداول جاهزة!');

    // 2. Migrations — بدون IF NOT EXISTS
    console.log('\n🔄 تشغيل Migrations...');

    // تحقق إذا sort_order موجود، إذا لا أضفه
    const [cols] = await connection.query(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'levels' 
      AND COLUMN_NAME = 'sort_order'
    `);

    if (cols.length === 0) {
      await connection.query(`ALTER TABLE levels ADD COLUMN sort_order INT DEFAULT 0`);
      console.log('   ✅ levels.sort_order ajoutée');
    } else {
      console.log('   ✅ levels.sort_order déjà présente');
    }

    // تحديث قيم sort_order
    await connection.query(`
      UPDATE levels SET sort_order = CASE name
        WHEN 'الابتدائي'          THEN 1
        WHEN 'الأولى إعدادي'     THEN 2
        WHEN 'الثانية إعدادي'    THEN 3
        WHEN 'الثالثة إعدادي'    THEN 4
        WHEN 'الجذع مشترك'       THEN 5
        WHEN 'الأولى باكالوريا'  THEN 6
        WHEN 'الثانية باكالوريا' THEN 7
        ELSE sort_order
      END
      WHERE sort_order = 0
    `);
    console.log('   ✅ قيم sort_order محدّثة');

    console.log('\n✅ جميع Migrations اكتملت بنجاح!');
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
