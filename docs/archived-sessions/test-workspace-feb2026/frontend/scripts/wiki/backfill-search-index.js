#!/usr/bin/env node

/**
 * Wiki FTS5 Search Index Backfill Script
 *
 * Populates the wiki_search FTS5 table with all existing wiki pages.
 * This script should be run after deploying the FTS5 migration to ensure
 * all existing content is searchable.
 *
 * Usage:
 *   node scripts/wiki/backfill-search-index.js
 *
 * Or via npm:
 *   npm run wiki:reindex
 */

const path = require('path');
const Database = require('better-sqlite3');

// Load environment variables from .env.local if it exists
const dotenv = require('dotenv');
const envPath = path.join(__dirname, '../../.env.local');
try {
  dotenv.config({ path: envPath });
  console.log('✓ Loaded environment variables from .env.local');
} catch (error) {
  console.warn('⚠ Could not load .env.local, using defaults');
}

// Get database path from environment or use default
const DB_PATH = process.env.WIKI_DATABASE_PATH || path.join(__dirname, '../../data/wiki.db');

console.log('==========================================');
console.log('Wiki FTS5 Search Index Backfill');
console.log('==========================================\n');

console.log(`Database: ${DB_PATH}`);

// Check if database exists
const fs = require('fs');
if (!fs.existsSync(DB_PATH)) {
  console.error(`\n❌ Error: Database not found at ${DB_PATH}`);
  console.error('Please ensure the database exists before running this script.');
  process.exit(1);
}

// Open database connection
let db;
try {
  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL'); // Enable WAL mode for better concurrency
  console.log('✓ Connected to database\n');
} catch (error) {
  console.error(`\n❌ Error connecting to database: ${error.message}`);
  process.exit(1);
}

// Main backfill function
async function backfillWikiSearch() {
  try {
    console.log('Step 1: Checking FTS5 table exists...');

    // Check if wiki_search table exists
    const tableCheck = db
      .prepare(
        `
      SELECT name FROM sqlite_master
      WHERE type='table' AND name='wiki_search'
    `
      )
      .get();

    if (!tableCheck) {
      console.error('\n❌ Error: wiki_search FTS5 table does not exist.');
      console.error('Please ensure the database schema is up to date.');
      process.exit(1);
    }
    console.log('✓ FTS5 table exists\n');

    console.log('Step 2: Clearing existing FTS5 index...');
    const deleteStmt = db.prepare('DELETE FROM wiki_search');
    const deleteResult = deleteStmt.run();
    console.log(`✓ Cleared ${deleteResult.changes} existing entries\n`);

    console.log('Step 3: Fetching all wiki pages with latest revisions...');
    const pagesStmt = db.prepare(`
      SELECT
        p.id,
        p.title,
        (SELECT GROUP_CONCAT(wt.name, ', ')
         FROM wiki_page_tags wpt
         JOIN wiki_tags wt ON wpt.tag_id = wt.id
         WHERE wpt.page_id = p.id) as tags,
        p.category_id,
        c.name as category_name,
        r.content
      FROM wiki_pages p
      LEFT JOIN wiki_categories c ON p.category_id = c.id
      LEFT JOIN wiki_revisions r ON p.id = r.page_id
        AND r.id = (SELECT MAX(id) FROM wiki_revisions WHERE page_id = p.id)
      ORDER BY p.id
    `);

    const pages = pagesStmt.all();
    console.log(`✓ Found ${pages.length} pages to index\n`);

    if (pages.length === 0) {
      console.log('ℹ No pages to index. Database is empty.');
      db.close();
      return;
    }

    console.log('Step 4: Populating FTS5 search index...');
    console.log('----------------------------------------');

    // Prepare insert statement
    const insertStmt = db.prepare(`
      INSERT INTO wiki_search(rowid, title, content, tags, category)
      VALUES (?, ?, ?, ?, ?)
    `);

    // Use transaction for better performance
    const transaction = db.transaction(pagesToIndex => {
      let indexed = 0;
      let errors = 0;

      for (const page of pagesToIndex) {
        try {
          insertStmt.run(
            page.id,
            page.title || '',
            page.content || '',
            page.tags || '',
            page.category_name || ''
          );
          indexed++;

          // Progress indicator every 10 pages
          if (indexed % 10 === 0) {
            process.stdout.write(`\rIndexed ${indexed}/${pages.length} pages...`);
          }
        } catch (error) {
          errors++;
          console.error(`\n⚠ Error indexing page ${page.id} (${page.title}): ${error.message}`);
        }
      }

      return { indexed, errors };
    });

    // Execute transaction
    const result = transaction(pages);

    console.log(`\n✓ Successfully indexed ${result.indexed} pages`);
    if (result.errors > 0) {
      console.warn(`⚠ ${result.errors} pages failed to index`);
    }

    console.log('\n');
    console.log('Step 5: Verifying index...');

    // Verify index count
    const countStmt = db.prepare('SELECT COUNT(*) as count FROM wiki_search');
    const count = countStmt.get();
    console.log(`✓ FTS5 index contains ${count.count} entries`);

    // Test search functionality
    console.log('\nStep 6: Testing search functionality...');
    try {
      const testStmt = db.prepare(`
        SELECT COUNT(*) as count
        FROM wiki_search
        WHERE wiki_search MATCH 'test* OR wiki*'
      `);
      const testResult = testStmt.get();
      console.log(`✓ Search test passed (found ${testResult.count} matching pages)`);
    } catch (error) {
      console.warn(`⚠ Search test failed: ${error.message}`);
    }

    console.log('\n==========================================');
    console.log('✅ Wiki FTS5 index backfill complete!');
    console.log('==========================================\n');

    console.log('Next steps:');
    console.log('1. Verify search functionality in the application');
    console.log('2. Monitor search performance');
    console.log('3. The FTS5 index will auto-update via triggers on page changes\n');
  } catch (error) {
    console.error(`\n❌ Fatal error: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  } finally {
    if (db) {
      db.close();
      console.log('✓ Database connection closed');
    }
  }
}

// Run the backfill
backfillWikiSearch().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
