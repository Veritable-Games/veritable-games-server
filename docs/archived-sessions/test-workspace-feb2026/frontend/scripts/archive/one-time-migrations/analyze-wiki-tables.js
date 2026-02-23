#!/usr/bin/env node

const Database = require('better-sqlite3');
const path = require('path');

console.log('=== Wiki Database Table Analysis ===\n');

const dbPath = path.join(__dirname, '..', 'data', 'wiki.db');
const db = new Database(dbPath, { readonly: true });

// Get all wiki-related tables
const wikiTables = db
  .prepare(
    `
  SELECT name FROM sqlite_master
  WHERE type='table' AND name LIKE 'wiki_%'
  ORDER BY name
`
  )
  .all();

console.log('Wiki tables found:', wikiTables.map(t => t.name).join(', '));
console.log('\n');

// Analyze each wiki table
wikiTables.forEach(table => {
  console.log(`Table: ${table.name}`);
  console.log('='.repeat(50));

  // Get column info
  const columns = db.prepare(`PRAGMA table_info(${table.name})`).all();
  console.log('Columns:');
  columns.forEach(col => {
    const pk = col.pk ? ' [PRIMARY KEY]' : '';
    const nn = col.notnull ? ' NOT NULL' : '';
    const def = col.dflt_value ? ` DEFAULT ${col.dflt_value}` : '';
    console.log(`  - ${col.name}: ${col.type}${pk}${nn}${def}`);
  });

  // Get row count
  const count = db.prepare(`SELECT COUNT(*) as count FROM ${table.name}`).get();
  console.log(`\nRow count: ${count.count}`);

  // Show sample data for important tables
  if (['wiki_pages', 'wiki_revisions'].includes(table.name) && count.count > 0) {
    console.log('\nSample data (first 2 rows):');
    const sample = db.prepare(`SELECT * FROM ${table.name} LIMIT 2`).all();
    sample.forEach(row => {
      console.log('  ', JSON.stringify(row, null, 2).split('\n').join('\n  '));
    });
  }

  console.log('\n');
});

// Check foreign key relationships
console.log('Foreign Key Relationships:');
console.log('='.repeat(50));
const fks = db
  .prepare(
    `
  SELECT
    m.name as table_name,
    p."from" as from_column,
    p."to" as to_column,
    p."table" as referenced_table
  FROM sqlite_master m
  JOIN pragma_foreign_key_list(m.name) p
  WHERE m.type = 'table' AND m.name LIKE 'wiki_%'
`
  )
  .all();

fks.forEach(fk => {
  console.log(`${fk.table_name}.${fk.from_column} -> ${fk.referenced_table}.${fk.to_column}`);
});

db.close();

console.log('\n=== Analysis Complete ===');
