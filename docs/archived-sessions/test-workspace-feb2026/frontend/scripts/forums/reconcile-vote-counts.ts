/**
 * Vote Count Reconciliation Script
 *
 * Bug #4 Fix: Vote count drift prevention
 *
 * This script detects and fixes any drift between:
 * - forum_replies.vote_count (cached count)
 * - Actual sum from forum_votes table
 *
 * The database trigger (update_reply_vote_count) should prevent drift,
 * but this script provides a safety net for:
 * - Manual database edits
 * - Trigger failures or disabled triggers
 * - Data corruption
 * - Migration issues
 *
 * Usage:
 *   # Dry run (check only, no changes)
 *   DATABASE_MODE=production npx tsx scripts/forums/reconcile-vote-counts.ts
 *
 *   # Fix mode (apply corrections)
 *   DATABASE_MODE=production npx tsx scripts/forums/reconcile-vote-counts.ts --fix
 *
 *   # Scheduled job (run daily via cron)
 *   0 2 * * * cd /path/to/app && DATABASE_MODE=production npx tsx scripts/forums/reconcile-vote-counts.ts --fix
 */

import { dbAdapter } from '@/lib/database/adapter';
import { logger } from '@/lib/utils/logger';

interface VoteCountDiscrepancy {
  replyId: number;
  topicId: number;
  storedCount: number;
  actualCount: number;
  drift: number;
}

/**
 * Find replies where vote_count doesn't match actual sum from forum_votes
 */
async function findDiscrepancies(): Promise<VoteCountDiscrepancy[]> {
  const query = `
    SELECT
      fr.id as reply_id,
      fr.topic_id,
      COALESCE(fr.vote_count, 0) as stored_count,
      COALESCE(SUM(CASE
        WHEN fv.vote_type = 'up' THEN 1
        WHEN fv.vote_type = 'down' THEN -1
        ELSE 0
      END), 0) as actual_count,
      COALESCE(fr.vote_count, 0) - COALESCE(SUM(CASE
        WHEN fv.vote_type = 'up' THEN 1
        WHEN fv.vote_type = 'down' THEN -1
        ELSE 0
      END), 0) as drift
    FROM forum_replies fr
    LEFT JOIN forum_votes fv ON fv.reply_id = fr.id
    WHERE fr.deleted_at IS NULL
    GROUP BY fr.id, fr.topic_id, fr.vote_count
    HAVING COALESCE(fr.vote_count, 0) != COALESCE(SUM(CASE
      WHEN fv.vote_type = 'up' THEN 1
      WHEN fv.vote_type = 'down' THEN -1
      ELSE 0
    END), 0)
    ORDER BY ABS(COALESCE(fr.vote_count, 0) - COALESCE(SUM(CASE
      WHEN fv.vote_type = 'up' THEN 1
      WHEN fv.vote_type = 'down' THEN -1
      ELSE 0
    END), 0)) DESC
  `;

  const result = await dbAdapter.query(query, [], { schema: 'forums' });

  return result.rows.map(row => ({
    replyId: row.reply_id,
    topicId: row.topic_id,
    storedCount: row.stored_count,
    actualCount: row.actual_count,
    drift: row.drift,
  }));
}

/**
 * Fix a single reply's vote count
 */
async function fixVoteCount(replyId: number, actualCount: number): Promise<void> {
  await dbAdapter.query(
    'UPDATE forum_replies SET vote_count = ?, updated_at = NOW() WHERE id = ?',
    [actualCount, replyId],
    { schema: 'forums' }
  );
}

/**
 * Verify the database trigger exists and is enabled
 */
