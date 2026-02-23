/**
 * GET /api/documents/count
 *
 * Returns total count of documents matching the given filters
 * Used for virtual scrolling to establish totalCount upfront
 *
 * Query Parameters:
 * - query: string (optional) - Full-text search
 * - language: string or string[] (optional) - Filter by language(s)
 * - tags: string[] (optional) - Filter by tag names
 * - source: 'all' | 'library' | 'anarchist' (default: 'all')
 *
 * Response:
 * {
 *   success: true,
 *   data: {
 *     total: number,
 *     library_count: number,
 *     anarchist_count: number
 *   }
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { unifiedDocumentService } from '@/lib/documents/service';
import { logger } from '@/lib/utils/logger';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    // Parse query parameters
    const query = searchParams.get('query') || undefined;
    const languages = searchParams.getAll('language');
    const tags = searchParams.getAll('tags');
    const source = (searchParams.get('source') || 'all') as 'all' | 'library' | 'anarchist';

    // Get total count with filters applied
    const total = await unifiedDocumentService.getDocumentCount({
      query,
      language: languages.length > 0 ? languages : undefined,
      tags: tags.length > 0 ? tags : undefined,
      source,
    });

    // Return response
    return NextResponse.json({
      success: true,
      data: {
        total,
      },
    });
  } catch (error) {
    logger.error('[/api/documents/count] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to count documents',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export const dynamic = 'force-dynamic'; // Always fetch fresh data
export const revalidate = 0; // No caching
