const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '../data/library.db');
const db = new Database(dbPath);

// Disable foreign key checks for this script
db.pragma('foreign_keys = OFF');

// Helper to get or create tag
function getOrCreateTag(name, categoryId) {
  let tag = db.prepare('SELECT id FROM library_tags WHERE name = ?').get(name);
  if (!tag) {
    const result = db
      .prepare('INSERT INTO library_tags (name, category_id) VALUES (?, ?)')
      .run(name, categoryId);
    tag = { id: result.lastInsertRowid };
    console.log(`  ✓ Created tag: ${name}`);
  }
  return tag.id;
}

// Helper to link tag to document
function tagDocument(documentId, tagId) {
  const exists = db
    .prepare('SELECT 1 FROM library_document_tags WHERE document_id = ? AND tag_id = ?')
    .get(documentId, tagId);
  if (!exists) {
    // added_by can be NULL, added_at will default to CURRENT_TIMESTAMP
    db.prepare(
      'INSERT INTO library_document_tags (document_id, tag_id, added_by, added_at) VALUES (?, ?, NULL, CURRENT_TIMESTAMP)'
    ).run(documentId, tagId);
    return true;
  }
  return false;
}

// Category IDs (from database)
const CATEGORIES = {
  SOURCE_TYPE: 6, // Source Type
  THEME: 7, // Theme
  METHODOLOGY: 8, // Methodology
  TIME_PERIOD: 9, // Time Period
  GEOGRAPHIC: 10, // Geographic Focus
  FORMAT: 11, // Content Format
  SUBJECT: 12, // Subject Area
};

console.log('=== CREATING TAGS ===\n');

// Create comprehensive tags
const TAGS = {
  // Source Types (category 6)
  book: getOrCreateTag('book', CATEGORIES.SOURCE_TYPE),
  article: getOrCreateTag('article', CATEGORIES.SOURCE_TYPE),
  guide: getOrCreateTag('guide', CATEGORIES.SOURCE_TYPE),
  manual: getOrCreateTag('manual', CATEGORIES.SOURCE_TYPE),
  manifesto: getOrCreateTag('manifesto', CATEGORIES.SOURCE_TYPE),

  // Themes (category 7)
  anarchism: getOrCreateTag('anarchism', CATEGORIES.THEME),
  mutualAid: getOrCreateTag('mutual-aid', CATEGORIES.THEME),
  permaculture: getOrCreateTag('permaculture', CATEGORIES.THEME),
  education: getOrCreateTag('education', CATEGORIES.THEME),
  democracy: getOrCreateTag('democracy', CATEGORIES.THEME),

  // Methodologies (category 8)
  criticalPedagogy: getOrCreateTag('critical-pedagogy', CATEGORIES.METHODOLOGY),
  ecologicalDesign: getOrCreateTag('ecological-design', CATEGORIES.METHODOLOGY),
  neuralNetworks: getOrCreateTag('neural-networks', CATEGORIES.METHODOLOGY),

  // Time Periods (category 9)
  historical: getOrCreateTag('historical', CATEGORIES.TIME_PERIOD),
  contemporary: getOrCreateTag('contemporary', CATEGORIES.TIME_PERIOD),
  classical: getOrCreateTag('classical', CATEGORIES.TIME_PERIOD),

  // Geographic (category 10)
  globalSouth: getOrCreateTag('global-south', CATEGORIES.GEOGRAPHIC),
  western: getOrCreateTag('western', CATEGORIES.GEOGRAPHIC),
  universal: getOrCreateTag('universal', CATEGORIES.GEOGRAPHIC),

  // Subject Areas (category 12)
  computerScience: getOrCreateTag('computer-science', CATEGORIES.SUBJECT),
  politicalTheory: getOrCreateTag('political-theory', CATEGORIES.SUBJECT),
  architecture: getOrCreateTag('architecture', CATEGORIES.SUBJECT),
  cognitiveScience: getOrCreateTag('cognitive-science', CATEGORIES.SUBJECT),
  ecology: getOrCreateTag('ecology', CATEGORIES.SUBJECT),
  economics: getOrCreateTag('economics', CATEGORIES.SUBJECT),
  biology: getOrCreateTag('biology', CATEGORIES.SUBJECT),
  urbanDesign: getOrCreateTag('urban-design', CATEGORIES.SUBJECT),
  machinelearning: getOrCreateTag('machine-learning', CATEGORIES.SUBJECT),
  development: getOrCreateTag('development', CATEGORIES.SUBJECT),
};

console.log('\n=== TAGGING DOCUMENTS ===\n');

