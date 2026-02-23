#!/usr/bin/env node

/**
 * Database Cleanup and Security Script
 *
 * This script:
 * 1. Lists all users
 * 2. Keeps only 'admin' and 'Test User'
 * 3. Generates secure passwords for both
 * 4. Deletes all forum posts (keeps categories/sections)
 * 5. Writes passwords to desktop file
 */

const Database = require('better-sqlite3');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

// Database paths
const AUTH_DB = path.join(__dirname, '../data/auth.db');
const FORUMS_DB = path.join(__dirname, '../data/forums.db');

// Generate secure random password
function generateSecurePassword(length = 20) {
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()-_=+';
  let password = '';
  const bytes = crypto.randomBytes(length);

  for (let i = 0; i < length; i++) {
    password += charset[bytes[i] % charset.length];
  }

  return password;
}

async function main() {
  console.log('🔐 Database Cleanup and Security Script');
  console.log('=====================================\n');

  // Open databases
  const authDb = new Database(AUTH_DB);
  const forumsDb = new Database(FORUMS_DB);

  try {
    // Step 1: Check current users
    console.log('📋 Step 1: Checking current users...');
    const users = authDb.prepare('SELECT id, username, email, role FROM users').all();
    console.log(`Found ${users.length} users:`);
    users.forEach(u => console.log(`  - ID ${u.id}: ${u.username} (${u.role}) - ${u.email}`));
    console.log();

    // Step 2: Find admin and Test User
    console.log('🔍 Step 2: Finding admin and Test User...');
    const adminUser = users.find(u => u.username.toLowerCase() === 'admin' || u.role === 'admin');
    const testUser = users.find(
      u => u.username === 'Test User' || u.username.toLowerCase().includes('test')
    );

    if (!adminUser) {
      console.error('❌ ERROR: Admin user not found!');
      console.log('Available users:', users.map(u => u.username).join(', '));
      process.exit(1);
    }

    console.log(`  ✓ Admin user found: ${adminUser.username} (ID: ${adminUser.id})`);

    if (testUser) {
      console.log(`  ✓ Test user found: ${testUser.username} (ID: ${testUser.id})`);
    } else {
      console.log('  ⚠ Test User not found - will create one');
    }
    console.log();

    // Step 3: Generate secure passwords
    console.log('🔑 Step 3: Generating secure passwords...');
    const adminPassword = generateSecurePassword(24);
    const testPassword = generateSecurePassword(24);

    const adminHash = await bcrypt.hash(adminPassword, 12);
    const testHash = await bcrypt.hash(testPassword, 12);

    console.log('  ✓ Generated secure passwords (24 chars each)');
    console.log();

    // Step 4: Update admin password
    console.log('💾 Step 4: Updating admin password...');
    authDb
      .prepare('UPDATE users SET password_hash = ?, role = ? WHERE id = ?')
      .run(adminHash, 'admin', adminUser.id);
    console.log(`  ✓ Admin password updated: ${adminUser.username}`);
    console.log();

    // Step 5: Create or update Test User
    console.log('💾 Step 5: Creating/updating Test User...');
    if (testUser) {
      authDb
        .prepare('UPDATE users SET password_hash = ?, role = ? WHERE id = ?')
        .run(testHash, 'user', testUser.id);
      console.log(`  ✓ Test User password updated: ${testUser.username}`);
    } else {
      // Create Test User
      const insertResult = authDb
        .prepare(
          `
        INSERT INTO users (username, email, password_hash, display_name, role, is_active, created_at)
        VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
      `
        )
        .run('Test User', 'test@veritablegames.com', testHash, 'Test User', 'user', 1);

      console.log(`  ✓ Test User created (ID: ${insertResult.lastInsertRowid})`);
    }
    console.log();

    // Step 6: Get IDs to keep
    const updatedAdminUser = authDb
      .prepare('SELECT id FROM users WHERE username = ? OR id = ?')
      .get(adminUser.username, adminUser.id);
    const updatedTestUser = authDb
      .prepare('SELECT id FROM users WHERE username = ?')
      .get('Test User');

    const keepUserIds = [updatedAdminUser.id];
    if (updatedTestUser) {
      keepUserIds.push(updatedTestUser.id);
    }

    console.log(`🗑️  Step 6: Removing other users (keeping IDs: ${keepUserIds.join(', ')})...`);
    const placeholders = keepUserIds.map(() => '?').join(',');
    const deleteUsersResult = authDb
      .prepare(`DELETE FROM users WHERE id NOT IN (${placeholders})`)
      .run(...keepUserIds);

    console.log(`  ✓ Deleted ${deleteUsersResult.changes} users`);
    console.log();

    // Step 7: Delete forum posts
    console.log('🗑️  Step 7: Deleting forum posts (keeping structure)...');

    // Get counts before deletion
    const topicCount = forumsDb.prepare('SELECT COUNT(*) as count FROM forum_topics').get().count;
    const replyCount = forumsDb.prepare('SELECT COUNT(*) as count FROM forum_replies').get().count;
    const categoryCount = forumsDb
      .prepare('SELECT COUNT(*) as count FROM forum_categories')
      .get().count;
    const sectionCount = forumsDb
      .prepare('SELECT COUNT(*) as count FROM forum_sections')
      .get().count;

    console.log(`  Current state:`);
    console.log(`    - ${sectionCount} sections`);
    console.log(`    - ${categoryCount} categories`);
    console.log(`    - ${topicCount} topics`);
    console.log(`    - ${replyCount} replies`);

    // Delete replies first (foreign key constraints)
    forumsDb.prepare('DELETE FROM forum_replies').run();
    console.log(`  ✓ Deleted all ${replyCount} replies`);

    // Delete topics
    forumsDb.prepare('DELETE FROM forum_topics').run();
    console.log(`  ✓ Deleted all ${topicCount} topics`);

    // Clear FTS index
    forumsDb.prepare('DELETE FROM forum_search_fts').run();
    console.log(`  ✓ Cleared forum search index`);

    // Reset view counts on categories
    forumsDb
      .prepare('UPDATE forum_categories SET topic_count = 0, reply_count = 0, last_post_at = NULL')
      .run();
    console.log(`  ✓ Reset category counts`);

    console.log();

    // Step 8: Write passwords to desktop
    console.log('📝 Step 8: Writing passwords to desktop...');
    const desktopPath = path.join(process.env.HOME, 'Desktop', 'veritablegames-passwords.txt');
    const passwordContent = `Veritable Games - Admin Credentials
Generated: ${new Date().toISOString()}

⚠️  IMPORTANT: Store these passwords in a password manager and delete this file!

=========================================

ADMIN ACCOUNT
Username: ${adminUser.username}
Email: ${adminUser.email}
Password: ${adminPassword}
Role: admin

TEST USER ACCOUNT
Username: Test User
Email: test@veritablegames.com
Password: ${testPassword}
Role: user

=========================================

Database cleaned:
- All other users deleted
- All forum topics and replies deleted
- Forum structure (sections/categories) preserved

Next steps:
1. Store these passwords in your password manager
2. Delete this file securely
3. Test login at: https://veritablegames.com/auth/login

`;

    fs.writeFileSync(desktopPath, passwordContent, 'utf8');
    console.log(`  ✓ Passwords written to: ${desktopPath}`);
    console.log();

    // Summary
    console.log('✅ Database cleanup completed successfully!');
    console.log();
    console.log('Summary:');
    console.log(`  - Admin user secured: ${adminUser.username}`);
    console.log(`  - Test user secured: Test User`);
    console.log(`  - ${deleteUsersResult.changes} other users removed`);
    console.log(`  - ${topicCount} forum topics deleted`);
    console.log(`  - ${replyCount} forum replies deleted`);
    console.log(
      `  - Forum structure preserved (${sectionCount} sections, ${categoryCount} categories)`
    );
    console.log();
    console.log(`📄 Passwords saved to: ${desktopPath}`);
    console.log();
    console.log('⚠️  IMPORTANT: Store passwords in password manager and delete the text file!');
  } catch (error) {
    console.error('❌ ERROR:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    authDb.close();
    forumsDb.close();
  }
}

main().catch(console.error);
