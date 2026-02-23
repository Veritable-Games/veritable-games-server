#!/usr/bin/env node

const Database = require('better-sqlite3');
const path = require('path');

// Connect to users database
const dbPath = path.join(process.cwd(), 'data', 'users.db');
const db = new Database(dbPath);

// Check test user status
console.log('\n📊 Checking test user status...\n');
const user = db
  .prepare('SELECT username, email, role, is_active FROM users WHERE username = ?')
  .get('testadmin');

if (user) {
  console.log('Test user details:');
  console.log('  Username:', user.username);
  console.log('  Email:', user.email);
  console.log('  Role:', user.role);
  console.log('  Is Active:', user.is_active);

  if (!user.is_active) {
    console.log('\n⚠️  User is not active! Activating...');
    const stmt = db.prepare('UPDATE users SET is_active = 1 WHERE username = ?');
    const result = stmt.run('testadmin');

    if (result.changes > 0) {
      console.log('✅ User activated successfully!');
    }
  } else {
    console.log('\n✅ User is already active');
  }
} else {
  console.log('❌ Test user not found');
}

db.close();
console.log('\nDone!\n');
