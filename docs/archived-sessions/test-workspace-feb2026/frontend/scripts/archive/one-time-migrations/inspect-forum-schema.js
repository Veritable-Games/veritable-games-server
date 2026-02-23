#!/usr/bin/env node

/**
 * Inspect actual forum database schema and compare with TypeScript types
 */

const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'data', 'forums.db');

console.log('========================================');
console.log('FORUM DATABASE SCHEMA INSPECTION');
console.log('========================================\n');

try {
  const db = new Database(dbPath, { readonly: true });

  // Get all tables
  const tables = db
    .prepare(
      `
    SELECT name FROM sqlite_master
    WHERE type='table' AND name LIKE 'forum_%'
    ORDER BY name
  `
    )
    .all();

  console.log('Tables found:', tables.map(t => t.name).join(', '));
  console.log('\n========================================\n');

  // Inspect each table
  for (const table of tables) {
    const tableName = table.name;
    console.log(`TABLE: ${tableName}`);
    console.log('─'.repeat(50));

    const columns = db.prepare(`PRAGMA table_info(${tableName})`).all();

    columns.forEach((col, i) => {
      const nullable = col.notnull ? 'NOT NULL' : 'NULL';
      const defaultVal = col.dflt_value !== null ? `DEFAULT ${col.dflt_value}` : '';
      const pk = col.pk ? '(PK)' : '';

      console.log(
        `${i + 1}. ${col.name.padEnd(25)} ${col.type.padEnd(15)} ${nullable.padEnd(10)} ${defaultVal.padEnd(30)} ${pk}`
      );
    });

    console.log('\n');
  }

  db.close();
} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}
