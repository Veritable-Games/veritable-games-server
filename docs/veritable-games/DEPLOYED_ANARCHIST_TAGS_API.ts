import { NextRequest, NextResponse } from 'next/server';
import { withSecurity } from '@/lib/security/middleware';
import { dbAdapter } from '@/lib/database/adapter';
import { requireAuth } from '@/lib/auth/server';
import { z } from 'zod';

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

// GET - Fetch tags for an anarchist library document
export const GET = withSecurity(
  async (request: NextRequest, context: { params: Promise<{ slug: string }> }) => {
    try {
      const params = await context.params;

      console.log('[Tags Route] GET request for anarchist document:', params.slug);

      // Get the anarchist document by slug
      let documentResult;
      try {
        documentResult = await dbAdapter.query(
          'SELECT id FROM documents WHERE slug = $1',
          [params.slug],
          { schema: 'anarchist' }
        );
        console.log('[Tags Route] Query result:', documentResult.rows.length, 'rows');
      } catch (queryError) {
        console.error('[Tags Route] Query failed:', queryError);
        throw queryError;
      }

      const document = documentResult.rows[0];

      if (!document) {
        console.log('[Tags Route] Document not found for slug:', params.slug);
        return NextResponse.json(
          {
            error: `Anarchist document not found: ${params.slug}`,
            debug: {
              slug: params.slug,
              rowsReturned: documentResult.rows.length,
            },
          },
          { status: 404 }
        );
      }

      // Get current tags for this document
      const currentTagsResult = await dbAdapter.query(
        `
      SELECT
        t.id,
        t.name
      FROM anarchist.document_tags dt
      JOIN anarchist.tags t ON dt.tag_id = t.id
      WHERE dt.document_id = $1
      ORDER BY t.name
    `,
        [document.id]
      );
      const currentTags = currentTagsResult.rows;

      // Get all available tags from anarchist.tags
      const allTagsResult = await dbAdapter.query(
        `
      SELECT
        t.id,
        t.name
      FROM anarchist.tags t
      ORDER BY t.name
    `
      );
      const allTags = allTagsResult.rows;

      return NextResponse.json({
        success: true,
        currentTags,
        allTags,
      });
    } catch (error) {
      console.error('Failed to fetch anarchist document tags:', error);
      return NextResponse.json({ error: 'Failed to fetch document tags' }, { status: 500 });
    }
  }
);

// POST - Add tag(s) to an anarchist library document
export const POST = withSecurity(
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

      // Get the anarchist document by slug
      const documentResult = await dbAdapter.query(
        'SELECT id FROM documents WHERE slug = $1',
        [params.slug],
        { schema: 'anarchist' }
      );
      const document = documentResult.rows[0];

      if (!document) {
        return NextResponse.json(
          { error: `Anarchist document not found: ${params.slug}` },
          { status: 404 }
        );
      }

      if (tagId !== undefined) {
        // Add existing tag by ID
        try {
          // Check if tag exists in anarchist.tags
          const tagResult = await dbAdapter.query(
            'SELECT * FROM tags WHERE id = $1',
            [tagId],
            { schema: 'anarchist' }
          );
          const tag = tagResult.rows[0];
          if (!tag) {
            return NextResponse.json({ error: 'Tag not found' }, { status: 404 });
          }

          // Check if already linked
          const existingResult = await dbAdapter.query(
            'SELECT * FROM document_tags WHERE document_id = $1 AND tag_id = $2',
            [document.id, tagId],
            { schema: 'anarchist' }
          );

          if (existingResult.rows[0]) {
            return NextResponse.json({ error: 'Tag is already on this document' }, { status: 409 });
          }

          // Add tag to anarchist.document_tags (no user tracking)
          await dbAdapter.query(
            'INSERT INTO document_tags (document_id, tag_id) VALUES ($1, $2)',
            [document.id, tagId],
            { schema: 'anarchist' }
          );

          // Note: usage_count is automatically updated by trigger

          return NextResponse.json({
            success: true,
            addedTags: [tag],
            message: 'Tag added successfully',
          });
        } catch (error: any) {
          console.error('Error adding tag by ID:', error);
          throw error;
        }
      } else if (tagNames !== undefined) {
        // Create and add new tags by name
        const addedTags: any[] = [];

        for (const tagName of tagNames) {
          const trimmedName = tagName.trim().toLowerCase().replace(/\s+/g, '-');
          if (!trimmedName) continue;

          // Create tag if it doesn't exist in anarchist.tags
          await dbAdapter.query(
            'INSERT INTO tags (name, created_at) VALUES ($1, NOW()) ON CONFLICT (name) DO NOTHING',
            [trimmedName],
            { schema: 'anarchist' }
          );

          // Get the tag from anarchist.tags
          const tagResult = await dbAdapter.query(
            'SELECT * FROM tags WHERE name = $1',
            [trimmedName],
            { schema: 'anarchist' }
          );
          const tag = tagResult.rows[0];

          if (tag) {
            // Check if already linked
            const existingResult = await dbAdapter.query(
              'SELECT * FROM document_tags WHERE document_id = $1 AND tag_id = $2',
              [document.id, tag.id],
              { schema: 'anarchist' }
            );

            if (!existingResult.rows[0]) {
              // Add to anarchist document
              await dbAdapter.query(
                'INSERT INTO document_tags (document_id, tag_id) VALUES ($1, $2)',
                [document.id, tag.id],
                { schema: 'anarchist' }
              );

              // Note: usage_count is automatically updated by trigger

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
      console.error('Failed to add tags to anarchist document:', error);
      return NextResponse.json({ error: error.message || 'Failed to add tags' }, { status: 500 });
    }
  }
);

// DELETE - Remove a tag from an anarchist library document
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

      // Get the anarchist document by slug
      const documentResult = await dbAdapter.query(
        'SELECT id FROM documents WHERE slug = $1',
        [params.slug],
        { schema: 'anarchist' }
      );
      const document = documentResult.rows[0];

      if (!document) {
        return NextResponse.json(
          { error: `Anarchist document not found: ${params.slug}` },
          { status: 404 }
        );
      }

      // Remove the tag from anarchist.document_tags
      const result = await dbAdapter.query(
        'DELETE FROM document_tags WHERE document_id = $1 AND tag_id = $2',
        [document.id, tagId],
        { schema: 'anarchist' }
      );

      if (result.rowCount === 0) {
        return NextResponse.json({ error: 'Tag not found on this document' }, { status: 404 });
      }

      // Note: usage_count is automatically updated by trigger

      return NextResponse.json({
        success: true,
        message: 'Tag removed successfully',
      });
    } catch (error: any) {
      console.error('Failed to remove tag from anarchist document:', error);
      return NextResponse.json({ error: error.message || 'Failed to remove tag' }, { status: 500 });
    }
  }
);
