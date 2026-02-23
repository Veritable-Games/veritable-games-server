#!/usr/bin/env node

/**
 * Import Historical Wiki Revisions
 *
 * Imports 834 historical revisions from ~/Documents/Documents/docs/archive/versions/
 * into the PostgreSQL wiki.wiki_revisions table.
 *
 * Usage:
 *   node scripts/wiki/import-historical-revisions.js --dry-run    # Preview (default)
 *   node scripts/wiki/import-historical-revisions.js --execute    # Actually import
 *   node scripts/wiki/import-historical-revisions.js --slug=planet-chione  # Import single page
 *
 * Features:
 *   - Preserves all revision metadata (author, timestamp, summary)
 *   - Skips revisions that already exist
 *   - Auto-creates archive pages for unmatched slugs
 *   - Full dry-run mode for safety
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Configuration
const DRY_RUN = !process.argv.includes('--execute');
const SINGLE_SLUG = process.argv.find(arg => arg.startsWith('--slug='))?.split('=')[1];
const VERSIONS_DIR = path.join(process.env.HOME, 'Documents/Documents/docs/archive/versions');

// Slug mapping for pages that have been renamed
const SLUG_MAPPING = {
  // Add manual mappings here if needed
  // 'old-slug': 'new-slug'
};

// Database connection
const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    'postgresql://postgres:postgres@localhost:5432/veritable_games',
});

// Statistics
const stats = {
  pagesProcessed: 0,
  pagesMatched: 0,
  pagesUnmatched: 0,
  pagesArchived: 0,
  revisionsImported: 0,
  revisionsSkipped: 0,
  errors: [],
};

/**
 * Parse revision markdown file frontmatter and content
 */
function parseRevisionFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const match = content.match(/^---\n([\s\S]+?)\n---\n([\s\S]*)$/);

  if (!match) {
    throw new Error('Invalid revision file format');
  }

  const [, frontmatter, body] = match;
  const metadata = {};

  // Parse YAML frontmatter (simple parser)
  frontmatter.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split(':');
    if (key && valueParts.length > 0) {
      let value = valueParts.join(':').trim();
      // Remove quotes
      value = value.replace(/^["']|["']$/g, '');
      metadata[key.trim()] = value;
    }
  });

  return {
    metadata,
    content: body.trim(),
  };
}

/**
 * Get all revisions for a page directory
 */
function getPageRevisions(pageDir) {
  const files = fs
    .readdirSync(pageDir)
    .filter(f => f.startsWith('revision-') && f.endsWith('.md'))
    .sort((a, b) => {
      // Sort by sequence number (revision-{id}-{seq}.md)
      const seqA = parseInt(a.match(/-(\d+)\.md$/)[1]);
      const seqB = parseInt(b.match(/-(\d+)\.md$/)[1]);
      return seqA - seqB;
    });

  return files.map(file => {
    const filePath = path.join(pageDir, file);
    const { metadata, content } = parseRevisionFile(filePath);

    return {
      revision_id: parseInt(metadata.revision_id),
      page_id: parseInt(metadata.page_id),
      page_title: metadata.page_title,
      author: metadata.author || 'admin',
      author_ip: metadata.author_ip !== 'N/A' ? metadata.author_ip : null,
      timestamp: metadata.timestamp,
      summary: metadata.summary || 'Historical revision',
      is_minor: metadata.is_minor === 'true',
      content_format: metadata.content_format || 'markdown',
      content: content,
      size_bytes: Buffer.from(content, 'utf8').length,
    };
  });
}

/**
 * Import a single revision into PostgreSQL
 */
