#!/usr/bin/env node
/**
 * Gallery Filename Normalization Migration
 *
 * This script:
 * 1. Renames all uploaded images from ref_* to image_* format
 * 2. Updates database records (filename_storage, file_path)
 * 3. Extracts and preserves original metadata dates (EXIF + file system)
 * 4. Updates created_at to earliest available date
 * 5. Marks missing files as deleted
 *
 * Usage:
 *   node normalize-gallery-filenames.js --dry-run  # Preview changes
 *   node normalize-gallery-filenames.js --execute  # Apply changes
 */

const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const ExifParser = require('exif-parser');

// ============================================================================
// Configuration
// ============================================================================

const DB_PATH = path.join(__dirname, '../../data/content.db');
const UPLOADS_DIR = path.join(__dirname, '../../public/uploads');
const LOG_FILE = path.join(__dirname, `migration-log-${Date.now()}.json`);

const GALLERY_TYPES = ['references', 'concept-art'];

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Extract all available dates from an image file
 * @param {Buffer} buffer - Image file buffer
 * @param {object} stats - File system stats from fs.statSync()
 * @returns {object} { exifDate, fileCreated, fileModified, earliestDate }
 */
async function extractDates(buffer, stats) {
  const dates = {
    exifDate: null,
    fileCreated: null,
    fileModified: null,
    earliestDate: null,
  };

  // Extract file system dates
  if (stats.birthtime) {
    dates.fileCreated = new Date(stats.birthtime);
  }
  if (stats.mtime) {
    dates.fileModified = new Date(stats.mtime);
  }

  // Extract EXIF date
  try {
    const metadata = await sharp(buffer).metadata();

    if (metadata.exif) {
      const parser = ExifParser.create(metadata.exif);
      const result = parser.parse();

      // Try different EXIF date fields
      const exifTimestamp =
        result.tags.DateTimeOriginal || result.tags.DateTime || result.tags.CreateDate;

      if (exifTimestamp) {
        dates.exifDate = new Date(exifTimestamp * 1000); // EXIF uses seconds
      }
    }
  } catch (error) {
    // Not all images have EXIF data (PNG, GIF don't support it)
    console.log(`  No EXIF data found: ${error.message}`);
  }

  // Find earliest date
  const allDates = [dates.exifDate, dates.fileCreated, dates.fileModified].filter(Boolean);

  if (allDates.length > 0) {
    dates.earliestDate = new Date(Math.min(...allDates.map(d => d.getTime())));
  }

  return dates;
}

/**
 * Format date for SQLite (ISO 8601)
 */
function formatDateForSQL(date) {
  if (!date) return null;
  return date.toISOString().replace('T', ' ').substring(0, 19);
}

/**
 * Backup database before migration
 */
function backupDatabase() {
  const timestamp = Date.now();
  const backupPath = DB_PATH.replace('.db', `.backup-${timestamp}.db`);
  fs.copyFileSync(DB_PATH, backupPath);
  console.log(`✅ Database backed up to: ${backupPath}`);
  return backupPath;
}

/**
 * Rename file on disk
 */
function renameFile(oldPath, newPath) {
  if (!fs.existsSync(oldPath)) {
    throw new Error(`File not found: ${oldPath}`);
  }
  fs.renameSync(oldPath, newPath);
}

// ============================================================================
// Migration Logic
// ============================================================================

/**
 * Process a single image record
 */
async function processImage(image, db, dryRun) {
  const result = {
    id: image.id,
    projectSlug: image.project_slug,
    galleryType: image.gallery_type,
    oldFilename: image.filename_storage,
    newFilename: null,
    oldPath: image.file_path,
    newPath: null,
    oldCreatedAt: image.created_at,
    newCreatedAt: null,
    action: null, // 'renamed' | 'deleted' | 'error' | 'skipped'
    error: null,
    dates: null,
  };

  try {
    // Check if already using image_ prefix
    if (image.filename_storage.startsWith('image_')) {
      result.action = 'skipped';
      result.error = 'Already using image_ prefix';
      return result;
    }

    // Check if file still uses ref_ prefix
    if (!image.filename_storage.startsWith('ref_')) {
      result.action = 'skipped';
      result.error = 'Does not use ref_ prefix';
      return result;
    }

    // Construct file paths
    const projectSlug = image.project_slug;
    const oldFilePath = path.join(
      UPLOADS_DIR,
      image.gallery_type,
      projectSlug,
      image.filename_storage
    );

    // Generate new filename
    const newFilename = image.filename_storage.replace(/^ref_/, 'image_');
    const newFilePath = path.join(UPLOADS_DIR, image.gallery_type, projectSlug, newFilename);

    result.newFilename = newFilename;
    result.newPath = `/uploads/${image.gallery_type}/${projectSlug}/${newFilename}`;

    // Check if file exists
    if (!fs.existsSync(oldFilePath)) {
      result.action = 'deleted';
      result.error = `File not found: ${oldFilePath}`;

      if (!dryRun) {
        // Mark as deleted in database
        db.prepare(
          `
          UPDATE project_reference_images
          SET is_deleted = 1,
              deleted_at = datetime('now'),
              updated_at = datetime('now')
          WHERE id = ?
        `
        ).run(image.id);
      }

      return result;
    }

    // Read file and extract dates
    const buffer = fs.readFileSync(oldFilePath);
    const stats = fs.statSync(oldFilePath);
    const dates = await extractDates(buffer, stats);

    result.dates = {
      exif: dates.exifDate ? dates.exifDate.toISOString() : null,
      fileCreated: dates.fileCreated ? dates.fileCreated.toISOString() : null,
      fileModified: dates.fileModified ? dates.fileModified.toISOString() : null,
      earliest: dates.earliestDate ? dates.earliestDate.toISOString() : null,
    };

    result.newCreatedAt = dates.earliestDate
      ? formatDateForSQL(dates.earliestDate)
      : image.created_at;

    if (!dryRun) {
      // Rename file on disk
      renameFile(oldFilePath, newFilePath);

      // Update database
      db.prepare(
        `
        UPDATE project_reference_images
        SET filename_storage = ?,
            file_path = ?,
            created_at = ?,
            updated_at = datetime('now')
        WHERE id = ?
      `
      ).run(newFilename, result.newPath, result.newCreatedAt, image.id);
    }

    result.action = 'renamed';
    return result;
  } catch (error) {
    result.action = 'error';
    result.error = error.message;
    return result;
  }
}

