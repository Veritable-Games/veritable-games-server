#!/usr/bin/env node

/**
 * Database Schema Examination Tool
 *
 * This script examines the database schema to identify:
 * - All tables and their structures
 * - Potential remnants from removed features
 * - Foreign key constraints
 * - Indexes that might need cleanup
 */

const Database = require('better-sqlite3');
const path = require('path');

const FORUMS_DB_PATH = path.join(__dirname, '..', 'data', 'forums.db');
const NOTEBOOKS_DB_PATH = path.join(__dirname, '..', 'data', 'notebooks.db');

function examineDatabase(dbPath, dbName) {
  console.log(`\n==================== ${dbName} ====================`);

  try {
    const db = new Database(dbPath, { readonly: true });

    // Get all tables
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
      .all();
    console.log(`\nTables in ${dbName}:`);
    tables.forEach(table => console.log(`  - ${table.name}`));

    // Look for potential reaction system remnants
    console.log(`\n=== Searching for Reaction System Remnants ===`);
    const reactionTables = tables.filter(
      t =>
        t.name.toLowerCase().includes('reaction') ||
        t.name.toLowerCase().includes('like') ||
        t.name.toLowerCase().includes('vote')
    );

    if (reactionTables.length > 0) {
      console.log('Found potential reaction tables:');
      reactionTables.forEach(table => console.log(`  ⚠️  ${table.name}`));
    } else {
      console.log('✅ No obvious reaction tables found');
    }

    // Look for file upload remnants
    console.log(`\n=== Searching for File Upload Remnants ===`);
    const fileTables = tables.filter(
      t =>
        t.name.toLowerCase().includes('file') ||
        t.name.toLowerCase().includes('upload') ||
        t.name.toLowerCase().includes('attachment')
    );

    if (fileTables.length > 0) {
      console.log('Found potential file-related tables:');
      fileTables.forEach(table => console.log(`  ⚠️  ${table.name}`));
    } else {
      console.log('✅ No obvious file tables found');
    }

    // Look for analytics remnants
    console.log(`\n=== Searching for Analytics Remnants ===`);
    const analyticsTables = tables.filter(
      t =>
        t.name.toLowerCase().includes('analytics') ||
        t.name.toLowerCase().includes('stats') ||
        t.name.toLowerCase().includes('metric') ||
        t.name.toLowerCase().includes('tracking')
    );

    if (analyticsTables.length > 0) {
      console.log('Found potential analytics tables:');
      analyticsTables.forEach(table => console.log(`  ⚠️  ${table.name}`));
    } else {
      console.log('✅ No obvious analytics tables found');
    }

    // Examine table structures for columns that might need cleanup
    console.log(`\n=== Examining Table Structures ===`);

    for (const table of tables) {
      const columns = db.prepare(`PRAGMA table_info('${table.name}')`).all();
      const suspiciousColumns = columns.filter(
        col =>
          col.name.toLowerCase().includes('reaction') ||
          col.name.toLowerCase().includes('like') ||
          col.name.toLowerCase().includes('file') ||
          col.name.toLowerCase().includes('upload') ||
          col.name.toLowerCase().includes('analytics') ||
          col.name.toLowerCase().includes('attachment') ||
          col.name.toLowerCase().includes('storage') ||
          col.name.toLowerCase().includes('mime') ||
          col.name.toLowerCase().includes('size')
      );

      if (suspiciousColumns.length > 0) {
        console.log(`\nTable ${table.name} has potential cleanup columns:`);
        suspiciousColumns.forEach(col => {
          console.log(`  ⚠️  ${col.name} (${col.type})`);
        });
      }
    }

    // Check for foreign key constraints
    console.log(`\n=== Foreign Key Analysis ===`);
    let totalForeignKeys = 0;

    for (const table of tables) {
      const foreignKeys = db.prepare(`PRAGMA foreign_key_list('${table.name}')`).all();
      if (foreignKeys.length > 0) {
        totalForeignKeys += foreignKeys.length;
        console.log(`\nTable ${table.name} foreign keys:`);
        foreignKeys.forEach(fk => {
          console.log(`  ${fk.from} -> ${fk.table}.${fk.to}`);
        });
      }
    }

    console.log(`\nTotal foreign key constraints: ${totalForeignKeys}`);

    // Check indexes
    console.log(`\n=== Index Analysis ===`);
    const indexes = db
      .prepare(
        "SELECT name, tbl_name FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%' ORDER BY tbl_name, name"
      )
      .all();

    if (indexes.length > 0) {
      console.log('Custom indexes:');
      let currentTable = '';
      indexes.forEach(idx => {
        if (idx.tbl_name !== currentTable) {
          currentTable = idx.tbl_name;
          console.log(`\n  Table: ${currentTable}`);
        }
        console.log(`    - ${idx.name}`);
      });
    } else {
      console.log('No custom indexes found');
    }

    db.close();
  } catch (error) {
    if (error.code === 'SQLITE_CANTOPEN') {
      console.log(`⚠️  Database ${dbName} not found or cannot be opened: ${dbPath}`);
    } else {
      console.error(`❌ Error examining ${dbName}:`, error.message);
    }
  }
}

function main() {
  console.log('🔍 Database Schema Examination\n');

  // Examine both databases
  examineDatabase(FORUMS_DB_PATH, 'forums.db');
  examineDatabase(NOTEBOOKS_DB_PATH, 'notebooks.db');

  console.log('\n==================== Summary ====================');
  console.log('Schema examination completed.');
  console.log('Review the warnings above to identify cleanup opportunities.');
}

if (require.main === module) {
  main();
}

module.exports = { examineDatabase };
