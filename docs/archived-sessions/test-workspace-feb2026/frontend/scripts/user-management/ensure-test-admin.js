#!/usr/bin/env node

/**
 * ⚠️ DEPRECATED - DO NOT USE ⚠️
 *
 * This script is DISABLED for security reasons.
 * It previously reset the admin password to a weak test password.
 *
 * SECURITY ISSUE: This script would overwrite admin passwords without safeguards.
 * See: docs/forums/SECURITY_ISSUE_E2E_ADMIN_PASSWORD.md
 *
 * ALTERNATIVE: Use .claude-credentials file with dedicated test account.
 *
 * If you need to reset admin password for legitimate reasons, use:
 *   npm run user:reset-admin-password
 */

console.error('');
console.error('❌ ERROR: This script is DISABLED for security reasons.');
console.error('');
console.error('This script previously reset admin passwords to weak test passwords.');
console.error('');
console.error('INSTEAD:');
console.error('  1. Use .claude-credentials file for test authentication');
console.error('  2. Create dedicated test account (NOT admin)');
console.error('  3. See: docs/forums/SECURITY_ISSUE_E2E_ADMIN_PASSWORD.md');
console.error('');
console.error('To reset admin password (with confirmation):');
console.error('  npm run user:reset-admin-password');
console.error('');
process.exit(1);

// ORIGINAL CODE BELOW IS DISABLED
// DO NOT RE-ENABLE WITHOUT ADDING PROPER SAFEGUARDS

/*
require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

async function ensureTestAdmin() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL,
    ssl: process.env.POSTGRES_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
  });

  try {
    const TEST_PASSWORD = 'admin123';

    // DISABLED CODE - See comment at top of file
    // Find admin user
    // const adminResult = await pool.query(
    //   `SELECT id, username, email FROM users.users WHERE role = 'admin' OR username = 'admin' LIMIT 1`
    // );

    // if (adminResult.rows.length === 0) {
    //   console.log('⚠️  Admin user not found - tests may fail');
    //   console.log('   Run: npm run user:reset-admin-password to create admin user');
    //   process.exit(0); // Don't fail - let tests handle missing user
    // }

    // const admin = adminResult.rows[0];
    // console.log(`Found admin user: ${admin.username} (ID: ${admin.id})`);

    // Hash the test password
    // const passwordHash = await bcrypt.hash(TEST_PASSWORD, 12);

    // Update admin password
    // await pool.query(`UPDATE users.users SET password_hash = $1 WHERE id = $2`, [
    //   passwordHash,
    //   admin.id,
    // ]);

    // console.log(`✅ Admin password set to '${TEST_PASSWORD}' for testing`);

    // Verify login works by checking password
    // const verifyResult = await pool.query(`SELECT password_hash FROM users.users WHERE id = $1`, [
    //   admin.id,
    // ]);

    // const isValid = await bcrypt.compare(TEST_PASSWORD, verifyResult.rows[0].password_hash);
    // if (isValid) {
    //   console.log('✅ Password verified - admin login ready');
    // } else {
    //   console.log('⚠️  Password verification failed');
    // }
  } catch (error) {
    console.error('❌ Failed to setup test admin:', error.message);
    // Don't fail - let tests handle auth errors
  } finally {
    await pool.end();
  }
}

// ensureTestAdmin();
*/
