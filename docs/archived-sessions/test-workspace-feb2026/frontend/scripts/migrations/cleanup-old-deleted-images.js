#!/usr/bin/env node
/**
 * Cleanup Old Soft-Deleted Images
 *
 * This script permanently deletes soft-deleted images that are:
 * - Older than a specified age (default: 30 days)
 * - Still marked as is_deleted = 1
 *
 * It performs both database cleanup AND file deletion from disk.
 *
 * Usage:
 *   node cleanup-old-deleted-images.js --dry-run --days 30  # Preview
 *   node cleanup-old-deleted-images.js --execute --days 30  # Execute
 *   node cleanup-old-deleted-images.js --execute --days 7   # More aggressive
 */

const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

// ============================================================================
// Configuration
// ============================================================================

const DB_PATH = path.join(__dirname, '../../data/content.db');
const UPLOADS_DIR = path.join(__dirname, '../../public/uploads');
const LOG_FILE = path.join(__dirname, `cleanup-log-${Date.now()}.json`);

// Parse command line arguments
const args = process.argv.slice(2);
const dryRun = !args.includes('--execute');
const daysArg = args.find((arg, i) => arg === '--days' && args[i + 1]);
const daysStr = daysArg ? args[args.indexOf(daysArg) + 1] : '30';
const days = Math.max(1, parseInt(daysStr) || 30);

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Backup database before migration
 */
function backupDatabase() {
  const timestamp = Date.now();
  const backupPath = DB_PATH.replace('.db', `.backup-cleanup-${timestamp}.db`);
  fs.copyFileSync(DB_PATH, backupPath);
  console.log(`✅ Database backed up to: ${backupPath}`);
  return backupPath;
}

/**
 * Calculate date threshold
 */
function getThresholdDate(days) {
  const threshold = new Date();
  threshold.setDate(threshold.getDate() - days);
  return threshold.toISOString().split('T')[0];
}

/**
 * Main cleanup function
 */
