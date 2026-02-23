#!/usr/bin/env node
/**
 * fix-journal-namespace.js
 *
 * Fixes journal pages that have category_id='journals' but incorrect namespace.
 * This happens when pages were created in the Journals category before the
 * namespace auto-assignment logic was added.
 *
 * Usage:
 *   node scripts/wiki/fix-journal-namespace.js [--dry-run]
 */

const path = require('path');
const fs = require('fs');

// Parse command line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');

// Determine if we're running in production or development
const isProduction =
  process.env.DATABASE_MODE === 'postgres' || process.env.NODE_ENV === 'production';

async function main() {
  console.log('🔍 Journal Namespace Migration Script');
  console.log('=====================================\n');

  if (isDryRun) {
    console.log('🔎 DRY RUN MODE - No changes will be made\n');
  }

  let db;
  let result;

  try {
    if (isProduction) {
      // Production: Use PostgreSQL
      console.log('📊 Using PostgreSQL database');
      const { Pool } = require('pg');

      const pool = new Pool({
        connectionString: process.env.POSTGRES_URL || process.env.DATABASE_URL,
      });

      // Find pages with category='journals' but namespace!='journals'
      const selectQuery = `
        SELECT id, slug, title, namespace, category_id, created_by
        FROM wiki.wiki_pages
        WHERE category_id = 'journals' AND namespace != 'journals'
        ORDER BY id
      `;

      result = await pool.query(selectQuery);
      const pages = result.rows;

      console.log(`Found ${pages.length} journal pages with incorrect namespace:\n`);

      if (pages.length === 0) {
        console.log('✅ No pages need fixing!');
        await pool.end();
        return;
      }

      // Display affected pages
      pages.forEach(page => {
        console.log(`  • ID ${page.id}: "${page.title}" (slug: ${page.slug})`);
        console.log(`    Current namespace: "${page.namespace}" → Should be: "journals"`);
        console.log(`    Created by user ID: ${page.created_by}\n`);
      });

      if (!isDryRun) {
        // Update the namespace for all affected pages
        const updateQuery = `
          UPDATE wiki.wiki_pages
          SET namespace = 'journals'
          WHERE category_id = 'journals' AND namespace != 'journals'
        `;

        const updateResult = await pool.query(updateQuery);
        console.log(
          `✅ Successfully updated ${updateResult.rowCount} pages to namespace='journals'`
        );
      } else {
        console.log(`\n💡 Run without --dry-run to apply these changes`);
      }

      await pool.end();
    } else {
      // Development: Use SQLite
      console.log('📊 Using SQLite database');
      const Database = require('better-sqlite3');
      const dbPath = path.join(__dirname, '../../data/wiki.db');

      if (!fs.existsSync(dbPath)) {
        console.error(`❌ Database not found at: ${dbPath}`);
        process.exit(1);
      }

      db = new Database(dbPath);

      // Find pages with category='journals' but namespace!='journals'
      const pages = db
        .prepare(
          `
        SELECT id, slug, title, namespace, category_id, created_by
        FROM wiki_pages
        WHERE category_id = 'journals' AND namespace != 'journals'
        ORDER BY id
      `
        )
        .all();

      console.log(`Found ${pages.length} journal pages with incorrect namespace:\n`);

      if (pages.length === 0) {
        console.log('✅ No pages need fixing!');
        db.close();
        return;
      }

      // Display affected pages
      pages.forEach(page => {
        console.log(`  • ID ${page.id}: "${page.title}" (slug: ${page.slug})`);
        console.log(`    Current namespace: "${page.namespace}" → Should be: "journals"`);
        console.log(`    Created by user ID: ${page.created_by}\n`);
      });

      if (!isDryRun) {
        // Update the namespace for all affected pages
        const updateStmt = db.prepare(`
          UPDATE wiki_pages
          SET namespace = 'journals'
          WHERE category_id = 'journals' AND namespace != 'journals'
        `);

        const updateResult = updateStmt.run();
        console.log(
          `✅ Successfully updated ${updateResult.changes} pages to namespace='journals'`
        );
      } else {
        console.log(`\n💡 Run without --dry-run to apply these changes`);
      }

      db.close();
    }

    console.log('\n✨ Migration complete!');
  } catch (error) {
    console.error('❌ Error during migration:', error);
    if (db) {
      db.close();
    }
    process.exit(1);
  }
}

main();
