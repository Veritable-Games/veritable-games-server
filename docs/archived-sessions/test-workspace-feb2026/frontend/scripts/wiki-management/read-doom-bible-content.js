// Read DOOM Bible content for manual inspection
const Database = require('better-sqlite3');
const db = new Database('./data/forums.db');

try {
  const pageStmt = db.prepare('SELECT id FROM wiki_pages WHERE slug = ?');
  const page = pageStmt.get('library/doom-bible');

  if (!page) {
    console.log('❌ DOOM Bible page not found');
    process.exit(1);
  }

  const revisionStmt = db.prepare(`
    SELECT content FROM wiki_revisions 
    WHERE page_id = ? 
    ORDER BY revision_timestamp DESC 
    LIMIT 1
  `);
  const revision = revisionStmt.get(page.id);

  if (!revision) {
    console.log('❌ No revisions found');
    process.exit(1);
  }

  // Output the full content so I can manually inspect it
  console.log(revision.content);
} catch (error) {
  console.error('Error:', error);
} finally {
  db.close();
}
