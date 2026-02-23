#!/usr/bin/env node

/**
 * Export Wiki Pages to Markdown
 *
 * Exports all wiki pages from PostgreSQL to markdown files for git versioning.
 * Markdown files are the source of truth for wiki content.
 *
 * Usage: npm run wiki:export
 */

const { Pool } = require('pg');
const fs = require('fs/promises');
const path = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL,
  ssl: process.env.POSTGRES_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

async function exportWikiToMarkdown() {
  try {
    console.log('\n📝 Exporting Wiki Pages to Markdown\n');

    // Create wiki content directory
    const wikiDir = path.join(__dirname, '../../content/wiki');
    await fs.mkdir(wikiDir, { recursive: true });

    // Get all wiki pages with their latest revision content
    const result = await pool.query(`
      SELECT
        wp.id,
        wp.slug,
        wp.title,
        wp.category_id,
        wc.name as category_name,
        wr.content,
        wp.created_at,
        wr.revision_timestamp as updated_at
      FROM wiki.wiki_pages wp
      LEFT JOIN wiki.wiki_categories wc ON wp.category_id = wc.id
      LEFT JOIN wiki.wiki_revisions wr ON wp.id = wr.page_id
      WHERE wr.id = (
        SELECT id FROM wiki.wiki_revisions
        WHERE page_id = wp.id
        ORDER BY revision_timestamp DESC
        LIMIT 1
      )
      ORDER BY wp.slug
    `);

    console.log(`Found ${result.rows.length} wiki pages\n`);

    // Export each page to markdown
    for (const page of result.rows) {
      const categorySlug = page.category_id || 'general';
      const categoryDir = path.join(wikiDir, categorySlug);

      // Create category directory
      await fs.mkdir(categoryDir, { recursive: true });

      // Create markdown file
      const filePath = path.join(categoryDir, `${page.slug}.md`);
      const content = page.content || '';

      await fs.writeFile(filePath, content, 'utf8');
      console.log(`✓ ${categorySlug}/${page.slug}.md`);
    }

    // Create metadata file
    const metaFile = path.join(wikiDir, '_meta.json');
    const metadata = {
      exportedAt: new Date().toISOString(),
      totalPages: result.rows.length,
      source: 'PostgreSQL wiki schema',
      note: 'Wiki pages are the source of truth for wiki content. Database is cache.',
    };

    await fs.writeFile(metaFile, JSON.stringify(metadata, null, 2), 'utf8');
    console.log(`\n✓ Export complete: ${result.rows.length} pages exported`);
    console.log(`📂 Location: ${wikiDir}\n`);

    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Export failed:', error.message);
    await pool.end();
    process.exit(1);
  }
}

exportWikiToMarkdown();
