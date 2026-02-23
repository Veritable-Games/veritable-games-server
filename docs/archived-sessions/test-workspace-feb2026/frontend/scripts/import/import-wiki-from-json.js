#!/usr/bin/env node
/**
 * Import Wiki Pages from JSON Export
 *
 * Restores wiki pages from JSON backup to PostgreSQL
 * Used for disaster recovery when server is rebuilt
 *
 * Usage:
 *   node scripts/import/import-wiki-from-json.js [json-file]
 *   node scripts/import/import-wiki-from-json.js data/exports/wiki-pages.json
 */

const fs = require('fs');
const path = require('path');
const { pgPool } = require('../../src/lib/database/pool-postgres');

const COLORS = {
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
};

function log(message, color = 'reset') {
  console.log(`${COLORS[color]}${message}${COLORS.reset}`);
}

async function importWikiPages(jsonFilePath) {
  log('\n📚 Importing Wiki Pages from JSON', 'cyan');
  log('================================================\n', 'cyan');

  // Read JSON file
  const fullPath = path.resolve(process.cwd(), jsonFilePath);

  if (!fs.existsSync(fullPath)) {
    log(`❌ File not found: ${fullPath}`, 'red');
    process.exit(1);
  }

  const jsonData = fs.readFileSync(fullPath, 'utf8');
  const pages = JSON.parse(jsonData);

  if (!Array.isArray(pages) || pages.length === 0) {
    log('⚠️  No wiki pages to import (file is empty or invalid)', 'yellow');
    process.exit(0);
  }

  log(`Found ${pages.length} wiki pages to import\n`, 'green');

  // Ensure wiki schema exists
  await pgPool.query('CREATE SCHEMA IF NOT EXISTS wiki');

  // Ensure wiki_pages table exists
  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS wiki.wiki_pages (
      id SERIAL PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      slug VARCHAR(255) NOT NULL UNIQUE,
      content TEXT,
      category VARCHAR(100),
      tags TEXT[],
      author_id INTEGER,
      is_published BOOLEAN DEFAULT false,
      version INTEGER DEFAULT 1,
      parent_id INTEGER,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  let imported = 0;
  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (const page of pages) {
    try {
      // Check if page already exists (by slug)
      const existing = await pgPool.query('SELECT id FROM wiki.wiki_pages WHERE slug = $1', [
        page.slug,
      ]);

      if (existing.rows.length > 0) {
        // Update existing page
        await pgPool.query(
          `
          UPDATE wiki.wiki_pages
          SET
            title = $1,
            content = $2,
            category = $3,
            tags = $4,
            author_id = $5,
            is_published = $6,
            version = $7,
            parent_id = $8,
            updated_at = $9
          WHERE slug = $10
        `,
          [
            page.title,
            page.content,
            page.category,
            page.tags,
            page.author_id,
            page.is_published ?? false,
            page.version ?? 1,
            page.parent_id,
            page.updated_at || new Date(),
            page.slug,
          ]
        );

        log(`  ✅ Updated: ${page.title} (${page.slug})`, 'green');
        updated++;
      } else {
        // Insert new page
        await pgPool.query(
          `
          INSERT INTO wiki.wiki_pages (
            title, slug, content, category, tags, author_id,
            is_published, version, parent_id, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        `,
          [
            page.title,
            page.slug,
            page.content,
            page.category,
            page.tags,
            page.author_id,
            page.is_published ?? false,
            page.version ?? 1,
            page.parent_id,
            page.created_at || new Date(),
            page.updated_at || new Date(),
          ]
        );

        log(`  ✅ Imported: ${page.title} (${page.slug})`, 'green');
        imported++;
      }
    } catch (error) {
      log(`  ❌ Error importing "${page.title}": ${error.message}`, 'red');
      errors++;
    }
  }

  log('\n================================================', 'cyan');
  log('📊 Import Summary:', 'cyan');
  log(`   New pages imported: ${imported}`, 'green');
  log(`   Pages updated: ${updated}`, 'yellow');
  log(`   Errors: ${errors}`, errors > 0 ? 'red' : 'green');
  log('================================================\n', 'cyan');

  if (errors > 0) {
    log('⚠️  Some pages failed to import. Check errors above.', 'yellow');
  } else {
    log('✅ Wiki pages import complete!', 'green');
  }
}

// Main execution
const jsonFile = process.argv[2] || 'data/exports/wiki-pages.json';

importWikiPages(jsonFile)
  .then(() => {
    process.exit(0);
  })
  .catch(error => {
    log(`\n❌ Fatal error: ${error.message}`, 'red');
    console.error(error);
    process.exit(1);
  });
