const Database = require('better-sqlite3');

const db = new Database('./data/forums.db');

console.log('Reading nanite-related pages...');

// Get all nanite-related pages
const nanitePages = db
  .prepare(
    `
    SELECT wp.*, wr.content 
    FROM wiki_pages wp 
    JOIN wiki_revisions wr ON wp.id = wr.page_id 
    WHERE wp.slug LIKE '%nanite%' OR wp.slug LIKE '%mag%'
    ORDER BY wr.revision_timestamp DESC
`
  )
  .all();

console.log('Nanite-related pages:');
nanitePages.forEach(page => {
  console.log(`\n=== ${page.title} (${page.slug}) ===`);
  console.log(
    page.content.substring(0, 1000) + (page.content.length > 1000 ? '...\n[Content truncated]' : '')
  );
  console.log('='.repeat(50));
});

db.close();
