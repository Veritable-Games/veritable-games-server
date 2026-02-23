#!/usr/bin/env node
/**
 * Non-Interactive Admin Password Reset
 * Usage: node set-admin-password-automated.js "new-password"
 */

const { Client } = require('pg');
const bcrypt = require('bcrypt');
require('dotenv').config({ path: '.env.local' });

const SALT_ROUNDS = 12; // Match AuthService cost

async function setAdminPassword(newPassword) {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    database: 'veritable_games',
    user: 'postgres',
    password: 'postgres',
  });

  try {
    await client.connect();
    console.log('✅ Connected to database');

    // Find admin user
    const userResult = await client.query(
      'SELECT id, username, email FROM auth.users WHERE username = $1',
      ['admin']
    );

    if (userResult.rows.length === 0) {
      throw new Error('Admin user not found');
    }

    const user = userResult.rows[0];
    console.log(`✅ Found admin user: ${user.username} (${user.email})`);

    // Hash password
    console.log('🔒 Hashing password...');
    const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);

    // Update password
    await client.query(
      'UPDATE auth.users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
      [passwordHash, user.id]
    );

    console.log('✅ Password updated successfully!');
    console.log(`   Username: ${user.username}`);
    console.log(`   Password: ${newPassword}`);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

// Get password from command line
const newPassword = process.argv[2];

if (!newPassword) {
  console.error('Usage: node set-admin-password-automated.js "new-password"');
  process.exit(1);
}

setAdminPassword(newPassword);
