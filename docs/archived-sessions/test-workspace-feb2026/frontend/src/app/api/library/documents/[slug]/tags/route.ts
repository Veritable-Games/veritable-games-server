import { NextRequest, NextResponse } from 'next/server';
import { withSecurity } from '@/lib/security/middleware';
import { dbAdapter } from '@/lib/database/adapter';
import { requireAuth, getCurrentUser } from '@/lib/auth/server';
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

// GET - Fetch tags for a library document
export const GET = withSecurity(
  async (request: NextRequest, context: { params: Promise<{ slug: string }> }) => {
    try {
      const params = await context.params;

      // Get current user to determine visibility filtering
      const user = await getCurrentUser(request);
      const isPrivileged = user?.role === 'admin' || user?.role === 'moderator';

      // Get the document by slug
      const documentResult = await dbAdapter.query(
        'SELECT id, is_public FROM library_documents WHERE slug = $1',
        [params.slug],
        { schema: 'library' }
      );
      const document = documentResult.rows[0];

      if (!document) {
        return NextResponse.json(
          { error: `Library document not found: ${params.slug}` },
          { status: 404 }
        );
      }

      // Check if user can view private document
      if (!document.is_public && !isPrivileged) {
        return NextResponse.json({ error: 'Document not found' }, { status: 404 });
      }

      // Get current tags for this document from shared.tags
      const currentTagsResult = await dbAdapter.query(
        `
        SELECT
          t.id,
          t.name
        FROM library.library_document_tags dt
        JOIN shared.tags t ON dt.tag_id = t.id
        WHERE dt.document_id = $1
        ORDER BY t.name
        `,
        [document.id]
      );
      const currentTags = currentTagsResult.rows;

      // Get all available tags from shared.tags that are used by library documents
      // For non-privileged users, only show tags from public documents
      const allTagsResult = await dbAdapter.query(
        `
        SELECT
          t.id,
          t.name,
          COUNT(DISTINCT ldt.document_id) as usage_count
        FROM shared.tags t
        LEFT JOIN library.library_document_tags ldt ON t.id = ldt.tag_id
        LEFT JOIN library.library_documents ld ON ldt.document_id = ld.id
        ${!isPrivileged ? 'WHERE ld.is_public = true OR ld.id IS NULL' : ''}
        GROUP BY t.id, t.name
        ORDER BY usage_count DESC, t.name
        `,
        []
      );
      const allTags = allTagsResult.rows.map((tag: any) => ({
        id: tag.id,
        name: tag.name,
        usage_count: parseInt(tag.usage_count) || 0,
      }));

      return NextResponse.json({
        success: true,
        currentTags,
        allTags,
      });
    } catch (error) {
      logger.error('Failed to fetch library document tags:', error);
      return NextResponse.json({ error: 'Failed to fetch document tags' }, { status: 500 });
    }
  }
);

// POST - Add tag(s) to a library document
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

      // Get the document by slug
      const documentResult = await dbAdapter.query(
        'SELECT id FROM library_documents WHERE slug = $1',
        [params.slug],
        { schema: 'library' }
      );
      const document = documentResult.rows[0];

      if (!document) {
        return NextResponse.json(
          { error: `Library document not found: ${params.slug}` },
          { status: 404 }
        );
      }

      if (tagId !== undefined) {
        // Add existing tag by ID
        try {
          // Check if tag exists in shared.tags
          const tagResult = await dbAdapter.query(
            'SELECT id, name FROM shared.tags WHERE id = $1',
            [tagId]
          );
          const tag = tagResult.rows[0];
          if (!tag) {
            return NextResponse.json({ error: 'Tag not found' }, { status: 404 });
          }

          // Check if already linked
          const existingResult = await dbAdapter.query(
            'SELECT * FROM library_document_tags WHERE document_id = $1 AND tag_id = $2',
            [document.id, tagId],
            { schema: 'library' }
          );

          if (existingResult.rows[0]) {
            return NextResponse.json({ error: 'Tag is already on this document' }, { status: 409 });
          }

          // Add tag - usage_count is handled by database trigger
          await dbAdapter.query(
            'INSERT INTO library_document_tags (document_id, tag_id) VALUES ($1, $2)',
            [document.id, tagId],
            { schema: 'library' }
          );

          return NextResponse.json({
            success: true,
            addedTags: [tag],
            message: 'Tag added successfully',
          });
        } catch (error: any) {
          logger.error('Error adding tag by ID:', error);
          throw error;
        }
      } else if (tagNames !== undefined) {
        // Create and add new tags by name
        const addedTags: any[] = [];

        for (const tagName of tagNames) {
          const trimmedName = tagName.trim().toLowerCase().replace(/\s+/g, '-');
          if (!trimmedName) continue;

          // Create tag in shared.tags if it doesn't exist
          await dbAdapter.query(
            `INSERT INTO shared.tags (name, source, created_at)
             VALUES ($1, 'library', NOW())
             ON CONFLICT (name) DO NOTHING`,
            [trimmedName]
          );

          // Get the tag from shared.tags
          const tagResult = await dbAdapter.query(
            'SELECT id, name FROM shared.tags WHERE name = $1',
            [trimmedName]
          );
          const tag = tagResult.rows[0];

          if (tag) {
            // Check if already linked
            const existingResult = await dbAdapter.query(
              'SELECT * FROM library_document_tags WHERE document_id = $1 AND tag_id = $2',
              [document.id, tag.id],
              { schema: 'library' }
            );

            if (!existingResult.rows[0]) {
              // Add to document - usage_count is handled by database trigger
              await dbAdapter.query(
                'INSERT INTO library_document_tags (document_id, tag_id) VALUES ($1, $2)',
                [document.id, tag.id],
                { schema: 'library' }
              );

              addedTags.push(tag);
            }
          }
        }

        return NextResponse.json({
          success: true,
          addedTags,
          message: `Added ${addedTags.length} tag(s)`,
        });
      }

      // Should never reach here due to validation
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    } catch (error: any) {
      logger.error('Failed to add tags to library document:', error);
      return NextResponse.json({ error: error.message || 'Failed to add tags' }, { status: 500 });
    }
  }
);

// DELETE - Remove a tag from a library document
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

      // Get the document by slug
      const documentResult = await dbAdapter.query(
        'SELECT id FROM library_documents WHERE slug = $1',
        [params.slug],
        { schema: 'library' }
      );
      const document = documentResult.rows[0];

      if (!document) {
        return NextResponse.json(
          { error: `Library document not found: ${params.slug}` },
          { status: 404 }
        );
      }

      // Remove the tag - usage_count is handled by database trigger
      const result = await dbAdapter.query(
        'DELETE FROM library_document_tags WHERE document_id = $1 AND tag_id = $2',
        [document.id, tagId],
        { schema: 'library' }
      );

      if (result.rowCount === 0) {
        return NextResponse.json({ error: 'Tag not found on this document' }, { status: 404 });
      }

      return NextResponse.json({
        success: true,
        message: 'Tag removed successfully',
      });
    } catch (error: any) {
      logger.error('Failed to remove tag from library document:', error);
      return NextResponse.json({ error: error.message || 'Failed to remove tag' }, { status: 500 });
    }
  }
);
