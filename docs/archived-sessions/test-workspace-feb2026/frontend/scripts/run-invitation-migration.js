#!/usr/bin/env node

/**
 * Run Invitation System Migration
 *
 * Creates the invitations table in auth.db for token-based registration control.
 */

const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const AUTH_DB = path.join(__dirname, '../data/auth.db');
const MIGRATION_FILE = path.join(__dirname, '../migrations/20251028_create_invitations_table.sql');

console.log('🔧 Invitation System Migration');
console.log('==============================\n');

try {
  // Check if migration file exists
  if (!fs.existsSync(MIGRATION_FILE)) {
    console.error('❌ Migration file not found:', MIGRATION_FILE);
    process.exit(1);
  }

  // Read migration SQL
  const migrationSQL = fs.readFileSync(MIGRATION_FILE, 'utf8');

  // Open database
  const db = new Database(AUTH_DB);

  console.log('📂 Database:', AUTH_DB);
  console.log('📄 Migration:', MIGRATION_FILE);
  console.log();

  // Check if table already exists
  const tableExists = db
    .prepare(
      `
    SELECT name FROM sqlite_master
    WHERE type='table' AND name='invitations'
  `
    )
    .get();

  if (tableExists) {
    console.log('⚠️  Table "invitations" already exists');
    console.log('   Skipping migration (already applied)');
    db.close();
    process.exit(0);
  }

  // Execute migration
  console.log('⏳ Running migration...');
  db.exec(migrationSQL);

  // Verify table was created
  const created = db
    .prepare(
      `
    SELECT name FROM sqlite_master
    WHERE type='table' AND name='invitations'
  `
    )
    .get();

  if (created) {
    console.log('✅ Table "invitations" created successfully');

    // Show table schema
    const columns = db.prepare('PRAGMA table_info(invitations)').all();
    console.log('\n📋 Table Schema:');
    console.log('   Columns:', columns.length);
    columns.forEach(col => {
      console.log(`   - ${col.name} (${col.type})`);
    });

    // Show indexes
    const indexes = db
      .prepare(
        `
      SELECT name FROM sqlite_master
      WHERE type='index' AND tbl_name='invitations'
    `
      )
      .all();
    console.log('\n🔍 Indexes:', indexes.length);
    indexes.forEach(idx => {
      console.log(`   - ${idx.name}`);
    });
  } else {
    console.error('❌ Table creation failed');
    process.exit(1);
  }

  db.close();
  console.log('\n✅ Migration completed successfully!');
} catch (error) {
  console.error('❌ Migration failed:', error.message);
  console.error(error.stack);
  process.exit(1);
}
