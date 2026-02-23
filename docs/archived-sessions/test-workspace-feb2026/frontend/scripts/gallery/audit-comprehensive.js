#!/usr/bin/env node

const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const db = new Database(path.join(__dirname, 'data/content.db'));

console.log('='.repeat(100));
console.log('SAFE GALLERY AUDIT - NO DELETIONS, REPORTING ONLY');
console.log('='.repeat(100));
console.log('');

// First, understand the data format
console.log('STEP 1: Analyzing database structure');
console.log('-'.repeat(100));

const sample = db
  .prepare(
    `
  SELECT
    id,
    project_id,
    file_path,
    filename_storage,
    gallery_type,
    is_deleted
  FROM project_reference_images
  LIMIT 1
`
  )
  .get();

if (sample) {
  console.log('Sample record:');
  console.log(JSON.stringify(sample, null, 2));
  console.log('');
}

// Get counts by gallery type
const typeCounts = db
  .prepare(
    `
  SELECT
    gallery_type,
    COUNT(*) as total,
    SUM(CASE WHEN is_deleted = 0 THEN 1 ELSE 0 END) as active,
    SUM(CASE WHEN is_deleted = 1 THEN 1 ELSE 0 END) as soft_deleted
  FROM project_reference_images
  GROUP BY gallery_type
  ORDER BY gallery_type
`
  )
  .all();

console.log('Database counts by gallery_type:');
typeCounts.forEach(row => {
  console.log(
    `  ${row.gallery_type}: ${row.total} total (${row.active} active, ${row.soft_deleted} soft-deleted)`
  );
});
console.log('');

// Now get all active (non-deleted) records organized by gallery type and project
console.log('STEP 2: Analyzing disk structure and comparing');
console.log('-'.repeat(100));
console.log('');

const allRecords = db
  .prepare(
    `
  SELECT
    pri.id,
    pri.project_id,
    pri.file_path,
    pri.gallery_type,
    pri.is_deleted,
    p.slug
  FROM project_reference_images pri
  JOIN projects p ON p.id = pri.project_id
  ORDER BY pri.gallery_type, p.slug, pri.file_path
`
  )
  .all();

// Organize by gallery_type/slug
const recordsByType = {};
for (const record of allRecords) {
  if (!recordsByType[record.gallery_type]) {
    recordsByType[record.gallery_type] = {};
  }
  if (!recordsByType[record.gallery_type][record.slug]) {
    recordsByType[record.gallery_type][record.slug] = [];
  }
  recordsByType[record.gallery_type][record.slug].push(record);
}

let totalMissing = 0;
let totalOrphaned = 0;
let totalActive = 0;
let totalSoftDeleted = 0;

const detailedResults = {};

for (const [galleryType, slugData] of Object.entries(recordsByType)) {
  detailedResults[galleryType] = {};

  for (const [slug, records] of Object.entries(slugData)) {
    const diskPath = path.join(__dirname, `public/uploads/${galleryType}/${slug}`);

    let diskFiles = [];
    let diskExists = false;

    if (fs.existsSync(diskPath)) {
      diskExists = true;
      diskFiles = fs.readdirSync(diskPath);
    }

    // Separate into active and soft-deleted
    const activeRecords = records.filter(r => r.is_deleted === 0);
    const softDeletedRecords = records.filter(r => r.is_deleted === 1);

    totalActive += activeRecords.length;
    totalSoftDeleted += softDeletedRecords.length;

    // Find missing files (in DB but not on disk) - for ACTIVE records only
    const missingFiles = [];
    const duplicateNames = {};

    for (const record of activeRecords) {
      const filename = path.basename(record.file_path);
      if (!diskFiles.includes(filename)) {
        missingFiles.push({
          id: record.id,
          filename: filename,
          fullPath: record.file_path,
        });
        totalMissing++;
      } else {
        // Track which files exist to find duplicates
        if (!duplicateNames[filename]) {
          duplicateNames[filename] = [];
        }
        duplicateNames[filename].push(record.id);
      }
    }

    // Find orphaned files (on disk but not in DB)
    const dbActiveFilenames = new Set(activeRecords.map(r => path.basename(r.file_path)));
    const orphanedFiles = diskFiles.filter(f => !dbActiveFilenames.has(f));
    totalOrphaned += orphanedFiles.length;

    detailedResults[galleryType][slug] = {
      diskExists,
      diskCount: diskFiles.length,
      dbActiveCount: activeRecords.length,
      dbSoftDeletedCount: softDeletedRecords.length,
      missingFiles,
      orphanedFiles,
      duplicateRecords: Object.entries(duplicateNames).filter(([_, ids]) => ids.length > 1),
    };
  }
}

