/**
 * Unified Document Service
 *
 * Provides unified interface for querying and managing documents from both
 * library (user-uploaded) and anarchist (archived) collections.
 *
 * Features:
 * - Parallel queries across both schemas
 * - Content loading (DB vs filesystem)
 * - Translation support
 * - Full-text search with ranking
 * - Language/tag filtering
 */

import { dbAdapter } from '@/lib/database/adapter';
import { anarchistService } from '@/lib/anarchist/service';
import { libraryService } from '@/lib/library/service';
import { logger } from '@/lib/utils/logger';
import type {
  UnifiedDocument,
  UnifiedSearchParams,
  UnifiedSearchResult,
  UnifiedDocumentWithContent,
  TranslationGroup,
  DocumentTranslation,
  LanguageInfo,
  ArchiveStats,
} from './types';

/**
 * Extended document type with optional source-specific fields
 * Library documents have 'description', anarchist documents have 'notes'
 */
interface SourceDocument {
  description?: string;
  notes?: string;
  [key: string]: any;
}

export class UnifiedDocumentService {
  private cache: Map<string, any> = new Map();
  private cacheTimeout = 3600000; // 1 hour

  // ========================================================================
  // CORE DOCUMENT QUERIES
  // ========================================================================

  /**
   * Get paginated documents from both collections
   * Merges results from library and anarchist, applies filtering/sorting
   */
  async getDocuments(params: UnifiedSearchParams = {}): Promise<UnifiedSearchResult> {
    const {
      query,
      language,
      tags,
      source = 'all',
      sort_by = 'title',
      sort_order = 'asc',
      page = 1,
      limit = 50,
      userRole,
    } = params;

    const startTime = Date.now();
    const offset = (page - 1) * limit;

    try {
      // Query both sources in parallel
      // FIXED: Pass full limit to both sources, then merge and sort to get best matches
      // Natural sorting determines which documents appear first based on sort criteria
      // This removes artificial barriers - all documents are equally accessible
      const [libraryResults, anarchistResults] = await Promise.all([
        source !== 'anarchist'
          ? this.queryLibrary({
              query,
              language,
              tags,
              sort_by,
              sort_order,
              limit, // Pass FULL limit
              offset,
              userRole,
            })
          : Promise.resolve({ documents: [], total: 0 }),
        source !== 'library'
          ? this.queryAnarchist({
              query,
              language,
              tags,
              sort_by,
              sort_order,
              limit, // Pass FULL limit
              offset,
              userRole,
            })
          : Promise.resolve({ documents: [], total: 0 }),
      ]);

      // Log detailed results for debugging
      logger.info('[UnifiedDocumentService] Query results:', {
        source,
        page,
        limit,
        offset,
        userRole: userRole || 'anonymous',
        libraryDocuments: libraryResults.documents.length,
        libraryTotal: libraryResults.total,
        anarchistDocuments: anarchistResults.documents.length,
        anarchistTotal: anarchistResults.total,
        query: query || '(no query)',
        language: language || '(all)',
      });

      // Merge results from both sources (may be up to 2x limit documents)
      let allDocuments = [...libraryResults.documents, ...anarchistResults.documents];

      // Deduplicate documents by source+id (prevents duplication from offset miscalculations)
      const seen = new Set<string>();
      allDocuments = allDocuments.filter(doc => {
        const key = `${doc.source}-${doc.id}`;
        if (seen.has(key)) {
          return false;
        }
        seen.add(key);
        return true;
      });

      // Re-sort merged results (since we got both separately)
      // FIX: Use stable sort to prevent random document ordering
      allDocuments.sort((a, b) => {
        const direction = sort_order === 'asc' ? 1 : -1;
        let comparison = 0;

        switch (sort_by) {
          case 'title':
            comparison = a.title.localeCompare(b.title);
            break;
          case 'author':
            comparison = (a.author || '').localeCompare(b.author || '');
            break;
          case 'publication_date':
            comparison = (a.publication_date || '' || '').localeCompare(
              b.publication_date || '' || ''
            );
            break;
          case 'created_at':
            comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
            break;
          case 'view_count':
            comparison = (a.view_count || 0) - (b.view_count || 0);
            break;
          case 'source-library-first':
            // Sort by source: library first, then anarchist
            const aSourceLibFirst = a.source || 'library';
            const bSourceLibFirst = b.source || 'library';
            if (aSourceLibFirst === bSourceLibFirst) {
              comparison = 0;
            } else if (aSourceLibFirst === 'library') {
              comparison = -1; // Library sorts before anarchist
            } else {
              comparison = 1; // Anarchist sorts after library
            }
            // Secondary sort by title for documents with same source
            if (comparison === 0) {
              comparison = a.title.localeCompare(b.title);
            }
            break;
          case 'source-anarchist-first':
            // Sort by source: anarchist first, then library
            const aSourceAnFirst = a.source || 'library';
            const bSourceAnFirst = b.source || 'library';
            if (aSourceAnFirst === bSourceAnFirst) {
              comparison = 0;
            } else if (aSourceAnFirst === 'anarchist') {
              comparison = -1; // Anarchist sorts before library
            } else {
              comparison = 1; // Library sorts after anarchist
            }
            // Secondary sort by title for documents with same source
            if (comparison === 0) {
              comparison = a.title.localeCompare(b.title);
            }
            break;
          default:
            comparison = 0;
        }

        // Tiebreaker: sort by ID for stable sorting
        if (comparison === 0) {
          comparison = String(a.id).localeCompare(String(b.id));
        }

        return direction * comparison;
      });

      // Return exactly 'limit' documents from merged and sorted results
      // Natural sorting means best matches appear first regardless of source
      const paginatedDocuments = allDocuments.slice(0, limit);
      const total = Number(libraryResults.total) + Number(anarchistResults.total);

      return {
        documents: paginatedDocuments,
        pagination: {
          page,
          limit,
          total,
          total_pages: Math.ceil(total / limit),
          has_more: page < Math.ceil(total / limit),
        },
        metadata: {
          search_time_ms: Date.now() - startTime,
          results_from_library: libraryResults.documents.length,
          results_from_anarchist: anarchistResults.documents.length,
        },
      };
    } catch (error) {
      logger.error('[UnifiedDocumentService] getDocuments error:', error);
      throw error;
    }
  }

