/**
 * Populate anarchist document notes field from document content
 *
 * This migration extracts the first meaningful paragraph from each anarchist
 * document and uses it as the notes/description for preview display.
 *
 * Usage:
 *   npx ts-node src/lib/anarchist/populate-descriptions.ts
 *
 * Environment:
 *   DATABASE_URL: PostgreSQL connection string
 *   ANARCHIST_LIBRARY_PATH: Path to anarchist documents (default: /app/anarchist-library)
 */

import { dbAdapter } from '@/lib/database/adapter';
import * as fs from 'fs/promises';
import * as path from 'path';
import { logger } from '@/lib/utils/logger';

const LIBRARY_BASE_PATH = process.env.ANARCHIST_LIBRARY_PATH || '/app/anarchist-library';

/**
 * Extract first paragraph from markdown content
 * Skips YAML frontmatter and extracts first meaningful text (150-200 chars)
 */
function extractFirstParagraph(content: string): string | null {
  // Remove YAML frontmatter
  const withoutFrontmatter = content.replace(/^---\n[\s\S]*?\n---\n/, '');

  // Split into lines and filter empty lines
  const lines = withoutFrontmatter
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0);

  // Find first meaningful paragraph (skip markdown headers that are just title)
  let firstParagraph = '';

  for (const line of lines) {
    // Skip markdown headers (lines starting with #)
    if (line.startsWith('#')) {
      continue;
    }

    // Take first non-header line as start of paragraph
    firstParagraph = line;
    break;
  }

  if (!firstParagraph) {
    return null;
  }

  // Limit to ~200 characters, add ellipsis if truncated
  if (firstParagraph.length > 200) {
    return firstParagraph.substring(0, 200).trim() + '...';
  }

  return firstParagraph;
}

/**
 * Read document content from filesystem
 */
async function getDocumentContent(filePath: string): Promise<string | null> {
  try {
    const fullPath = path.join(LIBRARY_BASE_PATH, filePath);

    // Security check: ensure path is within library directory
    if (!fullPath.startsWith(LIBRARY_BASE_PATH)) {
      logger.warn(`Path traversal attempt: ${filePath}`);
      return null;
    }

    const content = await fs.readFile(fullPath, 'utf-8');
    return content;
  } catch (error) {
    logger.error(`Failed to read ${filePath}:`, error);
    return null;
  }
}

/**
 * Main migration function
 */
async function populateDescriptions() {
  logger.info('🔍 Populating anarchist document descriptions from content...\n');

  try {
    // Get all documents with NULL notes
    const docsResult = await dbAdapter.query(
      `SELECT id, slug, file_path, notes FROM anarchist.documents WHERE notes IS NULL ORDER BY created_at DESC`,
      [],
      { schema: 'anarchist' }
    );

    const documents = docsResult.rows;
    logger.info(`Found ${documents.length} documents with empty notes field\n`);

    if (documents.length === 0) {
      logger.info('✓ All documents already have descriptions!');
      return;
    }

    let updated = 0;
    let errors = 0;
    let skipped = 0;

    // Process each document
    for (let i = 0; i < documents.length; i++) {
      const doc = documents[i];

      try {
        // Read document content
        const content = await getDocumentContent(doc.file_path);
        if (!content) {
          skipped++;
          continue;
        }

        // Extract first paragraph
        const description = extractFirstParagraph(content);
        if (!description) {
          skipped++;
          continue;
        }

        // Update database
        await dbAdapter.query(
          `UPDATE anarchist.documents SET notes = $1 WHERE id = $2`,
          [description, doc.id],
          { schema: 'anarchist' }
        );

        updated++;

        // Progress indicator
        if ((i + 1) % 500 === 0 || i === documents.length - 1) {
          const percent = ((i + 1) / documents.length) * 100;
          logger.info(
            `[${i + 1}/${documents.length}] ${percent.toFixed(1)}% - ` +
              `Updated: ${updated}, Skipped: ${skipped}, Errors: ${errors}`
          );
        }
      } catch (error) {
        errors++;
        if (errors <= 5) {
          logger.error(`Error processing ${doc.slug}:`, error);
        }
      }
    }

    logger.info(`\n${'='.repeat(70)}`);
    logger.info(`Migration complete!`);
    logger.info(`  Updated: ${updated}`);
    logger.info(`  Skipped: ${skipped}`);
    logger.info(`  Errors: ${errors}`);
    logger.info(`${'='.repeat(70)}`);
  } catch (error) {
    logger.error('Fatal error:', error);
    process.exit(1);
  }
}

// Run migration
if (require.main === module) {
  populateDescriptions()
    .then(() => {
      logger.info('\n✓ Done!');
      process.exit(0);
    })
    .catch(error => {
      logger.error('Migration failed:', error);
      process.exit(1);
    });
}

export { populateDescriptions, extractFirstParagraph };
