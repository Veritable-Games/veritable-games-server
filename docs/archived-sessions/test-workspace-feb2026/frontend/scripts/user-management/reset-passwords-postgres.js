#!/usr/bin/env node

/**
 * Reset user passwords for PostgreSQL
 *
 * Generates cryptographically secure random passwords
 */

require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

/**
 * Generate a cryptographically secure random password
 * Format: base58 encoding (no ambiguous characters like 0, O, I, l)
 */
function generateSecurePassword(length = 15) {
  const base58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  const randomBytes = crypto.randomBytes(length);
  let password = '';

  for (let i = 0; i < length; i++) {
    password += base58[randomBytes[i] % base58.length];
  }

  return password;
}

// Generate secure random passwords
const ADMIN_PASSWORD = generateSecurePassword(15);
const TEST_PASSWORD = generateSecurePassword(15);

async function resetPasswords() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.POSTGRES_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
  });

  try {
    console.log('🔧 PostgreSQL Password Reset Tool\n');
    console.log('Database:', process.env.DATABASE_URL?.split('@')[1] || 'localhost');

    // Hash passwords
    console.log('\n📝 Hashing passwords...');
    const adminHash = await bcrypt.hash(ADMIN_PASSWORD, 12);
    const testHash = await bcrypt.hash(TEST_PASSWORD, 12);
    console.log('✅ Passwords hashed');

    // Find admin user in USERS schema (this is where auth service checks)
    console.log('\n🔍 Finding admin user in users schema...');
    const adminResult = await pool.query(
      `SELECT id, username, email FROM users.users WHERE role = 'admin' OR username = 'admin' LIMIT 1`
    );

    if (adminResult.rows.length === 0) {
      console.error('❌ Admin user not found in users schema!');
      console.log('\nSearching for any users...');
      const allUsers = await pool.query(
        `SELECT id, username, email, role FROM users.users LIMIT 10`
      );
      console.log('Users found:', allUsers.rows);
      process.exit(1);
    }

    const admin = adminResult.rows[0];
    console.log(`✅ Found admin: ${admin.username} (${admin.email})`);

    // Update admin password in USERS schema (where auth service checks)
    console.log('\n🔄 Updating admin password in users schema...');
    await pool.query(
      `UPDATE users.users SET password_hash = $1, updated_at = NOW() WHERE id = $2`,
      [adminHash, admin.id]
    );
    console.log('✅ Admin password updated in users schema');

    // Find or create test user in USERS schema (where auth service checks)
    console.log('\n🔍 Finding test user in users schema...');
    let testResult = await pool.query(
      `SELECT id, username, email FROM users.users
       WHERE username IN ('testuser', 'test')
          OR email = 'test@veritablegames.com'
       LIMIT 1`
    );

    let testUser;
    if (testResult.rows.length === 0) {
      console.log('📝 Test user not found, creating in users schema...');

      // Create test user (let PostgreSQL generate the ID)
      const createResult = await pool.query(
        `INSERT INTO users.users (username, email, password_hash, role, is_active, email_verified, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
         RETURNING id, username, email`,
        ['testuser', 'test@veritablegames.com', testHash, 'user', true, true]
      );

      testUser = createResult.rows[0];
      console.log(`✅ Test user created: ${testUser.username} (${testUser.email})`);
    } else {
      testUser = testResult.rows[0];
      console.log(`✅ Found test user: ${testUser.username} (${testUser.email})`);

      // Update test password in USERS schema
      console.log('\n🔄 Updating test user password in users schema...');
      await pool.query(
        `UPDATE users.users SET password_hash = $1, updated_at = NOW() WHERE id = $2`,
        [testHash, testUser.id]
      );
      console.log('✅ Test user password updated in users schema');
    }

    console.log('\n' + '='.repeat(70));
    console.log('✅ Password reset complete!');
    console.log('='.repeat(70));
    console.log('\n🔐 SECURE RANDOM PASSWORDS (SAVE THESE NOW!)');
    console.log('='.repeat(70));
    console.log('\n📋 Admin Credentials:');
    console.log(`   Username: ${admin.username}`);
    console.log(`   Email:    ${admin.email}`);
    console.log(`   Password: ${ADMIN_PASSWORD}`);
    console.log('\n📋 Test User Credentials:');
    console.log(`   Username: ${testUser.username}`);
    console.log(`   Email:    ${testUser.email}`);
    console.log(`   Password: ${TEST_PASSWORD}`);
    console.log('\n' + '='.repeat(70));
    console.log('⚠️  CRITICAL: These passwords are shown ONCE and cannot be recovered!');
    console.log('⚠️  Copy them to a secure password manager NOW!');
    console.log('⚠️  Change them immediately after first login!');
    console.log('='.repeat(70));
    console.log('');
  } catch (error) {
    console.error('\n❌ Error resetting passwords:', error.message);
    console.error('\nFull error:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run the script
resetPasswords()
  .then(() => {
    process.exit(0);
  })
  .catch(error => {
    console.error('Unexpected error:', error);
    process.exit(1);
  });
