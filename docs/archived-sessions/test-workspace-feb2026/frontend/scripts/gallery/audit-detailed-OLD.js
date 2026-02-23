const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const db = new Database(path.join(__dirname, 'data/content.db'));

console.log('='.repeat(90));
console.log('DETAILED GALLERY FILE AUDIT');
console.log('='.repeat(90));
console.log('');

// Get all projects with their galleries
const galleries = db
  .prepare(
    `
  SELECT DISTINCT project_id, gallery_type FROM project_reference_images
  ORDER BY project_id, gallery_type
`
  )
  .all();

let totalOrphaned = 0;
let totalMissing = 0;

for (const gallery of galleries) {
  const project = db.prepare('SELECT slug FROM projects WHERE id = ?').get(gallery.project_id);
  const slug = project.slug;
  const type = gallery.gallery_type;

  // Get all DB records for this gallery
  const dbRecords = db
    .prepare(
      `
    SELECT id, file_path, filename_storage FROM project_reference_images
    WHERE project_id = ? AND gallery_type = ? AND is_deleted = 0
  `
    )
    .all(gallery.project_id, type);

  // Get actual files on disk
  const diskPath = path.join(__dirname, `public/uploads/${type}/${slug}`);
  let diskFiles = [];

  if (fs.existsSync(diskPath)) {
    diskFiles = fs.readdirSync(diskPath);
  }

  // Find missing files (in DB but not on disk)
  const missingFiles = dbRecords.filter(rec => {
    const filename = path.basename(rec.file_path);
    return !diskFiles.includes(filename);
  });

  // Find orphaned files (on disk but not in DB)
  const dbFilenames = new Set(dbRecords.map(rec => path.basename(rec.file_path)));
  const orphanedFiles = diskFiles.filter(f => !dbFilenames.has(f));

  if (missingFiles.length > 0 || orphanedFiles.length > 0) {
    console.log(`${slug.toUpperCase()} / ${type.toUpperCase()}`);
    console.log(`${'─'.repeat(80)}`);

    if (missingFiles.length > 0) {
      console.log(
        `  ❌ MISSING FROM DISK (${missingFiles.length} files have DB records but no files):`
      );
      missingFiles.forEach(f => {
        console.log(`     - ${path.basename(f.file_path)}`);
      });
      totalMissing += missingFiles.length;
    }

    if (orphanedFiles.length > 0) {
      console.log(
        `  ⚠️  ORPHANED ON DISK (${orphanedFiles.length} files exist but no DB records):`
      );
      orphanedFiles.slice(0, 10).forEach(f => {
        const fpath = path.join(diskPath, f);
        const stats = fs.statSync(fpath);
        const size = (stats.size / 1024 / 1024).toFixed(2);
        console.log(`     - ${f} (${size}MB)`);
      });
      if (orphanedFiles.length > 10) {
        console.log(`     ... and ${orphanedFiles.length - 10} more`);
      }
      totalOrphaned += orphanedFiles.length;
    }

    console.log('');
  }
}

console.log('='.repeat(90));
console.log('SUMMARY:');
console.log(`  ❌ Missing from disk: ${totalMissing} files (have DB records)`);
console.log(`  ⚠️  Orphaned on disk: ${totalOrphaned} files (no DB records)`);
console.log('');

db.close();
