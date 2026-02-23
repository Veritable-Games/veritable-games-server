#!/usr/bin/env node
/**
 * fix-journal-category.js
 *
 * Fixes journal pages that have namespace='journals' but category_id='uncategorized'
 * This happens when pages were created before the category/namespace auto-assignment fix
 *
 * Usage:
 *   POSTGRES_URL=... node scripts/wiki/fix-journal-category.js [--dry-run]
 */

const { Pool } = require('pg');

const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');

async function main() {
  console.log('🔧 Journal Category Fix');
  console.log('=======================\n');

  if (isDryRun) {
    console.log('🔎 DRY RUN MODE - No changes will be made\n');
  }

  const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;

  if (!connectionString) {
    console.error('❌ Error: POSTGRES_URL or DATABASE_URL environment variable not set');
    process.exit(1);
  }

  const pool = new Pool({ connectionString });

  try {
    // Find pages with namespace='journals' but category_id='uncategorized'
    const selectQuery = `
      SELECT id, slug, title, namespace, category_id
      FROM wiki.wiki_pages
      WHERE namespace = 'journals' AND category_id = 'uncategorized'
      ORDER BY id
    `;

    const result = await pool.query(selectQuery);
    const pages = result.rows;

    console.log(`Found ${pages.length} journal pages with incorrect category:\n`);

    if (pages.length === 0) {
      console.log('✅ No pages need fixing!');
      await pool.end();
      return;
    }

    // Show first 10 as examples
    const displayCount = Math.min(10, pages.length);
    console.log(`First ${displayCount} affected pages:`);
    pages.slice(0, displayCount).forEach((page, idx) => {
      console.log(`  ${idx + 1}. ID ${page.id}: "${page.title}"`);
      console.log(`     Current category: "${page.category_id}" → Should be: "journals"\n`);
    });

    if (pages.length > displayCount) {
      console.log(`  ... and ${pages.length - displayCount} more pages\n`);
    }

    if (!isDryRun) {
      // Update the category_id for all affected pages
      const updateQuery = `
        UPDATE wiki.wiki_pages
        SET category_id = 'journals'
        WHERE namespace = 'journals' AND category_id = 'uncategorized'
      `;

      const updateResult = await pool.query(updateQuery);
      console.log(
        `✅ Successfully updated ${updateResult.rowCount} pages to category_id='journals'`
      );
      console.log(`\n✨ All journal entries now have correct category!`);
    } else {
      console.log(`\n💡 Run without --dry-run to apply these changes`);
      console.log(`\nSQL Command:`);
      console.log(`UPDATE wiki.wiki_pages`);
      console.log(`SET category_id = 'journals'`);
      console.log(`WHERE namespace = 'journals' AND category_id = 'uncategorized';`);
    }

    await pool.end();
  } catch (error) {
    console.error('❌ Error:', error);
    await pool.end();
    process.exit(1);
  }
}

main();
