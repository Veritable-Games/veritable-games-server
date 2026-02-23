#!/usr/bin/env node
/**
 * Import Gallery Images from JSON Export
 *
 * Restores gallery image metadata from JSON backup to PostgreSQL
 * Note: This imports metadata only. Image files should already be in git.
 * Used for disaster recovery when server is rebuilt
 *
 * Usage:
 *   node scripts/import/import-gallery-from-json.js [json-file]
 *   node scripts/import/import-gallery-from-json.js data/exports/gallery-images.json
 */

const fs = require('fs');
const path = require('path');
const { pgPool } = require('../../src/lib/database/pool-postgres');

const COLORS = {
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
};

function log(message, color = 'reset') {
  console.log(`${COLORS[color]}${message}${COLORS.reset}`);
}

async function importGalleryImages(jsonFilePath) {
  log('\n🖼️  Importing Gallery Images from JSON', 'cyan');
  log('================================================\n', 'cyan');

  // Read JSON file
  const fullPath = path.resolve(process.cwd(), jsonFilePath);

  if (!fs.existsSync(fullPath)) {
    log(`❌ File not found: ${fullPath}`, 'red');
    process.exit(1);
  }

  const jsonData = fs.readFileSync(fullPath, 'utf8');
  const images = JSON.parse(jsonData);

  if (!Array.isArray(images) || images.length === 0) {
    log('⚠️  No gallery images to import (file is empty or invalid)', 'yellow');
    process.exit(0);
  }

  log(`Found ${images.length} gallery images to import\n`, 'green');

  // Ensure content schema exists
  await pgPool.query('CREATE SCHEMA IF NOT EXISTS content');

  // Ensure gallery images table exists
  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS content.project_gallery_images (
      id SERIAL PRIMARY KEY,
      project_id INTEGER NOT NULL,
      filename VARCHAR(500) NOT NULL,
      original_filename VARCHAR(500),
      title VARCHAR(255),
      description TEXT,
      category VARCHAR(100),
      tags TEXT[],
      file_size BIGINT,
      width INTEGER,
      height INTEGER,
      mime_type VARCHAR(100),
      upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      is_featured BOOLEAN DEFAULT false,
      display_order INTEGER DEFAULT 0,
      album_id INTEGER,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  let imported = 0;
  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (const image of images) {
    try {
      // Check if image already exists (by project_id + filename)
      const existing = await pgPool.query(
        'SELECT id FROM content.project_gallery_images WHERE project_id = $1 AND filename = $2',
        [image.project_id, image.filename]
      );

      if (existing.rows.length > 0) {
        // Update existing image metadata
        await pgPool.query(
          `
          UPDATE content.project_gallery_images
          SET
            original_filename = $1,
            title = $2,
            description = $3,
            category = $4,
            tags = $5,
            file_size = $6,
            width = $7,
            height = $8,
            mime_type = $9,
            is_featured = $10,
            display_order = $11,
            album_id = $12,
            updated_at = $13
          WHERE project_id = $14 AND filename = $15
        `,
          [
            image.original_filename,
            image.title,
            image.description,
            image.category,
            image.tags,
            image.file_size,
            image.width,
            image.height,
            image.mime_type,
            image.is_featured ?? false,
            image.display_order ?? 0,
            image.album_id,
            image.updated_at || new Date(),
            image.project_id,
            image.filename,
          ]
        );

        log(`  ✅ Updated: ${image.filename}`, 'green');
        updated++;
      } else {
        // Insert new image metadata
        await pgPool.query(
          `
          INSERT INTO content.project_gallery_images (
            project_id, filename, original_filename, title, description,
            category, tags, file_size, width, height, mime_type,
            upload_date, is_featured, display_order, album_id,
            created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
        `,
          [
            image.project_id,
            image.filename,
            image.original_filename,
            image.title,
            image.description,
            image.category,
            image.tags,
            image.file_size,
            image.width,
            image.height,
            image.mime_type,
            image.upload_date || new Date(),
            image.is_featured ?? false,
            image.display_order ?? 0,
            image.album_id,
            image.created_at || new Date(),
            image.updated_at || new Date(),
          ]
        );

        log(`  ✅ Imported: ${image.filename}`, 'green');
        imported++;
      }
    } catch (error) {
      log(`  ❌ Error importing "${image.filename}": ${error.message}`, 'red');
      errors++;
    }
  }

  log('\n================================================', 'cyan');
  log('📊 Import Summary:', 'cyan');
  log(`   New images imported: ${imported}`, 'green');
  log(`   Images updated: ${updated}`, 'yellow');
  log(`   Errors: ${errors}`, errors > 0 ? 'red' : 'green');
  log('================================================\n', 'cyan');

  if (errors > 0) {
    log('⚠️  Some images failed to import. Check errors above.', 'yellow');
  } else {
    log('✅ Gallery images import complete!', 'green');
  }

  log('\n💡 Note: This imports metadata only.', 'yellow');
  log('   Image files should already be deployed from git in:', 'yellow');
  log('   - public/uploads/references/', 'yellow');
  log('   - public/uploads/concept-art/', 'yellow');
  log('   - public/uploads/history/\n', 'yellow');
}

// Main execution
const jsonFile = process.argv[2] || 'data/exports/gallery-images.json';

importGalleryImages(jsonFile)
  .then(() => {
    process.exit(0);
  })
  .catch(error => {
    log(`\n❌ Fatal error: ${error.message}`, 'red');
    console.error(error);
    process.exit(1);
  });
