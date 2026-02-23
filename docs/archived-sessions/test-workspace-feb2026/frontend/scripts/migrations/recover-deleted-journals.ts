/**
 * Recovery Script: Restore Deleted Journals
 * Purpose: Mark all journals as NOT deleted if they were accidentally deleted during migration
 *
 * USAGE:
 *   DATABASE_URL="postgresql://postgres:postgres@10.100.0.1:5432/veritable_games" \
 *   DATABASE_MODE=production \
 *   npx tsx scripts/migrations/recover-deleted-journals.ts
 */

import { dbAdapter } from '@/lib/database/adapter';
import { logger } from '@/lib/utils/logger';

async function recoverJournals() {
  try {
    logger.info('🔍 Checking journal deletion status...\n');

    // Check current status
    const statusResult = await dbAdapter.query(
      `SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN is_deleted = TRUE THEN 1 END) as deleted_count,
        COUNT(CASE WHEN is_deleted = FALSE THEN 1 END) as active_count,
        COUNT(CASE WHEN is_deleted IS NULL THEN 1 END) as null_count
      FROM wiki.journals`,
      [],
      { schema: 'wiki' }
    );

    const status = statusResult.rows[0];
    logger.info('Current Journal Status:');
    logger.info(`  Total journals: ${status.total}`);
    logger.info(`  Deleted: ${status.deleted_count}`);
    logger.info(`  Active: ${status.active_count}`);
    logger.info(`  NULL: ${status.null_count}\n`);

    if (parseInt(status.deleted_count) === 0) {
      logger.info('✅ All journals are active. No recovery needed.\n');
      return;
    }

    if (parseInt(status.total) === 0) {
      logger.warn('⚠️  No journals found in database. Migration may not have completed.\n');
      return;
    }

    logger.warn(`⚠️  Found ${status.deleted_count} deleted journals. Recovery needed.\n`);

    // Recover journals
    logger.info('🔧 Recovering journals...\n');

    const recoverResult = await dbAdapter.query(
      `UPDATE wiki.journals 
       SET is_deleted = FALSE, deleted_by = NULL, deleted_at = NULL
       WHERE is_deleted = TRUE`,
      [],
      { schema: 'wiki' }
    );

    logger.info(`✅ Recovered ${recoverResult.rowCount} journals\n`);

    // Verify recovery
    const verifyResult = await dbAdapter.query(
      `SELECT COUNT(*) as active_count FROM wiki.journals WHERE is_deleted = FALSE`,
      [],
      { schema: 'wiki' }
    );

    logger.info(`✅ Verification: ${verifyResult.rows[0].active_count} journals now active\n`);
    logger.info('🎉 Journal recovery complete!');

    process.exit(0);
  } catch (error) {
    logger.error('❌ Recovery failed:', error);
    process.exit(1);
  }
}

recoverJournals();
