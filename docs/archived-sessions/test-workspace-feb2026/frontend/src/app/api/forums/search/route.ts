/**
 * Forum Search API
 *
 * GET /api/forums/search?q=query&scope=all&category_id=1&page=1&limit=20
 *
 * Search topics and replies using FTS5 full-text search.
 *
 * Query Parameters:
 * - q: Search query (required)
 * - scope: 'all', 'topics', or 'replies' (default: 'all')
 * - category_id: Filter by category (optional)
 * - page: Page number (default: 1)
 * - limit: Results per page (default: 20, max: 100)
 * - sort_by: 'relevance', 'date', or 'votes' (default: 'relevance')
 *
 * Returns:
 * - success: boolean
 * - data: { results: SearchResultDTO[], pagination: PaginationMetadata }
 * - error?: string
 */

import { NextRequest, NextResponse } from 'next/server';
import { withSecurity, rateLimiters, getClientIP } from '@/lib/security/middleware';
import { SearchRepository } from '@/lib/forums/repositories/search-repository';
import { errorResponse, ValidationError } from '@/lib/utils/api-errors';
import { getCurrentUser } from '@/lib/auth/server';
import { logger } from '@/lib/utils/logger';
import type { CategoryId } from '@/lib/forums/branded-types';

// Mark as dynamic - this endpoint requires runtime database access
export const dynamic = 'force-dynamic';

export const GET = withSecurity(
  async (request: NextRequest) => {
    try {
      const { searchParams } = request.nextUrl;

      // 1. Get and validate query parameter
      const query = searchParams.get('q');
      if (!query || query.trim().length === 0) {
        throw new ValidationError('Query parameter "q" is required');
      }

      if (query.trim().length < 2) {
        throw new ValidationError('Search query must be at least 2 characters');
      }

      // 2. Parse optional parameters
      const scope = searchParams.get('scope') || 'all';
      const categoryIdStr = searchParams.get('category_id');
      const page = parseInt(searchParams.get('page') || '1', 10);
      const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100);
      const sortBy = searchParams.get('sort_by') || 'relevance';

      // 3. Validate scope
      if (!['all', 'topics', 'replies'].includes(scope)) {
        throw new ValidationError('scope must be one of: all, topics, replies');
      }

      // 4. Validate sort_by (match Browse page options)
      if (!['relevance', 'recent', 'popular', 'replies', 'views'].includes(sortBy)) {
        throw new ValidationError(
          'sort_by must be one of: relevance, recent, popular, replies, views'
        );
      }

      // 5. Parse category_id if provided
      let categoryId: number | undefined;
      if (categoryIdStr) {
        categoryId = parseInt(categoryIdStr, 10);
        if (isNaN(categoryId)) {
          throw new ValidationError('category_id must be a number');
        }
      }

      // 6. Get current user for role-based filtering
      const user = await getCurrentUser(request);
      const userRole = user?.role || 'anonymous';

      // 7. Build search options
      const searchOptions = {
        page,
        limit,
        category_id: categoryId ? (categoryId as CategoryId) : undefined,
        sort_by: sortBy as 'relevance' | 'recent' | 'popular' | 'replies' | 'views',
        userRole: userRole as 'admin' | 'moderator' | 'user' | 'anonymous',
      };

      // 8. Execute search based on scope
      const searchRepo = new SearchRepository();
      let result;

      if (scope === 'topics') {
        result = await searchRepo.searchTopics(query, searchOptions);
      } else if (scope === 'replies') {
        result = await searchRepo.searchReplies(query, searchOptions);
      } else {
        result = await searchRepo.searchAll(query, searchOptions);
      }

      if (result.isErr()) {
        const err = result.error;
        throw new Error(err.type === 'database' ? err.message : `Repository error: ${err.type}`);
      }

      return NextResponse.json({
        success: true,
        data: result.value,
      });
    } catch (error) {
      logger.error('Error searching forums:', error);
      return errorResponse(error);
    }
  },
  {
    rateLimiter: rateLimiters.search,
    rateLimiterType: 'search',
    rateLimitKey: req => `search:forums:${getClientIP(req)}`,
  }
);
