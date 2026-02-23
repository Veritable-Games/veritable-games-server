import { dbAdapter } from '@/lib/database/adapter';
import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { getWikiService } from '@/lib/services/registry';
import { requireAuth, getCurrentUser } from '@/lib/auth/server';
import { apiOptimizer } from '@/lib/performance/compression';
import { withSecurity } from '@/lib/security/middleware';
import { wikiRevisionSchema, validateWithSchema } from '@/lib/schemas/unified';
import { z } from 'zod';
import { sanitizeWikiContent, ContentSanitizer } from '@/lib/content/sanitization';
import { parseWikiSlug } from '@/lib/wiki/utils/slug-parser';
import { logger } from '@/lib/utils/logger';

// Mark as dynamic - this endpoint requires runtime database access
export const dynamic = 'force-dynamic';

const wikiService = getWikiService();

async function getHandler(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug: rawSlug } = await params;
    const slug = decodeURIComponent(rawSlug);

    if (!slug) {
      return NextResponse.json(
        {
          success: false,
          error: 'Page slug is required',
        },
        { status: 400 }
      );
    }

    // Get user for role-based access
    const user = await getCurrentUser(request);
    const userRole = user?.role || null;

    // Parse slug to separate namespace (e.g., "library/doom-bible" → slug="doom-bible", namespace="library")
    const { slug: actualSlug, namespace } = parseWikiSlug(slug);

    // Get the page using WikiService
    const page = await wikiService.getPageBySlug(actualSlug, namespace);

    if (!page) {
      return NextResponse.json(
        {
          success: false,
          error: 'Page not found',
        },
        { status: 404 }
      );
    }

    // Use compression and ETag optimization for wiki page details
    return await apiOptimizer.optimizeResponse(
      request,
      {
        success: true,
        data: page,
      },
      {
        contentType: 'application/json',
        maxAge: 600, // Cache for 10 minutes (individual pages change less frequently)
        staleWhileRevalidate: 1800, // Allow stale content for 30 minutes
        additionalETagData: {
          slug: actualSlug,
          namespace,
          lastModified: page.updated_at || page.created_at,
        },
      }
    );
  } catch (error: any) {
    logger.error('Error getting wiki page:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch wiki page',
        message: error.message,
      },
      { status: 500 }
    );
  }
}

