/**
 * GET /api/documents/[slug]
 *
 * Get single document by slug with full content
 * Auto-detects source (library or anarchist) and loads content appropriately
 *
 * Path Parameters:
 * - slug: string - Document slug (e.g., 'the-conquest-of-bread')
 */

import { NextRequest, NextResponse } from 'next/server';
import { unifiedDocumentService } from '@/lib/documents/service';
import { logger } from '@/lib/utils/logger';

interface RouteParams {
  params: {
    slug: string;
  };
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { slug } = params;

    if (!slug) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing slug parameter',
        },
        { status: 400 }
      );
    }

    // Get document with content
    const document = await unifiedDocumentService.getDocumentBySlug(slug);

    if (!document) {
      return NextResponse.json(
        {
          success: false,
          error: 'Document not found',
        },
        { status: 404 }
      );
    }

    // Increment view count in background (don't await)
    unifiedDocumentService.incrementViewCount(slug, document.source).catch(err => {
      logger.error('[/api/documents/[slug]] Error incrementing view count:', err);
    });

    // Return document
    return NextResponse.json({
      success: true,
      data: document,
    });
  } catch (error) {
    logger.error('[/api/documents/[slug]] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch document',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export const dynamic = 'force-dynamic';
export const revalidate = 0;
