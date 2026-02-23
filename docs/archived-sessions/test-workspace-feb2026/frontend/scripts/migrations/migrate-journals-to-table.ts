/**
 * Journal Table Migration Script
 * Date: February 15, 2026
 * Purpose: Migrate journals from wiki_pages to dedicated journals table
 *
 * Prerequisites:
 * - Schema migration 018-separate-journals-table.sql must be applied first
 * - Database backup should be created before running
 *
 * Usage:
 *   Development:
 *     DATABASE_URL="postgresql://postgres:postgres@localhost:5432/veritable_games" \
 *     DATABASE_MODE=production \
 *     npx tsx scripts/migrations/migrate-journals-to-table.ts
 *
 *   Production:
 *     DATABASE_URL="postgresql://postgres:postgres@10.100.0.1:5432/veritable_games" \
 *     DATABASE_MODE=production \
 *     npx tsx scripts/migrations/migrate-journals-to-table.ts
 */

import { dbAdapter } from '@/lib/database/adapter';
import { logger } from '@/lib/utils/logger';

interface MigrationStats {
  totalJournals: number;
  migratedJournals: number;
  deletedFromWikiPages: number;
  columnsDropped: string[];
}

async function migrateJournals(): Promise<MigrationStats> {
  const stats: MigrationStats = {
    totalJournals: 0,
    migratedJournals: 0,
    deletedFromWikiPages: 0,
    columnsDropped: [],
  };

  logger.info('========================================');
  logger.info('Starting journal migration...');
  logger.info('========================================\n');

  try {
    // ============================================================
    // PHASE 1: Verify new journals table exists
    // ============================================================
    logger.info('[Phase 1] Verifying journals table exists...');

    const tableCheck = await dbAdapter.query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'wiki'
        AND table_name = 'journals'
      ) as exists`,
      [],
      { schema: 'wiki' }
    );

    if (!tableCheck.rows[0].exists) {
      throw new Error(
        'journals table does not exist. Please run schema migration 018-separate-journals-table.sql first.'
      );
    }

    logger.info('✓ journals table exists\n');

    // ============================================================
    // PHASE 2: Count journals to migrate
    // ============================================================
    logger.info('[Phase 2] Counting journals to migrate...');

    const countResult = await dbAdapter.query(
      `SELECT COUNT(*) as total FROM wiki_pages WHERE namespace = 'journals'`,
      [],
      { schema: 'wiki' }
    );

    stats.totalJournals = parseInt(countResult.rows[0].total);
    logger.info(`✓ Found ${stats.totalJournals} journals to migrate\n`);

    if (stats.totalJournals === 0) {
      logger.info('No journals to migrate. Exiting.');
      return stats;
    }

    // ============================================================
    // PHASE 3: Copy journal data from wiki_pages to journals table
    // ============================================================
    logger.info('[Phase 3] Migrating journal data...');

    const migrationResult = await dbAdapter.query(
      `
      INSERT INTO wiki.journals (
        id, user_id, title, slug, content,
        category_id, is_deleted, deleted_by, deleted_at,
        created_at, updated_at, restored_by, restored_at
      )
      SELECT
        p.id,
        p.created_by as user_id,
        p.title,
        p.slug,
        COALESCE(r.content, '') as content,
        p.journal_category_id as category_id,
        COALESCE(p.is_deleted, false) as is_deleted,
        p.deleted_by,
        p.deleted_at,
        p.created_at,
        p.updated_at,
        p.restored_by,
        p.restored_at
      FROM wiki.wiki_pages p
      LEFT JOIN LATERAL (
        SELECT content
        FROM wiki.wiki_revisions
        WHERE page_id = p.id
        ORDER BY created_at DESC
        LIMIT 1
      ) r ON true
      WHERE p.namespace = 'journals'
      ON CONFLICT (id) DO NOTHING
      `,
      []
    );

    stats.migratedJournals = migrationResult.rowCount || 0;
    logger.info(`✓ Migrated ${stats.migratedJournals} journals\n`);

    // ============================================================
    // PHASE 4: Verify migration count matches
    // ============================================================
    logger.info('[Phase 4] Verifying migration...');

    const verifyResult = await dbAdapter.query(
      `SELECT COUNT(*) as migrated FROM wiki.journals`,
      []
    );

    const migratedCount = parseInt(verifyResult.rows[0].migrated);

    if (migratedCount !== stats.totalJournals) {
      throw new Error(
        `Migration count mismatch: expected ${stats.totalJournals}, got ${migratedCount}`
      );
    }

    logger.info(`✓ Verification passed: ${migratedCount} journals migrated\n`);

    // ============================================================
    // PHASE 5: Verify revision history preserved
    // ============================================================
    logger.info('[Phase 5] Verifying revision history...');

    const revisionCheck = await dbAdapter.query(
      `SELECT COUNT(*) as revision_count
       FROM wiki.wiki_revisions r
       INNER JOIN wiki.journals j ON r.page_id = j.id`,
      []
    );

    const revisionCount = parseInt(revisionCheck.rows[0].revision_count);
    logger.info(`✓ Revision history preserved: ${revisionCount} journal revisions\n`);

    // ============================================================
    // PHASE 6: Delete journals from wiki_pages (auto-cleanup)
    // ============================================================
    logger.info('[Phase 6] Cleaning up wiki_pages...');

    const deleteResult = await dbAdapter.query(
      `DELETE FROM wiki.wiki_pages WHERE namespace = 'journals'`,
      []
    );

    stats.deletedFromWikiPages = deleteResult.rowCount || 0;
    logger.info(`✓ Cleaned up ${stats.deletedFromWikiPages} journal entries from wiki_pages\n`);

    // ============================================================
    // PHASE 7: Drop journal-specific columns from wiki_pages
    // ============================================================
    logger.info('[Phase 7] Dropping journal-specific columns from wiki_pages...');

    const columnsToCheck = [
      'journal_category_id',
      'is_deleted',
      'deleted_by',
      'deleted_at',
      'restored_by',
      'restored_at',
    ];

    for (const column of columnsToCheck) {
      const columnExists = await dbAdapter.query(
        `SELECT EXISTS (
          SELECT FROM information_schema.columns
          WHERE table_schema = 'wiki'
          AND table_name = 'wiki_pages'
          AND column_name = $1
        ) as exists`,
        [column],
        { schema: 'wiki' }
      );

      if (columnExists.rows[0].exists) {
        await dbAdapter.query(`ALTER TABLE wiki.wiki_pages DROP COLUMN ${column}`, []);
        stats.columnsDropped.push(column);
        logger.info(`  ✓ Dropped column: ${column}`);
      }
    }

    if (stats.columnsDropped.length === 0) {
      logger.info('  ✓ No journal-specific columns found in wiki_pages');
    }

    logger.info('');

    // ============================================================
    // MIGRATION COMPLETE
    // ============================================================
    logger.info('========================================');
    logger.info('✅ Journal migration complete!');
    logger.info('========================================\n');

    logger.info('Migration Summary:');
    logger.info(`  • Journals in wiki_pages: ${stats.totalJournals}`);
    logger.info(`  • Journals migrated: ${stats.migratedJournals}`);
    logger.info(`  • Entries cleaned from wiki_pages: ${stats.deletedFromWikiPages}`);
    logger.info(`  • Columns dropped: ${stats.columnsDropped.length}`);
    logger.info(`  • Revision history: Preserved in wiki_revisions`);
    logger.info('');

    return stats;
  } catch (error) {
    logger.error('========================================');
    logger.error('❌ Migration failed!');
    logger.error('========================================\n');
    logger.error('Error:', error);
    logger.error('\nRollback instructions:');
    logger.error('1. Restore database from backup');
    logger.error('2. Check migration logs for details');
    logger.error('3. Fix issues and retry migration');
    throw error;
  }
}

// Run migration
if (require.main === module) {
  migrateJournals()
    .then(stats => {
      logger.info('Migration completed successfully');
      process.exit(0);
    })
    .catch(error => {
      logger.error('Migration failed:', error);
      process.exit(1);
    });
}

export { migrateJournals, type MigrationStats };
