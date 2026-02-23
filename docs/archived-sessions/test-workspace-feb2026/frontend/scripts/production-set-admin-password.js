#!/usr/bin/env node
/**
 * Emergency Admin Password Setter for Production
 *
 * This script sets the admin password to match your local environment.
 * Run this ONLY on production server after deployment.
 *
 * Usage:
 *   ssh into production server
 *   cd /path/to/deployed/app/frontend
 *   node scripts/production-set-admin-password.js
 */

const bcrypt = require('bcryptjs');
const Database = require('better-sqlite3');
const path = require('path');

// Your production password (matches local)
const PASSWORD = 'Qt2rctLAeGuRlfGFMPHE4FIH';

console.log('🔧 Production Admin Password Setter\n');

try {
  const dbPath = path.join(process.cwd(), 'data', 'users.db');
  console.log('Database path:', dbPath);

  const db = new Database(dbPath);

  // Check for admin user
  const admin = db.prepare('SELECT id, username FROM users WHERE username = ?').get('admin');

  if (!admin) {
    console.error('❌ Admin user not found!');

    // Create admin user if missing
    console.log('Creating admin user...');
    const hash = bcrypt.hashSync(PASSWORD, 12);
    db.prepare(
      `
      INSERT INTO users (username, email, password_hash, role, created_at, updated_at, is_active)
      VALUES (?, ?, ?, ?, datetime('now'), datetime('now'), 1)
    `
    ).run('admin', 'admin@veritablegames.com', hash, 'admin');

    console.log('✅ Admin user created');
  } else {
    console.log(`✅ Found admin user: ${admin.username} (ID: ${admin.id})`);
    console.log('🔑 Updating password...');

    const hash = bcrypt.hashSync(PASSWORD, 12);
    db.prepare('UPDATE users SET password_hash = ? WHERE username = ?').run(hash, 'admin');

    console.log('✅ Password updated successfully!');
  }

  console.log('\n📋 Production Credentials:');
  console.log('   Username: admin');
  console.log('   Password: Qt2rctLAeGuRlfGFMPHE4FIH');
  console.log('\n🌐 Login URL: http://192.168.1.15:3000/auth/login');
  console.log('\n⚠️  SECURITY: Store this password securely!');

  db.close();
} catch (error) {
  console.error('❌ Error:', error.message);
  console.error('\nFull error:', error);
  process.exit(1);
}
