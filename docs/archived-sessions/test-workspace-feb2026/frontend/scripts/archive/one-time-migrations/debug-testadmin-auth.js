#!/usr/bin/env node

const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');

// Connect to users database
const dbPath = path.join(process.cwd(), 'data', 'users.db');
const db = new Database(dbPath);

console.log('\n🔍 Debugging testadmin authentication issue...\n');

// 1. Check if user exists
const user = db.prepare('SELECT * FROM users WHERE username = ?').get('testadmin');

if (!user) {
  console.log('❌ User testadmin not found in database!');
  process.exit(1);
}

console.log('✅ User found:');
console.log('  ID:', user.id);
console.log('  Username:', user.username);
console.log('  Email:', user.email);
console.log('  Role:', user.role);
console.log('  Is Active:', user.is_active);
console.log('  Password hash exists:', !!user.password_hash);
console.log('  Password hash length:', user.password_hash?.length);

// 2. Test password verification
const testPassword = 'testpassword123';
console.log('\n📊 Testing password verification...');
console.log('  Testing with:', testPassword);

try {
  const isMatch = bcrypt.compareSync(testPassword, user.password_hash);
  console.log('  bcrypt.compareSync result:', isMatch);

  if (!isMatch) {
    console.log('\n  ❌ Password does not match!');
    console.log('  First 10 chars of hash:', user.password_hash.substring(0, 10));
  } else {
    console.log('  ✅ Password matches!');
  }
} catch (error) {
  console.log('  ❌ Error during password comparison:', error.message);
}

// 3. Test SQL query that auth service uses
console.log('\n📊 Testing auth service SQL query...');
const query = `
  SELECT * FROM users
  WHERE (username = ? OR email = ?) AND is_active = 1
`;

const userFromQuery = db.prepare(query).get('testadmin', 'testadmin');

if (userFromQuery) {
  console.log('  ✅ User found with auth query');
  console.log('  ID:', userFromQuery.id);
} else {
  console.log('  ❌ User NOT found with auth query!');
  console.log('  This is why authentication is failing.');
}

// 4. Check what happens with is_active
console.log('\n📊 Checking is_active values...');
const allTestUsers = db
  .prepare('SELECT username, email, is_active FROM users WHERE username LIKE ?')
  .all('%test%');
console.log('  Test users in database:');
allTestUsers.forEach(u => {
  console.log(
    `    ${u.username} (${u.email}) - is_active: ${u.is_active} (type: ${typeof u.is_active})`
  );
});

// 5. Try direct query without is_active filter
console.log('\n📊 Query without is_active filter...');
const userWithoutActive = db
  .prepare('SELECT * FROM users WHERE username = ? OR email = ?')
  .get('testadmin', 'testadmin');
if (userWithoutActive) {
  console.log('  ✅ User found without is_active filter');
  console.log(
    '  is_active value:',
    userWithoutActive.is_active,
    'type:',
    typeof userWithoutActive.is_active
  );
}

db.close();
console.log('\n✅ Debug complete\n');
