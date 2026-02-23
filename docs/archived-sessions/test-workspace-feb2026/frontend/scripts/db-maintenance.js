#!/usr/bin/env node

/**
 * Database Maintenance Script
 *
 * Performs weekly database maintenance tasks:
 * - ANALYZE to update query planner statistics
 * - VACUUM to reclaim space and defragment
 * - Index integrity checks
 *
 * Usage:
 *   node scripts/db-maintenance.js [--analyze-only] [--db forums|wiki|all]
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(__dirname, '..', 'data');

const DATABASES = {
  forums: 'forums.db',
  wiki: 'wiki.db',
  library: 'library.db',
  content: 'content.db',
  users: 'users.db',
  auth: 'auth.db',
  messaging: 'messaging.db',
  system: 'system.db',
};

const args = process.argv.slice(2);
const analyzeOnly = args.includes('--analyze-only');
const dbFilter = args.find(arg => arg.startsWith('--db='))?.split('=')[1] || 'all';

function formatBytes(bytes) {
  return (bytes / 1024).toFixed(2) + ' KB';
}

function analyzeTables(db, dbName) {
  console.log(`\n[${dbName}] Running ANALYZE...`);

  const tables = db
    .prepare(
      `
    SELECT name FROM sqlite_master
    WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
  `
    )
    .all();

  tables.forEach(({ name }) => {
    const start = Date.now();
    db.prepare(`ANALYZE ${name}`).run();
    const duration = Date.now() - start;
    console.log(`  ✓ ${name} (${duration}ms)`);
  });
}

function getIndexStats(db) {
  return db
    .prepare(
      `
    SELECT
      name,
      tbl_name,
      (SELECT COUNT(*) FROM sqlite_master WHERE type='index' AND tbl_name = idx.tbl_name) as index_count
    FROM sqlite_master idx
    WHERE type = 'index' AND name NOT LIKE 'sqlite_%'
    ORDER BY tbl_name, name
  `
    )
    .all();
}

function getTableStats(db) {
  const tables = db
    .prepare(
      `
    SELECT name FROM sqlite_master
    WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
  `
    )
    .all();

  return tables.map(({ name }) => {
    const count = db.prepare(`SELECT COUNT(*) as count FROM ${name}`).get().count;
    return { table: name, rows: count };
  });
}

function vacuumDatabase(db, dbName, dbPath) {
  console.log(`\n[${dbName}] Running VACUUM...`);

  const beforeStats = fs.statSync(dbPath);
  const beforeSize = beforeStats.size;

  const start = Date.now();
  db.prepare('VACUUM').run();
  const duration = Date.now() - start;

  const afterStats = fs.statSync(dbPath);
  const afterSize = afterStats.size;
  const saved = beforeSize - afterSize;
  const percentSaved = ((saved / beforeSize) * 100).toFixed(2);

  console.log(`  ✓ Completed in ${duration}ms`);
  console.log(`  ✓ Size: ${formatBytes(beforeSize)} → ${formatBytes(afterSize)}`);
  console.log(`  ✓ Reclaimed: ${formatBytes(saved)} (${percentSaved}%)`);
}

function maintainDatabase(dbName, dbFile) {
  const dbPath = path.join(DATA_DIR, dbFile);

  if (!fs.existsSync(dbPath)) {
    console.log(`⚠ [${dbName}] Database not found: ${dbPath}`);
    return;
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`Maintaining ${dbName}.db`);
  console.log('='.repeat(60));

  const db = new Database(dbPath);

  try {
    // Gather statistics
    console.log(`\n[${dbName}] Database Statistics:`);
    const tableStats = getTableStats(db);
    tableStats.forEach(({ table, rows }) => {
      console.log(`  ${table}: ${rows.toLocaleString()} rows`);
    });

    const indexStats = getIndexStats(db);
    const indexCount = indexStats.length;
    console.log(`\n[${dbName}] Indexes: ${indexCount} total`);

    // Run ANALYZE
    analyzeTables(db, dbName);

    // Run VACUUM (unless --analyze-only)
    if (!analyzeOnly) {
      vacuumDatabase(db, dbName, dbPath);
    } else {
      console.log(`\n[${dbName}] Skipping VACUUM (--analyze-only mode)`);
    }

    // Check integrity
    console.log(`\n[${dbName}] Running integrity check...`);
    const integrityResult = db.prepare('PRAGMA integrity_check').get();
    if (integrityResult.integrity_check === 'ok') {
      console.log('  ✓ Integrity check passed');
    } else {
      console.error('  ✗ Integrity check FAILED:', integrityResult);
    }
  } finally {
    db.close();
  }
}

function main() {
  console.log('Database Maintenance Tool');
  console.log('========================\n');
  console.log(`Mode: ${analyzeOnly ? 'ANALYZE only' : 'Full maintenance'}`);
  console.log(`Target: ${dbFilter === 'all' ? 'All databases' : dbFilter + '.db'}\n`);

  const startTime = Date.now();

  if (dbFilter === 'all') {
    Object.entries(DATABASES).forEach(([name, file]) => {
      maintainDatabase(name, file);
    });
  } else if (DATABASES[dbFilter]) {
    maintainDatabase(dbFilter, DATABASES[dbFilter]);
  } else {
    console.error(`Error: Unknown database "${dbFilter}"`);
    console.log('Available databases:', Object.keys(DATABASES).join(', '));
    process.exit(1);
  }

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`\n${'='.repeat(60)}`);
  console.log(`✓ Maintenance completed in ${totalTime}s`);
  console.log('='.repeat(60));
}

main();
