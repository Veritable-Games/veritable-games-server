/**
 * Document Pagination Constants
 *
 * Centralized configuration for document pagination across the application.
 * This ensures consistency between server-side rendering, client-side infinite scroll,
 * API limits, and service defaults.
 *
 * Created: November 17, 2025
 * Purpose: Fix hardcoded pagination limits that caused 199-document loading bug
 */

export const DOCUMENT_PAGINATION = {
  /**
   * Server-side rendering initial page size
   * Used by: app/library/page.tsx
   */
  INITIAL_PAGE_SIZE: 200,

  /**
   * Client-side infinite scroll page size
   * Used by: LibraryPageClient.tsx (loadMoreDocuments, loadAllRemainingDocuments)
   */
  INFINITE_SCROLL_PAGE_SIZE: 200,

  /**
   * Maximum limit allowed by API endpoints (safety cap)
   * Used by: app/api/documents/route.ts
   */
  API_MAX_LIMIT: 5000,

  /**
   * Default limit when no limit is specified
   * Used by: lib/documents/service.ts, API routes
   */
  DEFAULT_LIMIT: 50,

  /**
   * Batch size for parallel page fetching (load all remaining documents)
   * Used by: LibraryPageClient.tsx (loadAllRemainingDocuments)
   */
  BATCH_FETCH_SIZE: 10,

  /**
   * Traditional pagination page size
   * Used by: usePaginatedDocuments, DocumentGrid, DocumentList
   */
  TRADITIONAL_PAGE_SIZE: 120,
} as const;

export type DocumentPaginationConfig = typeof DOCUMENT_PAGINATION;
