import { dbAdapter } from '@/lib/database/adapter';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/server';
import { wikiAutoCategorizer } from '@/lib/wiki/auto-categorization';
import { withSecurity } from '@/lib/security/middleware';
import { logger } from '@/lib/utils/logger';

// Mark as dynamic - this endpoint requires runtime database access
export const dynamic = 'force-dynamic';

/**
 * Result types for auto-categorization API
 */
interface SinglePageAnalysisResult {
  type: 'single-page-analysis';
  pageId: number;
  pageTitle: string;
  suggestion: string | null;
  confidence: number;
  reasoning: string;
  wouldApply: boolean;
}

interface SinglePageCategorizationResult {
  type: 'single-page-categorization';
  pageId: number;
  success: boolean;
  message: string;
}

interface BulkCategorizationResult {
  type: 'bulk-categorization';
  dryRun: boolean;
  processed: number;
  categorized: number;
  errors: number | { pageId: number; error: string }[];
  minConfidence: number;
  summary: string;
  wouldCategorize?: number; // Only present in dry run mode
}

type AutoCategorizeResult =
  | SinglePageAnalysisResult
  | SinglePageCategorizationResult
  | BulkCategorizationResult;

/**
 * API endpoint for manually triggering wiki auto-categorization
 *
 * POST /api/wiki/auto-categorize
 *
 * Body (optional):
 * {
 *   "pageId": number,        // Categorize specific page
 *   "dryRun": boolean,       // Just analyze without applying changes
 *   "minConfidence": number  // Minimum confidence threshold (0.0-1.0)
 * }
 *
 * Requires admin privileges.
 */
