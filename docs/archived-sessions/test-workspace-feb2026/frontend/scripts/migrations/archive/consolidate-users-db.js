#!/usr/bin/env node

/**
 * User Database Consolidation Script
 *
 * Migrates all users from users.db into auth.db to fix
 * the database inconsistency issue.
 *
 * This ensures all users can login via the auth system.
 */

const Database = require('better-sqlite3');
const path = require('path');

const authDbPath = path.join(__dirname, 'data', 'auth.db');
const usersDbPath = path.join(__dirname, 'data', 'users.db');

console.log('🔄 User Database Consolidation\n');
console.log('Source: users.db');
console.log('Target: auth.db');
console.log('');

try {
  const authDb = new Database(authDbPath);
  const usersDb = new Database(usersDbPath);

  // Get counts
  const authCount = authDb.prepare('SELECT COUNT(*) as count FROM users').get();
  const usersCount = usersDb.prepare('SELECT COUNT(*) as count FROM users').get();

  console.log(`📊 Current State:`);
  console.log(`   auth.db: ${authCount.count} users`);
  console.log(`   users.db: ${usersCount.count} users`);
  console.log('');

  // Find users in users.db that aren't in auth.db
  const usersInAuth = authDb
    .prepare('SELECT id FROM users')
    .all()
    .map(u => u.id);
  const allUsers = usersDb.prepare('SELECT * FROM users').all();

  const usersToMigrate = allUsers.filter(user => !usersInAuth.includes(user.id));

  if (usersToMigrate.length === 0) {
    console.log('✅ No migration needed - all users already in auth.db');
    authDb.close();
    usersDb.close();
    return;
  }

  console.log(`🔍 Found ${usersToMigrate.length} users to migrate:`);
  usersToMigrate.forEach(user => {
    console.log(`   - ${user.username} (${user.role}) [ID: ${user.id}]`);
  });
  console.log('');

  // Prepare insert statement
  const insert = authDb.prepare(`
    INSERT INTO users (
      id, username, email, password_hash, display_name, avatar_url, bio,
      role, reputation, post_count, created_at, last_active, is_active,
      location, website_url, github_url, mastodon_url, linkedin_url,
      discord_username, profile_visibility, activity_privacy, email_visibility,
      show_online_status, allow_messages, two_factor_enabled, email_verified,
      last_login_at, login_count, steam_url, xbox_gamertag, psn_id, updated_at,
      avatar_position_x, avatar_position_y, avatar_scale, bluesky_url,
      follower_count, following_count, friend_count, message_count,
      last_seen, privacy_settings
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?
    )
  `);

  console.log('💾 Starting migration...');

  // Run migration in transaction
  const transaction = authDb.transaction(users => {
    let migrated = 0;
    let errors = 0;

    users.forEach(user => {
      try {
        insert.run(
          user.id,
          user.username,
          user.email,
          user.password_hash,
          user.display_name,
          user.avatar_url,
          user.bio,
          user.role,
          user.reputation,
          user.post_count,
          user.created_at,
          user.last_active,
          user.is_active,
          user.location,
          user.website_url,
          user.github_url,
          user.mastodon_url,
          user.linkedin_url,
          user.discord_username,
          user.profile_visibility,
          user.activity_privacy,
          user.email_visibility,
          user.show_online_status,
          user.allow_messages,
          user.two_factor_enabled,
          user.email_verified,
          user.last_login_at,
          user.login_count,
          user.steam_url,
          user.xbox_gamertag,
          user.psn_id,
          user.updated_at,
          user.avatar_position_x,
          user.avatar_position_y,
          user.avatar_scale,
          user.bluesky_url,
          user.follower_count,
          user.following_count,
          user.friend_count,
          user.message_count,
          user.last_seen,
          user.privacy_settings
        );
        migrated++;
      } catch (err) {
        console.error(`   ❌ Failed to migrate ${user.username}:`, err.message);
        errors++;
      }
    });

    return { migrated, errors };
  });

  const result = transaction(usersToMigrate);

  console.log('');
  console.log('='.repeat(60));
  console.log('✅ MIGRATION COMPLETE');
  console.log('='.repeat(60));
  console.log('');
  console.log(`📊 Results:`);
  console.log(`   ✅ Migrated: ${result.migrated} users`);
  console.log(`   ❌ Errors: ${result.errors} users`);
  console.log('');

  const newAuthCount = authDb.prepare('SELECT COUNT(*) as count FROM users').get();
  console.log(`📊 Final State:`);
  console.log(`   auth.db: ${newAuthCount.count} users (was ${authCount.count})`);
  console.log('');

  if (result.errors === 0) {
    console.log('✅ All users successfully migrated!');
    console.log('   All users should now be able to login.');
  } else {
    console.warn(`⚠️  ${result.errors} users failed to migrate.`);
    console.log('   Check errors above for details.');
  }
  console.log('');

  authDb.close();
  usersDb.close();
} catch (error) {
  console.error('❌ Migration error:', error.message);
  console.error('\nFull error:', error);
  process.exit(1);
}
