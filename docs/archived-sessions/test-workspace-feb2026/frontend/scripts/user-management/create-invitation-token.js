#!/usr/bin/env node
/**
 * Create Invitation Token Script
 *
 * Generates an invitation token for testing registration.
 * Usage: node create-invitation-token.js [admin-username] [days-valid]
 */

const Database = require('better-sqlite3');
const path = require('path');
const crypto = require('crypto');

const adminUsername = process.argv[2] || 'admin';
const daysValid = parseInt(process.argv[3]) || 30;

// Open databases
const authDbPath = path.join(__dirname, 'data', 'auth.db');
const usersDbPath = path.join(__dirname, 'data', 'users.db');

const authDb = new Database(authDbPath);
const usersDb = new Database(usersDbPath);

try {
  // Find admin user
  const adminUser = usersDb.prepare('SELECT id FROM users WHERE username = ? AND role = ?').get(adminUsername, 'admin');

  if (!adminUser) {
    console.error(\`❌ Admin user '\${adminUsername}' not found in users.db\`);
    console.error(\`   Available admins:\`);
    const admins = usersDb.prepare('SELECT username FROM users WHERE role = ?').all('admin');
    admins.forEach(a => console.error(\`   - \${a.username}\`));
    process.exit(1);
  }

  // Generate secure token
  const token = crypto.randomBytes(32).toString('hex');

  // Calculate expiration
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + daysValid);

  // Insert invitation
  const result = authDb.prepare(\`
    INSERT INTO invitations (
      token, created_by, email, expires_at, notes, max_uses, use_count, is_revoked
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  \`).run(
    token,
    adminUser.id,
    null, // No email restriction
    expiresAt.toISOString(),
    \`Generated via CLI script on \${new Date().toISOString()}\`,
    1, // Single use
    0, // Not yet used
    0  // Not revoked
  );

  console.log('✅ Invitation token created successfully!');
  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(\`   TOKEN: \${token}\`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  console.log(\`   Valid for: \${daysValid} days\`);
  console.log(\`   Expires: \${expiresAt.toLocaleString()}\`);
  console.log(\`   Created by: \${adminUsername} (ID: \${adminUser.id})\`);
  console.log(\`   Max uses: 1\`);
  console.log('');
  console.log('Copy this token and paste it into the "Invitation Token" field');
  console.log('when creating a new account at http://localhost:3001/auth/login');
  console.log('');

} catch (error) {
  console.error('❌ Error creating invitation token:', error.message);
  process.exit(1);
} finally {
  authDb.close();
  usersDb.close();
}
