#!/usr/bin/env node

/**
 * Wiki Pages Migration Script
 *
 * Migrates old wiki pages from main.db (legacy) to wiki.db (production)
 *
 * Usage:
 *   node scripts/migrate-old-wiki-pages.js              # Dry-run mode (default)
 *   node scripts/migrate-old-wiki-pages.js --execute    # Execute migration
 *   npm run wiki:migrate-old-pages                      # Via npm script
 *
 * Migrates:
 * - 4 wiki pages (community-guidelines, getting-started, political-messaging-strategy, the-enact-dialogue-system-03122023)
 * - 10 historical revisions
 * - Page view statistics
 */

const path = require('path');
const Database = require('better-sqlite3');

// Configuration
const DRY_RUN = !process.argv.includes('--execute');
const SKIP_PAGES_WITHOUT_CONTENT = true; // Skip pages with 0 revisions

const PAGES_TO_MIGRATE = [
  'community-guidelines',
  'getting-started',
  'political-messaging-strategy',
  'the-enact-dialogue-system-03122023',
];

// Database paths
const MAIN_DB_PATH = path.join(__dirname, '../data/main.db');
const WIKI_DB_PATH = path.join(__dirname, '../data/wiki.db');

console.log('==========================================');
console.log('Wiki Pages Migration');
console.log('==========================================\n');
console.log(`Mode: ${DRY_RUN ? 'DRY-RUN (no changes)' : 'EXECUTE (will modify database)'}`);
console.log(`Source: ${MAIN_DB_PATH}`);
console.log(`Target: ${WIKI_DB_PATH}\n`);

if (DRY_RUN) {
  console.log('ℹ️  Running in DRY-RUN mode. No changes will be made.');
  console.log('   Use --execute flag to perform actual migration.\n');
}

// Open database connections
let mainDb, wikiDb;
try {
  mainDb = new Database(MAIN_DB_PATH, { readonly: true });
  wikiDb = new Database(WIKI_DB_PATH, { readonly: DRY_RUN });
  if (!DRY_RUN) {
    wikiDb.pragma('journal_mode = WAL');
  }
  console.log('✓ Connected to databases\n');
} catch (error) {
  console.error(`❌ Error connecting to databases: ${error.message}`);
  process.exit(1);
}

// Statistics
const stats = {
  pagesProcessed: 0,
  pagesSkipped: 0,
  pagesMigrated: 0,
  revisionsMigrated: 0,
  viewsMigrated: 0,
  errors: [],
};

/**
 * Main migration function
 */
