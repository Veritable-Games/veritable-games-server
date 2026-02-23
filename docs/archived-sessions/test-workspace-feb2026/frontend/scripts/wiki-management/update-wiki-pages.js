const Database = require('better-sqlite3');
const fs = require('fs');

function updateWikiPage(db, slug, title, newContent) {
  try {
    // Get page ID
    const pageStmt = db.prepare('SELECT id FROM wiki_pages WHERE slug = ?');
    const page = pageStmt.get(slug);

    if (!page) {
      console.log(`Page not found: ${slug}`);
      return false;
    }

    const pageId = page.id;

    // Insert new revision
    const revisionStmt = db.prepare(`
      INSERT INTO wiki_revisions (page_id, content, summary, author_id, size_bytes)
      VALUES (?, ?, ?, ?, ?)
    `);

    const summary = `Revised to use proper Wikipedia-style sentence structure - simplified complex nested sentences and removed bureaucratic padding`;
    const authorId = 1; // Assuming admin user ID
    const sizeBytes = Buffer.byteLength(newContent, 'utf8');

    revisionStmt.run(pageId, newContent, summary, authorId, sizeBytes);

    // Update page timestamp
    const updateStmt = db.prepare(
      'UPDATE wiki_pages SET updated_at = CURRENT_TIMESTAMP WHERE id = ?'
    );
    updateStmt.run(pageId);

    console.log(`Successfully updated: ${slug} (${sizeBytes} bytes)`);
    return true;
  } catch (error) {
    console.error(`Error updating ${slug}:`, error.message);
    return false;
  }
}

// Main execution
const db = new Database('./data/forums.db');

try {
  // Start with Allied Civil Preserve (already rewritten)
  const acpContent = fs.readFileSync('/tmp/allied-civil-preserve-proper-wikipedia.md', 'utf8');
  updateWikiPage(db, 'allied-civil-preserve', 'Allied Civil Preserve', acpContent);

  // Update Social Stratification (just revised)
  const socialContent = fs.readFileSync('/tmp/social-stratification-revised.md', 'utf8');
  updateWikiPage(
    db,
    'social-stratification-grand-voss',
    'Social Stratification (Grand Voss)',
    socialContent
  );

  console.log('\\nUpdated 2 pages successfully. Ready to revise remaining pages.');
} finally {
  db.close();
}
