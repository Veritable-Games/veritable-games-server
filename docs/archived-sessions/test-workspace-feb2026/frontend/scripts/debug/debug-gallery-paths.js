const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const db = new Database(path.join(__dirname, 'data/content.db'));

// Get a sample record
const sample = db
  .prepare(
    `
  SELECT project_reference_images.id, file_path, filename_storage, gallery_type, projects.slug FROM project_reference_images
  JOIN projects ON projects.id = project_reference_images.project_id
  LIMIT 1
`
  )
  .get();

console.log('Sample record from database:');
console.log(`  file_path: ${sample.file_path}`);
console.log(`  filename_storage: ${sample.filename_storage}`);
console.log(`  gallery_type: ${sample.gallery_type}`);
console.log(`  project slug: ${sample.slug}`);
console.log('');

// Reconstruct the path as the script did
const fullPath = path.join(__dirname, `public/uploads${sample.file_path}`);
console.log(`Constructed path: ${fullPath}`);
console.log(`File exists: ${fs.existsSync(fullPath)}`);
console.log('');

// Check what files actually exist for this project
const diskPath = path.join(__dirname, `public/uploads/${sample.gallery_type}/${sample.slug}`);
console.log(`Looking for files in: ${diskPath}`);
console.log(`Directory exists: ${fs.existsSync(diskPath)}`);

if (fs.existsSync(diskPath)) {
  const files = fs.readdirSync(diskPath);
  console.log(`Files in directory: ${files.length}`);
  console.log(`First few files:`);
  files.slice(0, 5).forEach(f => console.log(`  - ${f}`));
}

db.close();
