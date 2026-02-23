import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { getWikiService } from '@/lib/services/registry';
import { requireAuth, getCurrentUser } from '@/lib/auth/server';
import { apiOptimizer } from '@/lib/performance/compression';
import { withSecurity } from '@/lib/security/middleware';
import { wikiPageSchema, validateWithSchema, paginationSchema } from '@/lib/schemas/unified';
import { z } from 'zod';
import { sanitizeWikiContent, ContentSanitizer } from '@/lib/content/sanitization';
import { logger } from '@/lib/utils/logger';

// Mark as dynamic - this endpoint requires runtime database access
export const dynamic = 'force-dynamic';

const wikiService = getWikiService();

// Schema for GET query parameters
const getWikiPagesSchema = z.object({
  category: z.string().max(100).nullish(),
  search: z.string().min(2).max(200).nullish(),
  limit: z
    .string()
    .transform(val => (val ? parseInt(val) : 20))
    .refine(val => !isNaN(val) && val >= 1 && val <= 100, 'Limit must be between 1 and 100')
    .default(20),
});

async function getHandler(request: NextRequest) {
  try {
    // Require authentication - all wiki content requires login
    const authResult = await requireAuth(request);
    if (authResult.response) {
      return authResult.response;
    }

    const user = authResult.user;
    const userRole = user.role;

    const { searchParams } = new URL(request.url);

    // Validate query parameters with Zod
    const queryValidation = validateWithSchema(getWikiPagesSchema, {
      category: searchParams.get('category'),
      search: searchParams.get('search'),
      limit: searchParams.get('limit'),
    });

    if (!queryValidation.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid query parameters',
          details: queryValidation.errors,
        },
        { status: 400 }
      );
    }

    const { category, search, limit } = queryValidation.data;

    let pages: any[];
    if (search) {
      const results = await wikiService.searchPages(
        {
          query: search,
          limit,
          offset: 0,
        },
        userRole || undefined
      );
      pages = results.pages;
    } else {
      pages = await wikiService.getAllPages(category || undefined, limit, userRole || undefined);
    }

    // Return fresh data - wiki pages are mutable (can be created/deleted)
    // Disable HTTP caching to ensure category counts update immediately
    return NextResponse.json(
      {
        success: true,
        data: pages,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      }
    );
  } catch (error: any) {
    logger.error('Error fetching wiki pages:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch wiki pages',
        message: error.message,
      },
      { status: 500 }
    );
  }
}

// Helper function to generate slug from title
function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single
    .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
}

async function postHandler(request: NextRequest) {
  try {
    // Check authentication first
    const authResult = await requireAuth(request);
    if (authResult.response) {
      return authResult.response;
    }
    const user = authResult.user;

    const data = await request.json();

    // Validate request data with Zod schema
    const validation = validateWithSchema(wikiPageSchema, data);
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

    const { title, content, categories, tags, slug: providedSlug } = validation.data;

    // Sanitize user content to prevent XSS attacks
    const sanitizedContent = sanitizeWikiContent(content);
    const sanitizedTitle = ContentSanitizer.sanitizeContent(title, {
      level: 'minimal',
      allowMarkdown: false,
      stripHtml: true,
    });
    const sanitizedSummary = validation.data.summary
      ? ContentSanitizer.sanitizeContent(validation.data.summary, {
          level: 'minimal',
          allowMarkdown: false,
          stripHtml: true,
          maxLength: 500,
        })
      : undefined;

    // Validate content after sanitization
    const contentValidation = ContentSanitizer.validateContent(sanitizedContent, {
      level: 'safe',
      allowMarkdown: true,
      maxLength: 100000,
    });

    if (!contentValidation.isValid) {
      return NextResponse.json(
        {
          success: false,
          error: 'Content validation failed',
          details: contentValidation.errors,
        },
        { status: 400 }
      );
    }

    // Validate category if provided
    if (categories && categories.length > 0) {
      try {
        const availableCategories = await wikiService.getCategories(user.role);
        const validCategories = availableCategories.map(cat => cat.id);
        const invalidCategories = categories.filter(cat => !validCategories.includes(cat));

        if (invalidCategories.length > 0) {
          return NextResponse.json(
            {
              success: false,
              error: `Invalid categories: ${invalidCategories.join(', ')}. Valid categories are: ${validCategories.join(', ')}`,
            },
            { status: 400 }
          );
        }
      } catch (error) {
        logger.error('Error validating categories:', error);
        return NextResponse.json(
          {
            success: false,
            error: 'Failed to validate categories',
          },
          { status: 500 }
        );
      }
    }

    const slug = providedSlug || generateSlug(sanitizedTitle);

    const page = await wikiService.createPage(
      {
        slug,
        title: sanitizedTitle,
        content: sanitizedContent,
        categories: categories || [],
        tags: tags || [],
        status: validation.data.status,
        protectionLevel: validation.data.protectionLevel,
        namespace: validation.data.namespace,
        summary: sanitizedSummary,
        contentFormat: validation.data.contentFormat,
      },
      user.id
    );

    // Revalidate Next.js cache for wiki pages
    revalidatePath('/wiki');
    revalidatePath(`/wiki/${slug}`);
    if (categories && categories.length > 0) {
      categories.forEach(categoryId => {
        revalidatePath(`/wiki/category/${categoryId}`);
      });
    }

    return NextResponse.json({
      success: true,
      data: page,
      message: 'Wiki page created successfully',
    });
  } catch (error: any) {
    logger.error('Error creating wiki page:', error);

    // Handle specific database constraint errors
    if (error.message && error.message.includes('FOREIGN KEY constraint failed')) {
      if (error.message.includes('created_by')) {
        return NextResponse.json(
          {
            success: false,
            error: 'Invalid user: The specified user does not exist',
            message: 'User validation failed',
          },
          { status: 400 }
        );
      } else if (error.message.includes('category_id')) {
        return NextResponse.json(
          {
            success: false,
            error: 'Invalid category: The specified category does not exist',
            message: 'Category validation failed',
          },
          { status: 400 }
        );
      } else {
        return NextResponse.json(
          {
            success: false,
            error: 'Database constraint violation: Invalid reference to related data',
            message: 'Foreign key constraint failed',
          },
          { status: 400 }
        );
      }
    }

    // Handle duplicate slug errors
    if (error.message && error.message.includes('UNIQUE constraint failed')) {
      return NextResponse.json(
        {
          success: false,
          error: 'A page with this title already exists. Please choose a different title.',
          message: 'Duplicate page title',
        },
        { status: 409 }
      );
    }

    // Generic error fallback
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create wiki page',
        message: error.message || 'Unknown error occurred',
      },
      { status: 500 }
    );
  }
}

// Authenticated endpoint - all wiki content requires login
export const GET = withSecurity(getHandler, {
  enableCSRF: false, // GET requests don't need CSRF
});

export const POST = withSecurity(postHandler, {
  enableCSRF: true,
});
