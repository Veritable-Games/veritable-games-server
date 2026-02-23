#!/usr/bin/env node

/**
 * Add landing_subscribers table to auth.db
 * Run with: node scripts/add-landing-subscribers-table.js
 */

const path = require('path');
const Database = require('better-sqlite3');

const dbPath = path.join(__dirname, '..', 'data', 'auth.db');
const db = new Database(dbPath);

console.log('Adding landing_subscribers table to auth.db...');

try {
  // Create the table
  db.exec(`
    CREATE TABLE IF NOT EXISTS landing_subscribers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      subscribed_at INTEGER NOT NULL,
      source TEXT DEFAULT 'maintenance_landing',
      verified INTEGER DEFAULT 0
    );
  `);

  // Create index for faster email lookups
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_landing_subscribers_email
    ON landing_subscribers(email);
  `);

  console.log('✅ Successfully created landing_subscribers table');

  // Verify table exists
  const tables = db
    .prepare(
      `
    SELECT name FROM sqlite_master
    WHERE type='table' AND name='landing_subscribers'
  `
    )
    .all();

  if (tables.length > 0) {
    console.log('✅ Table verified in database');

    // Show table schema
    const schema = db
      .prepare(
        `
      SELECT sql FROM sqlite_master
      WHERE type='table' AND name='landing_subscribers'
    `
      )
      .get();

    console.log('\nTable schema:');
    console.log(schema.sql);
  }
} catch (error) {
  console.error('❌ Error creating table:', error.message);
  process.exit(1);
} finally {
  db.close();
}