  /**
   * Get total count of documents matching the given filters
   * Used for virtual scrolling to set totalCount upfront
   * Does NOT fetch actual documents, just counts
   */
  async getDocumentCount(
    params: Omit<UnifiedSearchParams, 'page' | 'limit'> = {}
  ): Promise<number> {
    const { query, language, tags, source = 'all' } = params;

    try {
      // Query both sources in parallel for counts only
      const [libraryCount, anarchistCount] = await Promise.all([
        source !== 'anarchist'
          ? this.queryLibraryCount({ query, language, tags })
          : Promise.resolve(0),
        source !== 'library'
          ? this.queryAnarchistCount({ query, language, tags })
          : Promise.resolve(0),
      ]);

      const total = libraryCount + anarchistCount;

      logger.info('[UnifiedDocumentService] getDocumentCount:', {
        source,
        query: query || '(no query)',
        language: language || '(all)',
        tags: tags?.length || 0,
        libraryCount,
        anarchistCount,
        total,
      });

      return total;
    } catch (error) {
      logger.error('[UnifiedDocumentService] getDocumentCount error:', error);
      return 0;
    }
  }

  /**
   * Get ALL documents from both collections without pagination
   * Used for virtual scrolling/full-list rendering with react-virtuoso
   * Returns complete merged and sorted dataset
   */
  async getAllDocuments(
    params: Omit<UnifiedSearchParams, 'page' | 'limit'> = {}
  ): Promise<UnifiedSearchResult> {
    const {
      query,
      language,
      tags,
      source = 'all',
      sort_by = 'title',
      sort_order = 'asc',
      userRole,
    } = params;

    const startTime = Date.now();
    const cacheKey = `all_docs_${source}_${query || ''}_${language || ''}_${tags?.join(',') || ''}_${sort_by}_${sort_order}`;

    // Check cache (5 minute TTL)
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < 300000) {
      logger.info('[UnifiedDocumentService] getAllDocuments returning cached results');
      return cached.data;
    }

