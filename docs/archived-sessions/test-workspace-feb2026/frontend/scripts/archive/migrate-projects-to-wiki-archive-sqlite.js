#!/usr/bin/env node

/**
 * Migrate Project Content to Wiki Archive (SQLite Version)
 *
 * This script migrates the main content body from 6 main projects to wiki archive pages:
 * 1. Reads current content and full revision history from content.db and project_revisions
 * 2. Creates wiki pages in wiki.db with slug pattern: archive/{project-slug}
 * 3. Migrates all revisions to wiki_revisions
 * 4. Clears projects.content field (sets to empty string)
 * 5. Keeps all other project data untouched (title, description, galleries, workspaces, etc.)
 *
 * After running, use `npm run wiki:export` to export to markdown files.
 *
 * Usage: node frontend/scripts/archive/migrate-projects-to-wiki-archive-sqlite.js
 */

const Database = require('better-sqlite3');
const readline = require('readline');
const path = require('path');
const fs = require('fs');

// Database paths
const contentDbPath = path.join(__dirname, '../../data/content.db');
const wikiDbPath = path.join(__dirname, '../../data/wiki.db');

// The 6 main projects to migrate
const PROJECTS_TO_MIGRATE = [
  'noxii',
  'autumn',
  'dodec',
  'on-command',
  'cosmic-knights',
  'project-coalesce',
];

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function confirmAction(message) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise(resolve => {
    rl.question(`${colors.yellow}${message} (yes/no): ${colors.reset}`, answer => {
      rl.close();
      resolve(answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y');
    });
  });
}

function getProjectData(contentDb, slug) {
  try {
    // Get current project data
    const project = contentDb
      .prepare(
        `SELECT id, slug, title, description, status, category, color, created_at, updated_at, content
         FROM projects
         WHERE slug = ?`
      )
      .get(slug);

    if (!project) {
      throw new Error(`Project '${slug}' not found in content.db`);
    }

    // Get revision history
    const revisions = contentDb
      .prepare(
        `SELECT id, content, revision_summary, created_at, created_by
         FROM project_revisions
         WHERE project_id = ?
         ORDER BY created_at ASC`
      )
      .all(project.id);

    return {
      project,
      revisions,
    };
  } catch (error) {
    throw new Error(`Failed to get project data for '${slug}': ${error.message}`);
  }
}

