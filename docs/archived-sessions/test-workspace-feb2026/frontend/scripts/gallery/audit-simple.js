#!/usr/bin/env node

const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

// Open database
const db = new Database(path.join(__dirname, 'data/content.db'));

// Get all projects
const projects = db.prepare('SELECT id, slug FROM projects').all();

console.log('='.repeat(80));
console.log('GALLERY IMAGE AUDIT');
console.log('='.repeat(80));
console.log('');

const results = {};

for (const project of projects) {
  const slug = project.slug;

  // Count DB records for references
  const refCount = db
    .prepare(
      `
    SELECT COUNT(*) as count FROM project_reference_images 
    WHERE project_id = ? AND is_deleted = 0
  `
    )
    .get(project.id);

  // Count actual files
  const refPath = path.join(__dirname, `public/uploads/references/${slug}`);
  const conceptPath = path.join(__dirname, `public/uploads/concept-art/${slug}`);

  let refFiles = 0;
  let conceptFiles = 0;

  if (fs.existsSync(refPath)) {
    refFiles = fs.readdirSync(refPath).length;
  }

  if (fs.existsSync(conceptPath)) {
    conceptFiles = fs.readdirSync(conceptPath).length;
  }

  results[slug] = {
    references: {
      db: refCount.count,
      disk: refFiles,
      mismatch: refCount.count !== refFiles ? '⚠️' : '✓',
    },
    conceptArt: {
      db: 0,
      disk: conceptFiles,
      mismatch: conceptFiles > 0 ? '⚠️' : '✓',
    },
  };
}

// Print results
console.log('PROJECT              | REFERENCES         | CONCEPT ART');
console.log('                     | DB    Disk  Status | DB    Disk  Status');
console.log('-'.repeat(80));

for (const [slug, data] of Object.entries(results)) {
  const refStatus = `${data.references.db.toString().padEnd(4)} ${data.references.disk.toString().padEnd(4)} ${data.references.mismatch}`;
  const conceptStatus = `${data.conceptArt.db.toString().padEnd(4)} ${data.conceptArt.disk.toString().padEnd(4)} ${data.conceptArt.mismatch}`;
  console.log(`${slug.padEnd(20)} | ${refStatus} | ${conceptStatus}`);
}

console.log('');
console.log('='.repeat(80));
console.log('SUMMARY:');

const refTotal = Object.values(results).reduce((sum, p) => sum + p.references.db, 0);
const refDiskTotal = Object.values(results).reduce((sum, p) => sum + p.references.disk, 0);
const conceptTotal = Object.values(results).reduce((sum, p) => sum + p.conceptArt.db, 0);
const conceptDiskTotal = Object.values(results).reduce((sum, p) => sum + p.conceptArt.disk, 0);

console.log(
  `References:   ${refTotal} in DB, ${refDiskTotal} on disk (${refDiskTotal - refTotal > 0 ? '+' : ''}${refDiskTotal - refTotal} difference)`
);
console.log(
  `Concept Art:  ${conceptTotal} in DB, ${conceptDiskTotal} on disk (${conceptDiskTotal - conceptTotal > 0 ? '+' : ''}${conceptDiskTotal - conceptTotal} difference)`
);
console.log(
  `TOTAL:        ${refTotal + conceptTotal} in DB, ${refDiskTotal + conceptDiskTotal} on disk`
);
console.log('');

if (refDiskTotal > refTotal || conceptDiskTotal > conceptTotal) {
  console.log('⚠️  WARNING: Orphaned files detected on disk!');
  console.log(`   ${refDiskTotal - refTotal} orphaned reference files`);
  console.log(`   ${conceptDiskTotal - conceptTotal} orphaned concept-art files`);
}

db.close();
