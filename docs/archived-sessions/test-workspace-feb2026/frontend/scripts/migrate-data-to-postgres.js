#!/usr/bin/env node

/**
 * Migrate SQLite Data to PostgreSQL
 *
 * Copies all data from SQLite databases to PostgreSQL schemas.
 * Handles batching for performance and reports progress.
 */

require('dotenv').config({ path: '.env.local' });
const Database = require('better-sqlite3');
const { Pool } = require('pg');
const path = require('path');

// Database mappings
const DATABASES = {
  forums: 'forums.db',
  wiki: 'wiki.db',
  users: 'users.db',
  auth: 'auth.db',
  content: 'content.db',
  library: 'library.db',
  messaging: 'messaging.db',
  system: 'system.db',
  cache: 'cache.db',
  main: 'main.db',
};

const DATA_DIR = path.join(__dirname, '..', 'data');
const BATCH_SIZE = 1000; // Insert 1000 rows at a time

async function main() {
  console.log('📊 Migrating SQLite Data to PostgreSQL\n');
  console.log('============================================================\n');

  // Connect to PostgreSQL
  const pgPool = new Pool({
    connectionString: process.env.POSTGRES_URL,
  });

  console.log('🔌 Connecting to Neon PostgreSQL...');
  try {
    await pgPool.query('SELECT 1');
    console.log('✅ Connected!\n');
  } catch (error) {
    console.error('❌ Failed to connect to PostgreSQL:', error.message);
    process.exit(1);
  }

  let totalTables = 0;
  let totalRows = 0;
  let errors = 0;

  // Process each database
  for (const [schemaName, dbFile] of Object.entries(DATABASES)) {
    const dbPath = path.join(DATA_DIR, dbFile);

    if (!require('fs').existsSync(dbPath)) {
      console.log(`⚠️  Skipping ${schemaName}.db (file not found)\n`);
      continue;
    }

    console.log(`📊 Processing ${schemaName}.db...`);

    const sqlite = new Database(dbPath, { readonly: true });

    // Get all tables
    const tables = sqlite
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
      .all();

    console.log(`   Found: ${tables.length} tables`);

    for (const { name: tableName } of tables) {
      // Skip FTS tables (they're virtual and managed differently)
      if (tableName.includes('_fts') || tableName.includes('_search')) {
        console.log(`   ⏭️  Skipping FTS table: ${tableName}`);
        continue;
      }

      try {
        // Get row count
        const countResult = sqlite.prepare(`SELECT COUNT(*) as count FROM "${tableName}"`).get();
        const rowCount = countResult.count;

        if (rowCount === 0) {
          console.log(`   📝 ${tableName}: 0 rows (empty)`);
          totalTables++;
          continue;
        }

        // Get all rows
        const rows = sqlite.prepare(`SELECT * FROM "${tableName}"`).all();

        if (rows.length === 0) {
          console.log(`   📝 ${tableName}: 0 rows (empty)`);
          totalTables++;
          continue;
        }

        // Get column names from first row
        const columns = Object.keys(rows[0]);
        const columnList = columns.map(col => `"${col}"`).join(', ');
        const placeholders = columns.map((_, idx) => `$${idx + 1}`).join(', ');

        // Insert in batches
        let inserted = 0;
        for (let i = 0; i < rows.length; i += BATCH_SIZE) {
          const batch = rows.slice(i, i + BATCH_SIZE);

          for (const row of batch) {
            const values = columns.map(col => {
              const val = row[col];
              // Handle NULL values
              if (val === null || val === undefined) return null;
              // Keep other values as-is (pg will handle type conversion)
              return val;
            });

            const insertQuery = `INSERT INTO ${schemaName}.${tableName} (${columnList}) VALUES (${placeholders})`;

            try {
              await pgPool.query(insertQuery, values);
              inserted++;
            } catch (insertError) {
              // If it's a duplicate key error, skip silently (data already exists)
              if (insertError.code === '23505') {
                // Unique violation - skip
                inserted++;
                continue;
              }
              throw insertError;
            }
          }

          // Show progress for large tables
          if (rowCount > 1000) {
            process.stdout.write(`\r   📝 ${tableName}: ${inserted}/${rowCount} rows inserted...`);
          }
        }

        if (rowCount > 1000) {
          process.stdout.write('\n');
        } else {
          console.log(`   ✅ ${tableName}: ${inserted}/${rowCount} rows`);
        }

        totalTables++;
        totalRows += inserted;
      } catch (error) {
        console.log(`   ❌ ${tableName}: ${error.message}`);
        errors++;
      }
    }

    sqlite.close();
    console.log('');
  }

  await pgPool.end();

  console.log('============================================================');
  console.log('📊 Migration Summary:');
  console.log(`   Tables processed: ${totalTables}`);
  console.log(`   Total rows migrated: ${totalRows.toLocaleString()}`);
  console.log(`   Errors: ${errors}`);
  console.log('');

  if (errors === 0) {
    console.log('✅ Data migration complete!\n');
  } else {
    console.log('⚠️  Data migration completed with errors.\n');
    console.log('   Please review the errors above.\n');
  }
}

main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
