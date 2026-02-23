import { NextRequest, NextResponse } from 'next/server';
import { dbAdapter } from '@/lib/database/adapter';
import { withSecurity } from '@/lib/security/middleware';
import { errorResponse, NotFoundError } from '@/lib/utils/api-errors';

// Mark as dynamic - this endpoint requires runtime database access
export const dynamic = 'force-dynamic';

/**
 * News article database result
 * SELECT id, title, slug, content, excerpt, author, published_at, featured_image, tags, views, status, created_at, updated_at
 */
interface NewsArticleResult {
  id: number;
  title: string;
  slug: string;
  content: string;
  excerpt: string;
  author: string;
  published_at: Date | string | null;
  featured_image: string | null;
  tags: string | null; // JSON string from database
  views: number;
  status: string;
  created_at: Date | string;
  updated_at: Date | string;
}

// GET /api/news/[slug] - Get single news article
export async function GET(request: NextRequest, context: { params: Promise<{ slug: string }> }) {
  const params = await context.params;
  const slug = params.slug;

  try {
    const articleResult = await dbAdapter.query(
      `SELECT id, title, slug, content,
              COALESCE(excerpt, '') as excerpt,
              COALESCE(author, 'Staff') as author,
              published_at, featured_image, tags, views, status,
              created_at, updated_at
       FROM news
       WHERE slug = $1`,
      [slug],
      { schema: 'content' }
    );
    const article = articleResult.rows[0] as NewsArticleResult;

    if (!article) {
      throw new NotFoundError('News article', slug);
    }

    // Parse tags if present
    let parsedTags: string[] = [];
    if (article.tags) {
      try {
        parsedTags = JSON.parse(article.tags);
      } catch {
        parsedTags = [];
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        ...article,
        tags: parsedTags,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

// PUT /api/news/[slug] - Update news article
async function updateHandler(request: NextRequest, context: { params: Promise<{ slug: string }> }) {
  const params = await context.params;
  const slug = params.slug;

  try {
    const body = await request.json();
    const { title, content, excerpt, author, featured_image, tags, status } = body;

    // Check if article exists
    const existingResult = await dbAdapter.query('SELECT id FROM news WHERE slug = $1', [slug], {
      schema: 'content',
    });
    const existing = existingResult.rows[0];
    if (!existing) {
      throw new NotFoundError('News article', slug);
    }

    // Build update query dynamically based on provided fields
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (title !== undefined) {
      updates.push(`title = $${paramIndex++}`);
      values.push(title);
    }
    if (content !== undefined) {
      updates.push(`content = $${paramIndex++}`);
      values.push(content);
    }
    if (excerpt !== undefined) {
      updates.push(`excerpt = $${paramIndex++}`);
      values.push(excerpt);
    }
    if (author !== undefined) {
      updates.push(`author = $${paramIndex++}`);
      values.push(author);
    }
    if (featured_image !== undefined) {
      updates.push(`featured_image = $${paramIndex++}`);
      values.push(featured_image);
    }
    if (tags !== undefined) {
      updates.push(`tags = $${paramIndex++}`);
      values.push(JSON.stringify(tags));
    }
    if (status !== undefined) {
      updates.push(`status = $${paramIndex++}`);
      values.push(status);
    }

    updates.push('updated_at = NOW()');
    values.push(slug); // for WHERE clause

    if (updates.length === 1) {
      // Only updated_at, nothing to update
      return NextResponse.json({ success: true, message: 'No changes to save' });
    }

    const updateQuery = `UPDATE news SET ${updates.join(', ')} WHERE slug = $${paramIndex}`;
    await dbAdapter.query(updateQuery, values, { schema: 'content' });

    return NextResponse.json({ success: true, message: 'News article updated successfully' });
  } catch (error) {
    return errorResponse(error);
  }
}

export const PUT = withSecurity(updateHandler);

// DELETE /api/news/[slug] - Delete news article (admin only)
async function deleteHandler(request: NextRequest, context: { params: Promise<{ slug: string }> }) {
  const params = await context.params;
  const slug = params.slug;

  try {
    // Check if article exists
    const existingResult = await dbAdapter.query('SELECT id FROM news WHERE slug = $1', [slug], {
      schema: 'content',
    });
    const existing = existingResult.rows[0];
    if (!existing) {
      throw new NotFoundError('News article', slug);
    }

    await dbAdapter.query('DELETE FROM news WHERE slug = $1', [slug], { schema: 'content' });

    return NextResponse.json({ success: true, message: 'News article deleted successfully' });
  } catch (error) {
    return errorResponse(error);
  }
}

export const DELETE = withSecurity(deleteHandler);
