#!/usr/bin/env node

/**
 * Expired Invitations Cleanup Script
 *
 * Removes expired invitations from the database to keep it clean
 * and improve query performance.
 *
 * Features:
 * - Removes invitations past their expiration date
 * - Dry-run mode to preview deletions
 * - Detailed logging of cleanup operations
 * - Safe operation (only removes already-expired records)
 *
 * Usage:
 *   node scripts/cleanup-expired-invitations.js              # Clean expired invitations
 *   node scripts/cleanup-expired-invitations.js --dry-run    # Preview what would be deleted
 *   node scripts/cleanup-expired-invitations.js --verbose    # Show detailed information
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Database path
const DB_PATH = path.join(__dirname, '../data/auth.db');

// Parse command line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const isVerbose = args.includes('--verbose') || isDryRun;

/**
 * Check if database file exists
 */
function checkDatabase() {
  if (!fs.existsSync(DB_PATH)) {
    console.error(`❌ Database not found: ${DB_PATH}`);
    console.error('   Run database initialization first: npm run db:init');
    process.exit(1);
  }
}

/**
 * Get expired invitations from database
 */
function getExpiredInvitations(db) {
  const query = `
    SELECT
      id,
      token,
      email,
      expires_at,
      created_at,
      created_by,
      used_at,
      used_by,
      revoked_at,
      notes,
      max_uses,
      use_count
    FROM invitations
    WHERE datetime(expires_at) <= datetime('now')
      AND is_revoked = 0  -- Don't double-count revoked invitations
    ORDER BY expires_at ASC
  `;

  return db.prepare(query).all();
}

/**
 * Format date for display
 */
