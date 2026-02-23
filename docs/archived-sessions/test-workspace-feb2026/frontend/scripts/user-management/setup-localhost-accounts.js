#!/usr/bin/env node

/**
 * Setup Localhost Accounts with Production Passwords
 *
 * Creates admin and testuser accounts in localhost database
 * with the same passwords as production.
 *
 * Usage:
 *   node scripts/user-management/setup-localhost-accounts.js
 *
 * Prerequisites:
 *   - PostgreSQL running locally (or DATABASE_MODE=development with local PostgreSQL)
 *   - Connection string: postgresql://postgres:postgres@localhost:5432/veritable_games
 */

const { Pool } = require('pg');

// Localhost database connection
const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/veritable_games',
  ssl: false,
});

// Account data with passwords from cryptographic protocol
const accounts = [
  {
    username: 'admin',
    email: 'admin@veritablegames.com',
    password_hash: '$2b$12$Rr0Z818ao7fT5VJOermZh.MUQxzSpbtlKg6gnQzLS69eObE33tLIa',
    role: 'admin',
    password: 'i9Wo9IW2uk9lmh7Rl8VF', // For display only
  },
  {
    username: 'testuser',
    email: 'test@veritablegames.com',
    password_hash: '$2b$12$z9.pwxJP9IOI37fNQ7ToHeX4VTr6SP/MHVc35OlJOC9McPQW8lXE.',
    role: 'user',
    password: 'cKwzlKa4ixJDNc8', // For display only
  },
];

async function setupAccounts() {
  console.log('🔐 Setting up localhost accounts...\n');

  try {
    // Test connection
    await pool.query('SELECT 1');
    console.log('✓ Database connection established\n');

    // Check if users schema exists
    const schemaCheck = await pool.query(`
      SELECT schema_name
      FROM information_schema.schemata
      WHERE schema_name = 'users'
    `);

    if (schemaCheck.rows.length === 0) {
      console.error('❌ Error: users schema does not exist');
      console.error('   Run migrations first: npm run db:migrate');
      process.exit(1);
    }

    console.log('✓ users schema exists\n');

    // Insert or update each account
    for (const account of accounts) {
      console.log(`Processing: ${account.username} (${account.email})`);

      // Check if user exists
      const userCheck = await pool.query(
        'SELECT id FROM users.users WHERE username = $1 OR email = $2',
        [account.username, account.email]
      );

      if (userCheck.rows.length > 0) {
        // Update existing user
        await pool.query(
          `
          UPDATE users.users
          SET password_hash = $1,
              email = $2,
              role = $3,
              updated_at = NOW()
          WHERE username = $4
        `,
          [account.password_hash, account.email, account.role, account.username]
        );

        console.log(`  ✓ Updated existing user (ID: ${userCheck.rows[0].id})`);
      } else {
        // Insert new user
        const result = await pool.query(
          `
          INSERT INTO users.users (username, email, password_hash, role, created_at, updated_at)
          VALUES ($1, $2, $3, $4, NOW(), NOW())
          RETURNING id
        `,
          [account.username, account.email, account.password_hash, account.role]
        );

        console.log(`  ✓ Created new user (ID: ${result.rows[0].id})`);
      }

      console.log(`  Password: ${account.password}`);
      console.log('');
    }

    // Verify accounts
    console.log('Verifying accounts...\n');
    const verification = await pool.query(`
      SELECT id, username, email, role, LENGTH(password_hash) as hash_length
      FROM users.users
      WHERE username IN ('admin', 'testuser')
      ORDER BY id
    `);

    console.log('✅ Localhost accounts configured:\n');
    console.table(verification.rows);

    console.log('\n📋 Summary:');
    console.log('  admin password:    i9Wo9IW2uk9lmh7Rl8VF (20 chars)');
    console.log('  testuser password: cKwzlKa4ixJDNc8 (15 chars)');
    console.log('\n⚠️  Save these passwords to your password manager!');
    console.log('⚠️  Same passwords are used in production\n');
  } catch (error) {
    console.error('\n❌ Error setting up accounts:', error.message);

    if (error.code === 'ECONNREFUSED') {
      console.error('\n💡 Tips:');
      console.error('   - Is PostgreSQL running on localhost:5432?');
      console.error('   - Check DATABASE_URL environment variable');
      console.error('   - Try: sudo systemctl start postgresql');
    }

    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run
setupAccounts();