// Document tagging mapping
const documentTagging = [
  {
    id: 1,
    title: 'A Pattern Language',
    tags: [
      TAGS.book,
      TAGS.architecture,
      TAGS.urbanDesign,
      TAGS.ecologicalDesign,
      TAGS.classical,
      TAGS.western,
    ],
  },
  {
    id: 2,
    title: 'Anarchist Organizing Manual',
    tags: [TAGS.manual, TAGS.anarchism, TAGS.politicalTheory, TAGS.contemporary, TAGS.universal],
  },
  {
    id: 3,
    title: 'API Documentation Guidelines',
    tags: [TAGS.guide, TAGS.computerScience, TAGS.development, TAGS.contemporary, TAGS.universal],
  },
  {
    id: 4,
    title: 'Community Guidelines',
    tags: [TAGS.guide, TAGS.democracy, TAGS.contemporary, TAGS.universal],
  },
  {
    id: 5,
    title: 'The Emotion Machine',
    tags: [TAGS.book, TAGS.cognitiveScience, TAGS.computerScience, TAGS.contemporary, TAGS.western],
  },
  {
    id: 6,
    title: 'The Society of Mind',
    tags: [TAGS.book, TAGS.cognitiveScience, TAGS.computerScience, TAGS.classical, TAGS.western],
  },
  {
    id: 7,
    title: 'Mutual Aid: A Factor of Evolution',
    tags: [TAGS.book, TAGS.anarchism, TAGS.mutualAid, TAGS.biology, TAGS.historical, TAGS.western],
  },
  {
    id: 8,
    title: 'The Conquest of Bread',
    tags: [
      TAGS.book,
      TAGS.manifesto,
      TAGS.anarchism,
      TAGS.economics,
      TAGS.historical,
      TAGS.western,
    ],
  },
  {
    id: 9,
    title: 'Test Document Title',
    tags: [TAGS.article, TAGS.contemporary],
  },
  {
    id: 10,
    title: 'Complete Library Formatting Guide',
    tags: [TAGS.guide, TAGS.development, TAGS.contemporary, TAGS.universal],
  },
  {
    id: 11,
    title: 'Api Documentation',
    tags: [TAGS.guide, TAGS.computerScience, TAGS.development, TAGS.contemporary, TAGS.universal],
  },
  {
    id: 12,
    title: 'Critical Consciousness Education',
    tags: [TAGS.article, TAGS.education, TAGS.criticalPedagogy, TAGS.contemporary, TAGS.universal],
  },
  {
    id: 13,
    title: 'Critical Consciousness in Education',
    tags: [
      TAGS.article,
      TAGS.education,
      TAGS.criticalPedagogy,
      TAGS.contemporary,
      TAGS.globalSouth,
    ],
  },
  {
    id: 14,
    title: 'Mutual Aid Kropotkin',
    tags: [
      TAGS.book,
      TAGS.anarchism,
      TAGS.mutualAid,
      TAGS.politicalTheory,
      TAGS.historical,
      TAGS.western,
    ],
  },
  {
    id: 15,
    title: 'Neural Networks and Deep Learning',
    tags: [
      TAGS.book,
      TAGS.computerScience,
      TAGS.neuralNetworks,
      TAGS.machinelearning,
      TAGS.contemporary,
      TAGS.universal,
    ],
  },
  {
    id: 16,
    title: 'Neural Networks Deep Learning',
    tags: [
      TAGS.book,
      TAGS.computerScience,
      TAGS.neuralNetworks,
      TAGS.machinelearning,
      TAGS.contemporary,
      TAGS.universal,
    ],
  },
  {
    id: 17,
    title: 'Permaculture Design Manual',
    tags: [
      TAGS.manual,
      TAGS.permaculture,
      TAGS.ecology,
      TAGS.ecologicalDesign,
      TAGS.contemporary,
      TAGS.universal,
    ],
  },
  {
    id: 18,
    title: 'Technical Standards',
    tags: [TAGS.guide, TAGS.development, TAGS.computerScience, TAGS.contemporary, TAGS.universal],
  },
  {
    id: 19,
    title: 'Workplace Democracy Implementation Guide',
    tags: [TAGS.guide, TAGS.democracy, TAGS.economics, TAGS.contemporary, TAGS.universal],
  },
];

// Apply tags
let totalTagged = 0;
documentTagging.forEach(doc => {
  console.log(`${doc.title}:`);
  let tagged = 0;
  doc.tags.forEach(tagId => {
    if (tagDocument(doc.id, tagId)) {
      tagged++;
      totalTagged++;
    }
  });
  console.log(`  ✓ Tagged with ${tagged} tags\n`);
});

console.log(`\n=== SUMMARY ===`);
console.log(`Total documents tagged: ${documentTagging.length}`);
console.log(`Total tag applications: ${totalTagged}`);

// Show tag usage counts
console.log('\n=== TAG USAGE ===');
const tagUsage = db
  .prepare(
    `
  SELECT t.name, t.category_id, COUNT(dt.document_id) as usage_count
  FROM library_tags t
  LEFT JOIN library_document_tags dt ON t.id = dt.tag_id
  GROUP BY t.id
  ORDER BY usage_count DESC, t.name
`
  )
  .all();

tagUsage.forEach(tag => {
  console.log(`${tag.name}: ${tag.usage_count} documents`);
});

db.close();
console.log('\n✓ Done!');
