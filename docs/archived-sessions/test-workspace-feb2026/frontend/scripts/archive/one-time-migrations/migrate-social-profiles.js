#!/usr/bin/env node

/**
 * Migration: Add social media profile columns to users table
 *
 * Restores social media functionality that was removed between web-0.30 and web-0.31
 * See: docs/SOCIAL_MEDIA_PROFILES_HISTORY.md
 */

const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '../data/users.db');

console.log('🔄 Starting social media profile migration...');
console.log('📁 Database:', dbPath);

try {
  const db = new Database(dbPath);

  console.log('\n📊 Current users table schema:');
  const currentSchema = db
    .prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='users'")
    .get();
  console.log(currentSchema.sql);

  console.log('\n➕ Adding social media columns...');

  // Add location and social media columns
  const columns = [
    { name: 'location', type: 'TEXT', description: 'User location' },
    { name: 'website_url', type: 'TEXT', description: 'Personal website' },
    { name: 'github_url', type: 'TEXT', description: 'GitHub profile' },
    { name: 'mastodon_url', type: 'TEXT', description: 'Mastodon profile' },
    { name: 'linkedin_url', type: 'TEXT', description: 'LinkedIn profile' },
    { name: 'discord_username', type: 'TEXT', description: 'Discord username' },
    { name: 'steam_url', type: 'TEXT', description: 'Steam profile' },
    { name: 'xbox_gamertag', type: 'TEXT', description: 'Xbox gamertag' },
    { name: 'psn_id', type: 'TEXT', description: 'PlayStation Network ID' },
    { name: 'bluesky_url', type: 'TEXT', description: 'Bluesky profile' },
    { name: 'avatar_position_x', type: 'REAL DEFAULT 50', description: 'Avatar X position' },
    { name: 'avatar_position_y', type: 'REAL DEFAULT 50', description: 'Avatar Y position' },
    { name: 'avatar_scale', type: 'REAL DEFAULT 100', description: 'Avatar scale' },
    { name: 'last_active', type: 'DATETIME', description: 'Last activity timestamp' },
  ];

  for (const col of columns) {
    try {
      db.exec(`ALTER TABLE users ADD COLUMN ${col.name} ${col.type};`);
      console.log(`  ✓ Added ${col.name} (${col.description})`);
    } catch (error) {
      if (error.message.includes('duplicate column name')) {
        console.log(`  ⚠ Skipped ${col.name} (already exists)`);
      } else {
        throw error;
      }
    }
  }

  console.log('\n📇 Creating indexes...');

  // Create indexes for commonly searched fields
  try {
    db.exec('CREATE INDEX IF NOT EXISTS idx_users_github ON users(github_url);');
    console.log('  ✓ Created index on github_url');
  } catch (error) {
    console.log('  ⚠ GitHub index already exists');
  }

  try {
    db.exec('CREATE INDEX IF NOT EXISTS idx_users_discord ON users(discord_username);');
    console.log('  ✓ Created index on discord_username');
  } catch (error) {
    console.log('  ⚠ Discord index already exists');
  }

  console.log('\n📊 Updated users table schema:');
  const newSchema = db
    .prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='users'")
    .get();
  console.log(newSchema.sql);

  console.log('\n📈 Current user count:');
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get();
  console.log(`  ${userCount.count} users in database`);

  db.close();

  console.log('\n✅ Migration completed successfully!');
  console.log('\n📝 Next steps:');
  console.log('  1. Restart dev server to pick up schema changes');
  console.log('  2. Visit /settings/profile to add social media links');
  console.log('  3. View profile page to see social links section');
} catch (error) {
  console.error('\n❌ Migration failed:', error.message);
  console.error(error.stack);
  process.exit(1);
}
