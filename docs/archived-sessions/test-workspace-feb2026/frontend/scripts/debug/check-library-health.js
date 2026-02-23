const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'data', 'library.db');
const db = new Database(dbPath, { readonly: true });

try {
  // Check documents
  const docCount = db.prepare('SELECT COUNT(*) as count FROM library_documents').get();
  console.log('Total documents:', docCount.count);

  // Check categories
  const catCount = db.prepare('SELECT COUNT(*) as count FROM library_tag_categories').get();
  console.log('Total tag categories:', catCount.count);

  // Check tags
  const tagCount = db.prepare('SELECT COUNT(*) as count FROM library_tags').get();
  console.log('Total tags:', tagCount.count);

  // Show sample documents
  if (docCount.count > 0) {
    const docs = db
      .prepare('SELECT id, title, author, status FROM library_documents LIMIT 5')
      .all();
    console.log('\nSample documents:');
    docs.forEach(doc => {
      console.log(`  - [${doc.status}] ${doc.title} by ${doc.author || 'Unknown'}`);
    });
  }

  // Show categories
  if (catCount.count > 0) {
    const cats = db
      .prepare('SELECT id, name, type FROM library_tag_categories ORDER BY name')
      .all();
    console.log('\nTag categories:');
    cats.forEach(cat => {
      console.log(`  - ${cat.name} (${cat.type})`);
    });
  }
} catch (error) {
  console.error('Error:', error.message);
} finally {
  db.close();
}
