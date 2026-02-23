/**
 * Unified Search Service
 *
 * Provides cross-archive search capability combining:
 * 1. Main Library (user-uploaded documents)
 * 2. Anarchist Library (24,643 texts from global anarchist network)
 *
 * Enables single search interface across all document collections.
 */

import { libraryService } from '@/lib/library/service';
import { anarchistService } from '@/lib/anarchist/service';
import { logger } from '@/lib/utils/logger';

export interface UnifiedDocument {
  id: number | string;
  source: 'library' | 'anarchist'; // Which archive it comes from
  slug: string;
  title: string;
  author?: string;
  language?: string;
  description?: string; // For library
  category?: string;
  view_count?: number;
  created_at: string;
  preview?: string; // First 200 chars of content
}

/**
 * Library document without source field
 * Used for temporary placeholder until library service methods are implemented
 */
type LibraryDocumentWithoutSource = Omit<UnifiedDocument, 'source'>;

export interface UnifiedSearchResult {
  results: UnifiedDocument[];
  summary: {
    total: number;
    from_library: number;
    from_anarchist: number;
    query: string;
    search_time_ms: number;
  };
}

export class UnifiedSearchService {
  /**
   * Search across both libraries
   */
  async searchAll(
    query: string,
    limit: number = 50,
    includeAnarchist: boolean = true,
    includeLibrary: boolean = true
  ): Promise<UnifiedSearchResult> {
    const startTime = Date.now();
    const results: UnifiedDocument[] = [];

    try {
      // Search both archives in parallel
      const [libraryResults, anarchistResults] = await Promise.all([
        includeLibrary
          ? libraryService.getDocuments({ query, limit }).then(result => result.documents)
          : Promise.resolve([]),
        includeAnarchist ? anarchistService.search(query, limit) : Promise.resolve([]),
      ]);

      // Transform library results
      if (includeLibrary && libraryResults && Array.isArray(libraryResults)) {
        for (const doc of libraryResults) {
          results.push({
            id: doc.id,
            source: 'library',
            slug: doc.slug,
            title: doc.title,
            author: doc.author ?? undefined,
            description: doc.notes ?? undefined,
            category: undefined, // Note: categories removed in schema migration (Nov 24, 2025)
            view_count: doc.view_count,
            created_at: doc.created_at,
            preview: doc.notes ? doc.notes.substring(0, 200) : undefined,
          });
        }
      }

      // Transform anarchist results
      if (includeAnarchist && anarchistResults && Array.isArray(anarchistResults)) {
        for (const doc of anarchistResults) {
          results.push({
            id: doc.id,
            source: 'anarchist',
            slug: doc.slug,
            title: doc.title,
            author: doc.author,
            language: doc.language,
            category: doc.category,
            view_count: doc.view_count,
            created_at: doc.created_at,
          });
        }
      }

      // Sort by relevance (view count as proxy)
      results.sort((a, b) => (b.view_count || 0) - (a.view_count || 0));

      // Limit results
      const limitedResults = results.slice(0, limit);

      const searchTimeMs = Date.now() - startTime;

      return {
        results: limitedResults,
        summary: {
          total: limitedResults.length,
          from_library: limitedResults.filter(r => r.source === 'library').length,
          from_anarchist: limitedResults.filter(r => r.source === 'anarchist').length,
          query,
          search_time_ms: searchTimeMs,
        },
      };
    } catch (error) {
      logger.error('Unified search failed', { query, error });
      return {
        results: [],
        summary: {
          total: 0,
          from_library: 0,
          from_anarchist: 0,
          query,
          search_time_ms: Date.now() - startTime,
        },
      };
    }
  }

  /**
   * Get statistics about both archives
   */
  async getArchiveStats() {
    try {
      const [libraryStats, anarchistStats] = await Promise.all([
        // Get from library (would need to add this method to library service)
        Promise.resolve({ total_documents: 0, contributors: 0 }),
        anarchistService.getArchiveStats(),
      ]);

      return {
        library: libraryStats,
        anarchist: anarchistStats,
        total_documents: (libraryStats.total_documents || 0) + anarchistStats.total_documents,
        total_languages: anarchistStats.total_languages,
        last_updated: new Date().toISOString(),
      };
    } catch (error) {
      logger.error('Failed to get archive statistics', error);
      return null;
    }
  }

  /**
   * Get documents by language (anarchist only)
   */
  async getByLanguage(language: string, limit: number = 100) {
    return anarchistService.getDocumentsByLanguage(language, limit);
  }

  /**
   * Get available languages (anarchist only)
   */
  async getLanguages() {
    return anarchistService.getAvailableLanguages();
  }

  /**
   * Get recent documents from both archives
   */
  async getRecent(limit: number = 20) {
    try {
      const [recentLibrary, recentAnarchist] = await Promise.all([
        // Would need to add this to library service
        Promise.resolve([] as LibraryDocumentWithoutSource[]),
        anarchistService.getRecentDocuments(limit / 2),
      ]);

      const combined = [
        ...recentLibrary.map(doc => ({
          ...doc,
          source: 'library' as const,
        })),
        ...recentAnarchist.map(doc => ({
          ...doc,
          source: 'anarchist' as const,
        })),
      ];

      // Sort by date, most recent first
      combined.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      return combined.slice(0, limit);
    } catch (error) {
      logger.error('Failed to get recent documents', error);
      return [];
    }
  }

  /**
   * Get most viewed documents from both archives
   */
  async getMostViewed(limit: number = 20) {
    try {
      const [viewedLibrary, viewedAnarchist] = await Promise.all([
        // Would need to add this to library service
        Promise.resolve([] as LibraryDocumentWithoutSource[]),
        anarchistService.getMostViewedDocuments(limit / 2),
      ]);

      const combined = [
        ...viewedLibrary.map(doc => ({
          ...doc,
          source: 'library' as const,
        })),
        ...viewedAnarchist.map(doc => ({
          ...doc,
          source: 'anarchist' as const,
        })),
      ];

      // Sort by view count
      combined.sort((a, b) => (b.view_count || 0) - (a.view_count || 0));

      return combined.slice(0, limit);
    } catch (error) {
      logger.error('Failed to get most viewed documents', error);
      return [];
    }
  }
}

// Export singleton instance
export const unifiedSearchService = new UnifiedSearchService();
