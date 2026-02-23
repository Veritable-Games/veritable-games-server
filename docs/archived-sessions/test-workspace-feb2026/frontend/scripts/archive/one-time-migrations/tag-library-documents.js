const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '../data/library.db');
const db = new Database(dbPath);

// Get all documents
console.log('=== EXISTING DOCUMENTS ===');
const documents = db
  .prepare(
    `
  SELECT id, title, slug, content
  FROM library_documents
  ORDER BY title
`
  )
  .all();

documents.forEach(doc => {
  const contentPreview = doc.content ? doc.content.substring(0, 100) : 'No content';
  console.log(`${doc.id}. ${doc.title} (${doc.slug})`);
  console.log(`   Preview: ${contentPreview}...\n`);
});

// Get all tags
console.log('\n=== EXISTING TAGS ===');
const tags = db
  .prepare(
    `
  SELECT id, name, category_id
  FROM library_tags
  ORDER BY name
`
  )
  .all();

tags.forEach(tag => {
  console.log(`${tag.id}. ${tag.name} (category: ${tag.category_id || 'none'})`);
});

// Get all categories
console.log('\n=== EXISTING CATEGORIES ===');
const categories = db
  .prepare(
    `
  SELECT id, name, type
  FROM library_tag_categories
  ORDER BY name
`
  )
  .all();

categories.forEach(cat => {
  console.log(`${cat.id}. ${cat.name} (${cat.type})`);
});

db.close();
