import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/utils/logger';

// Mark as dynamic - this endpoint requires runtime database access
export const dynamic = 'force-dynamic';

/**
 * GET /api/wiki/search
 * Search wiki pages by query
 * Authenticated endpoint - all wiki content requires login
 */
export async function GET(request: NextRequest) {
  // During build time, return empty results
  if (process.env.NEXT_PHASE === 'phase-production-build') {
    return NextResponse.json({
      success: true,
      data: {
        query: '',
        results: [],
        total: 0,
        limit: 20,
        offset: 0,
        has_more: false,
        suggestions: [],
        related_tags: [],
      },
    });
  }

  try {
    // Dynamic imports to avoid build-time module loading
    const [{ requireAuth }, { withSecurity, rateLimiters, getClientIP }, DOMPurifyModule] =
      await Promise.all([
        import('@/lib/auth/server'),
        import('@/lib/security/middleware'),
        import('isomorphic-dompurify'),
      ]);

    const DOMPurify = DOMPurifyModule.default;

    // Main handler logic
    const handler = async (request: NextRequest) => {
      // Require authentication - all wiki content requires login
      const authResult = await requireAuth(request);
      if (authResult.response) {
        return authResult.response;
      }

      const user = authResult.user;
      const userRole = user.role;

      const { searchParams } = new URL(request.url);
      const query = searchParams.get('q');
      const limit = parseInt(searchParams.get('limit') || '20');
      const offset = parseInt(searchParams.get('offset') || '0');
      const category = searchParams.get('category');

      // Validate query parameter
      if (!query || query.trim().length === 0) {
        return NextResponse.json(
          { success: false, error: 'Search query is required' },
          { status: 400 }
        );
      }

      if (query.length < 2) {
        return NextResponse.json(
          { success: false, error: 'Search query must be at least 2 characters' },
          { status: 400 }
        );
      }

      // Sanitize and prepare search query
      const sanitizedQuery = DOMPurify.sanitize(query.trim());
      const searchPattern = `%${sanitizedQuery}%`;

      // Import WikiSearchService
      const { WikiSearchService } = await import('@/lib/wiki/services/WikiSearchService');
      const searchService = new WikiSearchService();

      // Use WikiSearchService for FTS5-powered search
      const searchResult = await searchService.searchPages(
        {
          query: sanitizedQuery,
          namespace: searchParams.get('namespace') || undefined,
          category: category || undefined,
          tags: searchParams.get('tags')?.split(',').filter(Boolean) || undefined,
          author: searchParams.get('author') || undefined,
          status: 'published', // Always published for public search
          sort:
            (searchParams.get('sort') as 'updated' | 'created' | 'views' | 'title' | 'relevance') ||
            'relevance',
          order: (searchParams.get('order') as 'asc' | 'desc') || 'desc',
          limit,
          offset,
        },
        userRole
      );

      // Format results for API response
      const formattedResults = searchResult.pages.map((page: any) => ({
        id: page.id,
        title: page.title,
        slug: page.slug,
        excerpt: page.content?.substring(0, 200) || '',
        category: {
          id: page.category_ids?.[0],
          name: page.categories?.[0],
        },
        author: page.author
          ? {
              id: page.author.id,
              username: page.author.username,
              avatar_url: page.author.avatar_url,
            }
          : {
              id: page.created_by,
              username: null,
              avatar_url: null,
            },
        created_at: page.created_at,
        updated_at: page.updated_at,
        relevance_score: page.rank || 0,
        total_views: page.total_views || 0,
      }));

      // Get search suggestions if no results
      let suggestions: string[] = [];
      if (searchResult.pages.length === 0) {
        suggestions = await searchService.getSearchSuggestions(sanitizedQuery, 5);
      }

      // Get related tags (extract from results)
      const tagCounts = new Map<string, number>();
      searchResult.pages.forEach((page: any) => {
        if (page.tags && Array.isArray(page.tags)) {
          page.tags.forEach((tag: string) => {
            if (tag) {
              tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
            }
          });
        }
      });

      const relatedTags = Array.from(tagCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([tag, count]) => ({ tag, count }));

      return NextResponse.json({
        success: true,
        data: {
          query: sanitizedQuery,
          results: formattedResults,
          total: searchResult.total,
          limit,
          offset,
          has_more: searchResult.has_more,
          suggestions,
          related_tags: relatedTags,
        },
      });
    };

    // Apply security middleware
    const securedHandler = withSecurity(handler, {
      rateLimiter: rateLimiters.search,
      rateLimiterType: 'search',
      rateLimitKey: req => `search:wiki:${getClientIP(req)}`,
    });

    return securedHandler(request, {});
  } catch (error) {
    logger.error('Wiki search error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to search wiki pages' },
      { status: 500 }
    );
  }
}
