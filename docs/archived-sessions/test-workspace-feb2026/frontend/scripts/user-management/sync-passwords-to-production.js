#!/usr/bin/env node

/**
 * Sync passwords to production PostgreSQL
 *
 * Sets specific passwords to match localhost development database
 */

require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

// Passwords to sync from localhost
const ADMIN_PASSWORD = 'euZe3CTvcDqqsVz';
const TEST_PASSWORD = 'm8vBmxHEtq5MT6';

async function syncPasswords() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.POSTGRES_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
  });

  try {
    console.log('🔧 PostgreSQL Password Sync Tool\n');
    console.log('Database:', process.env.DATABASE_URL?.split('@')[1] || 'localhost');

    // Hash passwords
    console.log('\n📝 Hashing passwords...');
    const adminHash = await bcrypt.hash(ADMIN_PASSWORD, 12);
    const testHash = await bcrypt.hash(TEST_PASSWORD, 12);
    console.log('✅ Passwords hashed');

    // Find admin user in USERS schema
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

    // Update admin password
    console.log('\n🔄 Updating admin password...');
    await pool.query(
      `UPDATE users.users SET password_hash = $1, updated_at = NOW() WHERE id = $2`,
      [adminHash, admin.id]
    );
    console.log('✅ Admin password synced');

    // Find test user
    console.log('\n🔍 Finding test user in users schema...');
    let testResult = await pool.query(
      `SELECT id, username, email FROM users.users
       WHERE username IN ('testuser', 'test')
          OR email = 'test@veritablegames.com'
       LIMIT 1`
    );

    let testUser;
    if (testResult.rows.length === 0) {
      console.log('📝 Test user not found, creating...');

      // Create test user
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

      // Update test password
      console.log('\n🔄 Updating test user password...');
      await pool.query(
        `UPDATE users.users SET password_hash = $1, updated_at = NOW() WHERE id = $2`,
        [testHash, testUser.id]
      );
      console.log('✅ Test user password synced');
    }

    console.log('\n' + '='.repeat(70));
    console.log('✅ Password sync complete!');
    console.log('='.repeat(70));
    console.log('\n📋 Synced Credentials:');
    console.log('\nAdmin:');
    console.log(`   Username: ${admin.username}`);
    console.log(`   Password: ${ADMIN_PASSWORD}`);
    console.log('\nTest User:');
    console.log(`   Username: ${testUser.username}`);
    console.log(`   Password: ${TEST_PASSWORD}`);
    console.log('\n' + '='.repeat(70));
    console.log('✅ Both localhost and production (192.168.1.15:3000) now use same passwords');
    console.log('='.repeat(70));
    console.log('');
  } catch (error) {
    console.error('\n❌ Error syncing passwords:', error.message);
    console.error('\nFull error:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run the script
syncPasswords()
  .then(() => {
    process.exit(0);
  })
  .catch(error => {
    console.error('Unexpected error:', error);
    process.exit(1);
  });
