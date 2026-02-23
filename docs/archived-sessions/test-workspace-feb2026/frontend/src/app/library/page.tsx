import { getCurrentUser } from '@/lib/auth/server';
import { LibraryPageClient } from './LibraryPageClient';
import { LoginWidget } from '@/components/shared/LoginWidget';
import { unifiedDocumentService } from '@/lib/documents/service';
import { libraryService } from '@/lib/library/service';
import { DOCUMENT_PAGINATION } from '@/lib/documents/constants';
import type { UnifiedDocument } from '@/lib/documents/types';
import type { LibraryDocumentWithMetadata } from '@/lib/library/types';
import { logger } from '@/lib/utils/logger';

// Cache for 5 minutes - library is less dynamic than forums/wiki
export const revalidate = 300;

// Note: Using UnifiedDocument type for both library and anarchist documents
// This allows seamless integration of both collections
interface Document extends UnifiedDocument {}

async function getLibraryData(searchParams: { source?: string }) {
  try {
    logger.info('[Library Page] Starting data fetch...');
    const user = await getCurrentUser();
    logger.info('[Library Page] User:', user?.username || 'anonymous');
    logger.info('[Library Page] User role:', user?.role || 'anonymous');

    // Parse source filter from URL (for shareable/bookmarkable filtered views)
    const source = (searchParams.source || 'all') as 'all' | 'library' | 'anarchist';
    logger.info('[Library Page] Source filter:', source);

    // Fetch initial page of documents for infinite scroll
    // Client component will load more pages as user scrolls
    const documentsResult = await unifiedDocumentService.getDocuments({
      page: 1,
      limit: DOCUMENT_PAGINATION.INITIAL_PAGE_SIZE, // Initial load - fast SSR
      language: 'en', // Default to English for initial page load
      source, // Support source filtering from URL
      sort_by: 'title',
      sort_order: 'asc',
      userRole: user?.role, // Pass user role for proper visibility filtering
    });

    // Verify we got valid results
    if (!documentsResult || typeof documentsResult !== 'object') {
      logger.error('[Library Page] Invalid documentsResult:', {
        type: typeof documentsResult,
        value: documentsResult,
      });
      return {
        documents: [],
        tags: [],
        stats: null,
        user: null,
      };
    }

    // Fetch tags for filter sidebar (flat list sorted by usage count)
    // SSR always uses localhost for internal API calls (external URL may not be accessible)
    // Pass userRole param so tags are filtered by document visibility
    const tagUrl = user?.role
      ? `http://localhost:3000/api/library/tags?userRole=${user.role}`
      : 'http://localhost:3000/api/library/tags';
    const tagResponse = await fetch(tagUrl, {
      cache: 'no-store', // Don't cache API calls on server-side
    });
    const tagData = await tagResponse.json();
    const tags = tagData.tags || [];

    logger.info('[Library Page] Documents fetched:', documentsResult.documents?.length || 0);
    logger.info('[Library Page] Tags fetched:', tags?.length || 0);
    logger.info('[Library Page] Source: Unified service (library + anarchist)');
    logger.info('[Library Page] Pagination info:', {
      total: documentsResult.pagination?.total,
      page: documentsResult.pagination?.page,
      limit: documentsResult.pagination?.limit,
    });

    // Filter for public documents if user is not authenticated
    let documents: UnifiedDocument[] = documentsResult.documents || [];
    if (!user) {
      documents = documents.filter(doc => doc.is_public !== false);
    }

    logger.info('[Library Page] Final documents count:', documents.length);

    const pagination = documentsResult.pagination;
    const currentPage = pagination?.page || 1;
    const totalPages = pagination?.total_pages || 1;

    return {
      documents,
      tags,
      stats: {
        total: pagination?.total || 0,
        page: currentPage,
        limit: pagination?.limit || DOCUMENT_PAGINATION.INITIAL_PAGE_SIZE,
        totalPages,
        hasMore: currentPage < totalPages,
      },
      user,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : '';

    logger.error('[Library Page] Error loading library data:', {
      message: errorMessage,
      stack: errorStack,
      timestamp: new Date().toISOString(),
    });

    return {
      documents: [],
      tags: [],
      stats: null,
      user: null,
    };
  }
}

export default async function LibraryPage(props: { searchParams: Promise<{ source?: string }> }) {
  const searchParams = await props.searchParams;
  const { documents, tags, stats, user } = await getLibraryData(searchParams);

  return (
    <div className="mx-auto flex h-full max-w-6xl flex-col overflow-hidden px-6 py-6">
      {/* Header - Server Rendered */}
      <div className="flex-shrink-0">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <svg className="h-6 w-6 text-gray-500" fill="currentColor" viewBox="0 0 24 24">
                <path d="M11.25 4.533A9.707 9.707 0 006 3a9.735 9.735 0 00-3.25.555.75.75 0 00-.5.707v14.25a.75.75 0 001 .707A8.237 8.237 0 016 18.75c1.995 0 3.823.707 5.25 1.886V4.533zM12.75 20.636A8.214 8.214 0 0118 18.75c.966 0 1.89.166 2.75.47a.75.75 0 001-.708V4.262a.75.75 0 00-.5-.707A9.735 9.735 0 0018 3a9.707 9.707 0 00-5.25 1.533v16.103z" />
              </svg>
              <h1 className="text-xl font-bold text-white">Library</h1>
            </div>
            <p className="hidden text-sm text-gray-400 md:block">
              Document collection and research materials
            </p>
          </div>
          <div className="shrink-0">
            <LoginWidget />
          </div>
        </div>
      </div>

      {/* Client Component with Interactive Features (toolbar + content) */}
      <LibraryPageClient
        initialDocuments={documents}
        tags={tags}
        user={user}
        stats={stats || undefined}
      />
    </div>
  );
}