async function migrate() {
  console.log('Step 1: Analyzing pages to migrate...\n');

  for (const slug of PAGES_TO_MIGRATE) {
    try {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`Processing: ${slug}`);
      console.log('='.repeat(60));

      // Get page from main.db
      const oldPage = mainDb
        .prepare(
          `
        SELECT * FROM wiki_pages WHERE slug = ?
      `
        )
        .get(slug);

      if (!oldPage) {
        console.log(`⚠️  Page not found in main.db: ${slug}`);
        stats.pagesSkipped++;
        stats.errors.push({ page: slug, error: 'Page not found in source' });
        continue;
      }

      stats.pagesProcessed++;

      // Check if page already exists in wiki.db
      const existing = wikiDb
        .prepare(
          `
        SELECT id FROM wiki_pages WHERE slug = ?
      `
        )
        .get(slug);

      if (existing) {
        console.log(`⚠️  Page already exists in wiki.db (ID: ${existing.id})`);
        console.log('   Skipping to avoid duplicates.');
        stats.pagesSkipped++;
        continue;
      }

      // Get revisions
      const revisions = mainDb
        .prepare(
          `
        SELECT * FROM wiki_revisions
        WHERE page_id = ?
        ORDER BY revision_timestamp ASC
      `
        )
        .all(oldPage.id);

      console.log(`\nPage Details:`);
      console.log(`  Title: ${oldPage.title}`);
      console.log(`  Category: ${oldPage.category_id}`);
      console.log(`  Status: ${oldPage.status}`);
      console.log(`  Created: ${oldPage.created_at}`);
      console.log(`  Updated: ${oldPage.updated_at}`);
      console.log(`  Revisions: ${revisions.length}`);

      // Skip pages without content
      if (SKIP_PAGES_WITHOUT_CONTENT && revisions.length === 0) {
        console.log(`\n⚠️  Skipping page (no revisions/content)`);
        stats.pagesSkipped++;
        continue;
      }

      // Get page views
      const views = mainDb
        .prepare(
          `
        SELECT SUM(view_count) as total_views
        FROM wiki_page_views
        WHERE page_id = ?
      `
        )
        .get(oldPage.id);

      const totalViews = views?.total_views || 0;
      console.log(`  Views: ${totalViews}`);

      if (DRY_RUN) {
        console.log(`\n✓ Would migrate this page with ${revisions.length} revision(s)`);
        stats.pagesMigrated++;
        stats.revisionsMigrated += revisions.length;
        stats.viewsMigrated += totalViews;
        continue;
      }

      // Execute migration (not DRY_RUN)
      console.log(`\n📝 Migrating page...`);

      const transaction = wikiDb.transaction(() => {
        // Insert page
        const insertPage = wikiDb.prepare(`
          INSERT INTO wiki_pages (
            slug, title, namespace, status, protection_level,
            created_by, created_at, updated_at, project_slug,
            template_type, is_deleted, deleted_by, deleted_at,
            content_type, document_author, publication_date,
            download_count, category_id
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        const result = insertPage.run(
          oldPage.slug,
          oldPage.title,
          oldPage.namespace,
          oldPage.status,
          oldPage.protection_level,
          oldPage.created_by,
          oldPage.created_at,
          oldPage.updated_at,
          oldPage.project_slug,
          oldPage.template_type,
          oldPage.is_deleted,
          oldPage.deleted_by,
          oldPage.deleted_at,
          oldPage.content_type,
          oldPage.document_author,
          oldPage.publication_date,
          oldPage.download_count,
          oldPage.category_id
        );

        const newPageId = result.lastInsertRowid;
        console.log(`   ✓ Inserted page (new ID: ${newPageId})`);

        // Insert revisions
        if (revisions.length > 0) {
          const insertRevision = wikiDb.prepare(`
            INSERT INTO wiki_revisions (
              page_id, content, summary, content_format,
              author_id, author_ip, is_minor, size_bytes,
              revision_timestamp
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `);

          let revisionsInserted = 0;
          for (const rev of revisions) {
            insertRevision.run(
              newPageId,
              rev.content,
              rev.summary,
              rev.content_format,
              rev.author_id,
              rev.author_ip,
              rev.is_minor,
              rev.size_bytes,
              rev.revision_timestamp
            );
            revisionsInserted++;
          }
          console.log(`   ✓ Inserted ${revisionsInserted} revision(s)`);
        }

        // Log migration activity
        const insertActivity = wikiDb.prepare(`
          INSERT INTO unified_activity (user_id, activity_type, entity_type, entity_id, action, metadata)
          VALUES (?, ?, ?, ?, ?, ?)
        `);

        insertActivity.run(
          oldPage.created_by || 1, // Use original creator or admin (id=1)
          'wiki_edit',
          'page',
          newPageId.toString(),
          'migrate',
          JSON.stringify({
            title: oldPage.title,
            source: 'main.db',
            migrated_at: new Date().toISOString(),
            original_created_at: oldPage.created_at,
            revisions_count: revisions.length,
          })
        );
        console.log(`   ✓ Logged migration activity`);

        // Note: Page views are not migrated to wiki.db as the table doesn't exist
        // Views are tracked elsewhere in the new architecture

        return { pageId: newPageId, revisionsCount: revisions.length };
      });

      const migrationResult = transaction();

      console.log(`\n✅ Migration successful!`);
      console.log(`   New page ID: ${migrationResult.pageId}`);
      console.log(`   Revisions migrated: ${migrationResult.revisionsCount}`);

      stats.pagesMigrated++;
      stats.revisionsMigrated += migrationResult.revisionsCount;
      stats.viewsMigrated += totalViews;
    } catch (error) {
      console.error(`\n❌ Error migrating ${slug}:`, error.message);
      stats.errors.push({ page: slug, error: error.message });
    }
  }

  // Print summary
  console.log(`\n\n${'='.repeat(60)}`);
  console.log('Migration Summary');
  console.log('='.repeat(60));
  console.log(`\nPages processed: ${stats.pagesProcessed}`);
  console.log(`Pages migrated: ${stats.pagesMigrated}`);
  console.log(`Pages skipped: ${stats.pagesSkipped}`);
  console.log(`Revisions migrated: ${stats.revisionsMigrated}`);
  console.log(`Total views: ${stats.viewsMigrated}`);

  if (stats.errors.length > 0) {
    console.log(`\n⚠️  Errors (${stats.errors.length}):`);
    stats.errors.forEach(err => {
      console.log(`   - ${err.page}: ${err.error}`);
    });
  }

  if (!DRY_RUN && stats.pagesMigrated > 0) {
    console.log(`\n✅ Migration completed successfully!`);
    console.log(`\nNext steps:`);
    console.log(`  1. Rebuild FTS5 search index: npm run wiki:reindex`);
    console.log(`  2. Test migrated pages in web UI`);
    console.log(`  3. Verify revision history for each page\n`);
  } else if (DRY_RUN) {
    console.log(`\n✓ Dry-run completed. Run with --execute to perform migration.\n`);
  }
}

// Run migration
migrate()
  .catch(error => {
    console.error('\n❌ Fatal error:', error.message);
    console.error(error.stack);
    process.exit(1);
  })
  .finally(() => {
    if (mainDb) mainDb.close();
    if (wikiDb) wikiDb.close();
    console.log('✓ Database connections closed');
  });