async function cleanup(dryRun = true) {
  const thresholdDate = getThresholdDate(days);

  console.log('='.repeat(80));
  console.log('Cleanup Old Soft-Deleted Images');
  console.log('='.repeat(80));
  console.log(`Mode: ${dryRun ? 'DRY RUN (no changes)' : 'EXECUTE (applying changes)'}`);
  console.log(`Age threshold: ${days} days (before ${thresholdDate})`);
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

  // Get all soft-deleted images older than threshold
  const oldDeletedImages = db
    .prepare(
      `
    SELECT
      id,
      project_id,
      gallery_type,
      filename_storage,
      file_path,
      file_size,
      deleted_at,
      deleted_by
    FROM project_reference_images
    WHERE is_deleted = 1
      AND deleted_at < ?
    ORDER BY deleted_at ASC
  `
    )
    .all(thresholdDate);

  console.log(`📊 Found ${oldDeletedImages.length} soft-deleted images older than ${days} days\n`);

  if (oldDeletedImages.length === 0) {
    console.log('✅ No old soft-deleted images found. Database is clean!');
    db.close();
    return;
  }

  const results = {
    total: oldDeletedImages.length,
    files_deleted: 0,
    files_missing: 0,
    db_deleted: 0,
    errors: [],
  };

  if (!dryRun) {
    console.log('🔄 Cleaning up images...\n');

    try {
      db.transaction(() => {
        for (const image of oldDeletedImages) {
          // Get full file path
          const filePath = path.join(UPLOADS_DIR, image.file_path.substring(1)); // Remove leading /

          // Try to delete file from disk
          if (fs.existsSync(filePath)) {
            try {
              fs.unlinkSync(filePath);
              results.files_deleted++;
              console.log(`  ✅ Deleted file: ${image.filename_storage}`);
            } catch (error) {
              results.errors.push({
                imageId: image.id,
                type: 'file_delete_failed',
                filename: image.filename_storage,
                error: error instanceof Error ? error.message : String(error),
              });
              console.log(`  ⚠️  Failed to delete file: ${image.filename_storage}`);
            }
          } else {
            results.files_missing++;
            console.log(`  📁 File already missing: ${image.filename_storage}`);
          }

          // Delete from database
          db.prepare('DELETE FROM project_reference_image_tags WHERE reference_id = ?').run(
            image.id
          );
          db.prepare('DELETE FROM project_reference_images WHERE id = ?').run(image.id);
          results.db_deleted++;
        }
      })();

      console.log('\n✅ Cleanup complete');
    } catch (error) {
      console.error(`❌ Error during cleanup: ${error.message}`);
      results.errors.push({
        type: 'transaction_error',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  } else {
    // In dry-run mode, just show what would happen
    console.log('🔍 Preview of files that WOULD BE DELETED:\n');

    let filesWouldDelete = 0;
    let filesWouldBeOrphaned = 0;

    for (const image of oldDeletedImages) {
      const filePath = path.join(UPLOADS_DIR, image.file_path.substring(1));
      if (fs.existsSync(filePath)) {
        filesWouldDelete++;
        if (filesWouldDelete <= 5) {
          console.log(
            `  ${image.filename_storage} (${(image.file_size / 1024 / 1024).toFixed(2)} MB)`
          );
        }
      } else {
        filesWouldBeOrphaned++;
      }
    }

    if (oldDeletedImages.length > 5) {
      console.log(`  ... and ${oldDeletedImages.length - 5} more`);
    }

    console.log('');
    results.files_deleted = filesWouldDelete;
    results.files_missing = filesWouldBeOrphaned;
    results.db_deleted = oldDeletedImages.length;
  }

  // Close database
  db.close();

  // Print summary
  console.log('\n' + '='.repeat(80));
  console.log('Cleanup Summary');
  console.log('='.repeat(80));
  console.log(`Total images: ${results.total}`);
  console.log(`Files deleted: ${results.files_deleted}`);
  console.log(`Files missing: ${results.files_missing}`);
  console.log(`Database records removed: ${results.db_deleted}`);
  if (results.errors.length > 0) {
    console.log(`❌ Errors: ${results.errors.length}`);
  }

  // Calculate space freed
  const totalSize = oldDeletedImages.reduce((sum, img) => sum + (img.file_size || 0), 0);
  const freedSize = oldDeletedImages
    .filter(img => {
      const filePath = path.join(UPLOADS_DIR, img.file_path.substring(1));
      return fs.existsSync(filePath);
    })
    .reduce((sum, img) => sum + (img.file_size || 0), 0);

  console.log(`\nDisk space freed: ${(freedSize / 1024 / 1024).toFixed(2)} MB`);
  console.log(`Total data removed: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);
  console.log('');

  // Save log
  const log = {
    timestamp: new Date().toISOString(),
    mode: dryRun ? 'dry-run' : 'execute',
    backupPath,
    configuration: {
      days,
      thresholdDate,
    },
    summary: {
      total: results.total,
      files_deleted: results.files_deleted,
      files_missing: results.files_missing,
      db_deleted: results.db_deleted,
      errors: results.errors.length,
      disk_space_freed_mb: (freedSize / 1024 / 1024).toFixed(2),
    },
    errors: results.errors,
    details: oldDeletedImages.map(img => ({
      id: img.id,
      gallery_type: img.gallery_type,
      filename: img.filename_storage,
      file_size: img.file_size,
      deleted_at: img.deleted_at,
      deleted_by: img.deleted_by,
    })),
  };

  fs.writeFileSync(LOG_FILE, JSON.stringify(log, null, 2));
  console.log(`📄 Log saved to: ${LOG_FILE}`);

  if (dryRun) {
    console.log('\n⚠️  This was a DRY RUN. No changes were made.');
    console.log('   Run with --execute to apply changes.');
  } else {
    console.log('\n✅ Cleanup complete!');
    if (backupPath) {
      console.log(`   Database backup: ${backupPath}`);
    }
  }
}

// ============================================================================
// CLI Entry Point
// ============================================================================

if (args.includes('--help') || args.includes('-h')) {
  console.log(`
Cleanup Old Soft-Deleted Images

This script permanently deletes soft-deleted images older than a specified age.
Both database records AND files are removed.

Usage:
  node cleanup-old-deleted-images.js [options]

Options:
  --dry-run    Preview changes without modifying (default)
  --execute    Apply changes to database and disk
  --days N     Age threshold in days (default: 30)
  --help, -h   Show this help message

Examples:
  node cleanup-old-deleted-images.js
  node cleanup-old-deleted-images.js --days 7
  node cleanup-old-deleted-images.js --execute --days 30
  node cleanup-old-deleted-images.js --execute --days 7

Safety:
  - Automatic database backup before changes
  - Dry-run preview first to see what will be deleted
  - Confirm deletion with --execute flag
  - Errors are logged for review

Note: Soft-deleted images are those marked as is_deleted = 1 in the database.
They are hidden from the UI but still exist on disk and in the database.
This script cleans up both locations.
`);
  process.exit(0);
}

// Run cleanup
cleanup(dryRun).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