/**
 * Main migration function
 */
async function migrate(dryRun = true) {
  console.log('='.repeat(80));
  console.log('Gallery Filename Normalization Migration');
  console.log('='.repeat(80));
  console.log(`Mode: ${dryRun ? 'DRY RUN (no changes)' : 'EXECUTE (applying changes)'}`);
  console.log('');

  // Backup database if not dry run
  let backupPath = null;
  if (!dryRun) {
    backupPath = backupDatabase();
    console.log('');
  }

  // Open database
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');

  // Get all images from both gallery types
  const images = db
    .prepare(
      `
    SELECT
      img.id,
      img.project_id,
      img.gallery_type,
      img.filename_storage,
      img.file_path,
      img.created_at,
      img.is_deleted,
      p.slug as project_slug
    FROM project_reference_images img
    JOIN projects p ON img.project_id = p.id
    WHERE img.is_deleted = 0
      AND img.gallery_type IN (${GALLERY_TYPES.map(() => '?').join(', ')})
    ORDER BY img.id ASC
  `
    )
    .all(...GALLERY_TYPES);

  console.log(`📊 Found ${images.length} images to process\n`);

  // Process each image
  const results = {
    renamed: [],
    deleted: [],
    errors: [],
    skipped: [],
  };

  for (let i = 0; i < images.length; i++) {
    const image = images[i];
    console.log(`[${i + 1}/${images.length}] Processing image #${image.id}...`);

    const result = await processImage(image, db, dryRun);

    // Categorize result
    if (result.action === 'renamed') {
      results.renamed.push(result);
      console.log(`  ✅ ${result.oldFilename} → ${result.newFilename}`);
      if (result.dates.earliest) {
        console.log(`  📅 Date: ${result.oldCreatedAt} → ${result.newCreatedAt}`);
      }
    } else if (result.action === 'deleted') {
      results.deleted.push(result);
      console.log(`  ⚠️  Marked as deleted: ${result.error}`);
    } else if (result.action === 'error') {
      results.errors.push(result);
      console.log(`  ❌ Error: ${result.error}`);
    } else if (result.action === 'skipped') {
      results.skipped.push(result);
      console.log(`  ⏭️  Skipped: ${result.error}`);
    }

    console.log('');
  }

  // Close database
  db.close();

  // Print summary
  console.log('='.repeat(80));
  console.log('Migration Summary');
  console.log('='.repeat(80));
  console.log(`Total processed: ${images.length}`);
  console.log(`✅ Renamed:      ${results.renamed.length}`);
  console.log(`⚠️  Deleted:      ${results.deleted.length}`);
  console.log(`❌ Errors:       ${results.errors.length}`);
  console.log(`⏭️  Skipped:      ${results.skipped.length}`);
  console.log('');

  // Save log
  const log = {
    timestamp: new Date().toISOString(),
    mode: dryRun ? 'dry-run' : 'execute',
    backupPath,
    summary: {
      total: images.length,
      renamed: results.renamed.length,
      deleted: results.deleted.length,
      errors: results.errors.length,
      skipped: results.skipped.length,
    },
    results,
  };

  fs.writeFileSync(LOG_FILE, JSON.stringify(log, null, 2));
  console.log(`📄 Log saved to: ${LOG_FILE}`);

  if (dryRun) {
    console.log('\n⚠️  This was a DRY RUN. No changes were made.');
    console.log('   Run with --execute to apply changes.');
  } else {
    console.log('\n✅ Migration complete!');
    if (backupPath) {
      console.log(`   Database backup: ${backupPath}`);
    }
  }
}

// ============================================================================
// CLI Entry Point
// ============================================================================

const args = process.argv.slice(2);
const dryRun = !args.includes('--execute');

if (args.includes('--help') || args.includes('-h')) {
  console.log(`
Gallery Filename Normalization Migration

Usage:
  node normalize-gallery-filenames.js [options]

Options:
  --dry-run    Preview changes without modifying files/database (default)
  --execute    Apply changes to files and database
  --help, -h   Show this help message

Examples:
  node normalize-gallery-filenames.js              # Dry run
  node normalize-gallery-filenames.js --dry-run    # Dry run
  node normalize-gallery-filenames.js --execute    # Apply changes
`);
  process.exit(0);
}

// Run migration
migrate(dryRun).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
