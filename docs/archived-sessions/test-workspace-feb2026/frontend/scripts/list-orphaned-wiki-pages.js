#!/usr/bin/env node

/**
 * List Orphaned Wiki Pages
 *
 * Shows all wiki pages with created_by = NULL that can now be deleted by admins
 *
 * Usage:
 *   node scripts/list-orphaned-wiki-pages.js
 *   npm run wiki:list-orphaned
 */

const path = require('path');
const Database = require('better-sqlite3');

const DB_PATH = path.join(__dirname, '../data/wiki.db');

console.log('==========================================');
console.log('Orphaned Wiki Pages Report');
console.log('==========================================\n');

try {
  const db = new Database(DB_PATH, { readonly: true });

  // Get all orphaned pages
  const orphanedPages = db
    .prepare(
      `
    SELECT
      id,
      slug,
      title,
      category_id,
      created_at,
      updated_at,
      status
    FROM wiki_pages
    WHERE created_by IS NULL
    ORDER BY created_at DESC
  `
    )
    .all();

  console.log(`Found ${orphanedPages.length} orphaned pages\n`);
  console.log('These pages can now be deleted by administrators.\n');

  if (orphanedPages.length > 0) {
    console.log('Page List:\n');
    console.log('ID'.padEnd(5) + 'Slug'.padEnd(40) + 'Title'.padEnd(30) + 'Created');
    console.log('-'.repeat(100));

    orphanedPages.forEach(page => {
      const slug = page.slug.length > 38 ? page.slug.substring(0, 35) + '...' : page.slug;
      const title = page.title.length > 28 ? page.title.substring(0, 25) + '...' : page.title;
      const created = page.created_at.substring(0, 10);

      console.log(String(page.id).padEnd(5) + slug.padEnd(40) + title.padEnd(30) + created);
    });

    console.log('\n');
    console.log('Access URLs:');
    orphanedPages.slice(0, 5).forEach(page => {
      console.log(`  http://localhost:3000/wiki/${page.slug}`);
    });

    if (orphanedPages.length > 5) {
      console.log(`  ... and ${orphanedPages.length - 5} more pages`);
    }
  }

  // Statistics
  const totalPages = db.prepare('SELECT COUNT(*) as count FROM wiki_pages').get();
  const percentage = ((orphanedPages.length / totalPages.count) * 100).toFixed(1);

  console.log('\n');
  console.log('Statistics:');
  console.log(`  Total wiki pages: ${totalPages.count}`);
  console.log(`  Orphaned pages: ${orphanedPages.length}`);
  console.log(`  Percentage: ${percentage}%`);

  console.log('\n');
  console.log('ℹ️  After the fix, admins can now delete these pages via the UI.');
  console.log('   Regular users still cannot delete pages they did not create.\n');

  db.close();
} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}
