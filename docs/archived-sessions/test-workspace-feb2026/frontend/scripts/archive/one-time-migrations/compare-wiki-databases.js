const Database = require('better-sqlite3');
const path = require('path');

const mainDbPath = path.join(__dirname, '../data/main.db');
const wikiDbPath = path.join(__dirname, '../data/wiki.db');

const mainDb = new Database(mainDbPath, { readonly: true });
const wikiDb = new Database(wikiDbPath, { readonly: true });

const mainPages = mainDb
  .prepare('SELECT id, slug, title, created_at, updated_at FROM wiki_pages ORDER BY slug')
  .all();
const wikiPages = wikiDb
  .prepare('SELECT id, slug, title, created_at, updated_at FROM wiki_pages ORDER BY slug')
  .all();

const wikiSlugs = new Set(wikiPages.map(p => p.slug));
const mainSlugs = new Set(mainPages.map(p => p.slug));

const onlyInMain = mainPages.filter(p => !wikiSlugs.has(p.slug));
const onlyInWiki = wikiPages.filter(p => !mainSlugs.has(p.slug));

console.log('=== Wiki Pages Comparison ===\n');
console.log('Total pages in main.db:', mainPages.length);
console.log('Total pages in wiki.db:', wikiPages.length);
console.log('');

console.log('Pages only in main.db (OLD - need migration):', onlyInMain.length);
if (onlyInMain.length > 0) {
  console.log('');
  onlyInMain.forEach(p => {
    console.log(`  - ${p.slug}`);
    console.log(`    Title: ${p.title}`);
    console.log(`    Created: ${p.created_at}`);
    console.log(`    Updated: ${p.updated_at}`);
  });
}

console.log('\nPages only in wiki.db (NEW - already migrated):', onlyInWiki.length);
if (onlyInWiki.length > 0 && onlyInWiki.length <= 10) {
  console.log('');
  onlyInWiki.forEach(p => {
    console.log(`  - ${p.slug} | ${p.title}`);
  });
}

mainDb.close();
wikiDb.close();
