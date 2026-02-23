const Database = require('better-sqlite3');

const authDb = new Database('./data/auth.db');
const usersDb = new Database('./data/users.db');

console.log('=== AUTH DATABASE (auth.db) ===');
const authUsers = authDb
  .prepare('SELECT id, username, email, role, password_hash FROM users LIMIT 5')
  .all();
authUsers.forEach(user => {
  console.log(
    `  ${user.username} (${user.role}): ${user.password_hash ? 'HAS PASSWORD' : 'NO PASSWORD'}`
  );
});

console.log('\n=== USERS DATABASE (users.db) ===');
const userDbUsers = usersDb
  .prepare('SELECT id, username, email, role, password_hash FROM users LIMIT 5')
  .all();
userDbUsers.forEach(user => {
  console.log(
    `  ${user.username} (${user.role}): ${user.password_hash ? 'HAS PASSWORD' : 'NO PASSWORD'}`
  );
});

// Check admin specifically
console.log('\n=== ADMIN USER CHECK ===');
const adminAuth = authDb
  .prepare('SELECT id, username, password_hash FROM users WHERE username = ?')
  .get('admin');
const adminUsers = usersDb
  .prepare('SELECT id, username, password_hash FROM users WHERE username = ?')
  .get('admin');

console.log(
  'auth.db admin:',
  adminAuth
    ? `Found (ID ${adminAuth.id}), Password: ${adminAuth.password_hash ? adminAuth.password_hash.substring(0, 15) + '...' : 'MISSING'}`
    : 'NOT FOUND'
);
console.log(
  'users.db admin:',
  adminUsers
    ? `Found (ID ${adminUsers.id}), Password: ${adminUsers.password_hash ? adminUsers.password_hash.substring(0, 15) + '...' : 'MISSING'}`
    : 'NOT FOUND'
);

authDb.close();
usersDb.close();
