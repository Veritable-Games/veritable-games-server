#!/usr/bin/env node
/**
 * Fix Truncated Password Hashes Migration
 *
 * Problem: Password hashes in users.users are truncated to 24 characters
 * Solution: Copy correct 60-character bcrypt hashes from auth.users → users.users
 *
 * Date: November 6, 2025
 * Safe to run multiple times (idempotent)
 */

const { Pool } = require('pg');

async function fixTruncatedPasswordHashes() {
  const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;

  if (!connectionString) {
    console.error('❌ POSTGRES_URL or DATABASE_URL environment variable not set');
    process.exit(1);
  }

  const pool = new Pool({ connectionString });

  try {
    console.log('🔍 Checking for truncated password hashes in users.users table...');

    // Check if fix is needed
    const checkQuery = `
      SELECT COUNT(*) as count
      FROM users.users
      WHERE LENGTH(password_hash) < 60 AND LENGTH(password_hash) > 0
    `;

    const checkResult = await pool.query(checkQuery);
    const truncatedCount = parseInt(checkResult.rows[0].count);

    if (truncatedCount === 0) {
      console.log('✅ No truncated password hashes found - migration not needed');
      await pool.end();
      return { success: true, fixed: 0, message: 'No truncated hashes found' };
    }

    console.log(`⚠️  Found ${truncatedCount} user(s) with truncated password hashes`);

    // Get details of affected users
    const detailsQuery = `
      SELECT username, LENGTH(password_hash) as hash_length
      FROM users.users
      WHERE LENGTH(password_hash) < 60 AND LENGTH(password_hash) > 0
    `;
    const detailsResult = await pool.query(detailsQuery);
    console.log('📋 Affected users:');
    detailsResult.rows.forEach(row => {
      console.log(`   - ${row.username}: ${row.hash_length} chars (should be 60)`);
    });

    console.log('📝 Copying correct password hashes from auth.users → users.users...');

    // Copy correct hashes from auth.users to users.users
    const updateQuery = `
      UPDATE users.users u
      SET password_hash = a.password_hash
      FROM auth.users a
      WHERE u.id = a.id
        AND LENGTH(u.password_hash) < 60
        AND LENGTH(u.password_hash) > 0
        AND LENGTH(a.password_hash) = 60
    `;

    const result = await pool.query(updateQuery);
    console.log(`✅ Fixed ${result.rowCount} password hash(es)`);

    // Verify fix
    const verifyQuery = `
      SELECT COUNT(*) as count
      FROM users.users
      WHERE LENGTH(password_hash) < 60 AND LENGTH(password_hash) > 0
    `;
    const verifyResult = await pool.query(verifyQuery);
    const remaining = parseInt(verifyResult.rows[0].count);

    if (remaining === 0) {
      console.log('✅ All password hashes fixed successfully!');

      // Show sample of fixed hashes (first 10 chars only for security)
      const sampleQuery = `
        SELECT username, LEFT(password_hash, 10) as hash_prefix, LENGTH(password_hash) as length
        FROM users.users
        LIMIT 3
      `;
      const sampleResult = await pool.query(sampleQuery);
      console.log('📊 Sample of corrected hashes:');
      sampleResult.rows.forEach(row => {
        console.log(`   - ${row.username}: ${row.hash_prefix}... (${row.length} chars)`);
      });

      await pool.end();
      return { success: true, fixed: result.rowCount, message: 'All hashes fixed' };
    } else {
      console.warn(`⚠️  ${remaining} hash(es) still truncated (may not exist in auth.users)`);
      await pool.end();
      return {
        success: false,
        fixed: result.rowCount,
        remaining,
        message: 'Some hashes could not be fixed',
      };
    }
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('Stack trace:', error.stack);
    await pool.end();
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  fixTruncatedPasswordHashes()
    .then(result => {
      console.log('\n📋 Migration Summary:');
      console.log(`   Success: ${result.success}`);
      console.log(`   Fixed: ${result.fixed} user(s)`);
      console.log(`   Message: ${result.message}`);
      process.exit(result.success ? 0 : 1);
    })
    .catch(error => {
      console.error('\n❌ Migration failed with error:', error.message);
      process.exit(1);
    });
}

module.exports = { fixTruncatedPasswordHashes };