    try {
      // Query both sources in parallel WITHOUT pagination limits
      const [libraryResults, anarchistResults] = await Promise.all([
        source !== 'anarchist'
          ? this.queryLibrary({
              query,
              language,
              tags,
              sort_by,
              sort_order,
              limit: 999999,
              userRole,
            })
          : Promise.resolve({ documents: [], total: 0 }),
        source !== 'library'
          ? this.queryAnarchist({
              query,
              language,
              tags,
              sort_by,
              sort_order,
              limit: 999999,
              userRole,
            })
          : Promise.resolve({ documents: [], total: 0 }),
      ]);

      // Log results for debugging
      logger.info('[UnifiedDocumentService] getAllDocuments results:', {
        source,
        totalLibraryDocuments: libraryResults.documents.length,
        totalAnarchistDocuments: anarchistResults.documents.length,
        totalMerged: libraryResults.documents.length + anarchistResults.documents.length,
        query: query || '(no query)',
        language: language || '(all)',
      });

      // Merge documents from both sources
      const allDocuments = [...libraryResults.documents, ...anarchistResults.documents];

      // Sort merged results
      allDocuments.sort((a, b) => {
        const direction = sort_order === 'asc' ? 1 : -1;
        let comparison = 0;

        switch (sort_by) {
          case 'title':
            comparison = a.title.localeCompare(b.title);
            break;
          case 'author':
            comparison = (a.author || '').localeCompare(b.author || '');
            break;
          case 'publication_date':
            comparison = (a.publication_date || '' || '').localeCompare(
              b.publication_date || '' || ''
            );
            break;
          case 'created_at':
            comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
            break;
          case 'view_count':
            comparison = (a.view_count || 0) - (b.view_count || 0);
            break;
          default:
            comparison = 0;
        }

        // Tiebreaker: sort by ID for stable sorting
        if (comparison === 0) {
          comparison = String(a.id).localeCompare(String(b.id));
        }

        return direction * comparison;
      });

      const total = Number(libraryResults.total) + Number(anarchistResults.total);

      const result = {
        documents: allDocuments,
        pagination: {
          page: 1,
          limit: allDocuments.length,
          total,
          total_pages: 1,
          has_more: false,
        },
        metadata: {
          search_time_ms: Date.now() - startTime,
          results_from_library: libraryResults.documents.length,
          results_from_anarchist: anarchistResults.documents.length,
        },
      };

      // Cache the result
      this.cache.set(cacheKey, {
        data: result,
        timestamp: Date.now(),
      });

      return result;
    } catch (error) {
      logger.error('[UnifiedDocumentService] getAllDocuments error:', error);
      throw error;
    }
  }

  /**
   * Query library collection
   * @private
   */
  private async queryLibrary(params: any) {
    try {
      const { userRole, ...restParams } = params;
      // Use library service
      // Note: status parameter removed - all library documents are published by default
      const result = await libraryService.getDocuments(restParams, userRole);

      if (!result || !Array.isArray(result.documents)) {
        logger.warn('[UnifiedDocumentService] queryLibrary returned invalid result:', {
          hasResult: !!result,
          isArray: Array.isArray(result?.documents),
          resultKeys: result ? Object.keys(result) : 'null',
        });
        return { documents: [], total: 0 };
      }

      return {
        documents: (result.documents || []).map(doc => {
          // Normalize library documents to UnifiedDocument format
          // Library uses null for empty optional fields, but UnifiedDocument expects undefined
          const sourceDoc = doc as SourceDocument;
          return {
            ...doc,
            source: 'library' as const,
            author: doc.author || undefined,
            language: doc.language || 'en',
            publication_date: doc.publication_date || undefined,
            description: sourceDoc.description || sourceDoc.notes || undefined, // library has 'description', anarchist has 'notes'
            document_type: doc.document_type || undefined,
            source_url: doc.source_url || undefined, // Normalize null to undefined
            original_format: doc.original_format || undefined, // Normalize null to undefined
            created_by: doc.created_by || undefined, // Normalize null to undefined
            reconversion_status: doc.reconversion_status || null, // Reconversion status for library documents
            is_public: doc.is_public !== undefined ? Boolean(doc.is_public) : true, // Visibility control
          };
        }),
        total: result.pagination?.total || 0,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : '';

      logger.error('[UnifiedDocumentService] queryLibrary failed:', {
        message: errorMessage,
        stack: errorStack,
        params,
        timestamp: new Date().toISOString(),
      });
      return { documents: [], total: 0 };
    }
  }

  /**
   * Query anarchist collection
   * @private
   */
  private async queryAnarchist(params: any) {
    try {
      const { userRole, ...restParams } = params;
      // Use anarchist service
      const result = await anarchistService.getDocuments(restParams, userRole);

      if (!result || !Array.isArray(result.documents)) {
        logger.warn('[UnifiedDocumentService] queryAnarchist returned invalid result:', {
          hasResult: !!result,
          isArray: Array.isArray(result?.documents),
          resultKeys: result ? Object.keys(result) : 'null',
        });
        return { documents: [], total: 0 };
      }

      return {
        documents: (result.documents || []).map(doc => {
          // Normalize anarchist documents to UnifiedDocument format
          // Anarchist uses 'notes' field, but UnifiedDocument expects 'description'
          return {
            ...doc,
            source: 'anarchist' as const,
            description: doc.notes || undefined,
            is_public: doc.is_public !== undefined ? Boolean(doc.is_public) : true,
          };
        }),
        total: result.pagination?.total || 0,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : '';

      logger.error('[UnifiedDocumentService] queryAnarchist failed:', {
        message: errorMessage,
        stack: errorStack,
        params,
        timestamp: new Date().toISOString(),
      });

      // Return empty results instead of throwing
      // This allows partial results if library documents loaded successfully
      return { documents: [], total: 0 };
    }
  }

  /**
   * Get count from library collection
   * @private
   */
  private async queryLibraryCount(params: any): Promise<number> {
    try {
      const result = await libraryService.getDocuments({
        status: 'published',
        ...params,
        limit: 0, // Don't fetch documents, just get count
      });
      return Number(result.pagination?.total || 0);
    } catch (error) {
      logger.error('[UnifiedDocumentService] queryLibraryCount failed:', error);
      return 0;
    }
  }

  /**
   * Get count from anarchist collection
   * @private
   */
  private async queryAnarchistCount(params: any): Promise<number> {
    try {
      const result = await anarchistService.getDocuments({
        ...params,
        limit: 0, // Don't fetch documents, just get count
      });
      return Number(result.pagination?.total || 0);
    } catch (error) {
      logger.error('[UnifiedDocumentService] queryAnarchistCount failed:', error);
      return 0;
    }
  }

  // ========================================================================
  // DOCUMENT DETAIL QUERIES
  // ========================================================================

  /**
   * Get single document by slug, auto-detecting source
   * Loads content from appropriate source (DB for library, filesystem for anarchist)
   */
  async getDocumentBySlug(slug: string): Promise<UnifiedDocumentWithContent | null> {
    try {
      // Try library first (faster - content in DB)
      const libraryDoc = await libraryService.getDocumentBySlug(slug);
      if (libraryDoc) {
        return {
          ...libraryDoc,
          source: 'library',
          content: libraryDoc.content || '',
          // Normalize null to undefined for type consistency
          author: libraryDoc.author || undefined,
          language: libraryDoc.language || 'en',
          publication_date: libraryDoc.publication_date || undefined,
          description: libraryDoc.notes || undefined,
          source_url: libraryDoc.source_url || undefined,
          original_format: libraryDoc.original_format || undefined,
          created_by: libraryDoc.created_by || undefined,
        };
      }

      // Try anarchist (content from filesystem)
      const anarchistDoc = await anarchistService.getDocumentBySlug(slug);
      if (anarchistDoc) {
        return {
          ...anarchistDoc,
          source: 'anarchist',
          content: anarchistDoc.content || '',
          description: anarchistDoc.notes || undefined,
        };
      }

      return null;
    } catch (error) {
      logger.error('[UnifiedDocumentService] getDocumentBySlug error:', error);
      return null;
    }
  }

  // ========================================================================
  // TRANSLATION SUPPORT
  // ========================================================================

  /**
   * Get all translations of a document
   * Returns all language versions for a translation group
   */
  async getTranslations(translationGroupId: string): Promise<TranslationGroup | null> {
    try {
      // Check cache first
      const cacheKey = `translations:${translationGroupId}`;
      const cached = this.cache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
        return cached.data;
      }

      // Query both schemas
      const result = await dbAdapter.query(
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

      if (!result.rows || result.rows.length === 0) {
        return null;
      }

      const translations: DocumentTranslation[] = result.rows.map(row => ({
        id: row.id,
        source: row.source,
        slug: row.slug,
        title: row.title,
        language: row.language,
        author: row.author,
        publication_date: row.publication_date,
      }));

      const languages = [...new Set(translations.map(t => t.language))];

      const translationGroup: TranslationGroup = {
        translation_group_id: translationGroupId,
        translations,
        languages,
        total: translations.length,
      };

      // Cache result
      this.cache.set(cacheKey, { data: translationGroup, timestamp: Date.now() });

      return translationGroup;
    } catch (error) {
      logger.error('[UnifiedDocumentService] getTranslations error:', error);
      return null;
    }
  }

  // ========================================================================
  // LANGUAGE & ARCHIVE INFORMATION
  // ========================================================================

  /**
   * Get available languages with document counts
   */
  async getAvailableLanguages(): Promise<LanguageInfo[]> {
    try {
      // Check cache
      const cacheKey = 'languages:all';
      const cached = this.cache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
        return cached.data;
      }

      // Query both schemas for language distribution
      const result = await dbAdapter.query(`
        SELECT
          language,
          COUNT(*) FILTER (WHERE source = 'library') as library_count,
          COUNT(*) FILTER (WHERE source = 'anarchist') as anarchist_count,
          COUNT(*) as total
        FROM (
          SELECT language, 'library' as source FROM library.library_documents
          UNION ALL
          SELECT language, 'anarchist' as source FROM anarchist.documents
        ) combined
        WHERE language IS NOT NULL AND language != ''
        GROUP BY language
        ORDER BY total DESC
      `);

      const languages: LanguageInfo[] = result.rows.map(row => ({
        code: row.language,
        name: this.getLanguageName(row.language),
        document_count: row.total,
        from_library: row.library_count,
        from_anarchist: row.anarchist_count,
      }));

      // Cache result
      this.cache.set(cacheKey, { data: languages, timestamp: Date.now() });

      return languages;
    } catch (error) {
      logger.error('[UnifiedDocumentService] getAvailableLanguages error:', error);
      return [];
    }
  }

  /**
   * Get overall archive statistics
   */
  async getArchiveStats(): Promise<ArchiveStats> {
    try {
      // Check cache
      const cacheKey = 'stats:archive';
      const cached = this.cache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
        return cached.data;
      }

      const languages = await this.getAvailableLanguages();

      // Get document counts
      const countResult = await dbAdapter.query(`
        SELECT
          COUNT(*) FILTER (WHERE source = 'library') as library_total,
          COUNT(*) FILTER (WHERE source = 'anarchist') as anarchist_total,
          COUNT(*) as grand_total
        FROM (
          SELECT 'library' as source FROM library.library_documents WHERE status = 'published'
          UNION ALL
          SELECT 'anarchist' as source FROM anarchist.documents
        ) combined
      `);

      const counts = countResult.rows[0];

      const stats: ArchiveStats = {
        total_documents: counts.grand_total,
        library_documents: counts.library_total,
        anarchist_documents: counts.anarchist_total,
        total_languages: languages.length,
        languages,
        last_updated: new Date().toISOString(),
      };

      // Cache result
      this.cache.set(cacheKey, { data: stats, timestamp: Date.now() });

      return stats;
    } catch (error) {
      logger.error('[UnifiedDocumentService] getArchiveStats error:', error);
      return {
        total_documents: 0,
        library_documents: 0,
        anarchist_documents: 0,
        total_languages: 0,
        languages: [],
        last_updated: new Date().toISOString(),
      };
    }
  }

  /**
   * Increment view count for a document
   */
  async incrementViewCount(id: string | number, source: 'library' | 'anarchist'): Promise<boolean> {
    try {
      const docId = typeof id === 'string' ? parseInt(id, 10) : id;
      if (source === 'library') {
        await libraryService.incrementViewCount(docId);
        return true;
      } else {
        await anarchistService.incrementViewCount(docId);
        return true;
      }
    } catch (error) {
      logger.error('[UnifiedDocumentService] incrementViewCount error:', error);
      return false;
    }
  }

  // ========================================================================
  // UTILITY
  // ========================================================================

  /**
   * Get language name from code
   */
  private getLanguageName(code: string): string {
    const names: Record<string, string> = {
      en: 'English',
      de: 'Deutsch',
      es: 'Español',
      fr: 'Français',
      it: 'Italiano',
      pt: 'Português',
      pl: 'Polski',
      ru: 'Русский',
      nl: 'Nederlands',
      sv: 'Svenska',
      tr: 'Türkçe',
      ja: '日本語',
      zh: '中文',
      el: 'Ελληνικά',
      sea: 'Southeast Asian (Mixed)',
    };
    return names[code] || code;
  }

  /**
   * Clear cache (useful for testing)
   */
  clearCache(): void {
    this.cache.clear();
  }
}

// Export singleton instance
export const unifiedDocumentService = new UnifiedDocumentService();
