/**
 * GET /api/documents/[slug]/translations
 *
 * Get all language versions (translations) of a document
 * Used by language switcher component
 *
 * Path Parameters:
 * - slug: string - Document slug
 *
 * Returns all documents with the same translation_group_id
 * Ordered with English first, then alphabetical
 */

import { NextRequest, NextResponse } from 'next/server';
import { dbAdapter } from '@/lib/database/adapter';
import { logger } from '@/lib/utils/logger';

interface RouteParams {
  params: {
    slug: string;
  };
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { slug } = params;

    if (!slug) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing slug parameter',
        },
        { status: 400 }
      );
    }

    // Find translation_group_id for this document
    const getGroupResult = await dbAdapter.query(
      `
      SELECT translation_group_id
      FROM (
        SELECT translation_group_id FROM library.library_documents WHERE slug = $1
        UNION ALL
        SELECT translation_group_id FROM anarchist.documents WHERE slug = $1
      ) combined
      WHERE translation_group_id IS NOT NULL
      LIMIT 1
    `,
      [slug]
    );

    if (!getGroupResult.rows || getGroupResult.rows.length === 0) {
      // Document has no translations
      return NextResponse.json({
        success: true,
        data: {
          translation_group_id: null,
          translations: [],
          languages: [],
          total: 0,
        },
      });
    }

    const translationGroupId = getGroupResult.rows[0].translation_group_id;

    // Get all translations in this group
    const translationsResult = await dbAdapter.query(
      `
      SELECT
        id::text,
        source,
        slug,
        title,
        language,
        author,
        publication_date
      FROM (
        SELECT
          id, 'library' as source, slug, title, language, author, publication_date
        FROM library.library_documents
        WHERE translation_group_id = $1

        UNION ALL

        SELECT
          id, 'anarchist' as source, slug, title, language, author, publication_date
        FROM anarchist.documents
        WHERE translation_group_id = $1
      ) combined
      ORDER BY
        CASE WHEN language = 'en' THEN 0 ELSE 1 END,
        language
    `,
      [translationGroupId]
    );

    if (!translationsResult.rows) {
      return NextResponse.json({
        success: true,
        data: {
          translation_group_id: translationGroupId,
          translations: [],
          languages: [],
          total: 0,
        },
      });
    }

    const translations = translationsResult.rows.map(row => ({
      id: row.id,
      source: row.source,
      slug: row.slug,
      title: row.title,
      language: row.language,
      author: row.author,
      publication_date: row.publication_date,
    }));

    const languages = [...new Set(translations.map(t => t.language))];

    return NextResponse.json({
      success: true,
      data: {
        translation_group_id: translationGroupId,
        translations,
        languages,
        total: translations.length,
      },
    });
  } catch (error) {
    logger.error('[/api/documents/[slug]/translations] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch translations',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export const dynamic = 'force-dynamic';
export const revalidate = 0;
