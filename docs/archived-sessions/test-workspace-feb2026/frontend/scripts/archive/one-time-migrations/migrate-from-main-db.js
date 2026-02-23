/**
 * Migrate REAL project content from main.db to content.db
 *
 * The real full project content is stored in main.db, not wiki.db!
 */

const Database = require('better-sqlite3');
const path = require('path');

const MAIN_DB_PATH = path.join(__dirname, '../data/main.db');
const CONTENT_DB_PATH = path.join(__dirname, '../data/content.db');

function migrateFromMainDb() {
  console.log('🔄 Migrating REAL project content from main.db to content.db\n');

  const mainDb = new Database(MAIN_DB_PATH);
  const contentDb = new Database(CONTENT_DB_PATH);

  try {
    // Get all projects from main.db
    const mainProjects = mainDb
      .prepare(
        `
      SELECT slug, title, description, category, status, content,
             created_at, updated_at, is_universal_system
      FROM projects
      ORDER BY slug
    `
      )
      .all();

    console.log(`📄 Found ${mainProjects.length} projects in main.db\n`);

    let migratedCount = 0;
    let updatedCount = 0;
    let errorCount = 0;

    for (const project of mainProjects) {
      console.log(`\n📌 Processing: ${project.slug}`);
      console.log(`   Title: ${project.title}`);
      console.log(`   Content size: ${project.content ? project.content.length : 0} bytes`);

      try {
        // Check if project exists in content.db
        const existingProject = contentDb
          .prepare(
            `
          SELECT slug, LENGTH(content) as current_length FROM projects WHERE slug = ?
        `
          )
          .get(project.slug);

        if (!existingProject) {
          console.log(`   ⚠️  Project not found in content.db, skipping`);
          errorCount++;
          continue;
        }

        // Update the project with real content
        const updateResult = contentDb
          .prepare(
            `
          UPDATE projects
          SET content = ?,
              title = ?,
              description = ?,
              category = ?,
              status = ?,
              is_universal_system = ?,
              updated_at = ?
          WHERE slug = ?
        `
          )
          .run(
            project.content || '',
            project.title || project.slug.toUpperCase(),
            project.description || '',
            project.category || 'Uncategorized',
            project.status || 'Concept',
            project.is_universal_system || 0,
            project.updated_at || new Date().toISOString(),
            project.slug
          );

        if (updateResult.changes > 0) {
          const newSize = project.content ? project.content.length : 0;
          console.log(
            `   ✅ Updated project (${existingProject.current_length} → ${newSize} bytes)`
          );

          // Create revision with real content
          const revisionExists = contentDb
            .prepare(
              `
            SELECT COUNT(*) as count FROM project_revisions
            WHERE project_slug = ? AND author_name != 'Test System' AND author_name != 'Migration Script'
          `
            )
            .get(project.slug);

          if (revisionExists.count === 0 && project.content) {
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
                content_format,
                is_minor
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `
              )
              .run(
                project.slug,
                project.content,
                `Restored original content from main.db (${newSize} bytes)`,
                null,
                'Content Restoration',
                project.updated_at || new Date().toISOString(),
                newSize,
                'markdown',
                0
              );

            console.log(`   ✅ Created revision ID: ${revisionResult.lastInsertRowid}`);
            migratedCount++;
          } else {
            console.log(`   ℹ️  Revision already exists, only updated content`);
            updatedCount++;
          }
        } else {
          console.log(`   ❌ Failed to update project`);
          errorCount++;
        }
      } catch (error) {
        console.error(`   ❌ Error migrating ${project.slug}:`, error.message);
        errorCount++;
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('📊 Migration Summary:');
    console.log(`   ✅ New revisions created: ${migratedCount}`);
    console.log(`   ℹ️  Projects updated: ${updatedCount}`);
    console.log(`   ❌ Errors: ${errorCount}`);
    console.log('='.repeat(60) + '\n');

    // Verification
    console.log('🔍 Verifying migration...\n');
    const verificationResults = contentDb
      .prepare(
        `
      SELECT
        p.slug,
        p.title,
        LENGTH(p.content) as content_length,
        COUNT(DISTINCT pr.id) as revision_count
      FROM projects p
      LEFT JOIN project_revisions pr ON p.slug = pr.project_slug
      GROUP BY p.slug
      ORDER BY p.slug
    `
      )
      .all();

    console.log('📊 Final project status:\n');
    verificationResults.forEach(result => {
      const status =
        result.content_length > 1000 ? '✅' : result.content_length > 100 ? '⚠️ ' : '❌';
      console.log(
        `   ${status} ${result.slug.padEnd(25)} ${String(result.content_length).padStart(6)} bytes, ${result.revision_count} revision(s)`
      );
    });
    console.log('');

    console.log('✨ Migration from main.db completed!\n');
  } catch (error) {
    console.error('❌ Fatal error during migration:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    mainDb.close();
    contentDb.close();
  }
}

// Run migration
if (require.main === module) {
  migrateFromMainDb();
}

module.exports = { migrateFromMainDb };
