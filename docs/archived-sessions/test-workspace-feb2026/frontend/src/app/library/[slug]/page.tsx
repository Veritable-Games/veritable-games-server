import { notFound } from 'next/navigation';
import Link from 'next/link';
import { WikipediaStyleTOC } from '@/components/wiki/TableOfContents';
import { LoginWidget } from '@/components/shared/LoginWidget';
import { getCurrentUser } from '@/lib/auth/server';
import { libraryService } from '@/lib/library/service';
import { unifiedDocumentService } from '@/lib/documents/service';
import { LibraryDocumentClient } from '@/components/library/LibraryDocumentClient';
import { LibraryDocumentContentClient } from '@/components/library/LibraryDocumentContentClient';
import { LanguageSwitcher } from '@/components/documents/LanguageSwitcher';
import { SourceBadge } from '@/components/documents/SourceBadge';
import { formatPublishedDate } from '@/lib/utils/date-formatter';
import type { DocumentTranslation } from '@/lib/documents/types';
import type { WikiInfobox } from '@/lib/wiki/types';
import { logger } from '@/lib/utils/logger';

/**
 * Infobox data structure from database/service
 */
interface DocumentInfobox {
  id: number;
  template_id: number;
  position: string;
  data: Record<string, unknown>;
  is_active: boolean;
  [key: string]: unknown;
}

/**
 * Service layer document response (union of library and anarchist fields)
 */
interface ServiceDocumentResponse {
  id: string | number;
  title: string;
  slug: string;
  content?: string | null;
  created_at: string;
  updated_at: string;
  tags?: Array<{ id: number; name: string; color?: string }>;
  view_count?: number | null;
  author?: string | null;
  publication_date?: string | null;
  // Library-specific fields
  created_by?: number | null;
  uploaded_by_username?: string | null;
  uploaded_by_display_name?: string | null;
  category_name?: string | null;
  category_code?: string | null;
  // Anarchist-specific fields
  source?: 'library' | 'anarchist';
  language?: string | null;
  translations?: DocumentTranslation[];
  notes?: string | null;
}

// Force dynamic rendering for fresh data
export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface LibraryPageProps {
  params: Promise<{ slug: string }>;
}

interface LibraryDocumentData {
  id: string | number;
  title: string;
  titleEnglish?: string;
  slug: string;
  content: string;
  content_format: string;
  status?: string;
  created_at: string;
  updated_at: string;
  created_by?: number;
  username?: string;
  display_name?: string;
  categories?: string[];
  category_ids?: string[];
  tags?: Array<{
    id: number;
    name: string;
    color?: string;
  }>;
  view_count?: number;
  infoboxes?: DocumentInfobox[];
  document_author?: string;
  publication_date?: string;
  description?: string;
  abstract?: string;
  source?: 'library' | 'anarchist';
  language?: string;
  translations?: DocumentTranslation[];
}

/**
 * Server-side data fetching - supports both library and anarchist documents
 */
async function getLibraryDocumentData(slug: string): Promise<{
  document: LibraryDocumentData;
  allTags: Array<{ id: number; name: string; color?: string }>;
} | null> {
  try {
    // Try to fetch from unified service (supports both library and anarchist)
    const unifiedDoc = await unifiedDocumentService.getDocumentBySlug(slug);

    // Fallback to library service for backward compatibility
    let document: ServiceDocumentResponse | null =
      unifiedDoc || (await libraryService.getDocumentBySlug(slug));

    if (!document) {
      return null;
    }

    // Track page view asynchronously (don't block rendering)
    const source = document.source || 'library';
    if (source === 'library') {
      libraryService
        .incrementViewCount(
          typeof document.id === 'string' ? parseInt(document.id, 10) : document.id
        )
        .catch(err => {
          logger.error('Failed to record page view:', err);
        });
    } else {
      unifiedDocumentService.incrementViewCount(slug, 'anarchist').catch(err => {
        logger.error('Failed to record page view:', err);
      });
    }

    // Fetch all available tags for the editor
    const allTags = await libraryService.getAllTags();

    // Transform to match frontend expectations
    const documentData: LibraryDocumentData = {
      id: document.id,
      title: document.title,
      slug: document.slug,
      content: document.content || `# ${document.title}\n\n${document.notes || ''}`,
      content_format: 'markdown',
      status: 'published', // All library documents are published by default
      created_at: document.created_at,
      updated_at: document.updated_at,
      created_by: document.created_by ?? undefined,
      username: document.uploaded_by_username || '',
      display_name: document.uploaded_by_display_name || '',
      categories: document.category_name ? [document.category_name] : [],
      category_ids: document.category_code ? [document.category_code] : [],
      tags: document.tags || [],
      view_count: document.view_count ?? undefined,
      document_author: document.author ?? undefined,
      publication_date: document.publication_date ?? undefined,
      description: document.notes ?? undefined,
      abstract: undefined, // Abstract field removed in schema migration
      source: document.source || 'library',
      language: document.language ?? undefined,
      translations: document.translations,
    };

    return {
      document: documentData,
      allTags,
    };
  } catch (error) {
    logger.error('Error fetching library document:', error);
    return null;
  }
}