async function verifyTrigger(): Promise<boolean> {
  const result = await dbAdapter.query(
    `SELECT trigger_name, event_object_table, action_statement
     FROM information_schema.triggers
     WHERE trigger_name = 'trigger_update_reply_vote_count'
     AND event_object_schema = 'forums'
     AND event_object_table = 'forum_votes'`,
    [],
    { schema: 'forums' }
  );

  if (result.rows.length === 0) {
    logger.error('CRITICAL: Vote count trigger is missing! Vote drift will occur.');
    logger.error('Run migration 023-create-forum-votes-table.sql to restore trigger');
    return false;
  }

  if (result.rows.length !== 3) {
    logger.warn(
      `Vote count trigger found ${result.rows.length} times (expected 3: INSERT, UPDATE, DELETE)`
    );
  }

  logger.info('✓ Vote count trigger is active');
  return true;
}

/**
 * Main reconciliation logic
 */
async function reconcile(fixMode: boolean): Promise<void> {
  logger.info('=== Vote Count Reconciliation ===');
  logger.info(`Mode: ${fixMode ? 'FIX (will apply corrections)' : 'DRY RUN (check only)'}`);
  logger.info('');

  // 1. Verify trigger exists
  const triggerExists = await verifyTrigger();

  if (!triggerExists && fixMode) {
    logger.error('Aborting: Cannot fix vote counts when trigger is missing');
    logger.error('Restore trigger first, then re-run reconciliation');
    process.exit(1);
  }

  // 2. Find discrepancies
  logger.info('Scanning for vote count discrepancies...');
  const discrepancies = await findDiscrepancies();

  if (discrepancies.length === 0) {
    logger.info('✓ No discrepancies found. All vote counts are accurate.');
    logger.info('');
    logger.info('Summary:');
    logger.info('  Total replies checked: (all non-deleted)');
    logger.info('  Discrepancies found: 0');
    logger.info('  Status: HEALTHY');
    return;
  }

  // 3. Report discrepancies
  logger.warn(`Found ${discrepancies.length} vote count discrepancies:`);
  logger.info('');

  const totalDrift = discrepancies.reduce((sum, d) => sum + Math.abs(d.drift), 0);
  const maxDrift = Math.max(...discrepancies.map(d => Math.abs(d.drift)));

  logger.info('Top 10 worst discrepancies:');
  discrepancies.slice(0, 10).forEach(d => {
    logger.warn(
      `  Reply ${d.replyId} (Topic ${d.topicId}): stored=${d.storedCount}, actual=${d.actualCount}, drift=${d.drift > 0 ? '+' : ''}${d.drift}`
    );
  });

  logger.info('');
  logger.info('Summary:');
  logger.info(`  Total discrepancies: ${discrepancies.length}`);
  logger.info(`  Total drift (absolute): ${totalDrift}`);
  logger.info(`  Max drift: ${maxDrift}`);
  logger.info(`  Avg drift: ${(totalDrift / discrepancies.length).toFixed(2)}`);

  // 4. Fix if in fix mode
  if (fixMode) {
    logger.info('');
    logger.info('Applying fixes...');

    let fixed = 0;
    let failed = 0;

    for (const d of discrepancies) {
      try {
        await fixVoteCount(d.replyId, d.actualCount);
        fixed++;

        if (fixed % 100 === 0) {
          logger.info(`  Fixed ${fixed}/${discrepancies.length} replies...`);
        }
      } catch (error) {
        logger.error(`Failed to fix reply ${d.replyId}:`, error);
        failed++;
      }
    }

    logger.info('');
    logger.info('Fix Results:');
    logger.info(`  Successfully fixed: ${fixed}`);
    logger.info(`  Failed: ${failed}`);
    logger.info(`  Status: ${failed === 0 ? 'SUCCESS' : 'PARTIAL SUCCESS'}`);
  } else {
    logger.info('');
    logger.info('DRY RUN - No changes made.');
    logger.info('Run with --fix flag to apply corrections.');
  }
}

/**
 * Main entry point
 */
async function main() {
  const args = process.argv.slice(2);
  const fixMode = args.includes('--fix');

  try {
    await reconcile(fixMode);
    process.exit(0);
  } catch (error) {
    logger.error('Reconciliation failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

export { reconcile, findDiscrepancies, verifyTrigger };
