import { NextRequest, NextResponse } from 'next/server';
import { withSecurity } from '@/lib/security/middleware';
import { wikiTagService } from '@/lib/wiki/services/WikiTagService';
import { wikiPageService } from '@/lib/wiki/services/WikiPageService';
import { requireAuth } from '@/lib/auth/server';
import { parseWikiSlug } from '@/lib/wiki/utils/slug-parser';
import { z } from 'zod';
import { logger } from '@/lib/utils/logger';

// Mark as dynamic - this endpoint requires runtime database access
export const dynamic = 'force-dynamic';

// Validation schemas
const addTagSchema = z
  .object({
    tagId: z.number().optional(),
    tagNames: z.array(z.string()).optional(),
  })
  .refine(data => (data.tagId !== undefined) !== (data.tagNames !== undefined), {
    message: 'Must provide either tagId or tagNames, not both',
  });

const removeTagSchema = z.object({
  tagId: z.number(),
});

const updateTagsSchema = z.object({
  tagIds: z.array(z.number()),
});

// GET - Fetch tags for a specific page
export const GET = withSecurity(
  async (request: NextRequest, context: { params: Promise<{ slug: string }> }) => {
    try {
      // Authenticate user
      const authResult = await requireAuth(request);
      if (authResult.response) {
        return authResult.response;
      }

      const params = await context.params;

      // Parse namespace from slug (e.g., "library/doom-bible" → slug="doom-bible", namespace="library")
      const { slug, namespace } = parseWikiSlug(params.slug);

      // Get the page using parsed slug and namespace
      let page;
      try {
        page = await wikiPageService.getPageBySlug(slug, namespace);
      } catch (error) {
        return NextResponse.json(
          {
            error: `Page not found: ${params.slug} (parsed: slug="${slug}", namespace="${namespace}")`,
          },
          { status: 404 }
        );
      }

      // Get page tags
      const pageTags = await wikiTagService.getPageTags(page.id);

      // Get all available tags
      const allTags = await wikiTagService.getAllTags();

      return NextResponse.json({
        success: true,
        currentTags: pageTags,
        allTags: allTags,
      });
    } catch (error) {
      logger.error('Failed to fetch page tags:', error);
      return NextResponse.json({ error: 'Failed to fetch page tags' }, { status: 500 });
    }
  }
);

// POST - Add tag(s) to a page
export const POST = withSecurity(
  async (request: NextRequest, context: { params: Promise<{ slug: string }> }) => {
    try {
      // Authenticate user
      const authResult = await requireAuth(request);
      if (authResult.response) {
        return authResult.response;
      }
      const user = authResult.user;

      const params = await context.params;
      const body = await request.json();

      // Validate request body
      const validation = addTagSchema.safeParse(body);
      if (!validation.success) {
        return NextResponse.json(
          {
            error: 'Validation failed',
            details: validation.error.issues,
          },
          { status: 400 }
        );
      }

      const { tagId, tagNames } = validation.data;

      // Parse namespace from slug (e.g., "library/doom-bible" → slug="doom-bible", namespace="library")
      const { slug, namespace } = parseWikiSlug(params.slug);

      // Get the page using parsed slug and namespace
      let page;
      try {
        page = await wikiPageService.getPageBySlug(slug, namespace);
      } catch (error) {
        return NextResponse.json(
          {
            error: `Page not found: ${params.slug} (parsed: slug="${slug}", namespace="${namespace}")`,
          },
          { status: 404 }
        );
      }

      if (tagId !== undefined) {
        // Add existing tag by ID
        try {
          await wikiTagService.addTagToPage(page.id, tagId);
          const tag = wikiTagService.getTagById(tagId);

          return NextResponse.json({
            success: true,
            addedTags: [tag],
            message: 'Tag added successfully',
          });
        } catch (error: any) {
          if (error.message?.includes('already linked')) {
            return NextResponse.json({ error: 'Tag is already on this page' }, { status: 409 });
          }
          if (error.message?.includes('not found')) {
            return NextResponse.json({ error: 'Tag not found' }, { status: 404 });
          }
          throw error;
        }
      } else if (tagNames !== undefined) {
        // Create and add new tags by name
        const result = await wikiTagService.addTagsToPage(page.id, tagNames, user.id);

        return NextResponse.json({
          success: true,
          addedTags: result.addedTags,
          existingTags: result.existingTags,
          message: `Added ${result.addedTags.length} tag(s)`,
        });
      }

      // Should never reach here due to validation
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    } catch (error: any) {
      logger.error('Failed to add tags:', error);
      return NextResponse.json({ error: error.message || 'Failed to add tags' }, { status: 500 });
    }
  }
);