function formatDate(isoString) {
  if (!isoString) return 'N/A';
  const date = new Date(isoString);
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Calculate how long ago the invitation expired
 */
function getExpiredDuration(expiresAt) {
  const now = new Date();
  const expired = new Date(expiresAt);
  const diffMs = now - expired;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'today';
  if (diffDays === 1) return '1 day ago';
  if (diffDays < 30) return `${diffDays} days ago`;
  if (diffDays < 365) {
    const months = Math.floor(diffDays / 30);
    return months === 1 ? '1 month ago' : `${months} months ago`;
  }
  const years = Math.floor(diffDays / 365);
  return years === 1 ? '1 year ago' : `${years} years ago`;
}

/**
 * Display invitation details
 */
function displayInvitation(invitation, index) {
  const usageStatus = invitation.used_at
    ? `Used by user ${invitation.used_by} on ${formatDate(invitation.used_at)}`
    : `Unused (${invitation.use_count}/${invitation.max_uses} uses)`;

  const emailInfo = invitation.email ? ` (restricted to ${invitation.email})` : '';

  console.log(`
  ${index + 1}. Invitation ID ${invitation.id}
     Token: ${invitation.token.substring(0, 16)}...
     Created: ${formatDate(invitation.created_at)}${emailInfo}
     Expired: ${formatDate(invitation.expires_at)} (${getExpiredDuration(invitation.expires_at)})
     Status: ${usageStatus}
     ${invitation.notes ? `Notes: ${invitation.notes}` : ''}
  `);
}

/**
 * Delete expired invitations
 */
function deleteExpiredInvitations(db) {
  const deleteQuery = `
    DELETE FROM invitations
    WHERE datetime(expires_at) <= datetime('now')
      AND is_revoked = 0
  `;

  const stmt = db.prepare(deleteQuery);
  const result = stmt.run();

  return result.changes;
}

/**
 * Get invitation statistics
 */
function getInvitationStats(db) {
  const stats = db
    .prepare(
      `
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN used_at IS NOT NULL THEN 1 ELSE 0 END) as used,
      SUM(CASE WHEN is_revoked = 1 THEN 1 ELSE 0 END) as revoked,
      SUM(CASE WHEN datetime(expires_at) <= datetime('now') AND is_revoked = 0 THEN 1 ELSE 0 END) as expired,
      SUM(CASE WHEN datetime(expires_at) > datetime('now') AND used_at IS NULL AND is_revoked = 0 THEN 1 ELSE 0 END) as active
    FROM invitations
  `
    )
    .get();

  return stats;
}

/**
 * Main cleanup function
 */
function cleanup() {
  console.log('🧹 Expired Invitations Cleanup\n');

  if (isDryRun) {
    console.log('🔍 DRY RUN MODE - No deletions will be performed\n');
  }

  // Check database exists
  checkDatabase();

  // Open database connection
  let db;
  try {
    db = new Database(DB_PATH);
    console.log(`✅ Connected to database: ${DB_PATH}\n`);
  } catch (error) {
    console.error(`❌ Failed to connect to database: ${error.message}`);
    process.exit(1);
  }

  try {
    // Get current statistics
    const beforeStats = getInvitationStats(db);
    console.log('📊 Current Invitation Statistics:');
    console.log(`   Total invitations: ${beforeStats.total}`);
    console.log(`   Active (unexpired, unused): ${beforeStats.active}`);
    console.log(`   Used: ${beforeStats.used}`);
    console.log(`   Revoked: ${beforeStats.revoked}`);
    console.log(`   Expired: ${beforeStats.expired}`);
    console.log('');

    // Get expired invitations
    const expired = getExpiredInvitations(db);

    if (expired.length === 0) {
      console.log('✨ No expired invitations found - database is clean!');
      return;
    }

    console.log(
      `🔍 Found ${expired.length} expired invitation${expired.length === 1 ? '' : 's'}\n`
    );

    // Display expired invitations in verbose mode
    if (isVerbose) {
      console.log('Expired Invitations:');
      console.log('─'.repeat(70));
      expired.forEach((inv, idx) => displayInvitation(inv, idx));
      console.log('─'.repeat(70));
      console.log('');
    }

    // Perform deletion (or skip in dry-run mode)
    if (isDryRun) {
      console.log(
        `🔍 Would delete ${expired.length} expired invitation${expired.length === 1 ? '' : 's'}`
      );
      console.log('   Run without --dry-run flag to perform actual deletion');
    } else {
      const deletedCount = deleteExpiredInvitations(db);

      if (deletedCount > 0) {
        console.log(
          `✅ Successfully deleted ${deletedCount} expired invitation${deletedCount === 1 ? '' : 's'}`
        );

        // Show updated statistics
        const afterStats = getInvitationStats(db);
        console.log('\n📊 Updated Statistics:');
        console.log(
          `   Total invitations: ${afterStats.total} (${beforeStats.total - afterStats.total} removed)`
        );
        console.log(`   Active (unexpired, unused): ${afterStats.active}`);
        console.log(`   Used: ${afterStats.used}`);
        console.log(`   Revoked: ${afterStats.revoked}`);
        console.log(`   Expired: ${afterStats.expired}`);
      } else {
        console.log('⚠️  No invitations were deleted');
      }
    }
  } catch (error) {
    console.error(`❌ Cleanup failed: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  } finally {
    // Close database connection
    if (db) {
      db.close();
      console.log('\n✅ Database connection closed');
    }
  }
}

/**
 * Display help message
 */
function displayHelp() {
  console.log(`
Expired Invitations Cleanup Script

Usage:
  node scripts/cleanup-expired-invitations.js [options]

Options:
  --dry-run    Preview what would be deleted without actually deleting
  --verbose    Show detailed information about expired invitations
  --help       Display this help message

Examples:
  # Clean up expired invitations
  node scripts/cleanup-expired-invitations.js

  # Preview what would be deleted
  node scripts/cleanup-expired-invitations.js --dry-run

  # Show detailed information
  node scripts/cleanup-expired-invitations.js --dry-run --verbose

Recommendations:
  - Run with --dry-run first to preview deletions
  - Schedule as a cron job for automatic cleanup
  - Run weekly or monthly depending on invitation creation rate

Cron Job Example (daily at 2 AM):
  0 2 * * * cd /path/to/frontend && npm run invitations:cleanup >> logs/cleanup.log 2>&1

For more information, see: docs/features/INVITATION_SYSTEM.md
  `);
}

// Handle --help flag
if (args.includes('--help') || args.includes('-h')) {
  displayHelp();
  process.exit(0);
}

// Run cleanup
cleanup();