async function postHandler(request: NextRequest) {
  try {
    // Check authentication and admin privileges
    const authResult = await requireAuth(request);
    if (authResult.response) {
      return authResult.response;
    }

    const user = authResult.user;
    if (user.role !== 'admin') {
      return NextResponse.json(
        {
          success: false,
          error: 'Admin privileges required for auto-categorization',
        },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { pageId, dryRun = false, minConfidence = 0.4 } = body;

    // Validate minConfidence
    if (typeof minConfidence !== 'number' || minConfidence < 0 || minConfidence > 1) {
      return NextResponse.json(
        {
          success: false,
          error: 'minConfidence must be a number between 0 and 1',
        },
        { status: 400 }
      );
    }

    let results: AutoCategorizeResult;

    if (pageId) {
      // Categorize specific page
      if (typeof pageId !== 'number' || pageId <= 0) {
        return NextResponse.json(
          {
            success: false,
            error: 'pageId must be a positive number',
          },
          { status: 400 }
        );
      }

      if (dryRun) {
        // Just analyze the page without applying changes
        const pageData = await getPageForAnalysis(pageId);
        if (!pageData) {
          return NextResponse.json(
            {
              success: false,
              error: 'Page not found or already categorized',
            },
            { status: 404 }
          );
        }

        const analysis = await wikiAutoCategorizer.categorizePage(pageData);

        results = {
          type: 'single-page-analysis',
          pageId,
          pageTitle: pageData.title,
          suggestion: analysis.suggestedCategory,
          confidence: analysis.confidence,
          reasoning: analysis.reasoning,
          wouldApply: analysis.confidence >= minConfidence,
        };
      } else {
        // Actually categorize the page
        const success = await wikiAutoCategorizer.autoCategorizePage(pageId);
        results = {
          type: 'single-page-categorization',
          pageId,
          success,
          message: success
            ? 'Page categorized successfully'
            : 'Page was not categorized (may already have categories or analysis failed)',
        };
      }
    } else {
      // Categorize all orphaned pages
      const categorizeResults = await wikiAutoCategorizer.categorizeOrphanedPages();

      const bulkResult: BulkCategorizationResult = {
        type: 'bulk-categorization',
        dryRun,
        processed: categorizeResults.processed,
        categorized: dryRun ? 0 : categorizeResults.categorized,
        errors: categorizeResults.errors,
        minConfidence,
        summary: `Processed ${categorizeResults.processed} orphaned pages, ${dryRun ? 'would categorize' : 'categorized'} ${categorizeResults.categorized} pages`,
      };

      // If dry run, simulate what would be done
      if (dryRun) {
        bulkResult.wouldCategorize = categorizeResults.categorized;
        bulkResult.categorized = 0;
      }

      results = bulkResult;
    }

    return NextResponse.json({
      success: true,
      data: results,
      message: dryRun ? 'Analysis complete (no changes made)' : 'Auto-categorization complete',
    });
  } catch (error: any) {
    logger.error('Auto-categorization API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Auto-categorization failed',
        message: error.message,
      },
      { status: 500 }
    );
  }
}

/**
 * Get page data for analysis
 */
async function getPageForAnalysis(pageId: number): Promise<{
  title: string;
  content: string;
  slug: string;
  namespace: string;
} | null> {
  // Check if page exists and is not already categorized
  const pageCheckResult = await dbAdapter.query(
    `
      SELECT
        wp.id,
        wp.title,
        wp.slug,
        wp.namespace,
        COUNT(wpc.page_id) as category_count
      FROM wiki_pages wp
      LEFT JOIN wiki_page_categories wpc ON wp.id = wpc.page_id
      WHERE wp.id = $1 AND wp.status = 'published'
      GROUP BY wp.id, wp.title, wp.slug, wp.namespace
    `,
    [pageId],
    { schema: 'wiki' }
  );
  const pageCheck = pageCheckResult.rows[0];

  if (!pageCheck || (pageCheck.category_count || 0) > 0) {
    return null; // Page not found or already categorized
  }

  // Get the latest content
  const revisionResult = await dbAdapter.query(
    `
      SELECT content FROM wiki_revisions
      WHERE page_id = $1
      ORDER BY id DESC
      LIMIT 1
    `,
    [pageId],
    { schema: 'wiki' }
  );
  const revision = revisionResult.rows[0];

  return {
    title: pageCheck.title,
    content: revision?.content || '',
    slug: pageCheck.slug,
    namespace: pageCheck.namespace || 'main',
  };
}

/**
 * GET endpoint to show auto-categorization status and rules
 */
async function getHandler(request: NextRequest) {
  try {
    // Check authentication
    const authResult = await requireAuth(request);
    if (authResult.response) {
      return authResult.response;
    }

    const user = authResult.user;
    if (user.role !== 'admin') {
      return NextResponse.json(
        {
          success: false,
          error: 'Admin privileges required',
        },
        { status: 403 }
      );
    }

    // Get orphaned pages count
    const orphanedCountResult = await dbAdapter.query(
      `
      SELECT COUNT(*) as count
      FROM wiki_pages wp
      LEFT JOIN wiki_page_categories wpc ON wp.id = wpc.page_id
      WHERE wpc.page_id IS NULL
      AND wp.status = 'published'
    `,
      [],
      { schema: 'wiki' }
    );
    const orphanedCount = orphanedCountResult.rows[0]?.count || 0;

    // Get categorization rules
    const rules = wikiAutoCategorizer.getRules();

    return NextResponse.json({
      success: true,
      data: {
        orphanedPagesCount: orphanedCount,
        rulesCount: rules.length,
        rules: rules.map(rule => ({
          categoryId: rule.categoryId,
          weight: rule.weight,
          description: rule.description,
          patternTypes: Object.keys(rule.patterns),
        })),
        status: orphanedCount > 0 ? 'orphaned-pages-found' : 'all-pages-categorized',
      },
    });
  } catch (error: any) {
    logger.error('Auto-categorization status API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get auto-categorization status',
        message: error.message,
      },
      { status: 500 }
    );
  }
}

export const GET = withSecurity(getHandler, {
  enableCSRF: true,
});

export const POST = withSecurity(postHandler, {
  enableCSRF: true,
});
