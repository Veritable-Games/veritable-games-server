#!/usr/bin/env node

const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'data', 'library.db');

const db = new Database(DB_PATH);

console.log('Library Database Tables:\n');

const tables = db
  .prepare(
    `
  SELECT name FROM sqlite_master
  WHERE type='table' AND name NOT LIKE 'sqlite_%'
  ORDER BY name
`
  )
  .all();

for (const table of tables) {
  console.log(`\n📋 ${table.name}`);
  const columns = db.prepare(`PRAGMA table_info(${table.name})`).all();
  console.log('   Columns:', columns.map(c => `${c.name} (${c.type})`).join(', '));
}

db.close();
