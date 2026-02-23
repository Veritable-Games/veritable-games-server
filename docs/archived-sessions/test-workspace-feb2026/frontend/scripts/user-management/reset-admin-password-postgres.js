#!/usr/bin/env node

/**
 * PostgreSQL Admin Password Reset Tool
 *
 * Resets the admin user password in production PostgreSQL database
 * Uses the same secure password hashing (bcryptjs with cost 12) as login system
 */

require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function prompt(question) {
  return new Promise(resolve => {
    rl.question(question, answer => {
      resolve(answer);
    });
  });
}

async function resetAdminPassword() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL,
    ssl: process.env.POSTGRES_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
  });

  try {
    console.log('🔐 PostgreSQL Admin Password Reset Tool\n');
    console.log(
      'Database:',
      (process.env.DATABASE_URL || process.env.POSTGRES_URL)?.split('@')[1] || 'localhost'
    );

    // Find admin user
    console.log('\n🔍 Finding admin user...');
    const adminResult = await pool.query(
      `SELECT id, username, email FROM users.users WHERE role = 'admin' OR username = 'admin' LIMIT 1`
    );

    if (adminResult.rows.length === 0) {
      console.error('❌ Admin user not found!');
      console.log('\nSearching for any users...');
      const allUsers = await pool.query(
        `SELECT id, username, email, role FROM users.users LIMIT 10`
      );
      if (allUsers.rows.length > 0) {
        console.log('\nAvailable users:');
        allUsers.rows.forEach(user => {
          console.log(`   - ${user.username} (${user.email}) [${user.role}]`);
        });
      } else {
        console.log('   No users found in database');
      }
      process.exit(1);
    }

    const admin = adminResult.rows[0];
    console.log(`✅ Found admin user: ${admin.username} (${admin.email})`);

    // Prompt for new password
    console.log('\n📝 Setting new password...');
    console.log('⚠️  Password will be visible as you type');
    const newPassword = await prompt('Enter new admin password: ');

    if (!newPassword || newPassword.length < 8) {
      console.error('❌ Password must be at least 8 characters');
      process.exit(1);
    }

    // Confirm password
    const confirmPassword = await prompt('Confirm password: ');
    if (newPassword !== confirmPassword) {
      console.error('❌ Passwords do not match');
      process.exit(1);
    }

    // Hash password
    console.log('\n🔄 Hashing password (this may take a moment)...');
    const passwordHash = await bcrypt.hash(newPassword, 12);

    // Update password
    console.log('\n💾 Updating admin password in database...');
    const updateResult = await pool.query(
      `UPDATE users.users SET password_hash = $1, updated_at = NOW() WHERE id = $2 RETURNING username, email`,
      [passwordHash, admin.id]
    );

    if (updateResult.rows.length === 0) {
      console.error('❌ Failed to update password');
      process.exit(1);
    }

    const updated = updateResult.rows[0];

    console.log('\n' + '='.repeat(70));
    console.log('✅ Admin password reset successfully!');
    console.log('='.repeat(70));
    console.log(`\n📋 Updated User:`);
    console.log(`   Username: ${updated.username}`);
    console.log(`   Email: ${updated.email}`);
    console.log(`\n🔐 New Password: ${newPassword}`);
    console.log('\n💡 Login at: http://192.168.1.15:3000');
    console.log('   Username:', updated.username);
    console.log('   Password:', newPassword);
    console.log('\n' + '='.repeat(70));
    console.log('⚠️  SECURITY NOTE: Change this password after first login');
    console.log('='.repeat(70));
    console.log('');
  } catch (error) {
    console.error('\n❌ Error resetting password:', error.message);
    if (error.code === 'ECONNREFUSED') {
      console.error('   PostgreSQL server is not reachable');
    } else if (error.code === 'ENOENT') {
      console.error('   .env.local file not found');
    }
    console.error('\nFull error:', error);
    process.exit(1);
  } finally {
    rl.close();
    await pool.end();
  }
}

// Run the script
resetAdminPassword()
  .then(() => {
    process.exit(0);
  })
  .catch(error => {
    console.error('Unexpected error:', error);
    process.exit(1);
  });
