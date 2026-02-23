#!/usr/bin/env node

/**
 * Fix Workspace Table Conflict
 *
 * The workspaces table already exists with an old versioning schema.
 * This script renames the old table and creates the new simple schema.
 */

const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function main() {
  log('\n🔧 FIXING WORKSPACE TABLE CONFLICT', 'bright');
  log('==================================================', 'reset');

  const dbPath = path.join(__dirname, '../data/content.db');

  if (!fs.existsSync(dbPath)) {
    log(`❌ Database not found: ${dbPath}`, 'red');
    process.exit(1);
  }

  try {
    const db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    log('✅ Connected to content.db', 'green');

    // Check if old workspaces table exists
    const oldTable = db
      .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='workspaces'`)
      .get();

    if (!oldTable) {
      log('ℹ️  No conflicting workspaces table found', 'cyan');
      db.close();
      return;
    }

    // Check schema of existing table
    const columns = db.prepare('PRAGMA table_info(workspaces)').all();
    const hasSettings = columns.some(col => col.name === 'settings');

    if (hasSettings) {
      log('✅ Workspaces table already has correct schema', 'green');
      db.close();
      return;
    }

    log('\n⚠️  Found old workspaces table with incorrect schema', 'yellow');
    log('   Current columns:', 'yellow');
    columns.forEach(col => {
      log(`     - ${col.name} (${col.type})`, 'reset');
    });

    // Check if there's data in the old table
    const rowCount = db.prepare('SELECT COUNT(*) as cnt FROM workspaces').get().cnt;
    log(`\n📊 Old table has ${rowCount} row(s)`, 'cyan');

    // Rename old table
    log('\n🔄 Renaming old workspaces table to workspaces_old...', 'cyan');
    db.exec('ALTER TABLE workspaces RENAME TO workspaces_old');
    log('✅ Old table renamed', 'green');

    // Create new table with correct schema
    log('\n📝 Creating new workspaces table...', 'cyan');
    db.exec(`
      CREATE TABLE workspaces (
        id TEXT PRIMARY KEY,
        project_slug TEXT NOT NULL UNIQUE,
        settings TEXT NOT NULL DEFAULT '{}',
        created_by INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_by INTEGER,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        CHECK (id = project_slug)
      )
    `);
    log('✅ New workspaces table created', 'green');

    // Create indexes
    log('\n🔗 Creating indexes...', 'cyan');
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_workspaces_project ON workspaces(project_slug);
      CREATE INDEX IF NOT EXISTS idx_workspaces_created_by ON workspaces(created_by);
    `);
    log('✅ Indexes created', 'green');

    // Create trigger
    log('\n⚡ Creating update trigger...', 'cyan');
    db.exec(`
      CREATE TRIGGER IF NOT EXISTS update_workspaces_timestamp
      AFTER UPDATE ON workspaces
      FOR EACH ROW
      BEGIN
        UPDATE workspaces SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
      END
    `);
    log('✅ Trigger created', 'green');

    // Verify new schema
    const newColumns = db.prepare('PRAGMA table_info(workspaces)').all();
    log('\n✅ New workspaces table schema:', 'green');
    newColumns.forEach(col => {
      log(`   - ${col.name} (${col.type})`, 'reset');
    });

    db.close();

    log('\n==================================================', 'reset');
    log('✅ Workspace table conflict resolved!', 'green');
    log('\nℹ️  Old data preserved in workspaces_old table', 'cyan');
    log('ℹ️  You can drop it later with: DROP TABLE workspaces_old;', 'cyan');
    log('', 'reset');
  } catch (error) {
    log('\n❌ Error during migration:', 'red');
    log(error.message, 'red');
    if (error.stack) {
      log('\nStack trace:', 'yellow');
      log(error.stack, 'reset');
    }
    process.exit(1);
  }
}

main();
