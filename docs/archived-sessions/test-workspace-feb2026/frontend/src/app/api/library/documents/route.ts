import { NextRequest, NextResponse } from 'next/server';
import { libraryService } from '@/lib/library/service';
import { getCurrentUser } from '@/lib/auth/server';
import { withSecurity } from '@/lib/security/middleware';
import type { LibrarySearchParams } from '@/lib/library/types';
import { logger } from '@/lib/utils/logger';

// Mark as dynamic - this endpoint requires runtime database access
export const dynamic = 'force-dynamic';

/**
 * GET /api/library/documents
 *
 * Fetch library documents from the SEPARATE library_documents table.
 * The library is completely independent from the wiki system.
 */
async function getDocuments(request: NextRequest) {
  try {
    const url = new URL(request.url);

    // Parse search parameters
    const params: LibrarySearchParams = {
      query: url.searchParams.get('search') || undefined,
      // Note: category parameter removed in schema migration (Nov 24, 2025)
      author: url.searchParams.get('author') || undefined,
      document_type: url.searchParams.get('type') || undefined,
      // Note: status parameter removed - all documents are published by default
      sort_by:
        (url.searchParams.get('sort') as
          | 'title'
          | 'date'
          | 'author'
          | 'views'
          | 'downloads'
          | 'source-library-first'
          | 'source-anarchist-first') || 'title',
      sort_order: (url.searchParams.get('order') as 'asc' | 'desc') || 'asc',
      page: parseInt(url.searchParams.get('page') || '1'),
      limit: parseInt(url.searchParams.get('limit') || '100'),
    };

    // Get documents from library service
    const result = await libraryService.getDocuments(params);

    return NextResponse.json(result);
  } catch (error: any) {
    logger.error('Failed to fetch library documents:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch documents',
        details: error.message,
      },
      { status: 500 }
    );
  }
}

export const GET = withSecurity(getDocuments, {
  // GET requests don't need CSRF protection
});

/**
 * POST /api/library/documents
 *
 * Create a new text-based library document.
 */
async function createDocument(request: NextRequest) {
  logger.info('[Library API] POST request received - Creating text document');

  try {
    // Check authentication
    const user = await getCurrentUser(request);
    logger.info(
      '[Library API] User:',
      user ? `${user.username} (ID: ${user.id})` : 'Not authenticated'
    );

    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Parse JSON data
    logger.info('[Library API] Parsing request data...');
    const data = await request.json();
    const { title, author, publication_date, document_type, description, abstract, content, tags } =
      data;

    logger.info('[Library API] Data parsed successfully');
    logger.info('[Library API] Title:', title);
    logger.info('[Library API] Content length:', content?.length || 0);

    // Validation
    if (!title || !title.trim()) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }

    if (!content || !content.trim()) {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 });
    }

    logger.info('[Library API] Calling libraryService.createDocument...');

    // Create document using library service
    const result = await libraryService.createDocument(
      {
        title: title.trim(),
        author: author?.trim() || undefined,
        publication_date: publication_date || undefined,
        document_type: document_type || 'document',
        description: description?.trim() || undefined,
        // Note: abstract field removed in schema migration
        content: content.trim(),
        tags: Array.isArray(tags) && tags.length > 0 ? tags : undefined,
      },
      user.id
    );

    logger.info('[Library API] Document created successfully:', result);

    return NextResponse.json({
      success: true,
      data: {
        id: result.id,
        slug: result.slug,
        message: 'Library document created successfully',
      },
    });
  } catch (error: any) {
    logger.error('Failed to create library document:', error);
    return NextResponse.json(
      {
        error: 'Failed to create library document',
        details: error.message,
      },
      { status: 500 }
    );
  }
}

export const POST = withSecurity(createDocument, {
  enableCSRF: true, // POST requests need CSRF protection
});
