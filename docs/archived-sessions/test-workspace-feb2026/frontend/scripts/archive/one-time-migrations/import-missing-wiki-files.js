#!/usr/bin/env node

/**
 * Import Missing Wiki Files
 *
 * Scans public/wiki/ for markdown files and imports any that are missing from the database
 */

const Database = require('better-sqlite3');
const fs = require('fs').promises;
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'data', 'forums.db');
const WIKI_DIR = path.join(__dirname, '..', 'public', 'wiki');

function createSlug(filename) {
  return filename
    .replace('.md', '')
    .replace(/_/g, '-')
    .replace(/&/g, '-')
    .replace(/\s+/g, '-')
    .toLowerCase()
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function extractTitle(content) {
  // Look for # Title at the start
  const titleMatch = content.match(/^#\s+(.+)$/m);
  if (titleMatch) {
    return titleMatch[1].trim();
  }

  // Look for any first heading
  const headingMatch = content.match(/^#+\s+(.+)$/m);
  if (headingMatch) {
    return headingMatch[1].trim();
  }

  return null;
}

async function importMissingWikiFiles() {
  const db = new Database(DB_PATH);

  try {
    console.log('Scanning for missing wiki files...');
    console.log('Wiki directory:', WIKI_DIR);
    console.log('Database:', DB_PATH);
    console.log('');

    // Get all markdown files
    const files = await fs.readdir(WIKI_DIR);
    const markdownFiles = files.filter(file => file.endsWith('.md'));

    console.log(`Found ${markdownFiles.length} markdown files`);

    // Get existing wiki pages
    const existingPages = db.prepare('SELECT slug FROM wiki_pages').all();
    const existingSlugs = new Set(existingPages.map(p => p.slug));

    console.log(`Found ${existingSlugs.size} existing wiki pages`);
    console.log('');

    // Find missing files
    const missingFiles = [];

    for (const file of markdownFiles) {
      const slug = createSlug(file);
      if (!existingSlugs.has(slug)) {
        missingFiles.push({ file, slug });
      }
    }

    console.log(`Found ${missingFiles.length} missing files:`);
    missingFiles.forEach(({ file, slug }) => {
      console.log(`  - ${file} -> ${slug}`);
    });
    console.log('');

    if (missingFiles.length === 0) {
      console.log('✅ All wiki files are already imported!');
      return;
    }

    // Prepare insert statements
    const insertPage = db.prepare(`
      INSERT INTO wiki_pages (
        slug, title, namespace, status, protection_level,
        created_by, created_at, updated_at
      ) VALUES (?, ?, 'main', 'published', 'none', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `);

    const insertRevision = db.prepare(`
      INSERT INTO wiki_revisions (
        page_id, content, content_format, summary,
        author_id, revision_timestamp, size_bytes
      ) VALUES (?, ?, 'markdown', 'Initial import from file', 1, CURRENT_TIMESTAMP, ?)
    `);

    let imported = 0;
    let errors = 0;

    // Import each missing file
    for (const { file, slug } of missingFiles) {
      try {
        const filePath = path.join(WIKI_DIR, file);
        const content = await fs.readFile(filePath, 'utf-8');

        // Extract title from content
        const extractedTitle = extractTitle(content);
        const title = extractedTitle || file.replace('.md', '').replace(/_/g, ' ');

        // Insert page
        const pageResult = insertPage.run(slug, title);
        const pageId = pageResult.lastInsertRowid;

        // Insert revision with content
        const sizeBytes = Buffer.byteLength(content, 'utf8');
        insertRevision.run(pageId, content, sizeBytes);

        imported++;
        console.log(`✅ Imported: ${title} (${slug})`);
      } catch (error) {
        errors++;
        console.error(`❌ Failed to import ${file}:`, error.message);
      }
    }

    console.log('\n=== Import Summary ===');
    console.log(`📁 Files scanned: ${markdownFiles.length}`);
    console.log(`📄 Already existing: ${markdownFiles.length - missingFiles.length}`);
    console.log(`➕ Missing files found: ${missingFiles.length}`);
    console.log(`✅ Successfully imported: ${imported}`);
    console.log(`❌ Import errors: ${errors}`);

    if (imported > 0) {
      console.log('\n=== Newly Imported Pages ===');
      const newPages = db
        .prepare(
          `
        SELECT title, slug, created_at
        FROM wiki_pages
        WHERE created_at > datetime('now', '-1 minute')
        ORDER BY created_at DESC
      `
        )
        .all();

      newPages.forEach(page => {
        console.log(`  - ${page.title} (${page.slug})`);
      });
    }
  } catch (error) {
    console.error('Import failed:', error);
    process.exit(1);
  } finally {
    db.close();
  }
}

// Run the import
importMissingWikiFiles();