/**
 * Library Document Page - Server Component for instant rendering
 */
export default async function LibraryDocumentPage({ params }: LibraryPageProps) {
  const resolvedParams = await params;
  const slug = decodeURIComponent(resolvedParams.slug);

  const data = await getLibraryDocumentData(slug);

  if (!data) {
    notFound();
  }

  const { document, allTags } = data;

  // Get current user for authorization checks
  const user = await getCurrentUser();
  const isAuthenticated = !!user;
  const canEdit =
    isAuthenticated &&
    (user.role === 'admin' || user.role === 'moderator' || user.id === document.created_by);
  const canDelete = isAuthenticated && (user.role === 'admin' || user.id === document.created_by);

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-5xl px-8 py-6">
        {/* Server-rendered Document Header */}
        <div className="mb-6 flex-shrink-0">
          {/* Breadcrumb */}
          <nav className="mb-4 text-sm text-gray-400" aria-label="Breadcrumb navigation">
            <ol className="flex items-center">
              <li>
                <Link href="/library" className="transition-colors hover:text-blue-400">
                  Library
                </Link>
              </li>
              <li>
                <span className="mx-2 text-gray-500">›</span>
                <span className="text-white">{document.title}</span>
              </li>
            </ol>
          </nav>

          {/* Page Title with TOC and User Controls */}
          <div className="relative">
            <div className="flex items-start justify-between">
              {/* Wikipedia-style TOC positioned on left side */}
              <WikipediaStyleTOC content={document.content || ''} />

              <div className="ml-4 flex-1">
                <div className="mb-2 flex items-center gap-3">
                  <h1 className="text-3xl font-bold text-white">{document.title}</h1>
                  {document.source && (
                    <SourceBadge source={document.source as 'library' | 'anarchist'} />
                  )}
                </div>

                {/* English subtitle for non-English documents */}
                {document.language && document.language !== 'en' && document.titleEnglish && (
                  <p className="mb-3 text-sm italic text-gray-400">{document.titleEnglish}</p>
                )}

                {/* Document Metadata */}
                <div className="space-y-1">
                  {document.document_author && (
                    <div className="text-sm text-gray-400">
                      By <span className="text-gray-300">{document.document_author}</span>
                    </div>
                  )}
                  <div className="flex items-center space-x-4 text-sm text-gray-400">
                    {(document.publication_date || document.created_at) && (
                      <span>
                        Published{' '}
                        {formatPublishedDate(
                          document.publication_date,
                          document.created_at,
                          'full'
                        )}
                      </span>
                    )}
                    {document.view_count && document.view_count > 0 && (
                      <>
                        <span>•</span>
                        <span>{document.view_count} views</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Language Switcher and User Controls */}
              <div className="flex items-center space-x-2">
                {document.translations && document.translations.length > 1 && (
                  <LanguageSwitcher
                    currentLanguage={document.language || 'en'}
                    currentSlug={slug}
                    translations={document.translations}
                  />
                )}
                <LoginWidget />
              </div>
            </div>
          </div>
        </div>

        {/* Main Content with Inline Editing */}
        <div className="mb-6">
          <LibraryDocumentContentClient
            documentSlug={slug}
            documentId={document.id}
            content={document.content || ''}
            source={document.source}
            infoboxes={document.infoboxes as unknown as WikiInfobox[]}
            canEdit={canEdit}
            userId={user?.id}
          />
        </div>

        {/* Client Component for tags, history, and delete */}
        <LibraryDocumentClient
          documentSlug={slug}
          documentId={document.id}
          documentTitle={document.title}
          documentCreatedBy={document.created_by}
          documentSource={document.source as 'library' | 'anarchist'}
          initialTags={document.tags || []}
          allTags={allTags}
          canEdit={canEdit}
          canDelete={canDelete}
          userId={user?.id}
          userRole={user?.role}
          createdAt={document.created_at}
          updatedAt={document.updated_at}
        />
      </div>
    </div>
  );
}