async function putHandler(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  let slug: string = '';
  let data: Record<string, unknown> = {};

  try {
    // Check authentication first
    const authResult = await requireAuth(request);
    if (authResult.response) {
      return authResult.response;
    }
    const user = authResult.user;

    const resolvedParams = await params;
    slug = decodeURIComponent(resolvedParams.slug);
    data = await request.json();

    if (!slug) {
      return NextResponse.json(
        {
          success: false,
          error: 'Page slug is required',
        },
        { status: 400 }
      );
    }

    // Parse slug to separate namespace (e.g., "library/doom-bible" → slug="doom-bible", namespace="library")
    const { slug: actualSlug, namespace } = parseWikiSlug(slug);

    // Get the existing page to verify it exists and get its ID
    const existingPage = await wikiService.getPageBySlug(actualSlug, namespace);
    if (!existingPage) {
      return NextResponse.json(
        {
          success: false,
          error: 'Page not found',
        },
        { status: 404 }
      );
    }

    // Check if user has permission to edit this page
    // Ownership-based authorization: only page creator, admins, or moderators can edit
    if (user.id !== existingPage.created_by && user.role !== 'admin' && user.role !== 'moderator') {
      return NextResponse.json(
        {
          success: false,
          error:
            'Permission denied. Only the page creator, admins, or moderators can edit this page.',
        },
        { status: 403 }
      );
    }

    // Additional protection level checks
    if (
      existingPage.protection_level === 'semi' &&
      user.role !== 'admin' &&
      user.role !== 'moderator'
    ) {
      return NextResponse.json(
        {
          success: false,
          error: 'This page is semi-protected. Only admins and moderators can edit it.',
        },
        { status: 403 }
      );
    }

    if (existingPage.protection_level === 'full' && user.role !== 'admin') {
      return NextResponse.json(
        {
          success: false,
          error: 'This page is fully protected. Only admins can edit it.',
        },
        { status: 403 }
      );
    }

    // Create partial schema for updates (all fields optional)
    const updateWikiPageSchema = z
      .object({
        title: z.string().min(1).max(255).optional(),
        content: z.string().min(1).max(100000).optional(),
        status: z.enum(['draft', 'published', 'archived']).optional(),
        summary: z.string().max(500).optional(),
        categories: z.array(z.string().min(1).max(50)).max(10).optional(),
        tags: z.array(z.string().min(1).max(50)).max(20).optional(),
        content_format: z.enum(['markdown', 'html', 'plain']).optional(),
        is_minor: z.boolean().optional(),
        protection_level: z.enum(['none', 'semi', 'full']).optional(),
      })
      .refine(data => data.content || data.title || data.status || data.protection_level, {
        message:
          'At least one field (content, title, status, or protection_level) must be provided',
      });

    // Validate request data with Zod schema
    const validation = validateWithSchema(updateWikiPageSchema, data);
    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          details: validation.errors,
        },
        { status: 400 }
      );
    }

    const validatedData = validation.data;

    // Sanitize user content to prevent XSS attacks
    const sanitizedData = {
      title: validatedData.title
        ? ContentSanitizer.sanitizeContent(validatedData.title, {
            level: 'minimal',
            allowMarkdown: false,
            stripHtml: true,
          })
        : undefined,
      content: validatedData.content ? sanitizeWikiContent(validatedData.content) : undefined,
      summary: validatedData.summary
        ? ContentSanitizer.sanitizeContent(validatedData.summary, {
            level: 'minimal',
            allowMarkdown: false,
            stripHtml: true,
            maxLength: 500,
          })
        : undefined,
      status: validatedData.status,
      categories: validatedData.categories,
      tags: validatedData.tags,
      content_format: validatedData.content_format,
      is_minor: validatedData.is_minor,
      protection_level: validatedData.protection_level,
    };

    // Validate content after sanitization if content is provided
    if (sanitizedData.content) {
      const contentValidation = ContentSanitizer.validateContent(sanitizedData.content, {
        level: 'safe',
        allowMarkdown: true,
        maxLength: 100000,
      });

      if (!contentValidation.isValid) {
        return NextResponse.json(
          {
            success: false,
            error: 'Content validation failed after sanitization',
            details: contentValidation.errors,
          },
          { status: 400 }
        );
      }
    }

    // Update the page using WikiService
    const updatedPage = await wikiService.updatePage(
      existingPage.id,
      {
        title: sanitizedData.title,
        content: sanitizedData.content,
        status: sanitizedData.status,
        summary: sanitizedData.summary || 'Page updated',
        categories: sanitizedData.categories,
        tags: sanitizedData.tags,
        content_format: sanitizedData.content_format || 'markdown',
        is_minor: sanitizedData.is_minor || false,
        protection_level: sanitizedData.protection_level,
      },
      user.id,
      request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined
    );

    // Revalidate Next.js cache for wiki pages
    revalidatePath('/wiki');
    revalidatePath(`/wiki/${slug}`);

    // If categories changed, revalidate OLD category too
    // This is critical - we need to revalidate both old and new category pages
    const oldCategories = existingPage.category_ids || [];
    const newCategories = sanitizedData.categories || [];

    // Revalidate old category pages (prevents stale breadcrumbs)
    oldCategories.forEach((categoryId: string) => {
      revalidatePath(`/wiki/category/${categoryId}`);
    });

    // Revalidate new category pages
    newCategories.forEach((categoryId: string) => {
      revalidatePath(`/wiki/category/${categoryId}`);
    });

    // If title changed, revalidate the NEW slug path too
    if (sanitizedData.title && sanitizedData.title !== existingPage.title) {
      const { generateSlug } = require('@/lib/utils/slug');
      const newSlug = generateSlug(sanitizedData.title);
      revalidatePath(`/wiki/${newSlug}`);
    }

    return NextResponse.json({
      success: true,
      data: updatedPage,
      message: 'Page updated successfully',
    });
  } catch (error) {
    logger.error('Error in putHandler:', error);

    // Provide more specific error messages
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';

    // Check for slug conflict errors (from auto-regeneration)
    if (errorMessage.includes('A page with the slug')) {
      return NextResponse.json(
        {
          success: false,
          error: errorMessage,
          details:
            'The new title would create a URL slug that conflicts with an existing page. Try choosing a more unique title.',
        },
        { status: 409 }
      );
    }

    // Check for specific error types
    if (errorMessage.includes('Failed to save page changes')) {
      return NextResponse.json(
        {
          success: false,
          error: errorMessage,
          details:
            'The page could not be saved. This may be due to authentication issues or database constraints.',
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

async function patchHandler(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  let slug: string = '';
  let data: Record<string, unknown> = {};

  try {
    // Check authentication first
    const authResult = await requireAuth(request);
    if (authResult.response) {
      return authResult.response;
    }
    const user = authResult.user;

    // Admin only for status changes
    if (user.role !== 'admin') {
      return NextResponse.json(
        {
          success: false,
          error: 'Admin access required',
        },
        { status: 403 }
      );
    }

    const resolvedParams = await params;
    slug = decodeURIComponent(resolvedParams.slug);
    data = await request.json();

    if (!slug) {
      return NextResponse.json(
        {
          success: false,
          error: 'Page slug is required',
        },
        { status: 400 }
      );
    }

    // Parse slug to separate namespace (e.g., "library/doom-bible" → slug="doom-bible", namespace="library")
    const { slug: actualSlug, namespace } = parseWikiSlug(slug);

    // Get the existing page to verify it exists and get its ID
    const existingPage = await wikiService.getPageBySlug(actualSlug, namespace);
    if (!existingPage) {
      return NextResponse.json(
        {
          success: false,
          error: 'Page not found',
        },
        { status: 404 }
      );
    }

    // Schema for PATCH operations (admin-only fields)
    const patchWikiPageSchema = z
      .object({
        status: z.enum(['draft', 'published', 'archived']).optional(),
        protection_level: z.enum(['none', 'semi', 'full']).optional(),
      })
      .refine(data => data.status !== undefined || data.protection_level !== undefined, {
        message: 'At least one field (status or protection_level) must be provided',
      });

    // Validate request data with Zod schema
    const validation = validateWithSchema(patchWikiPageSchema, data);
    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          details: validation.errors,
        },
        { status: 400 }
      );
    }

    const validatedData = validation.data;

    // Update only the specified fields using WikiService
    const updatedPage = await wikiService.updatePage(
      existingPage.id,
      {
        status: validatedData.status,
        protection_level: validatedData.protection_level,
        summary: `Admin ${validatedData.status ? 'status' : 'protection'} change`,
      },
      user.id,
      request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined
    );

    return NextResponse.json({
      success: true,
      data: updatedPage,
      message: `Page ${validatedData.status ? 'status' : 'protection level'} updated successfully`,
    });
  } catch (error) {
    logger.error('Error in patchHandler:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

async function deleteHandler(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  let slug: string | undefined;

  try {
    // Check authentication first
    const authResult = await requireAuth(request);
    if (authResult.response) {
      return authResult.response;
    }
    const user = authResult.user;

    const resolvedParams = await params;
    slug = decodeURIComponent(resolvedParams.slug);

    if (!slug) {
      return NextResponse.json(
        {
          success: false,
          error: 'Page slug is required',
        },
        { status: 400 }
      );
    }

    // Parse slug to separate namespace (e.g., "library/doom-bible" → slug="doom-bible", namespace="library")
    const { slug: actualSlug, namespace } = parseWikiSlug(slug);

    // Get the existing page to verify it exists and get its ID
    const existingPage = await wikiService.getPageBySlug(actualSlug, namespace);
    if (!existingPage) {
      return NextResponse.json(
        {
          success: false,
          error: 'Page not found',
        },
        { status: 404 }
      );
    }

    // Enhanced permission check for deletion
    // Only page creator, admins, or moderators can delete pages
    if (user.id !== existingPage.created_by && user.role !== 'admin' && user.role !== 'moderator') {
      return NextResponse.json(
        {
          success: false,
          error:
            'Permission denied. Only the page creator, admins, or moderators can delete this page.',
        },
        { status: 403 }
      );
    }

    // Additional protection for important pages - only admins can delete protected pages
    if (existingPage.protection_level !== 'none' && user.role !== 'admin') {
      return NextResponse.json(
        {
          success: false,
          error: 'Protected pages can only be deleted by administrators.',
        },
        { status: 403 }
      );
    }

    // Store page info for activity logging before deletion
    const pageMetadata = {
      page_title: existingPage.title,
      page_slug: existingPage.slug,
      category_name: existingPage.categories?.[0] || null,
      categories: existingPage.categories || [],
      summary: `Deleted page: ${existingPage.title}`,
      reason: 'User-initiated deletion',
    };

    logger.info(
      '[DELETE] Page metadata for activity logging:',
      JSON.stringify(pageMetadata, null, 2)
    );
    logger.info('[DELETE] Calling wikiService.deletePage with:', {
      pageId: existingPage.id,
      userId: user.id,
    });

    // Delete the page using WikiService with metadata
    await wikiService.deletePage(existingPage.id, user.id, pageMetadata);

    // Revalidate Next.js cache for wiki pages
    revalidatePath('/wiki');
    revalidatePath(`/wiki/${slug}`);
    if (existingPage.category_ids && existingPage.category_ids.length > 0) {
      existingPage.category_ids.forEach((categoryId: string) => {
        revalidatePath(`/wiki/category/${categoryId}`);
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Page deleted successfully',
    });
  } catch (error) {
    logger.error('Error in deleteHandler:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// Public endpoint - no authentication required for viewing individual wiki pages
// But authenticated users may see additional content based on their role
export const GET = withSecurity(getHandler, {}); // Make public - authentication is optional

export const PUT = withSecurity(putHandler, {
  enableCSRF: true,
});

export const DELETE = withSecurity(deleteHandler, {
  enableCSRF: true,
});

export const PATCH = withSecurity(patchHandler, {
  enableCSRF: true,
});
