#!/usr/bin/env node
/**
 * Migration Script: Move Monitoring Data to System Database
 *
 * Purpose: Migrate 18,072 resource_usage logs from forums.db to system.db
 * Impact: Reduces forums.db size by ~4.5 MB
 *
 * Safety: Creates backup before migration
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(__dirname, '..', 'data');
const FORUMS_DB = path.join(DATA_DIR, 'forums.db');
const SYSTEM_DB = path.join(DATA_DIR, 'system.db');

function formatBytes(bytes) {
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

function getDbSize(dbPath) {
  const stats = fs.statSync(dbPath);
  return stats.size;
}

function createBackup(dbPath) {
  const backupPath = `${dbPath}.backup-${Date.now()}`;
  fs.copyFileSync(dbPath, backupPath);
  console.log(`✅ Created backup: ${path.basename(backupPath)}`);
  return backupPath;
}

function main() {
  console.log('🔄 Starting Monitoring Data Migration\n');

  // Check if databases exist
  if (!fs.existsSync(FORUMS_DB)) {
    console.error('❌ Error: forums.db not found');
    process.exit(1);
  }
  if (!fs.existsSync(SYSTEM_DB)) {
    console.error('❌ Error: system.db not found');
    process.exit(1);
  }

  // Get initial sizes
  const initialForumsSize = getDbSize(FORUMS_DB);
  const initialSystemSize = getDbSize(SYSTEM_DB);

  console.log('📊 Initial Database Sizes:');
  console.log(`   forums.db: ${formatBytes(initialForumsSize)}`);
  console.log(`   system.db: ${formatBytes(initialSystemSize)}\n`);

  // Create backups
  console.log('💾 Creating Backups...');
  const forumsBackup = createBackup(FORUMS_DB);
  const systemBackup = createBackup(SYSTEM_DB);
  console.log();

  // Open databases
  const forumsDb = new Database(FORUMS_DB);
  const systemDb = new Database(SYSTEM_DB);

  try {
    // Check if monitoring tables exist in forums.db
    const checkTables = forumsDb
      .prepare(
        `
      SELECT name FROM sqlite_master
      WHERE type='table' AND name IN ('resource_usage', 'memory_metrics', 'apm_request_metrics')
    `
      )
      .all();

    if (checkTables.length === 0) {
      console.log('ℹ️  No monitoring tables found in forums.db - migration may have already run');
      forumsDb.close();
      systemDb.close();
      return;
    }

    console.log(
      '📋 Found monitoring tables in forums.db:',
      checkTables.map(t => t.name).join(', ')
    );

    // Count rows to migrate
    let totalRows = 0;
    const rowCounts = {};

    for (const table of checkTables) {
      const count = forumsDb.prepare(`SELECT COUNT(*) as count FROM ${table.name}`).get().count;
      rowCounts[table.name] = count;
      totalRows += count;
    }

    console.log('\n📈 Rows to Migrate:');
    Object.entries(rowCounts).forEach(([table, count]) => {
      console.log(`   ${table}: ${count.toLocaleString()} rows`);
    });
    console.log(`   Total: ${totalRows.toLocaleString()} rows\n`);

    // Ensure tables exist in system.db
    console.log('🔧 Ensuring tables exist in system.db...');

    // Create resource_usage table if needed
    if (rowCounts['resource_usage']) {
      systemDb.exec(`
        CREATE TABLE IF NOT EXISTS resource_usage (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          timestamp INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
          resource_type TEXT NOT NULL,
          metric_name TEXT NOT NULL,
          current_value REAL NOT NULL,
          max_value REAL,
          unit TEXT NOT NULL,
          node_id TEXT DEFAULT 'main',
          process_id INTEGER,
          details TEXT,
          created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
        )
      `);
      console.log('   ✅ resource_usage table ready');
    }

    // Create memory_metrics table if needed
    if (rowCounts['memory_metrics']) {
      systemDb.exec(`
        CREATE TABLE IF NOT EXISTS memory_metrics (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          timestamp INTEGER NOT NULL,
          process_rss INTEGER NOT NULL,
          process_heap_total INTEGER NOT NULL,
          process_heap_used INTEGER NOT NULL,
          process_external INTEGER NOT NULL,
          process_array_buffers INTEGER NOT NULL,
          system_total_mb INTEGER NOT NULL,
          system_free_mb INTEGER NOT NULL,
          system_used_mb INTEGER NOT NULL,
          system_usage_percent REAL NOT NULL,
          rss_growth_rate REAL DEFAULT 0,
          heap_growth_rate REAL DEFAULT 0,
          memory_efficiency REAL DEFAULT 0,
          created_at INTEGER DEFAULT (unixepoch())
        )
      `);
      console.log('   ✅ memory_metrics table ready');
    }

    // Create apm_request_metrics table if needed
    if (rowCounts['apm_request_metrics']) {
      systemDb.exec(`
        CREATE TABLE IF NOT EXISTS apm_request_metrics (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          timestamp INTEGER NOT NULL,
          method TEXT NOT NULL,
          endpoint TEXT NOT NULL,
          status_code INTEGER NOT NULL,
          response_time_ms REAL NOT NULL,
          user_id INTEGER,
          ip_address TEXT,
          user_agent TEXT,
          error_message TEXT,
          memory_usage INTEGER,
          cpu_usage REAL
        )
      `);
      console.log('   ✅ apm_request_metrics table ready');
    }

    console.log();

    // Begin migration transaction
    console.log('🚀 Starting Data Migration...\n');

    systemDb.exec('BEGIN TRANSACTION');

    try {
      // Migrate resource_usage
      if (rowCounts['resource_usage'] > 0) {
        process.stdout.write('   Migrating resource_usage... ');
        const rows = forumsDb.prepare('SELECT * FROM resource_usage').all();
        const insertStmt = systemDb.prepare(`
          INSERT INTO resource_usage (timestamp, resource_type, metric_name, current_value, max_value, unit, node_id, process_id, details, created_at)
          VALUES (@timestamp, @resource_type, @metric_name, @current_value, @max_value, @unit, @node_id, @process_id, @details, @created_at)
        `);

        for (const row of rows) {
          insertStmt.run(row);
        }
        console.log(`✅ ${rows.length.toLocaleString()} rows`);
      }

      // Migrate memory_metrics
      if (rowCounts['memory_metrics'] > 0) {
        process.stdout.write('   Migrating memory_metrics... ');
        const rows = forumsDb.prepare('SELECT * FROM memory_metrics').all();
        const insertStmt = systemDb.prepare(`
          INSERT INTO memory_metrics (timestamp, process_rss, process_heap_total, process_heap_used, process_external, process_array_buffers, system_total_mb, system_free_mb, system_used_mb, system_usage_percent, rss_growth_rate, heap_growth_rate, memory_efficiency, created_at)
          VALUES (@timestamp, @process_rss, @process_heap_total, @process_heap_used, @process_external, @process_array_buffers, @system_total_mb, @system_free_mb, @system_used_mb, @system_usage_percent, @rss_growth_rate, @heap_growth_rate, @memory_efficiency, @created_at)
        `);

        for (const row of rows) {
          insertStmt.run(row);
        }
        console.log(`✅ ${rows.length.toLocaleString()} rows`);
      }

      // Migrate apm_request_metrics
      if (rowCounts['apm_request_metrics'] > 0) {
        process.stdout.write('   Migrating apm_request_metrics... ');
        const rows = forumsDb.prepare('SELECT * FROM apm_request_metrics').all();
        const insertStmt = systemDb.prepare(`
          INSERT INTO apm_request_metrics (timestamp, method, endpoint, status_code, response_time_ms, user_id, ip_address, user_agent, error_message, memory_usage, cpu_usage)
          VALUES (@timestamp, @method, @endpoint, @status_code, @response_time_ms, @user_id, @ip_address, @user_agent, @error_message, @memory_usage, @cpu_usage)
        `);

        for (const row of rows) {
          insertStmt.run(row);
        }
        console.log(`✅ ${rows.length.toLocaleString()} rows`);
      }

      systemDb.exec('COMMIT');
      console.log('\n✅ Migration transaction committed\n');

      // Verify migration
      console.log('🔍 Verifying Migration...');
      for (const table of checkTables) {
        const sourceCount = forumsDb
          .prepare(`SELECT COUNT(*) as count FROM ${table.name}`)
          .get().count;
        const targetCount = systemDb
          .prepare(`SELECT COUNT(*) as count FROM ${table.name}`)
          .get().count;

        if (targetCount >= sourceCount) {
          console.log(
            `   ✅ ${table.name}: ${sourceCount.toLocaleString()} → ${targetCount.toLocaleString()} rows`
          );
        } else {
          throw new Error(`Migration verification failed for ${table.name}`);
        }
      }

      console.log('\n✅ Migration verified successfully!\n');

      // Drop tables from forums.db (will be done in cleanup script)
      console.log('ℹ️  Note: Tables will be dropped from forums.db in cleanup script\n');
    } catch (error) {
      systemDb.exec('ROLLBACK');
      throw error;
    }

    // Get final sizes
    forumsDb.close();
    systemDb.close();

    const finalForumsSize = getDbSize(FORUMS_DB);
    const finalSystemSize = getDbSize(SYSTEM_DB);

    console.log('📊 Final Database Sizes (after next step - cleanup):');
    console.log(
      `   forums.db: ${formatBytes(finalForumsSize)} (will drop to ~${formatBytes(finalForumsSize * 0.06)} after cleanup)`
    );
    console.log(`   system.db: ${formatBytes(finalSystemSize)}`);
    console.log(
      `\n   Expected forums.db reduction: ${formatBytes(finalForumsSize * 0.94)} (~94%)\n`
    );

    console.log('✅ Migration Complete!');
    console.log('\n📝 Next Steps:');
    console.log('   1. Run cleanup script: node scripts/cleanup-forums-db.js');
    console.log('   2. Run VACUUM to reclaim space');
    console.log(
      `   3. Backups saved: ${path.basename(forumsBackup)}, ${path.basename(systemBackup)}`
    );
  } catch (error) {
    console.error('\n❌ Migration Error:', error.message);
    console.error('\n🔄 Restoring from backups...');
    forumsDb.close();
    systemDb.close();

    // Restore backups
    fs.copyFileSync(forumsBackup, FORUMS_DB);
    fs.copyFileSync(systemBackup, SYSTEM_DB);

    console.log('✅ Databases restored from backup');
    process.exit(1);
  }
}

// Run migration
main();
