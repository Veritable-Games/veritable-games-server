#!/usr/bin/env node

/**
 * Reset Admin Password Script - SQLite Version
 *
 * ⚠️ DEVELOPMENT ONLY - SQLite Admin Password Reset
 *
 * Resets the admin user password in the SQLite auth.db (development only).
 * Use this to regain admin access to the development environment.
 *
 * IMPORTANT: Change the password immediately after logging in!
 *
 * For production password resets, use: node scripts/user-management/reset-admin-password-postgres.js
 */

// Safety guard: Prevent production usage
const isProduction = process.env.NODE_ENV === 'production';
if (isProduction && !process.env.ALLOW_SQLITE_IN_PRODUCTION) {
  console.error(
    '[ERROR] SQLite Admin Password Reset cannot run in production.\n' +
      'This script only works with SQLite (development).\n' +
      'For production password resets, use: reset-admin-password-postgres.js\n' +
      'Production database: PostgreSQL 15\n'
  );
  process.exit(1);
}

const bcrypt = require('bcryptjs');
const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'data', 'auth.db');

console.log('🔧 Admin Password Reset Tool\n');
console.log('Database:', dbPath);
console.log('');

try {
  const db = new Database(dbPath);

  // Check if admin user exists
  const admin = db.prepare('SELECT id, username FROM users WHERE username = ?').get('admin');

  if (!admin) {
    console.error('❌ Admin user not found in database!');
    console.log('\nChecking for other admin users...');

    const admins = db.prepare('SELECT id, username FROM users WHERE role = ?').all('admin');

    if (admins.length === 0) {
      console.error('❌ No admin users found in the system!');
      console.log('\n📋 Available users:');
      const allUsers = db.prepare('SELECT id, username, role FROM users').all();
      allUsers.forEach(user => {
        console.log(`   ${user.id}. ${user.username} (${user.role})`);
      });
    } else {
      console.log('\n📋 Found these admin users:');
      admins.forEach(user => {
        console.log(`   ${user.id}. ${user.username}`);
      });
    }

    db.close();
    process.exit(1);
  }

  console.log(`✅ Found admin user: ${admin.username} (ID: ${admin.id})`);
  console.log('');

  // Set new password
  const newPassword = 'Admin123!';
  console.log('🔑 Generating secure password hash...');

  const hash = bcrypt.hashSync(newPassword, 12);

  console.log('💾 Updating database...');

  db.prepare('UPDATE users SET password_hash = ? WHERE username = ?').run(hash, 'admin');

  console.log('');
  console.log('='.repeat(60));
  console.log('✅ ADMIN PASSWORD RESET SUCCESSFUL');
  console.log('='.repeat(60));
  console.log('');
  console.log('📋 Login Credentials:');
  console.log('   Username: admin');
  console.log('   Password: Admin123!');
  console.log('');
  console.log('🌐 Login URL:');
  console.log('   http://localhost:3001/auth/login');
  console.log('   (or http://localhost:3000/auth/login if port 3000 is available)');
  console.log('');
  console.log('⚠️  SECURITY WARNING:');
  console.log('   This is a TEMPORARY password!');
  console.log('   After logging in, immediately:');
  console.log('   1. Go to /settings');
  console.log('   2. Change your password to something secure');
  console.log('   3. Do NOT share this password with anyone');
  console.log('');

  db.close();
} catch (error) {
  console.error('❌ Error resetting password:', error.message);
  console.error('\nFull error:', error);
  process.exit(1);
}
