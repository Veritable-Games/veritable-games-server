/**
 * API Route: Unified Documents with Pagination or Full List
 * GET /api/documents/unified
 *
 * Fetches documents from both library and anarchist sources
 * Supports pagination OR fetching all documents
 * Supports filtering by search query, tags, language, and sorting
 *
 * Query Parameters:
 * - all: boolean (if true, fetch ALL documents without pagination)
 * - page: number (default: 1, ignored if all=true)
 * - limit: number (default: 50, ignored if all=true)
 * - query: string (search query, optional)
 * - tags: string (comma-separated tag names, optional)
 * - language: string (language filter, optional)
 * - sortBy: string (title|date|author|publication_date, default: title)
 * - sortOrder: string (asc|desc, default: asc)
 */

import { NextRequest, NextResponse } from 'next/server';
import { unifiedDocumentService } from '@/lib/documents/service';
import { logger } from '@/lib/utils/logger';

// Mark as dynamic - this endpoint requires runtime database access
export const dynamic = 'force-dynamic';

/**
 * Query parameter types for document filtering and sorting
 */
type SortByOption =
  | 'author'
  | 'title'
  | 'publication_date'
  | 'created_at'
  | 'view_count'
  | 'relevance'
  | 'source-library-first'
  | 'source-anarchist-first';
type SortOrderOption = 'asc' | 'desc';
type SourceOption = 'all' | 'library' | 'anarchist';

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);

    // Parse query parameters
    const fetchAll = url.searchParams.get('all') === 'true';
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const query = url.searchParams.get('query') || undefined;
    const language = url.searchParams.get('language') || undefined;
    const tagsParam = url.searchParams.get('tags');
    const tags = tagsParam ? tagsParam.split(',').map(t => t.trim()) : undefined;
    const sortBy = (url.searchParams.get('sortBy') || 'title') as SortByOption;
    const sortOrder = (url.searchParams.get('sortOrder') || 'asc') as SortOrderOption;
    const source = (url.searchParams.get('source') || 'all') as SourceOption;

    // Validate inputs
    if (!fetchAll && (page < 1 || limit < 1 || limit > 100)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid page or limit. Page must be >= 1, limit must be 1-100.',
        },
        { status: 400 }
      );
    }

    // Call unified service with appropriate method
    const result = fetchAll
      ? await unifiedDocumentService.getAllDocuments({
          query,
          language,
          tags,
          sort_by: sortBy,
          sort_order: sortOrder,
          source,
        })
      : await unifiedDocumentService.getDocuments({
          page,
          limit,
          query,
          language,
          tags,
          sort_by: sortBy,
          sort_order: sortOrder,
          source,
        });

    // Return successful response
    return NextResponse.json({
      success: true,
      data: {
        documents: result.documents,
        pagination: result.pagination,
        metadata: {
          timestamp: new Date().toISOString(),
          filters: {
            query,
            language,
            tags,
            sortBy,
            sortOrder,
          },
        },
      },
    });
  } catch (error) {
    logger.error('[API] Get unified documents error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch documents',
      },
      { status: 500 }
    );
  }
}

// OPTIONS for CORS if needed
export async function OPTIONS() {
  return NextResponse.json({}, { status: 200 });
}
