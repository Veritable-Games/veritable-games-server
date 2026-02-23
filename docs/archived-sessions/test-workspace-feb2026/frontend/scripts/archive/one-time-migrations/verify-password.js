#!/usr/bin/env node

const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');

// Connect to users database
const dbPath = path.join(process.cwd(), 'data', 'users.db');
const db = new Database(dbPath);

// Get test user's password hash
console.log('\n📊 Verifying test user password...\n');
const user = db
  .prepare('SELECT username, email, password_hash FROM users WHERE username = ?')
  .get('testadmin');

if (user) {
  console.log('User found:', user.username);

  const testPassword = 'testpassword123';
  console.log('Testing password:', testPassword);

  // Check if password matches
  const isMatch = bcrypt.compareSync(testPassword, user.password_hash);

  if (isMatch) {
    console.log('✅ Password verification successful!');
  } else {
    console.log('❌ Password verification failed!');
    console.log('\nRegenerating password hash...');

    // Generate new hash
    const newHash = bcrypt.hashSync(testPassword, 12);

    // Update database
    const stmt = db.prepare('UPDATE users SET password_hash = ? WHERE username = ?');
    const result = stmt.run(newHash, 'testadmin');

    if (result.changes > 0) {
      console.log('✅ Password hash updated successfully!');

      // Verify again
      const isMatchNow = bcrypt.compareSync(testPassword, newHash);
      console.log('Verification after update:', isMatchNow ? '✅ Success' : '❌ Failed');
    }
  }
} else {
  console.log('❌ Test user not found');
}

db.close();
console.log('\nDone!\n');
