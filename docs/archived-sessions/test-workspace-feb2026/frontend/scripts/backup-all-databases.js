#!/usr/bin/env node

/**
 * Database Backup Script - SQLite Version
 *
 * ⚠️ DEVELOPMENT ONLY - SQLite Backup
 *
 * Creates timestamped backups of all SQLite databases used in development.
 * This script is NOT for production backups.
 *
 * Usage: node scripts/backup-all-databases.js
 *
 * For production backups, use: node scripts/backup-postgres.js
 */

// Safety guard: Prevent production usage
const isProduction = process.env.NODE_ENV === 'production';
if (isProduction && !process.env.ALLOW_SQLITE_IN_PRODUCTION) {
  console.error(
    '[ERROR] SQLite Backup script cannot run in production.\n' +
      'This script only works with SQLite (development).\n' +
      'For production backups, use: scripts/backup-postgres.js\n' +
      'Production database: PostgreSQL 15\n'
  );
  process.exit(1);
}

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../data');
const BACKUP_DIR = path.join(__dirname, '../data/backups');

// Databases to backup
const DATABASES = [
  'forums.db',
  'wiki.db',
  'library.db',
  'messaging.db',
  'content.db',
  'users.db',
  'auth.db',
  'system.db',
  'main.db',
  'cache.db',
];

/**
 * Create backup directory if it doesn't exist
 */
function ensureBackupDir() {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    console.log(`✅ Created backup directory: ${BACKUP_DIR}`);
  }
}

/**
 * Get timestamp for backup filename
 */
function getTimestamp() {
  const now = new Date();
  return now.toISOString().replace(/[:.]/g, '-').slice(0, 19); // 2025-10-05T15-30-45
}

/**
 * Get file size in human-readable format
 */
function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Backup a single database file
 */
function backupDatabase(dbName, timestamp) {
  const sourcePath = path.join(DATA_DIR, dbName);

  // Check if database exists
  if (!fs.existsSync(sourcePath)) {
    console.log(`⚠️  Skipping ${dbName} (does not exist)`);
    return { success: false, reason: 'not found' };
  }

  // Create backup filename: forums.db -> forums-2025-10-05T15-30-45.db.bak
  const backupName = dbName.replace('.db', `-${timestamp}.db.bak`);
  const backupPath = path.join(BACKUP_DIR, backupName);

  try {
    // Copy file
    fs.copyFileSync(sourcePath, backupPath);

    // Get file size
    const stats = fs.statSync(backupPath);
    const size = formatFileSize(stats.size);

    console.log(`✅ Backed up: ${dbName} → ${backupName} (${size})`);
    return { success: true, size: stats.size, path: backupPath };
  } catch (error) {
    console.error(`❌ Failed to backup ${dbName}:`, error.message);
    return { success: false, reason: error.message };
  }
}

/**
 * Clean up old backups (keep last N backups per database)
 */
function cleanupOldBackups(keepCount = 5) {
  if (!fs.existsSync(BACKUP_DIR)) return;

  const files = fs.readdirSync(BACKUP_DIR);

  // Group backups by database name
  const backupGroups = {};

  files.forEach(file => {
    if (!file.endsWith('.db.bak')) return;

    // Extract database name (forums-2025-10-05T15-30-45.db.bak -> forums)
    const dbName = file.split('-')[0];
    if (!backupGroups[dbName]) {
      backupGroups[dbName] = [];
    }

    const filePath = path.join(BACKUP_DIR, file);
    const stats = fs.statSync(filePath);
    backupGroups[dbName].push({
      name: file,
      path: filePath,
      mtime: stats.mtime,
    });
  });

  // Sort by modification time (newest first) and remove old backups
  Object.keys(backupGroups).forEach(dbName => {
    const backups = backupGroups[dbName];
    backups.sort((a, b) => b.mtime - a.mtime);

    if (backups.length > keepCount) {
      const toDelete = backups.slice(keepCount);
      toDelete.forEach(backup => {
        try {
          fs.unlinkSync(backup.path);
          console.log(`🗑️  Removed old backup: ${backup.name}`);
        } catch (error) {
          console.error(`❌ Failed to remove ${backup.name}:`, error.message);
        }
      });
    }
  });
}

/**
 * Main backup function
 */
async function main() {
  console.log('🔄 Starting database backup...\n');

  // Ensure backup directory exists
  ensureBackupDir();

  // Generate timestamp for this backup run
  const timestamp = getTimestamp();
  console.log(`📅 Timestamp: ${timestamp}\n`);

  // Backup each database
  const results = {
    success: 0,
    failed: 0,
    skipped: 0,
    totalSize: 0,
  };

  DATABASES.forEach(dbName => {
    const result = backupDatabase(dbName, timestamp);

    if (result.success) {
      results.success++;
      results.totalSize += result.size || 0;
    } else if (result.reason === 'not found') {
      results.skipped++;
    } else {
      results.failed++;
    }
  });

  // Clean up old backups (keep last 5 per database)
  console.log('\n🧹 Cleaning up old backups...');
  cleanupOldBackups(5);

  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('📊 Backup Summary:');
  console.log('='.repeat(50));
  console.log(`✅ Success:   ${results.success} database(s)`);
  console.log(`⚠️  Skipped:   ${results.skipped} database(s)`);
  console.log(`❌ Failed:    ${results.failed} database(s)`);
  console.log(`💾 Total Size: ${formatFileSize(results.totalSize)}`);
  console.log(`📁 Location:   ${BACKUP_DIR}`);
  console.log('='.repeat(50));

  if (results.failed > 0) {
    process.exit(1);
  }
}

// Run backup
main().catch(error => {
  console.error('❌ Backup failed:', error);
  process.exit(1);
});
