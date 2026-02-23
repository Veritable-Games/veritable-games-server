import { NextRequest, NextResponse } from 'next/server';
import { dbAdapter } from '@/lib/database/adapter';
import { withSecurity } from '@/lib/security/middleware';
import { logger } from '@/lib/utils/logger';

// Mark as dynamic - this endpoint requires runtime database access
export const dynamic = 'force-dynamic';

/**
 * Database error interface for PostgreSQL errors
 * Includes error code for constraint violations
 */
interface DatabaseError extends Error {
  code?: string;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');
    const status = searchParams.get('status') || 'published';
    const author = searchParams.get('author');
    const tag = searchParams.get('tag');

    let query = 'SELECT * FROM news';
    const params: any[] = [];
    const conditions: string[] = [];
    let paramIndex = 1;

    if (status) {
      conditions.push(`status = $${paramIndex++}`);
      params.push(status);
    }

    if (author) {
      conditions.push(`author = $${paramIndex++}`);
      params.push(author);
    }

    if (tag) {
      conditions.push(`tags ILIKE $${paramIndex++}`);
      params.push(`%"${tag}"%`);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ` ORDER BY published_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    params.push(limit, offset);

    const result = await dbAdapter.query(query, params, { schema: 'content' });
    const articles = result.rows;

    // Process tags from JSON strings
    const processedArticles = articles.map(article => ({
      ...article,
      tags: article.tags ? JSON.parse(article.tags) : [],
    }));

    // Get total count for pagination
    let countQuery = 'SELECT COUNT(*) as total FROM news';
    const countParams: any[] = [];

    if (conditions.length > 0) {
      countQuery += ' WHERE ' + conditions.join(' AND ');
      countParams.push(...params.slice(0, -2)); // Remove limit and offset
    }

    const countResult = await dbAdapter.query(countQuery, countParams, { schema: 'content' });
    const total = countResult.rows[0]?.total || 0;

    return NextResponse.json({
      articles: processedArticles,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    });
  } catch (error) {
    logger.error('Error fetching news articles:', error);
    return NextResponse.json({ error: 'Failed to fetch news articles' }, { status: 500 });
  }
}

async function postHandler(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      title,
      slug,
      summary,
      content,
      author,
      published_at,
      status = 'draft',
      featured_image,
      tags,
    } = body;

    // Validate required fields
    if (!title || !slug || !summary || !content || !author) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const result = await dbAdapter.query(
      `
      INSERT INTO news (
        title, slug, excerpt, content, author, published_at, status, featured_image, tags
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id
    `,
      [
        title,
        slug,
        summary,
        content,
        author,
        published_at || new Date().toISOString(),
        status,
        featured_image || null,
        tags ? JSON.stringify(tags) : null,
      ],
      { schema: 'content', returnLastId: true }
    );

    return NextResponse.json(
      {
        id: result.rows[0]?.id,
        message: 'News article created successfully',
      },
      { status: 201 }
    );
  } catch (error) {
    logger.error('Error creating news article:', error);
    const dbError = error as DatabaseError;
    if (dbError?.code === '23505') {
      // PostgreSQL unique constraint violation
      return NextResponse.json({ error: 'Article slug must be unique' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Failed to create news article' }, { status: 500 });
  }
}

export const POST = withSecurity(postHandler, {
  enableCSRF: true,
});
