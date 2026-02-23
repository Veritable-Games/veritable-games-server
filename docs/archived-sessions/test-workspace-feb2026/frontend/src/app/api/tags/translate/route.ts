import { NextRequest, NextResponse } from 'next/server';
import { withSecurity } from '@/lib/security/middleware';
import { dbAdapter } from '@/lib/database/adapter';
import { z } from 'zod';
import { logger } from '@/lib/utils/logger';

// Mark as dynamic - this endpoint requires runtime database access
export const dynamic = 'force-dynamic';

// Validation schema
const translateRequestSchema = z.object({
  tagNames: z.array(z.string()).min(1),
  targetLanguage: z.string().min(2).max(10),
  sourceLanguage: z.string().min(2).max(10).optional(),
});

/**
 * POST /api/tags/translate
 *
 * Translate tag names to their equivalents in a target language
 *
 * Request body:
 * {
 *   tagNames: string[],          // Tag names to translate (e.g., ["anarchism", "feminism"])
 *   targetLanguage: string,      // Target language code (e.g., "es")
 *   sourceLanguage?: string      // Optional source language hint (e.g., "en")
 * }
 *
 * Response:
 * {
 *   translations: {
 *     "anarchism": "anarquismo",
 *     "feminism": "feminismo"
 *   },
 *   unmapped: ["some-tag-without-translation"]
 * }
 */
export const POST = withSecurity(async (request: NextRequest) => {
  try {
    const body = await request.json();

    // Validate request
    const validation = translateRequestSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: validation.error.issues,
        },
        { status: 400 }
      );
    }

    const { tagNames, targetLanguage, sourceLanguage } = validation.data;

    logger.debug(
      `[tags/translate] Translating ${tagNames.length} tags to ${targetLanguage}${sourceLanguage ? ` from ${sourceLanguage}` : ''}`
    );

    // Get source tag IDs
    const sourceTagsResult = await dbAdapter.query(
      `
      SELECT id, name
      FROM shared.tags
      WHERE name = ANY($1)
    `,
      [tagNames],
      { schema: 'shared' }
    );

    const sourceTags = sourceTagsResult.rows;
    const sourceTagMap = new Map(sourceTags.map(tag => [tag.name, tag.id]));

    if (sourceTags.length === 0) {
      return NextResponse.json({
        translations: {},
        unmapped: tagNames,
      });
    }

    // Query translations using tag_translations table
    const translationsResult = await dbAdapter.query(
      `
      SELECT
        st.name as source_tag,
        tt.name as target_tag,
        tr.confidence_score
      FROM shared.tag_translations tr
      JOIN shared.tags st ON tr.source_tag_id = st.id
      JOIN shared.tags tt ON tr.target_tag_id = tt.id
      WHERE st.id = ANY($1)
        AND tr.target_language = $2
        ${sourceLanguage ? 'AND tr.source_language = $3' : ''}
      ORDER BY tr.confidence_score DESC
    `,
      sourceLanguage
        ? [sourceTags.map(t => t.id), targetLanguage, sourceLanguage]
        : [sourceTags.map(t => t.id), targetLanguage],
      { schema: 'shared' }
    );

    const translationRows = translationsResult.rows;

    // Build translations map (source_tag_name -> target_tag_name)
    const translations: Record<string, string> = {};
    const mapped = new Set<string>();

    for (const row of translationRows) {
      if (!translations[row.source_tag]) {
        translations[row.source_tag] = row.target_tag;
        mapped.add(row.source_tag);
      }
    }

    // Find unmapped tags
    const unmapped = tagNames.filter(name => !mapped.has(name));

    logger.debug(
      `[tags/translate] Translated ${Object.keys(translations).length}/${tagNames.length} tags, ${unmapped.length} unmapped`
    );

    return NextResponse.json({
      translations,
      unmapped,
    });
  } catch (error: any) {
    logger.error('Failed to translate tags:', error);
    return NextResponse.json(
      { error: 'Failed to translate tags', details: error.message },
      { status: 500 }
    );
  }
});
