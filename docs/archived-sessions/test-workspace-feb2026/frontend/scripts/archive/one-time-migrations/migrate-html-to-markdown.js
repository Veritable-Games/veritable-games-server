#!/usr/bin/env node

/**
 * Migration Script: Convert HTML-formatted wiki pages to Markdown
 *
 * This script converts wiki pages that were stored in HTML format back to Markdown,
 * while preserving wiki link syntax [[Page Name]] and other special formatting.
 *
 * Usage:
 *   node scripts/migrate-html-to-markdown.js           # Dry run (preview changes)
 *   node scripts/migrate-html-to-markdown.js --execute # Actually perform migration
 */

const Database = require('better-sqlite3');
const path = require('path');

const WIKI_DB_PATH = path.join(__dirname, '../data/wiki.db');
const DRY_RUN = !process.argv.includes('--execute');

/**
 * Convert HTML to Markdown
 */
function htmlToMarkdown(html) {
  let markdown = html;

  // Convert headings (h1-h6)
  markdown = markdown.replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1');
  markdown = markdown.replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1');
  markdown = markdown.replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1');
  markdown = markdown.replace(/<h4[^>]*>(.*?)<\/h4>/gi, '#### $1');
  markdown = markdown.replace(/<h5[^>]*>(.*?)<\/h5>/gi, '##### $1');
  markdown = markdown.replace(/<h6[^>]*>(.*?)<\/h6>/gi, '###### $1');

  // Convert paragraphs
  markdown = markdown.replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n');

  // Convert bold
  markdown = markdown.replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**');
  markdown = markdown.replace(/<b[^>]*>(.*?)<\/b>/gi, '**$1**');

  // Convert italic
  markdown = markdown.replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*');
  markdown = markdown.replace(/<i[^>]*>(.*?)<\/i>/gi, '*$1*');

  // Convert code
  markdown = markdown.replace(/<code[^>]*>(.*?)<\/code>/gi, '`$1`');

  // Convert blockquotes
  markdown = markdown.replace(/<blockquote[^>]*>(.*?)<\/blockquote>/gi, (match, content) => {
    return content
      .split('\n')
      .map(line => `> ${line}`)
      .join('\n');
  });

  // Convert unordered lists
  markdown = markdown.replace(/<ul[^>]*>(.*?)<\/ul>/gis, (match, content) => {
    // Extract list items
    const items = content.match(/<li[^>]*>(.*?)<\/li>/gi) || [];
    return (
      items
        .map(item => {
          const text = item.replace(/<li[^>]*>(.*?)<\/li>/i, '$1').trim();
          return `- ${text}`;
        })
        .join('\n') + '\n'
    );
  });

  // Convert ordered lists
  markdown = markdown.replace(/<ol[^>]*>(.*?)<\/ol>/gis, (match, content) => {
    // Extract list items
    const items = content.match(/<li[^>]*>(.*?)<\/li>/gi) || [];
    return (
      items
        .map((item, index) => {
          const text = item.replace(/<li[^>]*>(.*?)<\/li>/i, '$1').trim();
          return `${index + 1}. ${text}`;
        })
        .join('\n') + '\n'
    );
  });

  // Convert links (but preserve wiki links [[...]])
  markdown = markdown.replace(/<a[^>]*href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gi, '[$2]($1)');

  // Convert line breaks
  markdown = markdown.replace(/<br\s*\/?>/gi, '\n');

  // Convert horizontal rules
  markdown = markdown.replace(/<hr\s*\/?>/gi, '\n---\n');

  // Decode HTML entities
  const entities = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&apos;': "'",
    '&#39;': "'",
    '&nbsp;': ' ',
    '&mdash;': '—',
    '&ndash;': '–',
  };
  markdown = markdown.replace(/&[a-z0-9#]+;/gi, match => entities[match] || match);

  // Clean up extra newlines (more than 2 consecutive)
  markdown = markdown.replace(/\n{3,}/g, '\n\n');

  // Trim whitespace
  markdown = markdown.trim();

  return markdown;
}

/**
 * Main migration function
 */
function migrateHtmlToMarkdown() {
  const db = new Database(WIKI_DB_PATH);

  console.log('🔍 Scanning for HTML-formatted wiki pages...\n');

  // Find all HTML pages
  const htmlPages = db
    .prepare(
      `
    SELECT
      p.id,
      p.title,
      p.slug,
      r.id as revision_id,
      r.content,
      r.content_format,
      r.revision_timestamp
    FROM wiki_pages p
    LEFT JOIN wiki_revisions r ON p.id = r.page_id
      AND r.id = (SELECT MAX(id) FROM wiki_revisions WHERE page_id = p.id)
    WHERE p.status = 'published'
      AND r.content LIKE '<h%'
    ORDER BY p.title
  `
    )
    .all();

  if (htmlPages.length === 0) {
    console.log('✅ No HTML pages found - all pages are already in Markdown format!');
    db.close();
    return;
  }

  console.log(`Found ${htmlPages.length} HTML-formatted pages:\n`);

  const results = [];

  for (const page of htmlPages) {
    console.log(`📄 ${page.title} (ID: ${page.id})`);

    // Convert HTML to Markdown
    const markdownContent = htmlToMarkdown(page.content);

    // Calculate reduction in size
    const htmlLength = page.content.length;
    const markdownLength = markdownContent.length;
    const reduction = (((htmlLength - markdownLength) / htmlLength) * 100).toFixed(1);

    console.log(`   HTML length: ${htmlLength} chars`);
    console.log(`   Markdown length: ${markdownLength} chars`);
    console.log(`   Reduction: ${reduction}%`);

    // Check for wiki links
    const wikiLinks = (markdownContent.match(/\[\[.*?\]\]/g) || []).length;
    if (wikiLinks > 0) {
      console.log(`   ✓ Preserved ${wikiLinks} wiki links`);
    }

    results.push({
      pageId: page.id,
      title: page.title,
      oldContent: page.content,
      newContent: markdownContent,
      wikiLinks,
    });

    console.log('');
  }

  if (DRY_RUN) {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔍 DRY RUN MODE - No changes made');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('Preview of first conversion:\n');

    if (results[0]) {
      console.log(`Page: ${results[0].title}`);
      console.log('\nFirst 500 chars of Markdown:\n');
      console.log(results[0].newContent.substring(0, 500));
      console.log('\n...\n');
    }

    console.log('\n💡 To execute migration, run:');
    console.log('   node scripts/migrate-html-to-markdown.js --execute\n');
  } else {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('⚡ EXECUTING MIGRATION');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Create new revisions with Markdown content
    const insertRevision = db.prepare(`
      INSERT INTO wiki_revisions (
        page_id,
        content,
        content_format,
        size_bytes,
        summary,
        author_id,
        revision_timestamp
      ) VALUES (?, ?, 'markdown', ?, ?, 1, CURRENT_TIMESTAMP)
    `);

    db.transaction(() => {
      for (const result of results) {
        const sizeBytes = Buffer.byteLength(result.newContent, 'utf8');

        insertRevision.run(
          result.pageId,
          result.newContent,
          sizeBytes,
          'Automated migration: Convert HTML to Markdown format'
        );

        console.log(`✅ Migrated: ${result.title}`);
      }
    })();

    console.log(`\n✅ Successfully migrated ${results.length} pages to Markdown format!`);
    console.log('\n📊 Summary:');
    console.log(`   Total pages converted: ${results.length}`);
    console.log(`   Wiki links preserved: ${results.reduce((sum, r) => sum + r.wikiLinks, 0)}`);
  }

  db.close();
}

// Run migration
try {
  migrateHtmlToMarkdown();
} catch (error) {
  console.error('❌ Migration failed:', error);
  process.exit(1);
}
