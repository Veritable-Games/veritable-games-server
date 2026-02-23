/**
 * GET /api/documents/languages
 *
 * Get all available languages with document counts
 * Used to populate language filter dropdown
 *
 * Returns array of languages sorted by document count (highest first)
 * Each includes counts from both library and anarchist collections
 */

import { NextRequest, NextResponse } from 'next/server';
import { unifiedDocumentService } from '@/lib/documents/service';
import { logger } from '@/lib/utils/logger';

export async function GET(request: NextRequest) {
  try {
    const languages = await unifiedDocumentService.getAvailableLanguages();

    return NextResponse.json({
      success: true,
      data: languages,
    });
  } catch (error) {
    logger.error('[/api/documents/languages] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch languages',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export const dynamic = 'force-dynamic';
export const revalidate = 0;
