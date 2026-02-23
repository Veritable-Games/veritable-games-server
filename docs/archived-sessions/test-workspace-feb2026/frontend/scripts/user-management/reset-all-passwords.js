#!/usr/bin/env node

/**
 * Reset All User Passwords
 *
 * Generates new secure 15-character passwords for all users
 * and saves credentials to a file.
 */

require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

// Password generation configuration
const PASSWORD_LENGTH = 15;
const UPPERCASE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const LOWERCASE = 'abcdefghijklmnopqrstuvwxyz';
const NUMBERS = '0123456789';
const SPECIAL = '!@#$%^&*()_+-=[]{}|;:,.<>?';

function generatePassword() {
  const allChars = UPPERCASE + LOWERCASE + NUMBERS + SPECIAL;
  let password = '';

  // Ensure at least one of each type
  password += UPPERCASE[Math.floor(Math.random() * UPPERCASE.length)];
  password += LOWERCASE[Math.floor(Math.random() * LOWERCASE.length)];
  password += NUMBERS[Math.floor(Math.random() * NUMBERS.length)];
  password += SPECIAL[Math.floor(Math.random() * SPECIAL.length)];

  // Fill the rest randomly
  for (let i = password.length; i < PASSWORD_LENGTH; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)];
  }

  // Shuffle the password
  return password
    .split('')
    .sort(() => Math.random() - 0.5)
    .join('');
}

async function resetAllPasswords() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL,
    ssl: process.env.POSTGRES_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
  });

  const outputPath = path.join(process.env.HOME, 'Desktop', 'user-credentials.txt');
  const credentials = [];

  try {
    console.log('🔐 Reset All User Passwords\n');
    console.log(
      'Database:',
      (process.env.DATABASE_URL || process.env.POSTGRES_URL)?.split('@')[1] || 'localhost'
    );

    // Get all users
    console.log('\n🔍 Fetching all users...');
    const usersResult = await pool.query(
      `SELECT id, username, email, role FROM users.users ORDER BY role DESC, username ASC`
    );

    if (usersResult.rows.length === 0) {
      console.error('❌ No users found!');
      process.exit(1);
    }

    console.log(`✅ Found ${usersResult.rows.length} users\n`);

    // Process each user
    for (const user of usersResult.rows) {
      const newPassword = generatePassword();

      console.log(`🔄 Resetting password for ${user.username} (${user.role})...`);

      // Hash password
      const passwordHash = await bcrypt.hash(newPassword, 12);

      // Update in database
      await pool.query(
        `UPDATE users.users SET password_hash = $1, updated_at = NOW() WHERE id = $2`,
        [passwordHash, user.id]
      );

      credentials.push({
        username: user.username,
        email: user.email,
        role: user.role,
        password: newPassword,
      });

      console.log(`   ✅ Done`);
    }

    // Generate output file
    console.log(`\n📝 Writing credentials to ${outputPath}...`);

    const timestamp = new Date().toISOString();
    let output = `# Veritable Games User Credentials\n`;
    output += `# Generated: ${timestamp}\n`;
    output += `# SECURITY WARNING: Delete this file after use!\n`;
    output += `${'='.repeat(70)}\n\n`;

    for (const cred of credentials) {
      output += `Username: ${cred.username}\n`;
      output += `Email: ${cred.email}\n`;
      output += `Role: ${cred.role}\n`;
      output += `Password: ${cred.password}\n`;
      output += `${'-'.repeat(40)}\n`;
    }

    output += `\n${'='.repeat(70)}\n`;
    output += `Total users: ${credentials.length}\n`;
    output += `Login URL: https://www.veritablegames.com/auth/login\n`;

    fs.writeFileSync(outputPath, output);

    console.log('\n' + '='.repeat(70));
    console.log('✅ All passwords reset successfully!');
    console.log('='.repeat(70));
    console.log(`\n📋 Credentials saved to: ${outputPath}`);
    console.log(`   Total users: ${credentials.length}`);
    console.log('\n⚠️  SECURITY: Delete the credentials file after use!');
    console.log('='.repeat(70));
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error('\nFull error:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run
resetAllPasswords()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Unexpected error:', error);
    process.exit(1);
  });