async function importRevision(pageId, revision) {
  // Check if revision already exists
  const existing = await pool.query(
    'SELECT id FROM wiki.wiki_revisions WHERE page_id = $1 AND revision_timestamp = $2',
    [pageId, revision.timestamp]
  );

  if (existing.rows.length > 0) {
    stats.revisionsSkipped++;
    return { skipped: true, reason: 'already exists' };
  }

  if (DRY_RUN) {
    stats.revisionsImported++;
    return { imported: true, dry_run: true };
  }

  try {
    // Find author ID (default to admin if not found)
    let authorId = null;
    if (revision.author) {
      const userResult = await pool.query('SELECT id FROM users.users WHERE username = $1', [
        revision.author,
      ]);
      if (userResult.rows.length > 0) {
        authorId = userResult.rows[0].id;
      }
    }

    // Insert revision
    await pool.query(
      `INSERT INTO wiki.wiki_revisions (
        page_id, content, summary, content_format,
        author_id, author_ip, is_minor, size_bytes, revision_timestamp
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        pageId,
        revision.content,
        revision.summary,
        revision.content_format,
        authorId,
        revision.author_ip,
        revision.is_minor,
        revision.size_bytes,
        revision.timestamp,
      ]
    );

    stats.revisionsImported++;
    return { imported: true };
  } catch (error) {
    stats.errors.push({
      page_id: pageId,
      revision_timestamp: revision.timestamp,
      error: error.message,
    });
    return { error: error.message };
  }
}

/**
 * Import all revisions for a single page
 */
async function importPageRevisions(slug, pageDir) {
  // Get page info
  const pageInfoPath = path.join(pageDir, 'page-info.json');
  if (!fs.existsSync(pageInfoPath)) {
    stats.errors.push({ slug, error: 'Missing page-info.json' });
    return;
  }

  const pageInfo = JSON.parse(fs.readFileSync(pageInfoPath, 'utf8'));

  // Map slug
  const targetSlug = SLUG_MAPPING[slug] || slug;

  // Find current page in database
  const pageResult = await pool.query('SELECT id, title FROM wiki.wiki_pages WHERE slug = $1', [
    targetSlug,
  ]);

  let currentPage;

  if (pageResult.rows.length === 0) {
    // Page doesn't exist - create archive page
    stats.pagesUnmatched++;
    console.log(`  📦 No match for slug: ${slug} - creating archive page`);

    if (!DRY_RUN) {
      try {
        // Create new page in archive category
        const newPageResult = await pool.query(
          `INSERT INTO wiki.wiki_pages (
            slug, title, category_id, namespace, status, created_by, created_at, updated_at
          ) VALUES ($1, $2, 'archive', 'main', 'published', 1, NOW(), NOW())
          RETURNING id, title`,
          [targetSlug, pageInfo.title]
        );
        currentPage = newPageResult.rows[0];
        stats.pagesArchived++;
        console.log(`     ✨ Created archive page: "${pageInfo.title}"`);
      } catch (error) {
        stats.errors.push({
          slug,
          error: `Failed to create archive page: ${error.message}`,
        });
        console.log(`     ❌ Failed to create archive page: ${error.message}`);
        return;
      }
    } else {
      // Dry-run: simulate page creation
      currentPage = { id: -1, title: pageInfo.title };
      stats.pagesArchived++;
      console.log(`     ✨ Would create archive page: "${pageInfo.title}" [DRY-RUN]`);
    }
  } else {
    currentPage = pageResult.rows[0];
    stats.pagesMatched++;
  }

  // Get all revisions for this page
  const revisions = getPageRevisions(pageDir);

  console.log(`\n📄 ${slug} → ${currentPage.title}`);
  console.log(`   Found ${revisions.length} historical revisions`);

  // Import each revision
  for (const revision of revisions) {
    const result = await importRevision(currentPage.id, revision);

    if (result.imported) {
      const dryRunTag = result.dry_run ? ' [DRY-RUN]' : '';
      console.log(`   ✅ ${revision.timestamp.split('T')[0]} - ${revision.summary}${dryRunTag}`);
    } else if (result.skipped) {
      console.log(`   ⏭️  ${revision.timestamp.split('T')[0]} - ${result.reason}`);
    } else if (result.error) {
      console.log(`   ❌ ${revision.timestamp.split('T')[0]} - ERROR: ${result.error}`);
    }
  }
}

/**
 * Main import process
 */
async function main() {
  console.log('═'.repeat(80));
  console.log('📚 Historical Wiki Revision Import');
  console.log('═'.repeat(80));
  console.log(
    `Mode: ${DRY_RUN ? '🔍 DRY-RUN (no changes)' : '✍️  EXECUTE (will modify database)'}`
  );
  console.log(`Source: ${VERSIONS_DIR}`);
  console.log('');

  if (DRY_RUN) {
    console.log('ℹ️  Running in DRY-RUN mode. Use --execute to actually import.');
    console.log('');
  }

  try {
    // Get all version directories
    const dirs = fs
      .readdirSync(VERSIONS_DIR)
      .filter(d => {
        const fullPath = path.join(VERSIONS_DIR, d);
        return fs.statSync(fullPath).isDirectory();
      })
      .filter(d => {
        if (SINGLE_SLUG) {
          const match = d.match(/^\d+-(.+)$/);
          return match && match[1] === SINGLE_SLUG;
        }
        return true;
      });

    console.log(`Found ${dirs.length} pages with version history\n`);

    // Process each page
    for (const dir of dirs) {
      const match = dir.match(/^\d+-(.+)$/);
      if (!match) continue;

      const slug = match[1];
      const pageDir = path.join(VERSIONS_DIR, dir);

      stats.pagesProcessed++;
      await importPageRevisions(slug, pageDir);
    }

    // Print summary
    console.log('\n' + '═'.repeat(80));
    console.log('📊 Import Summary');
    console.log('═'.repeat(80));
    console.log(`Pages processed:      ${stats.pagesProcessed}`);
    console.log(`Pages matched:        ${stats.pagesMatched}`);
    console.log(`Pages unmatched:      ${stats.pagesUnmatched}`);
    console.log(`Pages archived:       ${stats.pagesArchived}`);
    console.log(`Revisions imported:   ${stats.revisionsImported}`);
    console.log(`Revisions skipped:    ${stats.revisionsSkipped}`);
    console.log(`Errors:               ${stats.errors.length}`);

    if (stats.errors.length > 0) {
      console.log('\n❌ Errors:');
      stats.errors.slice(0, 10).forEach(e => {
        console.log(`   - ${e.slug || e.page_id}: ${e.error}`);
      });
      if (stats.errors.length > 10) {
        console.log(`   ... and ${stats.errors.length - 10} more errors`);
      }
    }

    if (DRY_RUN) {
      console.log('\n✅ Dry-run complete. Use --execute to actually import.');
    } else {
      console.log('\n✅ Import complete!');
    }
  } catch (error) {
    console.error('\n❌ Fatal error:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run
main();
