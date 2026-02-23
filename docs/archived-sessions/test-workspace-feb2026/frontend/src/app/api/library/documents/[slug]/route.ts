import { NextRequest, NextResponse } from 'next/server';
import { libraryService } from '@/lib/library/service';
import { getCurrentUser } from '@/lib/auth/server';
import { withSecurity } from '@/lib/security/middleware';
import { logger } from '@/lib/utils/logger';

// Extended document type with optional uploader fields
interface DocumentWithUploader {
  uploaded_by_username?: string;
  uploaded_by_display_name?: string;
  [key: string]: any;
}

// Mark as dynamic - this endpoint requires runtime database access
export const dynamic = 'force-dynamic';

/**
 * GET /api/library/documents/[slug]
 *
 * Fetch a single library document by its slug.
 */
async function getDocument(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const resolvedParams = await params;
    const { slug } = resolvedParams;

    if (!slug) {
      return NextResponse.json({ error: 'Slug parameter is required' }, { status: 400 });
    }

    // Decode the slug (it might be URL encoded)
    const decodedSlug = decodeURIComponent(slug);

    logger.info(`[Library API] Fetching document by slug: ${decodedSlug}`);

    // Get document from library service
    const document = await libraryService.getDocumentBySlug(decodedSlug);

    if (!document) {
      logger.info(`[Library API] Document not found: ${decodedSlug}`);
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    // Increment view count
    await libraryService.incrementViewCount(document.id);

    logger.info(`[Library API] Document found: ${document.title} (ID: ${document.id})`);

    // Transform to match frontend expectations
    const docWithUploader = document as DocumentWithUploader;
    const response = {
      id: document.id,
      title: document.title,
      slug: document.slug,
      content: document.content || `# ${document.title}\n\n${document.notes || ''}`,
      content_format: 'markdown',
      namespace: 'library', // For compatibility
      // Note: status field removed - all documents are published by default
      created_at: document.created_at,
      updated_at: document.updated_at,
      created_by: document.created_by,
      username: docWithUploader.uploaded_by_username || '',
      display_name: docWithUploader.uploaded_by_display_name || '',
      // Note: categories removed in schema migration (Nov 24, 2025)
      categories: [],
      category_ids: [],
      tags: document.tags || [],
      total_views: document.view_count,
      // Library-specific fields
      document_author: document.author,
      publication_date: document.publication_date,
      description: document.notes,
      // Note: abstract field removed in schema migration
      is_public: true,
    };

    return NextResponse.json(response);
  } catch (error: any) {
    logger.error('Failed to fetch library document:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch document',
        details: error.message,
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/library/documents/[slug]
 *
 * Update a library document.
 */
async function updateDocument(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    // Check authentication
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    const resolvedParams = await params;
    const { slug } = resolvedParams;

    // Get the document first
    const document = await libraryService.getDocumentBySlug(decodeURIComponent(slug));

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    // Check if user has permission to edit (owner or admin/moderator)
    if (document.created_by !== user.id && user.role !== 'admin' && user.role !== 'moderator') {
      return NextResponse.json(
        { success: false, error: 'Insufficient permissions to edit this document' },
        { status: 403 }
      );
    }

    // Parse update data
    const updateData = await request.json();

    // Update the document
    const success = await libraryService.updateDocument(document.id, updateData);

    if (!success) {
      return NextResponse.json({ error: 'Failed to update document' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Document updated successfully',
    });
  } catch (error: any) {
    logger.error('Failed to update library document:', error);
    return NextResponse.json(
      {
        error: 'Failed to update document',
        details: error.message,
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/library/documents/[slug]
 *
 * Delete a library document by slug.
 * Only the author or an admin can delete documents.
 */
async function deleteDocument(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    // Check authentication
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const resolvedParams = await params;
    const { slug } = resolvedParams;

    // Get the document first
    const document = await libraryService.getDocumentBySlug(decodeURIComponent(slug));

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    logger.info(
      `[Library API] DELETE request for document ${slug} (ID: ${document.id}) by user ${user.username} (ID: ${user.id})`
    );

    // Call the library service to delete the document
    const result = await libraryService.deleteDocument(document.id, user.id, user.role);

    if (!result.success) {
      // Determine appropriate status code based on the error
      const status = result.message.includes('not found')
        ? 404
        : result.message.includes('permission')
          ? 403
          : 400;

      return NextResponse.json(
        {
          error: result.message,
          success: false,
        },
        { status }
      );
    }

    logger.info(
      `[Library API] Document ${slug} (ID: ${document.id}) successfully deleted by user ${user.id}`
    );

    return NextResponse.json({
      success: true,
      message: result.message,
    });
  } catch (error: any) {
    logger.error('Failed to delete library document:', error);
    return NextResponse.json(
      {
        error: 'Failed to delete document',
        details: error.message,
        success: false,
      },
      { status: 500 }
    );
  }
}

// Export handlers with security middleware
export const GET = withSecurity(getDocument, {
  // GET requests don't need CSRF
});

export const PUT = withSecurity(updateDocument, {
  enableCSRF: true, // PUT requires CSRF protection
});

export const DELETE = withSecurity(deleteDocument, {
  enableCSRF: true, // DELETE requires CSRF protection
});
