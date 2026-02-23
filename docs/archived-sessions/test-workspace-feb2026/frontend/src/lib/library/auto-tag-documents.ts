/**
 * Auto-Tag Documents with Anarchist Tags
 *
 * Analyzes document content and titles to automatically assign relevant anarchist tags
 * Uses keyword matching with configurable confidence threshold
 * Run with: npx ts-node -O '{"module":"commonjs"}' auto-tag-documents.ts
 */

import { dbAdapter } from '@/lib/database/adapter';
import { ANARCHIST_TAGS } from './anarchist-tag-seed';
import { logger } from '@/lib/utils/logger';

interface TagMatch {
  tag_id: number;
  tag_name: string;
  score: number;
  keywords_matched: string[];
}

interface DocumentTagResult {
  document_id: number;
  document_slug: string;
  title: string;
  matched_tags: TagMatch[];
}

/**
 * Extract text content for keyword matching
 * Combines title, notes, and content (first 5000 chars)
 */
function extractSearchText(document: any): string {
  const parts = [
    document.title || '',
    document.author || '',
    document.notes || '', // notes replaced description in schema migration
    (document.content || '').substring(0, 5000),
  ];

  return parts.filter(Boolean).join(' ').toLowerCase();
}

/**
 * Calculate tag match score based on keyword presence
 * Returns array of matched keywords and overall score
 */
function calculateTagScore(
  searchText: string,
  keywords: string[]
): { score: number; matched_keywords: string[] } {
  const matched: string[] = [];
  let score = 0;

  for (const keyword of keywords) {
    const keywordLower = keyword.toLowerCase();
    // Use word boundary regex to match whole words
    const regex = new RegExp(`\\b${keywordLower}\\b`, 'g');
    const matches = searchText.match(regex);

    if (matches && matches.length > 0) {
      matched.push(keyword);
      // Multiple occurrences increase score
      score += Math.min(matches.length, 3); // Cap at 3 per keyword
    }
  }

  // Normalize score to 0-100
  const normalizedScore = Math.min(100, (score / (keywords.length * 3)) * 100);

  return {
    score: Math.round(normalizedScore),
    matched_keywords: matched,
  };
}

/**
 * Find matching tags for a document
 * Returns tags with confidence score >= threshold
 */
function findMatchingTags(searchText: string, confidenceThreshold: number = 15): TagMatch[] {
  const tagMatches: TagMatch[] = [];

  // Create a tag lookup map for ID resolution (will be done in DB query)
  const tagsByName = new Map(ANARCHIST_TAGS.map(t => [t.name, t]));

  for (const tag of ANARCHIST_TAGS) {
    const { score, matched_keywords } = calculateTagScore(searchText, tag.keywords);

    if (score >= confidenceThreshold && matched_keywords.length > 0) {
      tagMatches.push({
        tag_id: 0, // Will be resolved from DB
        tag_name: tag.name,
        score,
        keywords_matched: matched_keywords,
      });
    }
  }

  // Sort by score descending
  return tagMatches.sort((a, b) => b.score - a.score);
}

/**
 * Assign matched tags to a document in the database
 * Uses shared.tags (unified tag system) for tag lookup
 */
async function assignTagsToDocument(
  documentId: number,
  matchedTagNames: string[]
): Promise<number> {
  if (matchedTagNames.length === 0) {
    return 0;
  }

  try {
    // Get tag IDs from shared.tags (unified tag system)
    const placeholders = matchedTagNames.map((_, i) => `$${i + 1}`).join(',');
    const tagsResult = await dbAdapter.query(
      `SELECT id, name FROM shared.tags WHERE name IN (${placeholders})`,
      matchedTagNames
    );

    const tagIds = tagsResult.rows.map(row => row.id);

    if (tagIds.length === 0) {
      logger.info(`    ! No tag IDs found for matched tag names`);
      return 0;
    }

    // Check existing document-tag relationships
    const existingResult = await dbAdapter.query(
      'SELECT tag_id FROM library_document_tags WHERE document_id = $1',
      [documentId],
      { schema: 'library' }
    );

    const existingTagIds = new Set(existingResult.rows.map(row => row.tag_id));

    // Insert new relationships (skip existing ones to avoid duplicates)
    // usage_count is handled by database trigger
    let inserted = 0;
    for (const tagId of tagIds) {
      if (!existingTagIds.has(tagId)) {
        await dbAdapter.query(
          'INSERT INTO library_document_tags (document_id, tag_id) VALUES ($1, $2)',
          [documentId, tagId],
          { schema: 'library' }
        );
        inserted++;
      }
    }

    return inserted;
  } catch (error) {
    logger.error(`    ! Error assigning tags to document ${documentId}:`, error);
    return 0;
  }
}

/**
 * Main auto-tagging function
 */
async function autoTagDocuments(confidenceThreshold: number = 15, limitDocuments?: number) {
  logger.info('🔖 Starting auto-tagging of documents with anarchist tags...\n');
  logger.info(`   Confidence threshold: ${confidenceThreshold}%`);
  if (limitDocuments) {
    logger.info(`   Limiting to first ${limitDocuments} documents\n`);
  } else {
    logger.info('');
  }

  try {
    // Fetch documents (with optional limit)
    const limit = limitDocuments ? `LIMIT ${limitDocuments}` : '';
    const documentsResult = await dbAdapter.query(
      `SELECT id, slug, title, author, notes, content
       FROM library_documents
       ORDER BY created_at DESC
       ${limit}`,
      [],
      { schema: 'library' }
    );

    const documents = documentsResult.rows;
    logger.info(`📄 Processing ${documents.length} documents...\n`);

    let totalTagsAssigned = 0;
    let documentsWithTags = 0;
    const results: DocumentTagResult[] = [];

    for (const doc of documents) {
      const searchText = extractSearchText(doc);
      const matchedTags = findMatchingTags(searchText, confidenceThreshold);

      if (matchedTags.length > 0) {
        const tagNames = matchedTags.map(t => t.tag_name);
        const assignedCount = await assignTagsToDocument(doc.id, tagNames);

        if (assignedCount > 0) {
          totalTagsAssigned += assignedCount;
          documentsWithTags++;

          logger.info(`  ✓ "${doc.title.substring(0, 50)}..." - ${assignedCount} tags`);

          results.push({
            document_id: doc.id,
            document_slug: doc.slug,
            title: doc.title,
            matched_tags: matchedTags,
          });
        }
      }
    }

    logger.info(`\n✓ Auto-tagging complete!\n`);
    logger.info(`Summary:`);
    logger.info(`  • Documents processed: ${documents.length}`);
    logger.info(`  • Documents with tags: ${documentsWithTags}`);
    logger.info(`  • Total tags assigned: ${totalTagsAssigned}`);

    return {
      success: true,
      documents_processed: documents.length,
      documents_tagged: documentsWithTags,
      total_tags_assigned: totalTagsAssigned,
      results: results.slice(0, 10), // Return first 10 results
    };
  } catch (error) {
    logger.error('\n✗ Fatal error during auto-tagging:', error);
    throw error;
  }
}

// Run if executed directly
if (require.main === module) {
  // Can pass confidence threshold as command line argument
  const confidence = parseInt(process.argv[2] || '15', 10);
  const limit = process.argv[3] ? parseInt(process.argv[3], 10) : undefined;

  autoTagDocuments(confidence, limit)
    .then(result => {
      logger.info('\nFinal result:', result);
      process.exit(0);
    })
    .catch(error => {
      logger.error('Auto-tagging failed:', error);
      process.exit(1);
    });
}

export { autoTagDocuments };
