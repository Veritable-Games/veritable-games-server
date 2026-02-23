#!/usr/bin/env node

/**
 * Run database migration to lower canvas_nodes size constraints
 */

const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

// Database path (workspace tables are in content.db)
const dbPath = path.join(__dirname, '../data/content.db');
const migrationPath = path.join(__dirname, 'migrations/lower-node-size-constraints.sql');

console.log('🔧 Running migration: lower-node-size-constraints.sql');
console.log('📂 Database:', dbPath);

// Check if database exists
if (!fs.existsSync(dbPath)) {
  console.error('❌ Database not found:', dbPath);
  process.exit(1);
}

// Check if migration file exists
if (!fs.existsSync(migrationPath)) {
  console.error('❌ Migration file not found:', migrationPath);
  process.exit(1);
}

// Read migration SQL
const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

try {
  // Open database
  const db = new Database(dbPath);

  // Check current table structure before migration
  console.log('\n📋 Current canvas_nodes structure:');
  const currentSchema = db
    .prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='canvas_nodes'")
    .get();
  if (currentSchema) {
    console.log(currentSchema.sql);
  } else {
    console.log('⚠️  canvas_nodes table does not exist');
  }

  // Run migration
  console.log('\n🚀 Running migration...');
  db.exec(migrationSQL);

  // Check new table structure after migration
  console.log('\n✅ Migration complete! New canvas_nodes structure:');
  const newSchema = db
    .prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='canvas_nodes'")
    .get();
  if (newSchema) {
    console.log(newSchema.sql);

    // Check if constraints were updated
    if (newSchema.sql.includes('width >= 60') && newSchema.sql.includes('height >= 30')) {
      console.log('\n✅ CHECK constraints successfully updated:');
      console.log('   - width >= 60 (was 100)');
      console.log('   - height >= 30 (was 50)');
    } else {
      console.log('\n⚠️  CHECK constraints may not have been updated correctly');
    }
  }

  // Close database
  db.close();

  console.log('\n✅ Migration completed successfully!');
} catch (error) {
  console.error('\n❌ Migration failed:', error.message);
  console.error(error);
  process.exit(1);
}
