#!/usr/bin/env node

/**
 * Script to optimize library.db with recommended indexes for better performance
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const LIBRARY_DB_PATH = path.join(__dirname, '../data/library.db');

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
};

function log(message, type = 'info') {
  const timestamp = new Date().toISOString();
  const typeColors = {
    info: colors.cyan,
    success: colors.green,
    warning: colors.yellow,
    error: colors.red,
    header: colors.magenta,
  };
  console.log(`${typeColors[type] || ''}[${timestamp}] ${message}${colors.reset}`);
}

function main() {
  log('Library Database Optimization Script', 'header');
  log('=====================================\n', 'header');

  if (!fs.existsSync(LIBRARY_DB_PATH)) {
    log('library.db not found! Run fix-library-db.js first.', 'error');
    process.exit(1);
  }

  const db = new Database(LIBRARY_DB_PATH);

  try {
    // Enable WAL mode for better performance
    db.pragma('journal_mode = WAL');
    db.pragma('synchronous = NORMAL');
    db.pragma('cache_size = -64000'); // 64MB cache
    db.pragma('temp_store = MEMORY');

    log('Creating optimized indexes for library.db...', 'info');

    const indexes = [
      // Library documents indexes
      {
        name: 'idx_library_documents_slug',
        sql: 'CREATE INDEX IF NOT EXISTS idx_library_documents_slug ON library_documents(slug)',
        description: 'Optimize document lookups by slug',
      },
      {
        name: 'idx_library_documents_category_order',
        sql: 'CREATE INDEX IF NOT EXISTS idx_library_documents_category_order ON library_documents(category_id, order_index)',
        description: 'Optimize category listings with ordering',
      },
      {
        name: 'idx_library_documents_status_updated',
        sql: 'CREATE INDEX IF NOT EXISTS idx_library_documents_status_updated ON library_documents(status, updated_at DESC)',
        description: 'Optimize fetching recent active documents',
      },
      {
        name: 'idx_library_documents_created',
        sql: 'CREATE INDEX IF NOT EXISTS idx_library_documents_created ON library_documents(created_at DESC)',
        description: 'Optimize chronological listings',
      },

      // Library categories indexes
      {
        name: 'idx_library_categories_parent',
        sql: 'CREATE INDEX IF NOT EXISTS idx_library_categories_parent ON library_categories(parent_id)',
        description: 'Optimize hierarchical category queries',
      },
      {
        name: 'idx_library_categories_slug',
        sql: 'CREATE INDEX IF NOT EXISTS idx_library_categories_slug ON library_categories(slug)',
        description: 'Optimize category lookups by slug',
      },
      {
        name: 'idx_library_categories_order',
        sql: 'CREATE INDEX IF NOT EXISTS idx_library_categories_order ON library_categories(order_index)',
        description: 'Optimize category ordering',
      },

      // Library tags indexes (if table exists)
      {
        name: 'idx_library_tags_name',
        sql: 'CREATE INDEX IF NOT EXISTS idx_library_tags_name ON library_tags(name)',
        description: 'Optimize tag lookups',
        checkTable: 'library_tags',
      },

      // Library collections indexes (if table exists)
      {
        name: 'idx_library_collections_slug',
        sql: 'CREATE INDEX IF NOT EXISTS idx_library_collections_slug ON library_collections(slug)',
        description: 'Optimize collection lookups',
        checkTable: 'library_collections',
      },
      {
        name: 'idx_library_collections_user',
        sql: 'CREATE INDEX IF NOT EXISTS idx_library_collections_user ON library_collections(user_id)',
        description: 'Optimize user collection queries',
        checkTable: 'library_collections',
      },
    ];

    let created = 0;
    let skipped = 0;
    let failed = 0;

    db.exec('BEGIN TRANSACTION');

    try {
      indexes.forEach(index => {
        try {
          // Check if table exists (for optional tables)
          if (index.checkTable) {
            const tableExists = db
              .prepare('SELECT name FROM sqlite_master WHERE type = "table" AND name = ?')
              .get(index.checkTable);

            if (!tableExists) {
              log(`  ⏭️  Skipping ${index.name} (table ${index.checkTable} not found)`, 'warning');
              skipped++;
              return;
            }
          }

          // Check if index already exists
          const existingIndex = db
            .prepare('SELECT name FROM sqlite_master WHERE type = "index" AND name = ?')
            .get(index.name);

          if (existingIndex) {
            log(`  ✓ ${index.name} already exists`, 'success');
            skipped++;
          } else {
            db.exec(index.sql);
            log(`  ✅ Created ${index.name}: ${index.description}`, 'success');
            created++;
          }
        } catch (error) {
          log(`  ❌ Failed to create ${index.name}: ${error.message}`, 'error');
          failed++;
        }
      });

      db.exec('COMMIT');
      log('\nTransaction committed successfully!', 'success');

      // Run ANALYZE to update query planner statistics
      log('\nRunning ANALYZE to update statistics...', 'info');
      db.exec('ANALYZE');
      log('Statistics updated successfully!', 'success');

      // Vacuum to optimize database file
      log('\nRunning VACUUM to optimize database file...', 'info');
      db.exec('VACUUM');
      log('Database file optimized!', 'success');

      // Display summary
      log('\n📊 Optimization Summary:', 'header');
      log(`  Created: ${created} new indexes`, created > 0 ? 'success' : 'info');
      log(`  Skipped: ${skipped} existing/optional indexes`, 'info');
      if (failed > 0) {
        log(`  Failed: ${failed} indexes`, 'error');
      }

      // Display database stats
      const stats = {
        pageSize: db.pragma('page_size')[0].page_size,
        pageCount: db.pragma('page_count')[0].page_count,
        cacheSize: db.pragma('cache_size')[0].cache_size,
        journalMode: db.pragma('journal_mode')[0].journal_mode,
      };

      const dbSizeMB = ((stats.pageSize * stats.pageCount) / 1024 / 1024).toFixed(2);

      log('\n📈 Database Statistics:', 'header');
      log(`  Database size: ${dbSizeMB} MB`, 'info');
      log(`  Page size: ${stats.pageSize} bytes`, 'info');
      log(`  Total pages: ${stats.pageCount}`, 'info');
      log(
        `  Cache size: ${Math.abs(stats.cacheSize)} ${stats.cacheSize < 0 ? 'KB' : 'pages'}`,
        'info'
      );
      log(`  Journal mode: ${stats.journalMode}`, 'info');

      log('\n✨ Optimization complete!', 'success');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  } catch (error) {
    log(`\nError during optimization: ${error.message}`, 'error');
    console.error(error);
    process.exit(1);
  } finally {
    db.close();
  }
}

// Run the optimization
if (require.main === module) {
  main();
}

module.exports = { main };
