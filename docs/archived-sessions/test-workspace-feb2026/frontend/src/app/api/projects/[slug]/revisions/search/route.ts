import { NextRequest, NextResponse } from 'next/server';
import { projectRevisionsService } from '@/lib/projects/revisions-service';
import { withSecurity } from '@/lib/security/middleware';
import { logger } from '@/lib/utils/logger';

// Mark as dynamic - this endpoint requires runtime database access
export const dynamic = 'force-dynamic';

// GET /api/projects/[slug]/revisions/search - Advanced version search for productivity
async function GETHandler(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const resolvedParams = await params;
    const { searchParams } = new URL(request.url);

    // Advanced search parameters for individual productivity
    const query = searchParams.get('q') || ''; // Search in summary and content
    const author = searchParams.get('author') || ''; // Search by author name
    const dateFrom = searchParams.get('from') || '';
    const dateTo = searchParams.get('to') || '';
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200);
    const includeContent = searchParams.get('includeContent') === 'true';

    // Use ProjectRevisionsService to search revisions
    const revisions = await projectRevisionsService.searchRevisions(resolvedParams.slug, {
      searchTerm: query,
      author,
      dateFrom,
      dateTo,
      limit,
    });

    // Get revision stats for insights
    const stats = await projectRevisionsService.getRevisionStats(resolvedParams.slug);

    // Calculate metrics for each revision
    const enhancedResults = revisions.map((revision, index) => {
      const prevRevision = index < revisions.length - 1 ? revisions[index + 1] : null;
      const sizeChange = prevRevision ? revision.size_bytes - prevRevision.size_bytes : 0;

      let changeCategory = 'minor';
      if (Math.abs(sizeChange) > 1000) changeCategory = 'major';
      else if (Math.abs(sizeChange) > 200) changeCategory = 'moderate';

      // Content preview for search results
      const contentPreview = revision.content
        ? revision.content.substring(0, 300).replace(/\n/g, ' ')
        : '';

      // Calculate word count
      const wordCount = revision.content ? revision.content.trim().split(/\s+/).length : 0;

      // Search relevance scoring
      let relevanceScore = 0;
      if (query) {
        const lowerQuery = query.toLowerCase();
        const summaryMatches = (revision.summary || '').toLowerCase().split(lowerQuery).length - 1;
        const contentMatches = revision.content.toLowerCase().split(lowerQuery).length - 1;
        relevanceScore = summaryMatches * 10 + contentMatches * 2;
      }

      return {
        id: revision.id,
        content: includeContent ? revision.content : undefined,
        summary: revision.summary || 'No summary',
        content_format: revision.content_format,
        author_id: revision.author_id,
        author_name: revision.author_name,
        is_minor: Boolean(revision.is_minor),
        revision_timestamp: revision.revision_timestamp,

        // Enhanced metadata for productivity
        metrics: {
          size_bytes: revision.size_bytes,
          size_change: sizeChange,
          word_count: wordCount,
          char_count: revision.content.length,
          line_count: revision.content.split('\n').length,
          change_category: changeCategory,
          prev_revision_id: prevRevision?.id || null,
        },

        // Search and discovery aids
        search_context: {
          relevance_score: relevanceScore,
          content_preview: contentPreview,
          summary_preview: (revision.summary || '').substring(0, 100),
          matched_terms: query ? extractMatchedTerms(revision, query) : [],
        },
      };
    });

    // Sort by relevance if query provided
    if (query) {
      enhancedResults.sort(
        (a, b) => b.search_context.relevance_score - a.search_context.relevance_score
      );
    }

    // Generate search insights
    const insights = {
      total_found: enhancedResults.length,
      total_revisions: stats.total_revisions,
      search_quality: {
        has_content_matches: enhancedResults.some(r => r.search_context.relevance_score > 2),
        avg_relevance:
          enhancedResults.length > 0
            ? enhancedResults.reduce((sum, r) => sum + r.search_context.relevance_score, 0) /
              enhancedResults.length
            : 0,
      },
      distribution: {
        by_change_type: {
          major: enhancedResults.filter(r => r.metrics.change_category === 'major').length,
          moderate: enhancedResults.filter(r => r.metrics.change_category === 'moderate').length,
          minor: enhancedResults.filter(r => r.metrics.change_category === 'minor').length,
        },
        by_word_count: {
          short: enhancedResults.filter(r => r.metrics.word_count < 100).length,
          medium: enhancedResults.filter(
            r => r.metrics.word_count >= 100 && r.metrics.word_count < 500
          ).length,
          long: enhancedResults.filter(r => r.metrics.word_count >= 500).length,
        },
      },
      suggestions: generateSearchSuggestions(enhancedResults, query, stats),
    };

    return NextResponse.json({
      project_slug: resolvedParams.slug,
      search_params: {
        query,
        author,
        date_from: dateFrom,
        date_to: dateTo,
        include_content: includeContent,
      },
      results: enhancedResults,
      insights,
    });
  } catch (error) {
    logger.error('Error searching revisions:', error);
    return NextResponse.json({ error: 'Failed to search revisions' }, { status: 500 });
  }
}

function extractMatchedTerms(revision: any, query: string): string[] {
  const terms = query
    .toLowerCase()
    .split(/\s+/)
    .filter(t => t.length > 2);
  const content = `${revision.summary || ''} ${revision.content || ''}`.toLowerCase();

  return terms.filter(term => content.includes(term));
}

function generateSearchSuggestions(results: any[], query: string, stats: any): any[] {
  const suggestions = [];

  // If no results, suggest broader search
  if (results.length === 0) {
    if (query) {
      suggestions.push({
        type: 'alternative',
        message: 'Try searching for partial terms or synonyms',
        action: 'simplify_query',
      });
    }
    suggestions.push({
      type: 'info',
      message: `Total revisions available: ${stats.total_revisions}`,
      action: 'clear_filters',
    });
  }

  // If many results, suggest filters
  if (results.length > 50) {
    suggestions.push({
      type: 'narrow',
      message: 'Try adding a date range to focus your search',
      action: 'add_date_range',
    });

    const majorChanges = results.filter(r => r.metrics.change_category === 'major').length;
    if (majorChanges > 5) {
      suggestions.push({
        type: 'filter',
        message: `Found ${majorChanges} major changes - filter by major changes only?`,
        action: 'filter_major_changes',
      });
    }
  }

  // Content-based suggestions
  const highWordCount = results.filter(r => r.metrics.word_count > 1000).length;
  if (highWordCount > 0) {
    suggestions.push({
      type: 'insight',
      message: `${highWordCount} substantial revisions found - these might be key milestones`,
      action: 'highlight_substantial',
    });
  }

  return suggestions;
}

// Apply security middleware
export const GET = withSecurity(GETHandler, {});