// DELETE - Remove a tag from a page
export const DELETE = withSecurity(
  async (request: NextRequest, context: { params: Promise<{ slug: string }> }) => {
    try {
      // Authenticate user
      const authResult = await requireAuth(request);
      if (authResult.response) {
        return authResult.response;
      }

      const params = await context.params;
      const body = await request.json();

      // Validate request body
      const validation = removeTagSchema.safeParse(body);
      if (!validation.success) {
        return NextResponse.json(
          {
            error: 'Validation failed',
            details: validation.error.issues,
          },
          { status: 400 }
        );
      }

      const { tagId } = validation.data;

      // Parse namespace from slug (e.g., "library/doom-bible" → slug="doom-bible", namespace="library")
      const { slug, namespace } = parseWikiSlug(params.slug);

      // Get the page using parsed slug and namespace
      let page;
      try {
        page = await wikiPageService.getPageBySlug(slug, namespace);
      } catch (error) {
        return NextResponse.json(
          {
            error: `Page not found: ${params.slug} (parsed: slug="${slug}", namespace="${namespace}")`,
          },
          { status: 404 }
        );
      }

      // Remove the tag
      try {
        await wikiTagService.removeTagFromPage(page.id, tagId);

        return NextResponse.json({
          success: true,
          message: 'Tag removed successfully',
        });
      } catch (error: any) {
        if (error.message?.includes('not found on this page')) {
          return NextResponse.json({ error: 'Tag not found on this page' }, { status: 404 });
        }
        throw error;
      }
    } catch (error: any) {
      logger.error('Failed to remove tag:', error);
      return NextResponse.json({ error: error.message || 'Failed to remove tag' }, { status: 500 });
    }
  }
);

// PUT - Replace all tags for a page (admin/moderator only)
export const PUT = withSecurity(
  async (request: NextRequest, context: { params: Promise<{ slug: string }> }) => {
    try {
      // Authenticate user
      const authResult = await requireAuth(request);
      if (authResult.response) {
        return authResult.response;
      }
      const user = authResult.user;

      // Require moderator or admin role for bulk operations
      if (user.role !== 'admin' && user.role !== 'moderator') {
        return NextResponse.json(
          { error: 'Insufficient permissions. Moderator or admin role required.' },
          { status: 403 }
        );
      }

      const params = await context.params;
      const body = await request.json();

      // Validate request body
      const validation = updateTagsSchema.safeParse(body);
      if (!validation.success) {
        return NextResponse.json(
          {
            error: 'Validation failed',
            details: validation.error.issues,
          },
          { status: 400 }
        );
      }

      const { tagIds } = validation.data;

      // Parse namespace from slug (e.g., "library/doom-bible" → slug="doom-bible", namespace="library")
      const { slug, namespace } = parseWikiSlug(params.slug);

      // Get the page using parsed slug and namespace
      let page;
      try {
        page = await wikiPageService.getPageBySlug(slug, namespace);
      } catch (error) {
        return NextResponse.json(
          {
            error: `Page not found: ${params.slug} (parsed: slug="${slug}", namespace="${namespace}")`,
          },
          { status: 404 }
        );
      }

      // Get tag names from IDs for setPageTags method
      const tagNames: string[] = [];
      for (const tagId of tagIds) {
        try {
          const tag = await wikiTagService.getTagById(tagId);
          tagNames.push(tag.name);
        } catch (error) {
          logger.warn(`Tag with ID ${tagId} not found, skipping`);
        }
      }

      const tags = await wikiTagService.setPageTags(page.id, tagNames);

      return NextResponse.json({
        success: true,
        tags,
        message: 'Page tags updated successfully',
      });
    } catch (error: any) {
      logger.error('Failed to update page tags:', error);
      return NextResponse.json(
        { error: error.message || 'Failed to update page tags' },
        { status: 500 }
      );
    }
  }
);
