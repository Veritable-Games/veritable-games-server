/**
 * GET /api/documents
 *
 * Unified documents endpoint
 * Returns combined results from library + anarchist collections
 *
 * Query Parameters:
 * - query: string (optional) - Full-text search
 * - language: string or string[] (optional) - Filter by language(s)
 * - tags: string[] (optional) - Filter by tag names
 * - source: 'all' | 'library' | 'anarchist' (default: 'all')
 * - sort_by: 'title' | 'author' | 'publication_date' | 'created_at' | 'view_count' | 'source-library-first' | 'source-anarchist-first' (default: 'title')
 * - sort_order: 'asc' | 'desc' (default: 'asc')
 * - page: number (default: 1) - Page-based pagination
 * - offset: number (optional) - Offset-based pagination (alternative to page)
 * - limit: number (default: 50, max: 5000)
 *
 * Note: Use either 'page' or 'offset', not both. If 'offset' is provided, it takes precedence.
 */

import { NextRequest, NextResponse } from 'next/server';
import { unifiedDocumentService } from '@/lib/documents/service';
import { DOCUMENT_PAGINATION } from '@/lib/documents/constants';
import type { UnifiedSearchParams } from '@/lib/documents/types';
import { logger } from '@/lib/utils/logger';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    // Parse query parameters
    const query = searchParams.get('query') || undefined;
    const languages = searchParams.getAll('language');
    const tags = searchParams.getAll('tags');
    const source = (searchParams.get('source') || 'all') as 'all' | 'library' | 'anarchist';
    const sort_by = searchParams.get('sort_by') || 'title';
    const sort_order = (searchParams.get('sort_order') || 'asc') as 'asc' | 'desc';
    const limit = Math.min(
      DOCUMENT_PAGINATION.API_MAX_LIMIT,
      Math.max(
        1,
        parseInt(searchParams.get('limit') || String(DOCUMENT_PAGINATION.DEFAULT_LIMIT), 10)
      )
    ); // Cap for API safety

    // Support both page-based and offset-based pagination
    // If offset is provided, use it directly; otherwise calculate from page
    const hasOffset = searchParams.has('offset');
    const offset = hasOffset
      ? Math.max(0, parseInt(searchParams.get('offset') || '0', 10))
      : undefined;
    const page = !hasOffset
      ? Math.max(1, parseInt(searchParams.get('page') || '1', 10))
      : Math.floor((offset || 0) / limit) + 1; // Calculate page from offset for compatibility

    // Validate sort_by
    const validSortFields = [
      'title',
      'author',
      'publication_date',
      'created_at',
      'view_count',
      'relevance',
      'source-library-first',
      'source-anarchist-first',
    ];
    const safeSortBy: UnifiedSearchParams['sort_by'] = validSortFields.includes(sort_by)
      ? (sort_by as UnifiedSearchParams['sort_by'])
      : 'title';

    // Build search params
    const params: UnifiedSearchParams = {
      query,
      language: languages.length > 0 ? languages : undefined,
      tags: tags.length > 0 ? tags : undefined,
      source,
      sort_by: safeSortBy,
      sort_order,
      page,
      limit,
    };

    // Execute search
    const result = await unifiedDocumentService.getDocuments(params);

    // Return response
    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error('[/api/documents] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch documents',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export const dynamic = 'force-dynamic'; // Always fetch fresh data
export const revalidate = 0; // No caching
