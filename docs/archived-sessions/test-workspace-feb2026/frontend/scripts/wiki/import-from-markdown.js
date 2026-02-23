#!/usr/bin/env node

/**
 * Import Wiki Pages from Markdown
 *
 * Imports wiki pages from markdown files into PostgreSQL.
 * Used after git pull to sync markdown changes to database.
 *
 * Usage: npm run wiki:import
 */

const { Pool } = require('pg');
const fs = require('fs/promises');
const path = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL,
  ssl: process.env.POSTGRES_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

async function importWikiFromMarkdown() {
  try {
    console.log('\n📝 Importing Wiki Pages from Markdown\n');

    const wikiDir = path.join(__dirname, '../../content/wiki');

    // Read all categories (directories in wiki/)
    const entries = await fs.readdir(wikiDir, { withFileTypes: true });
    const categories = entries.filter(e => e.isDirectory() && !e.name.startsWith('_'));

    let totalPages = 0;

    for (const categoryEntry of categories) {
      const categorySlug = categoryEntry.name;
      const categoryDir = path.join(wikiDir, categorySlug);

      // Read all markdown files in category
      const files = await fs.readdir(categoryDir);
      const mdFiles = files.filter(f => f.endsWith('.md'));

      for (const mdFile of mdFiles) {
        const pageSlug = mdFile.replace('.md', '');
        const filePath = path.join(categoryDir, mdFile);
        const content = await fs.readFile(filePath, 'utf8');

        // Extract title from first heading or use slug
        let title = pageSlug;
        const headingMatch = content.match(/^# (.+)$/m);
        if (headingMatch) {
          title = headingMatch[1];
        }

        // Check if page exists
        const existingPage = await pool.query('SELECT id FROM wiki.wiki_pages WHERE slug = $1', [
          pageSlug,
        ]);

        if (existingPage.rows.length === 0) {
          // Create new page
          const pageResult = await pool.query(
            `INSERT INTO wiki.wiki_pages (slug, title, category_id, status, created_at, updated_at)
             VALUES ($1, $2, $3, $4, NOW(), NOW())
             RETURNING id`,
            [pageSlug, title, categorySlug === 'general' ? null : categorySlug, 'published']
          );

          const pageId = pageResult.rows[0].id;

          // Create revision
          await pool.query(
            `INSERT INTO wiki.wiki_revisions (page_id, content, content_format, revision_timestamp)
             VALUES ($1, $2, $3, NOW())`,
            [pageId, content, 'markdown']
          );

          console.log(`✓ Created: ${categorySlug}/${pageSlug}`);
        } else {
          // Update existing page
          const pageId = existingPage.rows[0].id;

          // Update page metadata
          await pool.query(
            `UPDATE wiki.wiki_pages SET title = $1, updated_at = NOW() WHERE id = $2`,
            [title, pageId]
          );

          // Create new revision
          await pool.query(
            `INSERT INTO wiki.wiki_revisions (page_id, content, content_format, revision_timestamp)
             VALUES ($1, $2, $3, NOW())`,
            [pageId, content, 'markdown']
          );

          console.log(`✓ Updated: ${categorySlug}/${pageSlug}`);
        }

        totalPages++;
      }
    }

    console.log(`\n✓ Import complete: ${totalPages} pages imported\n`);

    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Import failed:', error.message);
    await pool.end();
    process.exit(1);
  }
}

importWikiFromMarkdown();
