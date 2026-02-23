/**
 * Migrate project content from wiki.db to content.db
 *
 * This script finds all wiki pages that belong to projects and copies
 * their latest content to the projects table and creates initial revisions.
 */

const Database = require('better-sqlite3');
const path = require('path');

const WIKI_DB_PATH = path.join(__dirname, '../data/wiki.db');
const CONTENT_DB_PATH = path.join(__dirname, '../data/content.db');

function migrateProjectContent() {
  console.log('🔄 Migrating project content from wiki.db to content.db\n');

  const wikiDb = new Database(WIKI_DB_PATH);
  const contentDb = new Database(CONTENT_DB_PATH);

  try {
    // Find all main project pages (the ones with -main suffix)
    const mainProjectPages = wikiDb
      .prepare(
        `
      SELECT id, slug, title, project_slug
      FROM wiki_pages
      WHERE slug LIKE '%-main' AND project_slug IS NOT NULL
      ORDER BY slug
    `
      )
      .all();

    console.log(`📄 Found ${mainProjectPages.length} main project pages to migrate\n`);

    let migratedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const page of mainProjectPages) {
      console.log(`\n📌 Processing: ${page.slug} (project: ${page.project_slug})`);

      try {
        // Get latest revision content from wiki
        const latestRevision = wikiDb
          .prepare(
            `
          SELECT content, summary, author_id, revision_timestamp, size_bytes
          FROM wiki_revisions
          WHERE page_id = ?
          ORDER BY revision_timestamp DESC
          LIMIT 1
        `
          )
          .get(page.id);

        if (!latestRevision || !latestRevision.content) {
          console.log(`  ⚠️  No content found, skipping`);
          skippedCount++;
          continue;
        }

        console.log(`  📝 Found content: ${latestRevision.size_bytes} bytes`);

        // Check if project exists in content.db
        const existingProject = contentDb
          .prepare(
            `
          SELECT slug, LENGTH(content) as current_length FROM projects WHERE slug = ?
        `
          )
          .get(page.project_slug);

        if (!existingProject) {
          console.log(`  ❌ Project '${page.project_slug}' not found in content.db, skipping`);
          skippedCount++;
          continue;
        }

        // Update the project content
        const updateResult = contentDb
          .prepare(
            `
          UPDATE projects
          SET content = ?,
              updated_at = ?
          WHERE slug = ?
        `
          )
          .run(latestRevision.content, latestRevision.revision_timestamp, page.project_slug);

        if (updateResult.changes > 0) {
          console.log(
            `  ✅ Updated project content (${existingProject.current_length} → ${latestRevision.size_bytes} bytes)`
          );

          // Create initial revision in project_revisions
          const revisionResult = contentDb
            .prepare(
              `
            INSERT INTO project_revisions (
              project_slug,
              content,
              summary,
              author_id,
              author_name,
              revision_timestamp,
              size_bytes,
              content_format
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `
            )
            .run(
              page.project_slug,
              latestRevision.content,
              latestRevision.summary || 'Migrated from wiki.db',
              latestRevision.author_id,
              'Migration Script',
              latestRevision.revision_timestamp,
              latestRevision.size_bytes,
              'markdown'
            );

          console.log(`  ✅ Created revision ID: ${revisionResult.lastInsertRowid}`);
          migratedCount++;
        } else {
          console.log(`  ❌ Failed to update project`);
          errorCount++;
        }
      } catch (error) {
        console.error(`  ❌ Error migrating ${page.slug}:`, error.message);
        errorCount++;
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('📊 Migration Summary:');
    console.log(`  ✅ Successfully migrated: ${migratedCount}`);
    console.log(`  ⚠️  Skipped: ${skippedCount}`);
    console.log(`  ❌ Errors: ${errorCount}`);
    console.log('='.repeat(60) + '\n');

    if (migratedCount > 0) {
      console.log('✨ Migration completed successfully!\n');

      // Verify the migration
      console.log('🔍 Verifying migration...\n');
      const verificationResults = contentDb
        .prepare(
          `
        SELECT
          p.slug,
          p.title,
          LENGTH(p.content) as content_length,
          COUNT(pr.id) as revision_count
        FROM projects p
        LEFT JOIN project_revisions pr ON p.slug = pr.project_slug
        GROUP BY p.slug
        ORDER BY p.slug
      `
        )
        .all();

      console.log('📊 Current project status:');
      verificationResults.forEach(result => {
        const status = result.content_length > 100 ? '✅' : '⚠️ ';
        console.log(
          `  ${status} ${result.slug}: ${result.content_length} bytes, ${result.revision_count} revision(s)`
        );
      });
      console.log('');
    }
  } catch (error) {
    console.error('❌ Fatal error during migration:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    wikiDb.close();
    contentDb.close();
  }
}

// Run migration
if (require.main === module) {
  migrateProjectContent();
}

module.exports = { migrateProjectContent };
