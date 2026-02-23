const Database = require('better-sqlite3');
const db = new Database('./data/forums.db');

// Get all NOXII-related pages content to find See Also links
const pages = db
  .prepare(
    `
  SELECT content FROM wiki_revisions 
  WHERE page_id IN (
    SELECT id FROM wiki_pages 
    WHERE slug LIKE '%noxii%' 
    OR slug IN (
      'grand-voss', 'engineering-caste', 'labor-caste', 'icebreaker-caste', 
      'stonebreaker-caste', 'allied-civil-preserve', 'social-stratification-grand-voss', 
      'the-games', 'prefects-administrative-caste', 'guards-authority-figures', 
      'vatra-hub', 'atlas-tether-infrastructure', 'machine-consciousness', 
      'neural-implant-technology', 'grand-voss-megastructures'
    )
  ) 
  ORDER BY revision_timestamp DESC
`
  )
  .all();

// Extract all wiki link references
const allLinks = new Set();
pages.forEach(p => {
  const regex = /\[\[([^\|\]]+)(\|[^\]]+)?\]\]/g;
  let match;
  while ((match = regex.exec(p.content)) !== null) {
    allLinks.add(match[1]);
  }
});

// Check which don't exist
const existing = db
  .prepare('SELECT slug FROM wiki_pages')
  .all()
  .map(p => p.slug);
const existingSet = new Set(existing);
const missing = Array.from(allLinks)
  .filter(link => !existingSet.has(link))
  .sort();

console.log('Missing NOXII pages referenced in See Also sections:');
console.log('=====================================');
missing.forEach(m => console.log('  ' + m));
console.log('\nTotal missing: ' + missing.length);

// Now let's categorize them
const categories = {
  infrastructure: [],
  technology: [],
  social: [],
  locations: [],
  events: [],
  administration: [],
  other: [],
};

missing.forEach(slug => {
  if (slug.includes('infrastructure') || slug.includes('system') || slug.includes('network')) {
    categories.infrastructure.push(slug);
  } else if (
    slug.includes('technology') ||
    slug.includes('quantum') ||
    slug.includes('generation')
  ) {
    categories.technology.push(slug);
  } else if (
    slug.includes('caste') ||
    slug.includes('prisoner') ||
    slug.includes('liberation') ||
    slug.includes('anarchist')
  ) {
    categories.social.push(slug);
  } else if (slug.includes('district') || slug.includes('camp') || slug.includes('facility')) {
    categories.locations.push(slug);
  } else if (slug.includes('cascade') || slug.includes('day') || slug.includes('timeline')) {
    categories.events.push(slug);
  } else if (
    slug.includes('protocol') ||
    slug.includes('imperial') ||
    slug.includes('administrative')
  ) {
    categories.administration.push(slug);
  } else {
    categories.other.push(slug);
  }
});

console.log('\nCategorized missing pages:');
console.log('=====================================');
for (const [cat, pages] of Object.entries(categories)) {
  if (pages.length > 0) {
    console.log(`\n${cat.toUpperCase()} (${pages.length}):`);
    pages.forEach(p => console.log('  - ' + p));
  }
}

db.close();
