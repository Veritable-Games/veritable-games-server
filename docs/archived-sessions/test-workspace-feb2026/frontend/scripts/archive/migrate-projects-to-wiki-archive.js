#!/usr/bin/env node

/**
 * Migrate Project Content to Wiki Archive
 *
 * This script migrates the main content body from 6 main projects to wiki archive pages:
 * 1. Reads current content and full revision history from content.projects and content.project_revisions
 * 2. Creates wiki pages in wiki.wiki_pages with slug pattern: archive/{project-slug}
 * 3. Migrates all revisions to wiki.wiki_revisions
 * 4. Clears content.projects.content field (sets to empty string)
 * 5. Keeps all other project data untouched (title, description, galleries, workspaces, etc.)
 *
 * After running, use `npm run wiki:export` to export to markdown files.
 *
 * Usage: node frontend/scripts/archive/migrate-projects-to-wiki-archive.js
 */

const { Pool } = require('pg');
const readline = require('readline');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL,
  ssl: process.env.POSTGRES_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

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

async function getProjectData(slug) {
  try {
    // Get current project data
    const projectResult = await pool.query(
      `SELECT id, slug, title, description, status, category, color, created_at, updated_at, content
       FROM content.projects
       WHERE slug = $1`,
      [slug]
    );

    if (projectResult.rows.length === 0) {
      throw new Error(`Project '${slug}' not found in content.projects`);
    }

    const project = projectResult.rows[0];

    // Get revision history
    const revisionsResult = await pool.query(
      `SELECT id, content, summary, revision_timestamp, author_id, author_name
       FROM content.project_revisions
       WHERE project_slug = $1
       ORDER BY revision_timestamp ASC`,
      [slug]
    );

    return {
      project,
      revisions: revisionsResult.rows,
    };
  } catch (error) {
    throw new Error(`Failed to get project data for '${slug}': ${error.message}`);
  }
}

async function createWikiPage(project, revisions) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const wikiSlug = `archive/${project.slug}`;

    // Check if wiki page already exists
    const existingPage = await client.query('SELECT id FROM wiki.wiki_pages WHERE slug = $1', [
      wikiSlug,
    ]);

    if (existingPage.rows.length > 0) {
      log(`  ⚠️  Wiki page '${wikiSlug}' already exists, skipping...`, 'yellow');
      await client.query('ROLLBACK');
      return { skipped: true, slug: wikiSlug };
    }

    // Create wiki page
    const pageResult = await client.query(
      `INSERT INTO wiki.wiki_pages
       (slug, title, category_id, namespace, status, created_at, updated_at, project_slug)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [
        wikiSlug,
        project.title,
        'archive',
        'main',
        'published',
        project.created_at,
        project.updated_at,
        project.slug,
      ]
    );

    const pageId = pageResult.rows[0].id;
    log(`  ✓ Created wiki page: ${wikiSlug} (ID: ${pageId})`, 'green');

    // Link to archive category
    await client.query(
      `INSERT INTO wiki.wiki_page_categories (page_id, category_id)
       VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [pageId, 'archive']
    );

    // Create revisions
    let revisionCount = 0;

    if (revisions.length > 0) {
      // Migrate all historical revisions
      for (const revision of revisions) {
        const content = revision.content || '';
        const sizeBytes = Buffer.byteLength(content, 'utf8');

        await client.query(
          `INSERT INTO wiki.wiki_revisions
           (page_id, content, content_format, summary, revision_timestamp, author_id, size_bytes)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            pageId,
            content,
            'markdown',
            revision.summary || 'Migrated from project content',
            revision.revision_timestamp,
            revision.author_id || 1, // Default to admin user
            sizeBytes,
          ]
        );
        revisionCount++;
      }
      log(`  ✓ Migrated ${revisionCount} revisions`, 'green');
    } else {
      // No revision history, create initial revision from current content
      const content = project.content || '';
      const sizeBytes = Buffer.byteLength(content, 'utf8');

      await client.query(
        `INSERT INTO wiki.wiki_revisions
         (page_id, content, content_format, summary, revision_timestamp, author_id, size_bytes)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          pageId,
          content,
          'markdown',
          'Migrated from project content',
          project.updated_at,
          1, // Admin user
          sizeBytes,
        ]
      );
      revisionCount = 1;
      log(`  ✓ Created initial revision from current content`, 'green');
    }

    await client.query('COMMIT');

    return {
      skipped: false,
      slug: wikiSlug,
      pageId,
      revisionCount,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function clearProjectContent(projectSlug) {
  try {
    await pool.query(
      `UPDATE content.projects
       SET content = '', updated_at = NOW()
       WHERE slug = $1`,
      [projectSlug]
    );
    log(`  ✓ Cleared content field for project '${projectSlug}'`, 'green');
  } catch (error) {
    throw new Error(`Failed to clear content for '${projectSlug}': ${error.message}`);
  }
}

async function migrateProject(slug) {
  log(`\n${'='.repeat(60)}`, 'cyan');
  log(`Migrating: ${slug}`, 'bright');
  log('='.repeat(60), 'cyan');

  try {
    // Step 1: Get project data
    log('\n1️⃣  Reading project data...', 'blue');
    const { project, revisions } = await getProjectData(slug);

    log(`  ✓ Found project: ${project.title}`, 'green');
    log(`  ✓ Current content length: ${(project.content || '').length} characters`, 'green');
    log(`  ✓ Revision history: ${revisions.length} revisions`, 'green');

    // Step 2: Create wiki page and migrate revisions
    log('\n2️⃣  Creating wiki archive page...', 'blue');
    const wikiResult = await createWikiPage(project, revisions);

    if (wikiResult.skipped) {
      log(`\n⚠️  Skipped: ${slug} (wiki page already exists)`, 'yellow');
      return { success: true, skipped: true, slug };
    }

    // Step 3: Clear original project content
    log('\n3️⃣  Clearing original project content...', 'blue');
    await clearProjectContent(slug);

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
  log('Project Content to Wiki Archive Migration', 'bright');
  log('='.repeat(60) + '\n', 'bright');

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
    await pool.end();
    process.exit(0);
  }

  log('\n🚀 Starting migration...\n', 'green');

  const results = [];

  for (const slug of PROJECTS_TO_MIGRATE) {
    const result = await migrateProject(slug);
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
  log('   2. Export to markdown: npm run wiki:export', 'cyan');
  log('   3. Check markdown files: frontend/content/wiki/archive/\n', 'cyan');

  await pool.end();

  if (failed.length > 0) {
    process.exit(1);
  }

  process.exit(0);
}

// Run migration
main().catch(async error => {
  log(`\n❌ Migration failed: ${error.message}`, 'red');
  console.error(error);
  await pool.end();
  process.exit(1);
});
