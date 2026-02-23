import { NextRequest, NextResponse } from 'next/server';
import { getWikiService } from '@/lib/services/registry';
import { withSecurity } from '@/lib/security/middleware';
import { requireAuth } from '@/lib/auth/server';
import { logger } from '@/lib/utils/logger';

// Mark as dynamic - this endpoint requires runtime database access
export const dynamic = 'force-dynamic';

const wikiService = getWikiService();

async function postHandler(request: NextRequest) {
  try {
    // Require authentication - all wiki content requires login
    const authResult = await requireAuth(request);
    if (authResult.response) {
      return authResult.response;
    }

    const body = await request.json();
    const { slugs } = body;

    if (!Array.isArray(slugs) || slugs.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Slugs must be a non-empty array',
        },
        { status: 400 }
      );
    }

    // Validate that all slugs are strings
    if (!slugs.every(slug => typeof slug === 'string')) {
      return NextResponse.json(
        {
          success: false,
          error: 'All slugs must be strings',
        },
        { status: 400 }
      );
    }

    // Check existence for each slug
    const existenceMap: Record<string, boolean> = {};

    // Batch query to check existence of multiple pages
    for (const slug of slugs) {
      try {
        // Check in main namespace first
        let page = await wikiService.getPageBySlug(slug, 'main');

        // If not found in main namespace, check library namespace
        if (!page && slug.startsWith('library/')) {
          page = await wikiService.getPageBySlug(slug, 'library');
        }

        existenceMap[slug] = !!page;
      } catch (error) {
        // If page doesn't exist, getPageBySlug will return null or throw
        existenceMap[slug] = false;
      }
    }

    return NextResponse.json({
      success: true,
      data: existenceMap,
    });
  } catch (error: any) {
    logger.error('Error validating wiki links:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to validate wiki links',
        message: error.message,
      },
      { status: 500 }
    );
  }
}

// Authenticated endpoint for wiki link validation
export const POST = withSecurity(postHandler, {
  enableCSRF: true, // POST requires CSRF
});
