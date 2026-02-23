/**
 * Migration script: Migrate existing journals to the new category system
 *
 * This script:
 * 1. Creates an "Uncategorized" journal category for each user who has journals
 * 2. Updates all existing journals to use the new journal_category_id field
 * 3. Clears the wiki category_id on journal entries (removes wiki category link)
 *
 * Run with: DATABASE_MODE=production npx tsx scripts/migrations/migrate-journals-to-categories.ts
 */

import { dbAdapter } from '../../src/lib/database/adapter';

async function migrateJournalsToCategories() {
  console.log('Starting journal category migration...\n');

  try {
    // Step 1: Find all users who have journals
    console.log('Step 1: Finding users with journals...');
    const usersResult = await dbAdapter.query(
      `SELECT DISTINCT created_by as user_id
       FROM wiki_pages
       WHERE namespace = 'journals'`,
      [],
      { schema: 'wiki' }
    );

    const userIds = usersResult.rows.map((r: { user_id: number }) => r.user_id);
    console.log(`  Found ${userIds.length} users with journals\n`);

    if (userIds.length === 0) {
      console.log('No journals to migrate. Done!');
      return;
    }

    // Step 2: Create "Uncategorized" category for each user
    console.log('Step 2: Creating Uncategorized categories...');
    const categoryIds: Record<number, string> = {};

    for (const userId of userIds) {
      const categoryId = `jcat-${userId}-uncategorized`;

      // Check if already exists
      const existingResult = await dbAdapter.query(
        `SELECT id FROM journal_categories WHERE id = $1`,
        [categoryId],
        { schema: 'wiki' }
      );

      if (existingResult.rows.length === 0) {
        await dbAdapter.query(
          `INSERT INTO journal_categories (id, user_id, name, sort_order)
           VALUES ($1, $2, 'Uncategorized', 0)`,
          [categoryId, userId],
          { schema: 'wiki' }
        );
        console.log(`  Created Uncategorized category for user ${userId}`);
      } else {
        console.log(`  Uncategorized category already exists for user ${userId}`);
      }

      categoryIds[userId] = categoryId;
    }
    console.log();

    // Step 3: Update journals to use the new category
    console.log('Step 3: Updating journals with category assignments...');
    let updatedCount = 0;

    for (const userId of userIds) {
      const categoryId = categoryIds[userId];

      const result = await dbAdapter.query(
        `UPDATE wiki_pages
         SET journal_category_id = $1,
             category_id = NULL
         WHERE namespace = 'journals'
           AND created_by = $2
           AND journal_category_id IS NULL`,
        [categoryId, userId],
        { schema: 'wiki' }
      );

      const count = result.rowCount || 0;
      updatedCount += count;
      console.log(`  Updated ${count} journals for user ${userId}`);
    }
    console.log();

    // Step 4: Clear wiki category_id on any remaining journal entries
    console.log('Step 4: Clearing wiki category references on journals...');
    const clearResult = await dbAdapter.query(
      `UPDATE wiki_pages
       SET category_id = NULL
       WHERE namespace = 'journals'
         AND category_id IS NOT NULL`,
      [],
      { schema: 'wiki' }
    );
    console.log(`  Cleared wiki category on ${clearResult.rowCount || 0} journals\n`);

    // Summary
    console.log('='.repeat(50));
    console.log('Migration Complete!');
    console.log('='.repeat(50));
    console.log(`  Users processed: ${userIds.length}`);
    console.log(`  Journals updated: ${updatedCount}`);
    console.log(`  Categories created: ${userIds.length}`);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

// Run the migration
migrateJournalsToCategories()
  .then(() => {
    console.log('\nMigration completed successfully.');
    process.exit(0);
  })
  .catch(error => {
    console.error('\nMigration failed:', error);
    process.exit(1);
  });
