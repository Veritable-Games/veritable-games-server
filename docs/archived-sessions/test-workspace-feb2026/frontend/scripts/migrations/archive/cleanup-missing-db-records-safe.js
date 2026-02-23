#!/usr/bin/env node

const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const db = new Database(path.join(__dirname, 'data/content.db'));

console.log('='.repeat(100));
console.log('CLEANUP MISSING FILES - SAFE DELETION OF ORPHANED DB RECORDS');
console.log('='.repeat(100));
console.log('');
console.log('This script deletes ONLY database records for files that do not exist on disk.');
console.log('The 161 "orphaned" files on disk are actually soft-deleted images (is_deleted=1),');
console.log('which are expected and should be cleaned up by the periodic cleanup job, not here.');
console.log('');

// Get all active records that reference missing files
const missingRecords = db
  .prepare(
    `
  SELECT
    pri.id,
    pri.project_id,
    pri.file_path,
    pri.gallery_type,
    p.slug
  FROM project_reference_images pri
  JOIN projects p ON p.id = pri.project_id
  WHERE pri.is_deleted = 0
  ORDER BY pri.gallery_type, p.slug
`
  )
  .all();

const toDelete = [];

console.log('Analyzing records...');
console.log('');

for (const record of missingRecords) {
  const filename = path.basename(record.file_path);
  const diskPath = path.join(__dirname, `public/uploads/${record.gallery_type}/${record.slug}`);

  let exists = false;
  if (fs.existsSync(diskPath)) {
    const files = fs.readdirSync(diskPath);
    exists = files.includes(filename);
  }

  if (!exists) {
    toDelete.push(record);
    console.log(`❌ [${record.id}] ${record.gallery_type}/${record.slug}/${filename}`);
  }
}

console.log('');
console.log('='.repeat(100));
console.log(`Found ${toDelete.length} orphaned DB records (files missing from disk)`);
console.log('='.repeat(100));
console.log('');

if (toDelete.length === 0) {
  console.log('✅ No orphaned records found. Database is clean!');
  db.close();
  process.exit(0);
}

console.log('Records to delete:');
toDelete.forEach(record => {
  console.log(`  - ID ${record.id}: ${record.gallery_type}/${record.slug}`);
});
console.log('');

// Create backup before deletion
const timestamp = Date.now();
const backupPath = path.join(__dirname, `data/content.backup-before-cleanup-${timestamp}.db`);
console.log(`Creating backup: ${backupPath}`);
fs.copyFileSync(path.join(__dirname, 'data/content.db'), backupPath);
console.log('✓ Backup created');
console.log('');

// Delete the records
console.log('Deleting orphaned records...');
const deleteStmt = db.prepare('DELETE FROM project_reference_images WHERE id = ?');

for (const record of toDelete) {
  deleteStmt.run(record.id);
}

console.log(`✓ Deleted ${toDelete.length} orphaned DB records`);
console.log('');

// Verify
const finalCount = db.prepare('SELECT COUNT(*) as count FROM project_reference_images').get();
console.log('='.repeat(100));
console.log(`Final record count: ${finalCount.count}`);
console.log('✅ Cleanup complete');
console.log('');

db.close();
