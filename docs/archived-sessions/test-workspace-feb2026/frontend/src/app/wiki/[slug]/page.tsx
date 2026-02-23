import { notFound } from 'next/navigation';
import Link from 'next/link';
import { WikipediaStyleTOC } from '@/components/wiki/TableOfContents';
import { LoginWidget } from '@/components/shared/LoginWidget';
import { getCurrentUser } from '@/lib/auth/server';
import { isMaintenanceModeEnabled } from '@/lib/auth/maintenance';
import { wikiPageService, wikiTagService } from '@/lib/wiki/services';
import { WikiPageClient } from '@/components/wiki/WikiPageClient';
import { WikiPageContentClient } from '@/components/wiki/WikiPageContentClient';
import { parseWikiSlug } from '@/lib/wiki/utils/slug-parser';
import { logger } from '@/lib/utils/logger';

// Force dynamic rendering for fresh data
export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface WikiPageProps {
  params: Promise<{ slug: string }>;
}

interface WikiPageData {
  id: number;
  title: string;
  slug: string;
  content: string;
  content_format: string;
  namespace: string;
  status: string;
  created_at: string;
  updated_at: string;
  created_by: number;
  username?: string;
  display_name?: string;
  categories?: string[];
  category_ids?: string[];
  tags?: Array<{
    id: number;
    name: string;
    color?: string;
  }>;
  total_views?: number;
  infoboxes?: any[];
}

/**
 * Server-side data fetching - no API route needed
 */
async function getWikiPageData(slug: string): Promise<{
  page: WikiPageData;
  allTags: Array<{ id: number; name: string; color?: string }>;
} | null> {
  try {
    // Parse slug to separate namespace (e.g., "library/doom-bible" → slug="doom-bible", namespace="library")
    const { slug: actualSlug, namespace } = parseWikiSlug(slug);

    // Fetch page data directly from service
    const page = await wikiPageService.getPageBySlug(actualSlug, namespace);

    if (!page) {
      return null;
    }

    // Track page view asynchronously (don't block rendering)
    wikiPageService.recordPageView(page.id).catch(err => {
      logger.warn('Failed to record page view', { pageId: page.id, error: err });
    });

    // Fetch all available tags for the editor
    const allTags = await wikiTagService.getAllTags();

    return {
      page: page as WikiPageData,
      allTags: allTags.map(tag => ({
        id: tag.id,
        name: tag.name,
        color: tag.color || undefined,
      })),
    };
  } catch (error) {
    logger.error('Error fetching wiki page', { slug, error });
    return null;
  }
}

/**
 * Wiki Page - Server Component for instant rendering
 */
export default async function WikiPageView({ params }: WikiPageProps) {
  const resolvedParams = await params;
  const slug = decodeURIComponent(resolvedParams.slug);

  const data = await getWikiPageData(slug);

  if (!data) {
    notFound();
  }

  const { page, allTags } = data;

  // Get current user
  const user = await getCurrentUser();

  // Check if authentication is required based on maintenance mode
  const maintenanceModeEnabled = await isMaintenanceModeEnabled();

  if (maintenanceModeEnabled && !user) {
    // Maintenance mode ON + no user → redirect to login
    const { redirect } = await import('next/navigation');
    redirect('/auth/login?redirect=/wiki/' + slug);
  }

  // TypeScript: user might be null if maintenance mode is OFF
  // Wrap in Boolean() to ensure strict boolean type (not boolean | null)
  const canEdit = Boolean(
    user && (user.role === 'admin' || user.role === 'moderator' || user.id === page.created_by)
  );
  const canDelete = Boolean(user && (user.role === 'admin' || user.id === page.created_by));

  return (
    <div className="mx-auto flex h-full max-w-5xl flex-col overflow-hidden px-8 py-6">
      {/* Server-rendered Page Header */}
      <div className="mb-6 flex-shrink-0">
        {/* Breadcrumb */}
        <nav className="mb-4 text-sm text-gray-400" aria-label="Breadcrumb">
          <ol className="flex items-center">
            <li>
              <Link href="/wiki" className="transition-colors hover:text-blue-400">
                Wiki
              </Link>
            </li>
            {page.categories &&
              page.categories.length > 0 &&
              page.category_ids &&
              page.category_ids.length > 0 && (
                <>
                  <li>
                    <span className="mx-2">›</span>
                  </li>
                  <li>
                    <Link
                      href={`/wiki/category/${page.category_ids[0]}`}
                      className="transition-colors hover:text-blue-400"
                    >
                      {page.categories[0]}
                    </Link>
                  </li>
                </>
              )}
            <li>
              <span className="mx-2">›</span>
            </li>
            <li>
              <span className="text-gray-300">{page.title}</span>
            </li>
          </ol>
        </nav>

        {/* Page Title with TOC */}
        <div className="relative">
          <div className="flex items-start justify-between">
            {/* Wikipedia-style TOC positioned on left side as square icon */}
            <WikipediaStyleTOC content={page.content} />

            <div className="ml-4 flex-1">
              <h1 className="mb-0 text-3xl font-bold text-white">{page.title}</h1>
              <div className="flex items-center space-x-4 text-sm text-gray-400">
                {(page.display_name || page.username) && (
                  <span>
                    Created by{' '}
                    <span className="text-blue-400">{page.display_name || page.username}</span>
                  </span>
                )}
                {(page.display_name || page.username) && <span>•</span>}
                <span>Updated {new Date(page.updated_at).toLocaleDateString()}</span>
                {page.total_views && page.total_views > 0 && (
                  <>
                    <span>•</span>
                    <span>{page.total_views} views</span>
                  </>
                )}
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <LoginWidget />
            </div>
          </div>
        </div>
      </div>

      {/* Page Content with Inline Editing */}
      <div
        className="flex-1 overflow-y-auto pr-0 [scrollbar-width:none] md:pr-4 md:[scrollbar-width:auto] [&::-webkit-scrollbar]:hidden md:[&::-webkit-scrollbar]:block"
        data-scroll-container="wiki-content"
      >
        <WikiPageContentClient
          pageSlug={page.namespace === 'main' ? page.slug : `${page.namespace}/${page.slug}`}
          pageId={page.id}
          content={page.content}
          namespace={page.namespace}
          infoboxes={page.infoboxes}
          canEdit={canEdit}
          userId={user?.id}
        />

        {/* Client Component for tags, history, and delete */}
        <WikiPageClient
          pageSlug={page.namespace === 'main' ? page.slug : `${page.namespace}/${page.slug}`}
          pageId={page.id}
          pageTitle={page.title}
          pageCreatedBy={page.created_by}
          initialTags={page.tags || []}
          allTags={allTags}
          canEdit={canEdit}
          canDelete={canDelete}
          userId={user?.id}
          userRole={user?.role}
          createdAt={page.created_at}
          username={page.username}
          displayName={page.display_name}
        />
      </div>
    </div>
  );
}
