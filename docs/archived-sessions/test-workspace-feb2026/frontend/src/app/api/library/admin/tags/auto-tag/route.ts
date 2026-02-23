/**
 * API Route: Auto-Tag Documents with Anarchist Tags
 *
 * POST /api/library/admin/tags/auto-tag
 * Analyzes document content and assigns relevant anarchist tags
 *
 * SECURITY: Admin-only endpoint
 *
 * Query params:
 *   - confidence: number (default: 15) - Minimum confidence threshold (0-100)
 *   - limit: number (optional) - Limit number of documents to process
 */

import { NextRequest, NextResponse } from 'next/server';
import { withSecurity } from '@/lib/security/middleware';
import { getCurrentUser } from '@/lib/auth/server';
import { dbAdapter } from '@/lib/database/adapter';
import { ANARCHIST_TAGS } from '@/lib/library/anarchist-tag-seed';
import { logger } from '@/lib/utils/logger';

// Mark as dynamic - this endpoint requires runtime database access
export const dynamic = 'force-dynamic';

interface TagMatch {
  tag_name: string;
  score: number;
  keywords_matched: string[];
}

function extractSearchText(document: any): string {
  const parts = [
    document.title || '',
    document.author || '',
    document.description || '',
    (document.content || '').substring(0, 5000),
  ];

  return parts.filter(Boolean).join(' ').toLowerCase();
}

function calculateTagScore(
  searchText: string,
  keywords: string[]
): { score: number; matched_keywords: string[] } {
  const matched: string[] = [];
  let score = 0;

  for (const keyword of keywords) {
    const keywordLower = keyword.toLowerCase();
    const regex = new RegExp(`\\b${keywordLower}\\b`, 'g');
    const matches = searchText.match(regex);

    if (matches && matches.length > 0) {
      matched.push(keyword);
      score += Math.min(matches.length, 3);
    }
  }

  const normalizedScore = Math.min(100, (score / (keywords.length * 3)) * 100);

  return {
    score: Math.round(normalizedScore),
    matched_keywords: matched,
  };
}

function findMatchingTags(searchText: string, confidenceThreshold: number = 15): TagMatch[] {
  const tagMatches: TagMatch[] = [];

  for (const tag of ANARCHIST_TAGS) {
    const { score, matched_keywords } = calculateTagScore(searchText, tag.keywords);

    if (score >= confidenceThreshold && matched_keywords.length > 0) {
      tagMatches.push({
        tag_name: tag.name,
        score,
        keywords_matched: matched_keywords,
      });
    }
  }

  return tagMatches.sort((a, b) => b.score - a.score);
}

async function assignTagsToDocument(
  documentId: number,
  matchedTagNames: string[]
): Promise<number> {
  if (matchedTagNames.length === 0) {
    return 0;
  }

  try {
    // Query tags from shared.tags (unified tag system)
    const placeholders = matchedTagNames.map((_, i) => `$${i + 1}`).join(',');
    const tagsResult = await dbAdapter.query(
      `SELECT id FROM shared.tags WHERE name IN (${placeholders})`,
      matchedTagNames
    );

    const tagIds = tagsResult.rows.map(row => row.id);

    if (tagIds.length === 0) {
      return 0;
    }

    const existingResult = await dbAdapter.query(
      'SELECT tag_id FROM library_document_tags WHERE document_id = $1',
      [documentId],
      { schema: 'library' }
    );

    const existingTagIds = new Set(existingResult.rows.map(row => row.tag_id));

    let inserted = 0;
    for (const tagId of tagIds) {
      if (!existingTagIds.has(tagId)) {
        // Insert into junction table - usage_count handled by database trigger
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
    logger.error(`Error assigning tags to document ${documentId}:`, error);
    return 0;
  }
}

async function POSTHandler(request: NextRequest) {
  try {
    // SECURITY: Require authentication
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // SECURITY: Require admin role
    if (user.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const confidenceThreshold = Math.max(
      0,
      Math.min(100, parseInt(searchParams.get('confidence') || '15', 10))
    );
    const limitDocs = searchParams.get('limit')
      ? parseInt(searchParams.get('limit')!, 10)
      : undefined;

    // AUDIT: Log admin action
    logger.info(
      `[ADMIN] Auto-tag triggered by user ${user.id} (${user.username}) with confidence=${confidenceThreshold}%`
    );
    logger.info(`🔖 Starting auto-tagging with confidence threshold: ${confidenceThreshold}%`);

    const limit = limitDocs ? `LIMIT ${limitDocs}` : '';
    // NOTE: 'status' column was deprecated - all documents are now published by default
    // Use is_public = true to filter only public documents
    const documentsResult = await dbAdapter.query(
      `SELECT id, slug, title, author, notes as description, content
       FROM library_documents
       WHERE is_public = true
       ORDER BY created_at DESC
       ${limit}`,
      [],
      { schema: 'library' }
    );

    const documents = documentsResult.rows;
    logger.info(`Processing ${documents.length} documents...`);

    let totalTagsAssigned = 0;
    let documentsWithTags = 0;
    const processedDocuments = [];

    for (const doc of documents) {
      const searchText = extractSearchText(doc);
      const matchedTags = findMatchingTags(searchText, confidenceThreshold);

      if (matchedTags.length > 0) {
        const tagNames = matchedTags.map(t => t.tag_name);
        const assignedCount = await assignTagsToDocument(doc.id, tagNames);

        if (assignedCount > 0) {
          totalTagsAssigned += assignedCount;
          documentsWithTags++;

          processedDocuments.push({
            id: doc.id,
            slug: doc.slug,
            title: doc.title,
            tags_assigned: assignedCount,
            matched_tags: matchedTags.slice(0, 5), // Top 5 tags
          });

          if (processedDocuments.length <= 20) {
            logger.info(`✓ "${doc.title.substring(0, 40)}..." - ${assignedCount} tags assigned`);
          }
        }
      }
    }

    const summary = {
      success: true,
      message: 'Auto-tagging completed',
      statistics: {
        documents_processed: documents.length,
        documents_with_tags: documentsWithTags,
        total_tags_assigned: totalTagsAssigned,
        confidence_threshold: confidenceThreshold,
      },
      sample_results: processedDocuments.slice(0, 10),
      performed_by: user.username,
      timestamp: new Date().toISOString(),
    };

    logger.info(`\n✓ Auto-tagging complete!`);
    logger.info(`  Documents processed: ${documents.length}`);
    logger.info(`  Documents tagged: ${documentsWithTags}`);
    logger.info(`  Total tags assigned: ${totalTagsAssigned}`);

    return NextResponse.json(summary, { status: 200 });
  } catch (error) {
    logger.error('Fatal error during auto-tagging:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to auto-tag documents',
        details: String(error),
      },
      { status: 500 }
    );
  }
}

export const POST = withSecurity(POSTHandler);
