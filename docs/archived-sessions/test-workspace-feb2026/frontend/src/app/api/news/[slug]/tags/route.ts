import { NextRequest, NextResponse } from 'next/server';
import { dbAdapter } from '@/lib/database/adapter';
import { withSecurity } from '@/lib/security/middleware';
import { errorResponse, NotFoundError } from '@/lib/utils/api-errors';

// Mark as dynamic - this endpoint requires runtime database access
export const dynamic = 'force-dynamic';

/**
 * News article row with tags field
 */
interface NewsArticleTagsRow {
  tags: string | null;
}

// GET /api/news/[slug]/tags - Get tags for news article
export async function GET(request: NextRequest, context: { params: Promise<{ slug: string }> }) {
  const params = await context.params;
  const slug = params.slug;

  try {
    const result = await dbAdapter.query('SELECT tags FROM news WHERE slug = $1', [slug], {
      schema: 'content',
    });
    const article = result.rows[0] as NewsArticleTagsRow | undefined;

    if (!article) {
      throw new NotFoundError('News article', slug);
    }

    let currentTags = [];
    if (article.tags) {
      try {
        const parsedTags = JSON.parse(article.tags);
        // Convert string array to tag objects
        currentTags = parsedTags.map((name: string, index: number) => ({
          id: index + 1,
          name: name,
          color: '#3b82f6',
        }));
      } catch {
        currentTags = [];
      }
    }

    // For news, we don't have a predefined tag system, so allTags is just the current tags
    // In the future, you could create a separate news_tags table
    return NextResponse.json({
      success: true,
      currentTags,
      allTags: currentTags, // For now, same as current tags
    });
  } catch (error) {
    return errorResponse(error);
  }
}

// POST /api/news/[slug]/tags - Add tag to news article
async function addTagHandler(request: NextRequest, context: { params: Promise<{ slug: string }> }) {
  const params = await context.params;
  const slug = params.slug;

  try {
    const body = await request.json();
    const { tagNames } = body;

    if (!tagNames || !Array.isArray(tagNames) || tagNames.length === 0) {
      return NextResponse.json({ error: 'Invalid tag names' }, { status: 400 });
    }

    const result = await dbAdapter.query('SELECT tags FROM news WHERE slug = $1', [slug], {
      schema: 'content',
    });
    const article = result.rows[0] as NewsArticleTagsRow | undefined;

    if (!article) {
      throw new NotFoundError('News article', slug);
    }

    let existingTags: string[] = [];
    if (article.tags) {
      try {
        existingTags = JSON.parse(article.tags);
      } catch {
        existingTags = [];
      }
    }

    // Add new tags (avoid duplicates)
    const newTags = tagNames
      .map((name: string) => name.trim().toLowerCase())
      .filter((name: string) => name && !existingTags.includes(name));

    const updatedTags = [...existingTags, ...newTags];

    await dbAdapter.query(
      'UPDATE news SET tags = $1, updated_at = NOW() WHERE slug = $2',
      [JSON.stringify(updatedTags), slug],
      { schema: 'content' }
    );

    // Convert to tag objects for response
    const addedTags = newTags.map((name, index) => ({
      id: existingTags.length + index + 1,
      name,
      color: '#3b82f6',
    }));

    return NextResponse.json({
      success: true,
      addedTags,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export const POST = withSecurity(addTagHandler);

// DELETE /api/news/[slug]/tags - Remove tag from news article
async function removeTagHandler(
  request: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  const params = await context.params;
  const slug = params.slug;

  try {
    const body = await request.json();
    const { tagId } = body;

    if (!tagId) {
      return NextResponse.json({ error: 'Tag ID required' }, { status: 400 });
    }

    const result = await dbAdapter.query('SELECT tags FROM news WHERE slug = $1', [slug], {
      schema: 'content',
    });
    const article = result.rows[0] as NewsArticleTagsRow | undefined;

    if (!article) {
      throw new NotFoundError('News article', slug);
    }

    let existingTags: string[] = [];
    if (article.tags) {
      try {
        existingTags = JSON.parse(article.tags);
      } catch {
        existingTags = [];
      }
    }

    // Remove tag by index (tagId is 1-indexed)
    const tagIndex = tagId - 1;
    if (tagIndex >= 0 && tagIndex < existingTags.length) {
      existingTags.splice(tagIndex, 1);
    }

    await dbAdapter.query(
      'UPDATE news SET tags = $1, updated_at = NOW() WHERE slug = $2',
      [JSON.stringify(existingTags), slug],
      { schema: 'content' }
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error);
  }
}

export const DELETE = withSecurity(removeTagHandler);
