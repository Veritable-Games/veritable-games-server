#!/usr/bin/env node

/**
 * Export Database Schemas
 * Extracts DDL (schema) from SQLite databases for seed script generation
 */

const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const DB_DIR = path.join(__dirname, '../data');
const SCHEMA_DIR = path.join(__dirname, 'seeds/schemas');

// Ensure schema directory exists
if (!fs.existsSync(SCHEMA_DIR)) {
  fs.mkdirSync(SCHEMA_DIR, { recursive: true });
}

// Databases to export
const DATABASES = [
  'auth',
  'forums',
  'wiki',
  'users',
  'content',
  'library',
  'messaging',
  'system',
  'cache',
  'main',
];

console.log('📦 Exporting Database Schemas');
console.log('==============================\n');

let exported = 0;
let skipped = 0;

for (const dbName of DATABASES) {
  const dbPath = path.join(DB_DIR, `${dbName}.db`);
  const schemaPath = path.join(SCHEMA_DIR, `${dbName}.sql`);

  if (!fs.existsSync(dbPath)) {
    console.log(`  ⚠  ${dbName}.db not found, skipping...`);
    skipped++;
    continue;
  }

  try {
    console.log(`Exporting ${dbName}.db schema...`);

    const db = new Database(dbPath, { readonly: true });

    // Get schema SQL
    const schema = db
      .prepare(
        `
      SELECT sql FROM sqlite_master
      WHERE sql IS NOT NULL
      AND type IN ('table', 'index', 'trigger', 'view')
      ORDER BY type, name
    `
      )
      .all();

    // Build schema file
    const header = `-- Schema export from ${dbName}.db
-- Generated: ${new Date().toISOString()}
-- SQLite version: ${db.pragma('application_id', { simple: true })}

`;

    const schemaSQL = schema.map(row => row.sql + ';').join('\n\n');
    const fullSchema = header + schemaSQL;

    // Write to file
    fs.writeFileSync(schemaPath, fullSchema, 'utf8');

    // Count objects
    const tableCount = schema.filter(r => r.sql.startsWith('CREATE TABLE')).length;
    const indexCount = schema.filter(r => r.sql.startsWith('CREATE INDEX')).length;
    const triggerCount = schema.filter(r => r.sql.startsWith('CREATE TRIGGER')).length;
    const viewCount = schema.filter(r => r.sql.startsWith('CREATE VIEW')).length;

    console.log(
      `  ✓ ${dbName}.sql - ${tableCount} tables, ${indexCount} indexes, ${triggerCount} triggers, ${viewCount} views`
    );

    db.close();
    exported++;
  } catch (error) {
    console.error(`  ❌ Error exporting ${dbName}.db:`, error.message);
    skipped++;
  }
}

console.log(`\n✅ Schema export complete!`);
console.log(`   Exported: ${exported} databases`);
console.log(`   Skipped: ${skipped} databases`);
console.log(`   Output: ${SCHEMA_DIR}/`);