function createWikiPage(wikiDb, project, revisions) {
  const wikiSlug = `archive/${project.slug}`;

  // Start transaction
  const transaction = wikiDb.transaction(() => {
    // Check if wiki page already exists
    const existingPage = wikiDb.prepare('SELECT id FROM wiki_pages WHERE slug = ?').get(wikiSlug);

    if (existingPage) {
      log(`  ⚠️  Wiki page '${wikiSlug}' already exists, skipping...`, 'yellow');
      return { skipped: true, slug: wikiSlug };
    }

    // Create wiki page
    const insertPage = wikiDb.prepare(
      `INSERT INTO wiki_pages
       (slug, title, category_id, namespace, status, created_at, updated_at, project_slug)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    );

    const pageResult = insertPage.run(
      wikiSlug,
      project.title,
      'archive',
      'main',
      'published',
      project.created_at,
      project.updated_at,
      project.slug
    );

    const pageId = pageResult.lastInsertRowid;
    log(`  ✓ Created wiki page: ${wikiSlug} (ID: ${pageId})`, 'green');

    // Link to archive category
    const insertCategory = wikiDb.prepare(
      `INSERT OR IGNORE INTO wiki_page_categories (page_id, category_id)
       VALUES (?, ?)`
    );
    insertCategory.run(pageId, 'archive');

    // Create revisions
    let revisionCount = 0;

    if (revisions.length > 0) {
      // Migrate all historical revisions
      const insertRevision = wikiDb.prepare(
        `INSERT INTO wiki_revisions
         (page_id, content, content_format, revision_summary, revision_timestamp, author_id, author_name, size_bytes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      );

      for (const revision of revisions) {
        const content = revision.content || '';
        const sizeBytes = Buffer.byteLength(content, 'utf8');

        insertRevision.run(
          pageId,
          content,
          'markdown',
          revision.revision_summary || 'Migrated from project content',
          revision.created_at,
          revision.created_by || 1, // Default to admin user
          'System',
          sizeBytes
        );
        revisionCount++;
      }
      log(`  ✓ Migrated ${revisionCount} revisions`, 'green');
    } else {
      // No revision history, create initial revision from current content
      const content = project.content || '';
      const sizeBytes = Buffer.byteLength(content, 'utf8');

      const insertRevision = wikiDb.prepare(
        `INSERT INTO wiki_revisions
         (page_id, content, content_format, revision_summary, revision_timestamp, author_id, author_name, size_bytes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      );

      insertRevision.run(
        pageId,
        content,
        'markdown',
        'Migrated from project content',
        project.updated_at,
        1, // Admin user
        'System',
        sizeBytes
      );
      revisionCount = 1;
      log(`  ✓ Created initial revision from current content`, 'green');
    }

    return {
      skipped: false,
      slug: wikiSlug,
      pageId,
      revisionCount,
    };
  });

  return transaction();
}

function clearProjectContent(contentDb, projectSlug) {
  try {
    const update = contentDb.prepare(
      `UPDATE projects
       SET content = '', updated_at = CURRENT_TIMESTAMP
       WHERE slug = ?`
    );

    update.run(projectSlug);
    log(`  ✓ Cleared content field for project '${projectSlug}'`, 'green');
  } catch (error) {
    throw new Error(`Failed to clear content for '${projectSlug}': ${error.message}`);
  }
}

function migrateProject(contentDb, wikiDb, slug) {
  log(`\n${'='.repeat(60)}`, 'cyan');
  log(`Migrating: ${slug}`, 'bright');
  log('='.repeat(60), 'cyan');

  try {
    // Step 1: Get project data
    log('\n1️⃣  Reading project data...', 'blue');
    const { project, revisions } = getProjectData(contentDb, slug);

    log(`  ✓ Found project: ${project.title}`, 'green');
    log(`  ✓ Current content length: ${(project.content || '').length} characters`, 'green');
    log(`  ✓ Revision history: ${revisions.length} revisions`, 'green');

    // Step 2: Create wiki page and migrate revisions
    log('\n2️⃣  Creating wiki archive page...', 'blue');
    const wikiResult = createWikiPage(wikiDb, project, revisions);

    if (wikiResult.skipped) {
      log(`\n⚠️  Skipped: ${slug} (wiki page already exists)`, 'yellow');
      return { success: true, skipped: true, slug };
    }

    // Step 3: Clear original project content
    log('\n3️⃣  Clearing original project content...', 'blue');
    clearProjectContent(contentDb, slug);

    log(`\n✅ Successfully migrated: ${slug}`, 'green');
    log(`   Wiki page: /wiki/${wikiResult.slug}`, 'cyan');
    log(`   Revisions: ${wikiResult.revisionCount}`, 'cyan');

    return {
      success: true,
      skipped: false,
      slug,
      wikiSlug: wikiResult.slug,
      revisionCount: wikiResult.revisionCount,
    };
  } catch (error) {
    log(`\n❌ Failed to migrate ${slug}: ${error.message}`, 'red');
    return {
      success: false,
      slug,
      error: error.message,
    };
  }
}

async function main() {
  log('\n' + '='.repeat(60), 'bright');
  log('Project Content to Wiki Archive Migration (SQLite)', 'bright');
  log('='.repeat(60) + '\n', 'bright');

  // Check if databases exist
  if (!fs.existsSync(contentDbPath)) {
    log(`❌ content.db not found at: ${contentDbPath}`, 'red');
    process.exit(1);
  }

  if (!fs.existsSync(wikiDbPath)) {
    log(`❌ wiki.db not found at: ${wikiDbPath}`, 'red');
    process.exit(1);
  }

  log('This script will:', 'yellow');
  log('  1. Read content and revisions from 6 main projects', 'yellow');
  log('  2. Create wiki pages in archive category', 'yellow');
  log('  3. Migrate all revision history', 'yellow');
  log('  4. Clear projects.content field (set to empty string)', 'yellow');
  log('  5. Keep all other project data untouched\n', 'yellow');

  log('Projects to migrate:', 'cyan');
  PROJECTS_TO_MIGRATE.forEach((slug, index) => {
    log(`  ${index + 1}. ${slug} → archive/${slug}`, 'cyan');
  });

  log('\n⚠️  WARNING: This operation will clear the content field from projects!', 'red');
  log('   Make sure you have a database backup before proceeding.\n', 'red');

  const confirmed = await confirmAction('Continue with migration?');

  if (!confirmed) {
    log('\n❌ Migration cancelled by user', 'yellow');
    process.exit(0);
  }

  log('\n🚀 Starting migration...\n', 'green');

  // Open databases
  const contentDb = new Database(contentDbPath);
  const wikiDb = new Database(wikiDbPath);

  contentDb.pragma('journal_mode = WAL');
  wikiDb.pragma('journal_mode = WAL');

  const results = [];

  try {
    for (const slug of PROJECTS_TO_MIGRATE) {
      const result = migrateProject(contentDb, wikiDb, slug);
      results.push(result);
    }

    // Summary
    log('\n' + '='.repeat(60), 'bright');
    log('Migration Summary', 'bright');
    log('='.repeat(60) + '\n', 'bright');

    const successful = results.filter(r => r.success && !r.skipped);
    const skipped = results.filter(r => r.skipped);
    const failed = results.filter(r => !r.success);

    log(`✅ Successful: ${successful.length}`, 'green');
    if (successful.length > 0) {
      successful.forEach(r => {
        log(`   - ${r.slug} → ${r.wikiSlug} (${r.revisionCount} revisions)`, 'green');
      });
    }

    if (skipped.length > 0) {
      log(`\n⚠️  Skipped: ${skipped.length}`, 'yellow');
      skipped.forEach(r => {
        log(`   - ${r.slug} (already exists)`, 'yellow');
      });
    }

    if (failed.length > 0) {
      log(`\n❌ Failed: ${failed.length}`, 'red');
      failed.forEach(r => {
        log(`   - ${r.slug}: ${r.error}`, 'red');
      });
    }

    log('\n📦 Next steps:', 'cyan');
    log('   1. Verify wiki pages: http://localhost:3000/wiki/category/archive', 'cyan');
    log('   2. Export to markdown: npm run wiki:export (if using PostgreSQL)', 'cyan');
    log('   3. Check wiki database for new pages\n', 'cyan');

    contentDb.close();
    wikiDb.close();

    if (failed.length > 0) {
      process.exit(1);
    }

    process.exit(0);
  } catch (error) {
    contentDb.close();
    wikiDb.close();
    throw error;
  }
}

// Run migration
main().catch(error => {
  log(`\n❌ Migration failed: ${error.message}`, 'red');
  console.error(error);
  process.exit(1);
});
