const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'data/content.db'));

// Get schema info for project_reference_images
const columns = db.prepare('PRAGMA table_info(project_reference_images)').all();

console.log('PROJECT_REFERENCE_IMAGES columns:');
columns.forEach(col => {
  console.log(`  - ${col.name}: ${col.type}`);
});

// Check if there's a gallery_type column
const hasGalleryType = columns.some(c => c.name === 'gallery_type');
console.log(`\nHas gallery_type column: ${hasGalleryType}`);

// Count by gallery type if it exists
if (hasGalleryType) {
  const counts = db
    .prepare(
      `
    SELECT gallery_type, COUNT(*) as count, SUM(CASE WHEN is_deleted = 0 THEN 1 ELSE 0 END) as active
    FROM project_reference_images
    GROUP BY gallery_type
  `
    )
    .all();

  console.log('\nCounts by gallery type:');
  counts.forEach(row => {
    console.log(`  ${row.gallery_type}: ${row.count} total, ${row.active} active (not deleted)`);
  });
}

// Sample a concept-art record
const sample = db
  .prepare(
    `
  SELECT * FROM project_reference_images 
  WHERE gallery_type = 'concept-art' 
  LIMIT 1
`
  )
  .get();

if (sample) {
  console.log('\nSample concept-art record:');
  console.log(JSON.stringify(sample, null, 2));
}

db.close();
