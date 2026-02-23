/**
 * Import Anarchist Tags
 *
 * Script to seed the shared.tags table with anarchist tags
 * Run with: npx ts-node -O '{"module":"commonjs"}' import-anarchist-tags.ts
 *
 * NOTE: Categories have been eliminated in the unified tag system (Nov 2025).
 * Tags are now stored directly in shared.tags without category_id.
 */

import { dbAdapter } from '@/lib/database/adapter';
import { ANARCHIST_TAGS } from './anarchist-tag-seed';
import { logger } from '@/lib/utils/logger';

async function importAnarchistTags() {
  logger.info('Starting anarchist tag import to shared.tags...\n');

  try {
    // Create tags directly in shared.tags (no categories)
    logger.info('Creating tags in shared.tags...');
    let createdCount = 0;
    let skippedCount = 0;

    for (const tag of ANARCHIST_TAGS) {
      try {
        // Check if tag exists in shared.tags
        const existingResult = await dbAdapter.query('SELECT id FROM shared.tags WHERE name = $1', [
          tag.name,
        ]);

        if (existingResult.rows.length > 0) {
          skippedCount++;
          logger.info(`  - Tag "${tag.name}" already exists`);
        } else {
          // Insert new tag into shared.tags
          await dbAdapter.query(
            `INSERT INTO shared.tags (name, description, source, created_at)
             VALUES ($1, $2, 'anarchist', NOW())`,
            [tag.name, tag.description || null]
          );

          createdCount++;
          logger.info(`  + Created tag "${tag.name}"`);
        }
      } catch (error) {
        logger.error(`  ! Error creating tag "${tag.name}":`, error);
      }
    }

    logger.info(`\nTags complete (${createdCount} created, ${skippedCount} already existed)\n`);

    logger.info('Anarchist tag import completed successfully!\n');
    logger.info(`Summary: ${ANARCHIST_TAGS.length} tags processed`);

    return {
      success: true,
      tags_created: createdCount,
      tags_skipped: skippedCount,
    };
  } catch (error) {
    logger.error('\nFatal error during import:', error);
    throw error;
  }
}

// Run if executed directly
if (require.main === module) {
  importAnarchistTags()
    .then(result => {
      logger.info('\nFinal result:', result);
      process.exit(0);
    })
    .catch(error => {
      logger.error('Import failed:', error);
      process.exit(1);
    });
}

export { importAnarchistTags };
