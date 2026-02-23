#!/usr/bin/env node

/**
 * Initialize Project Metadata Tables
 *
 * Creates project_metadata and project_sections tables in content.db
 * Required for workspace integration with ProjectService
 */

const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

// ANSI color codes for terminal output
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
  log('\n🚀 INITIALIZING PROJECT METADATA TABLES', 'bright');
  log('==================================================', 'reset');

  // Paths
  const dbPath = path.join(__dirname, '../data/content.db');
  const schemaPath = path.join(__dirname, 'migrations/project-metadata-schema.sql');

  // Verify schema file exists
  if (!fs.existsSync(schemaPath)) {
    log(`❌ Schema file not found: ${schemaPath}`, 'red');
    process.exit(1);
  }

  // Verify database exists
  if (!fs.existsSync(dbPath)) {
    log(`❌ Database not found: ${dbPath}`, 'red');
    log('Please ensure content.db exists before running this migration.', 'yellow');
    process.exit(1);
  }

  try {
    // Read schema SQL
    const schemaSQL = fs.readFileSync(schemaPath, 'utf-8');
    log('✅ Schema file loaded', 'green');

    // Connect to database
    const db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    log('✅ Connected to content.db', 'green');

    // Execute schema
    log('\n📊 Creating tables and indexes...', 'cyan');
    db.exec(schemaSQL);
    log('✅ Schema executed successfully', 'green');

    // Verify tables were created
    const tables = db
      .prepare(
        `SELECT name FROM sqlite_master
         WHERE type='table' AND name IN ('project_metadata', 'project_sections')`
      )
      .all();

    if (tables.length === 2) {
      log('✅ Tables created:', 'green');
      tables.forEach(table => {
        log(`   - ${table.name}`, 'reset');
      });
    } else {
      log('⚠️  Warning: Expected 2 tables, found ' + tables.length, 'yellow');
    }

    // Verify indexes
    const indexes = db
      .prepare(
        `SELECT name FROM sqlite_master
         WHERE type='index' AND name LIKE 'idx_project_%'`
      )
      .all();

    log(`✅ Created ${indexes.length} indexes`, 'green');

    // Verify triggers
    const triggers = db
      .prepare(
        `SELECT name FROM sqlite_master
         WHERE type='trigger' AND name LIKE '%project_%'`
      )
      .all();

    log(`✅ Created ${triggers.length} triggers`, 'green');

    // Verify initial data
    const projects = db
      .prepare(
        'SELECT project_slug, status, display_order FROM project_metadata ORDER BY display_order'
      )
      .all();

    if (projects.length > 0) {
      log('\n📋 Initial projects created:', 'cyan');
      projects.forEach(project => {
        log(`   - ${project.project_slug} (${project.status})`, 'reset');
      });
    } else {
      log('⚠️  Warning: No initial projects found', 'yellow');
    }

    // Close database
    db.close();
    log('\n==================================================', 'reset');
    log('✅ Project metadata tables initialized successfully!', 'green');
    log('', 'reset');
  } catch (error) {
    log('\n❌ Error during initialization:', 'red');
    log(error.message, 'red');
    if (error.stack) {
      log('\nStack trace:', 'yellow');
      log(error.stack, 'reset');
    }
    process.exit(1);
  }
}

main();
