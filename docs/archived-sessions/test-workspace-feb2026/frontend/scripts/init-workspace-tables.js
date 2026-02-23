#!/usr/bin/env node

/**
 * Database Migration: Initialize Workspace Tables
 *
 * This script creates the tables needed for the infinite canvas workspace feature.
 * Tables are added to content.db since workspaces are tightly coupled to projects.
 *
 * Run: node scripts/init-workspace-tables.js
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, '../data/content.db');
const schemaPath = path.join(__dirname, './migrations/workspace-schema.sql');

console.log('🚀 Workspace Tables Migration');
console.log('='.repeat(60));

// Check if database exists
if (!fs.existsSync(dbPath)) {
  console.error(`❌ Database not found: ${dbPath}`);
  console.error('Please ensure content.db exists before running this migration.');
  process.exit(1);
}

// Check if schema file exists
if (!fs.existsSync(schemaPath)) {
  console.error(`❌ Schema file not found: ${schemaPath}`);
  console.error('Please ensure workspace-schema.sql exists.');
  process.exit(1);
}

// Read SQL schema
const schemaSQL = fs.readFileSync(schemaPath, 'utf-8');

// Open database connection
const db = new Database(dbPath);

try {
  console.log(`📂 Database: ${dbPath}`);
  console.log(`📄 Schema: ${schemaPath}`);
  console.log('');

  // Check current database size
  const statsBefore = fs.statSync(dbPath);
  const sizeBefore = (statsBefore.size / 1024).toFixed(2);
  console.log(`📊 Database size before migration: ${sizeBefore} KB`);
  console.log('');

  // Execute schema
  console.log('⏳ Creating workspace tables...');
  db.exec(schemaSQL);
  console.log('✅ Schema executed successfully');
  console.log('');

  // Verify tables were created
  console.log('🔍 Verifying table creation...');
  const tables = db
    .prepare(
      `
    SELECT name FROM sqlite_master
    WHERE type='table'
      AND (
        name LIKE 'workspace%'
        OR name LIKE 'canvas_%'
        OR name LIKE 'node_%'
        OR name LIKE 'viewport_%'
      )
    ORDER BY name
  `
    )
    .all();

  if (tables.length === 0) {
    console.error('❌ No workspace tables were created');
    process.exit(1);
  }

  console.log(`✅ Created ${tables.length} tables:`);
  tables.forEach((table, index) => {
    console.log(`   ${index + 1}. ${table.name}`);
  });
  console.log('');

  // Verify indexes
  console.log('🔍 Verifying index creation...');
  const indexes = db
    .prepare(
      `
    SELECT name FROM sqlite_master
    WHERE type='index'
      AND name LIKE 'idx_%'
      AND (
        name LIKE '%workspace%'
        OR name LIKE '%canvas%'
        OR name LIKE '%connection%'
        OR name LIKE '%viewport%'
      )
    ORDER BY name
  `
    )
    .all();

  console.log(`✅ Created ${indexes.length} indexes:`);
  indexes.forEach((index, i) => {
    console.log(`   ${i + 1}. ${index.name}`);
  });
  console.log('');

  // Verify triggers
  console.log('🔍 Verifying trigger creation...');
  const triggers = db
    .prepare(
      `
    SELECT name FROM sqlite_master
    WHERE type='trigger'
      AND (
        name LIKE '%workspace%'
        OR name LIKE '%canvas%'
        OR name LIKE '%connection%'
        OR name LIKE '%viewport%'
      )
    ORDER BY name
  `
    )
    .all();

  console.log(`✅ Created ${triggers.length} triggers:`);
  triggers.forEach((trigger, i) => {
    console.log(`   ${i + 1}. ${trigger.name}`);
  });
  console.log('');

  // Show table schemas
  console.log('📋 Table Schemas:');
  console.log('-'.repeat(60));

  const workspaceSchema = db
    .prepare(`SELECT sql FROM sqlite_master WHERE type='table' AND name='workspaces'`)
    .get();
  if (workspaceSchema) {
    console.log('\n📦 workspaces:');
    const cols = db.prepare('PRAGMA table_info(workspaces)').all();
    cols.forEach(col => {
      console.log(
        `   - ${col.name}: ${col.type}${col.pk ? ' (PRIMARY KEY)' : ''}${col.dflt_value ? ` DEFAULT ${col.dflt_value}` : ''}`
      );
    });
  }

  const nodesSchema = db
    .prepare(`SELECT sql FROM sqlite_master WHERE type='table' AND name='canvas_nodes'`)
    .get();
  if (nodesSchema) {
    console.log('\n📦 canvas_nodes:');
    const cols = db.prepare('PRAGMA table_info(canvas_nodes)').all();
    cols.forEach(col => {
      console.log(
        `   - ${col.name}: ${col.type}${col.pk ? ' (PRIMARY KEY)' : ''}${col.dflt_value ? ` DEFAULT ${col.dflt_value}` : ''}`
      );
    });
  }

  const connectionsSchema = db
    .prepare(`SELECT sql FROM sqlite_master WHERE type='table' AND name='node_connections'`)
    .get();
  if (connectionsSchema) {
    console.log('\n📦 node_connections:');
    const cols = db.prepare('PRAGMA table_info(node_connections)').all();
    cols.forEach(col => {
      console.log(
        `   - ${col.name}: ${col.type}${col.pk ? ' (PRIMARY KEY)' : ''}${col.dflt_value ? ` DEFAULT ${col.dflt_value}` : ''}`
      );
    });
  }

  const viewportSchema = db
    .prepare(`SELECT sql FROM sqlite_master WHERE type='table' AND name='viewport_states'`)
    .get();
  if (viewportSchema) {
    console.log('\n📦 viewport_states:');
    const cols = db.prepare('PRAGMA table_info(viewport_states)').all();
    cols.forEach(col => {
      console.log(
        `   - ${col.name}: ${col.type}${col.pk ? ' (PRIMARY KEY)' : ''}${col.dflt_value ? ` DEFAULT ${col.dflt_value}` : ''}`
      );
    });
  }

  console.log('');

  // Check final database size
  const statsAfter = fs.statSync(dbPath);
  const sizeAfter = (statsAfter.size / 1024).toFixed(2);
  const sizeIncrease = (sizeAfter - sizeBefore).toFixed(2);
  console.log(`📊 Database size after migration: ${sizeAfter} KB (+${sizeIncrease} KB)`);
  console.log('');

  // Success summary
  console.log('='.repeat(60));
  console.log('✅ Migration completed successfully!');
  console.log('');
  console.log('Next steps:');
  console.log('1. Run `npm run type-check` to verify TypeScript');
  console.log('2. Create workspace types in src/lib/workspace/');
  console.log('3. Implement WorkspaceService');
  console.log('4. Build the canvas UI components');
  console.log('='.repeat(60));
} catch (error) {
  console.error('');
  console.error('❌ Migration failed:');
  console.error(error.message);
  console.error('');
  console.error('Stack trace:');
  console.error(error.stack);
  process.exit(1);
} finally {
  db.close();
}
