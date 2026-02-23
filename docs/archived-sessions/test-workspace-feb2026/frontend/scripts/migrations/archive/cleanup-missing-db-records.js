const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const db = new Database(path.join(__dirname, 'data/content.db'));

console.log('='.repeat(80));
console.log('CLEANING UP DATABASE RECORDS FOR MISSING FILES');
console.log('='.repeat(80));
console.log('');

// Get all galleries
const galleries = db
  .prepare(
    `
  SELECT DISTINCT project_id, gallery_type FROM project_reference_images
  ORDER BY project_id, gallery_type
`
  )
  .all();

let totalDeleted = 0;

for (const gallery of galleries) {
  const project = db.prepare('SELECT slug FROM projects WHERE id = ?').get(gallery.project_id);
  const slug = project.slug;
  const type = gallery.gallery_type;

  // Get all DB records for this gallery
  const dbRecords = db
    .prepare(
      `
    SELECT id, file_path FROM project_reference_images
    WHERE project_id = ? AND gallery_type = ?
  `
    )
    .all(gallery.project_id, type);

  // Find records with missing files
  const missingRecordIds = [];

  for (const record of dbRecords) {
    const fullPath = path.join(__dirname, `public/uploads${record.file_path}`);
    if (!fs.existsSync(fullPath)) {
      missingRecordIds.push(record.id);
    }
  }

  if (missingRecordIds.length > 0) {
    console.log(`${slug} / ${type}: Found ${missingRecordIds.length} records with missing files`);

    // Delete the records
    const deleteStmt = db.prepare('DELETE FROM project_reference_images WHERE id = ?');
    for (const id of missingRecordIds) {
      deleteStmt.run(id);
    }

    console.log(`  ✓ Deleted ${missingRecordIds.length} orphaned records`);
    totalDeleted += missingRecordIds.length;
    console.log('');
  }
}

console.log('='.repeat(80));
console.log(`✓ CLEANUP COMPLETE: Deleted ${totalDeleted} orphaned database records`);
console.log('');

db.close();
