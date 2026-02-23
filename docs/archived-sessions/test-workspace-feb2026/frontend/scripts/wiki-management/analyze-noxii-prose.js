const Database = require('better-sqlite3');
const db = new Database('./data/forums.db');

try {
  // Check what tables exist and their columns
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all();
  console.log(
    'Available tables:',
    tables.map(t => t.name)
  );

  // Check for wiki content table
  const wikiContentSchema = db
    .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'wiki_content'")
    .get();
  if (wikiContentSchema) {
    console.log('Wiki content schema:', wikiContentSchema.sql);
  }

  const wikiRevisionsSchema = db
    .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'wiki_revisions'")
    .get();
  if (wikiRevisionsSchema) {
    console.log('Wiki revisions schema:', wikiRevisionsSchema.sql);
  }

  // Try to find NOXII pages with their latest content
  const pages = db
    .prepare(
      `
    SELECT p.slug, p.title, r.content 
    FROM wiki_pages p
    LEFT JOIN wiki_revisions r ON p.id = r.page_id
    WHERE p.slug LIKE 'noxii-%' 
      AND r.revision_timestamp = (
        SELECT MAX(revision_timestamp) 
        FROM wiki_revisions r2 
        WHERE r2.page_id = p.id
      )
    ORDER BY p.slug
  `
    )
    .all();

  console.log('\n=== NOXII Wiki Pages Analysis ===');
  console.log('Total pages:', pages.length);
  console.log();

  pages.forEach((page, i) => {
    const content = page.content || '';
    const wordCount = content.split(/\s+/).filter(w => w).length;
    const sentences = content.split(/[.!?]+/).filter(s => s.trim()).length;
    const avgWordsPerSentence = sentences > 0 ? Math.round(wordCount / sentences) : 0;
    const emDashCount = (content.match(/—/g) || []).length;
    const complexClauses = (content.match(/,\s*[a-z]/g) || []).length;

    console.log(`${i + 1}. ${page.title} (${page.slug})`);
    console.log(`   Words: ${wordCount}, Sentences: ${sentences}, Avg: ${avgWordsPerSentence} w/s`);
    console.log(`   Em-dashes: ${emDashCount}, Complex clauses: ${complexClauses}`);
    console.log();
  });
} finally {
  db.close();
}
