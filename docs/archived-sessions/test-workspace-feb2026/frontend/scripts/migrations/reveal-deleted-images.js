#!/usr/bin/env node
/**
 * Reveal All Deleted Images Migration
 *
 * This script unmarks ALL soft-deleted images in the gallery system.
 * Soft-deleted images are hidden from the UI but still exist in the database.
 *
 * Current Status:
 * - Total deleted (hidden): 161 images
 * - references gallery: 149 images
 * - concept-art gallery: 12 images
 *
 * Usage:
 *   node reveal-deleted-images.js --dry-run  # Preview changes
 *   node reveal-deleted-images.js --execute  # Apply changes
 *
 * The script:
 * 1. Backs up the database before making changes
 * 2. Sets is_deleted = 0 for all images
 * 3. Clears deleted_at and deleted_by fields
 * 4. Updates the timestamp to track the reveal operation
 * 5. Logs all changes to migration-log file
 */

const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

// ============================================================================
// Configuration
// ============================================================================

const DB_PATH = path.join(__dirname, '../../data/content.db');
const LOG_FILE = path.join(__dirname, `reveal-log-${Date.now()}.json`);

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Backup database before migration
 */
function backupDatabase() {
  const timestamp = Date.now();
  const backupPath = DB_PATH.replace('.db', `.backup-reveal-${timestamp}.db`);
  fs.copyFileSync(DB_PATH, backupPath);
  console.log(`✅ Database backed up to: ${backupPath}`);
  return backupPath;
}

/**
 * Main reveal function
 */
async function revealImages(dryRun = true) {
  console.log('='.repeat(80));
  console.log('Reveal Deleted Images Migration');
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

  // Get all deleted images
  const deletedImages = db
    .prepare(
      `
    SELECT id, project_id, gallery_type, filename_storage, is_deleted, deleted_at, deleted_by
    FROM project_reference_images
    WHERE is_deleted = 1
    ORDER BY id ASC
  `
    )
    .all();

  console.log(`📊 Found ${deletedImages.length} deleted (hidden) images\n`);

  // Group by gallery type for summary
  const byGalleryType = {
    references: deletedImages.filter(img => img.gallery_type === 'references').length,
    'concept-art': deletedImages.filter(img => img.gallery_type === 'concept-art').length,
  };

  console.log('Breakdown by gallery type:');
  console.log(`  references:  ${byGalleryType.references}`);
  console.log(`  concept-art: ${byGalleryType['concept-art']}`);
  console.log('');

  const results = {
    total: deletedImages.length,
    revealed: 0,
    errors: 0,
  };

  if (!dryRun) {
    console.log('🔄 Revealing images...\n');

    try {
      // Use transaction for atomic operation
      db.transaction(() => {
        const stmt = db.prepare(`
          UPDATE project_reference_images
          SET is_deleted = 0,
              deleted_at = NULL,
              deleted_by = NULL,
              updated_at = datetime('now')
          WHERE is_deleted = 1
        `);

        const result = stmt.run();
        results.revealed = result.changes;
      })();

      console.log(`✅ Successfully revealed ${results.revealed} images`);
    } catch (error) {
      console.error(`❌ Error during reveal: ${error.message}`);
      results.errors = 1;
    }
  } else {
    // In dry run mode, just show what would happen
    console.log('🔍 Preview of changes:\n');
    console.log('Images that WOULD BE revealed:');
    const preview = deletedImages.slice(0, 10);
    preview.forEach((img, idx) => {
      console.log(`  [${idx + 1}] ID ${img.id}: ${img.filename_storage} (${img.gallery_type})`);
    });
    if (deletedImages.length > 10) {
      console.log(`  ... and ${deletedImages.length - 10} more`);
    }
    results.revealed = deletedImages.length;
  }

  // Close database
  db.close();

  // Print summary
  console.log('\n' + '='.repeat(80));
  console.log('Reveal Summary');
  console.log('='.repeat(80));
  console.log(`Total images to reveal: ${results.total}`);
  console.log(`✅ Would reveal:        ${results.revealed}`);
  console.log(`❌ Errors:              ${results.errors}`);
  console.log('');

  // Save log
  const log = {
    timestamp: new Date().toISOString(),
    mode: dryRun ? 'dry-run' : 'execute',
    backupPath,
    summary: {
      total: deletedImages.length,
      revealed: results.revealed,
      errors: results.errors,
      byGalleryType,
    },
    details: deletedImages.map(img => ({
      id: img.id,
      gallery_type: img.gallery_type,
      filename: img.filename_storage,
      was_deleted_at: img.deleted_at,
      was_deleted_by: img.deleted_by,
    })),
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
    console.log('\n🎉 All hidden images are now visible in the gallery!');
  }
}

// ============================================================================
// CLI Entry Point
// ============================================================================

const args = process.argv.slice(2);
const dryRun = !args.includes('--execute');

if (args.includes('--help') || args.includes('-h')) {
  console.log(`
Reveal Deleted Images Migration

This script unmarks ALL soft-deleted images in the project gallery system.
Soft-deleted images are hidden from the UI but still exist in the database.

Usage:
  node reveal-deleted-images.js [options]

Options:
  --dry-run    Preview changes without modifying database (default)
  --execute    Apply changes to database
  --help, -h   Show this help message

Examples:
  node reveal-deleted-images.js              # Dry run
  node reveal-deleted-images.js --dry-run    # Dry run
  node reveal-deleted-images.js --execute    # Apply changes

Current Status:
  Total hidden images: 161
  - references:   149
  - concept-art:  12
`);
  process.exit(0);
}

// Run migration
revealImages(dryRun).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