// Print detailed results
console.log('DETAILED RESULTS BY GALLERY TYPE:');
console.log('');

for (const [galleryType, slugData] of Object.entries(detailedResults)) {
  console.log(`${galleryType.toUpperCase()}`);
  console.log('='.repeat(100));

  for (const [slug, data] of Object.entries(slugData)) {
    const hasIssues =
      data.missingFiles.length > 0 ||
      data.orphanedFiles.length > 0 ||
      data.duplicateRecords.length > 0 ||
      (!data.diskExists && data.dbActiveCount > 0);

    const status = hasIssues ? '⚠️' : '✓';

    console.log(`\n${status} ${slug}`);
    console.log(`   Directory: ${data.diskExists ? 'EXISTS' : 'MISSING'}`);
    console.log(
      `   DB (active): ${data.dbActiveCount} | DB (soft-deleted): ${data.dbSoftDeletedCount} | Disk: ${data.diskCount}`
    );

    if (data.missingFiles.length > 0) {
      console.log(
        `   ❌ MISSING FROM DISK (${data.missingFiles.length} DB records have no files):`
      );
      data.missingFiles.forEach(f => {
        console.log(`      - ${f.filename} (DB ID: ${f.id})`);
      });
    }

    if (data.orphanedFiles.length > 0) {
      console.log(
        `   ⚠️  ORPHANED ON DISK (${data.orphanedFiles.length} files have no DB records):`
      );
      data.orphanedFiles.slice(0, 10).forEach(f => {
        const fpath = path.join(__dirname, `public/uploads/${galleryType}/${slug}`, f);
        try {
          const stats = fs.statSync(fpath);
          const size = (stats.size / 1024 / 1024).toFixed(2);
          console.log(`      - ${f} (${size}MB)`);
        } catch (e) {
          console.log(`      - ${f} (error reading stats)`);
        }
      });
      if (data.orphanedFiles.length > 10) {
        console.log(`      ... and ${data.orphanedFiles.length - 10} more`);
      }
    }

    if (data.duplicateRecords.length > 0) {
      console.log(
        `   🔄 DUPLICATE DB RECORDS (${data.duplicateRecords.length} filenames with multiple DB entries):`
      );
      data.duplicateRecords.forEach(([filename, ids]) => {
        console.log(`      - ${filename}: IDs ${ids.join(', ')}`);
      });
    }

    if (!data.diskExists && data.dbActiveCount > 0) {
      console.log(
        `   🚨 DIRECTORY MISSING: ${data.dbActiveCount} active DB records but no directory on disk!`
      );
    }
  }
  console.log('');
}

// Summary
console.log('');
console.log('='.repeat(100));
console.log('SUMMARY');
console.log('='.repeat(100));
console.log(`Total DB records (active):              ${totalActive}`);
console.log(`Total DB records (soft-deleted):        ${totalSoftDeleted}`);
console.log(`Total DB records (all):                 ${totalActive + totalSoftDeleted}`);
console.log('');
console.log(`Files missing from disk (DB→Disk):      ${totalMissing}`);
console.log(`Files orphaned on disk (Disk→DB):       ${totalOrphaned}`);
console.log('');

if (totalMissing === 0 && totalOrphaned === 0) {
  console.log('✅ All database records have corresponding files, and all files have records.');
  console.log('   Database and disk are IN SYNC.');
} else {
  console.log('⚠️  MISMATCHES DETECTED');
  if (totalMissing > 0) {
    console.log(`   ${totalMissing} database records reference files that don't exist on disk`);
    console.log(`   → These can be safely deleted from the database`);
  }
  if (totalOrphaned > 0) {
    console.log(`   ${totalOrphaned} files exist on disk but have no database records`);
    console.log(`   → These orphaned files should be investigated or deleted`);
  }
}

console.log('');
console.log('NO CHANGES WERE MADE TO DATABASE OR DISK');
console.log('This is a READ-ONLY audit report.');
console.log('');

db.close();
