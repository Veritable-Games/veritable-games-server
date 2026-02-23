import { WikiService } from '@/lib/wiki/service';
import { WikiCategoryPageClient } from '@/components/wiki/WikiCategoryPageClient';
import { JournalsPageClient } from '../journals/JournalsPageClient';
import { getCurrentUser } from '@/lib/auth/server';
import { isMaintenanceModeEnabled } from '@/lib/auth/maintenance';
import { dbAdapter } from '@/lib/database/adapter';
import Link from 'next/link';
import { UnifiedSearchHeader } from '@/components/ui/SearchResultTable';
import ClientWikiHeader from '@/components/wiki/ClientWikiHeader';
import { logger } from '@/lib/utils/logger';

// Force dynamic rendering for fresh data
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const dynamicParams = true;

// CRITICAL: Disable static generation to force server-side rendering
export async function generateStaticParams() {
  return [];
}

interface CategoryPageProps {
  params: Promise<{
    id: string;
  }>;
}

async function getCategoryData(categoryId: string, userRole?: string) {
  const wikiService = new WikiService();

  try {
    const [category, pages] = await Promise.all([
      wikiService.getCategoryById(categoryId, userRole),
      wikiService.getAllPages(categoryId),
    ]);

    // Get subcategories separately
    let subcategories: any[] = [];
    try {
      const subCats = await wikiService.getSubcategories(categoryId);
      subcategories = Array.isArray(subCats) ? subCats : [];
    } catch (e) {
      logger.warn('Failed to load subcategories', { categoryId, error: e });
      subcategories = [];
    }

    return { category, pages, subcategories };
  } catch (error) {
    logger.error('Failed to load wiki category', {
      categoryId,
      userRole,
      error: error instanceof Error ? error.message : String(error),
    });
    return { category: null, pages: [], subcategories: [] };
  }
}

async function getJournalsData(userId: number, userRole?: string) {
  try {
    // Admin/developer users see ALL journals, regular users see only their own
    const isPrivileged = userRole === 'admin' || userRole === 'developer';

    // Query the journals table (migrated from wiki_pages)
    const query = isPrivileged
      ? `
      SELECT
        j.id,
        j.slug,
        j.title,
        'journals' as namespace,
        j.created_at,
        j.updated_at,
        j.is_deleted,
        j.deleted_by,
        j.deleted_at,
        j.category_id as journal_category_id,
        r.content,
        COALESCE(b.id, 0) as is_bookmarked
      FROM journals j
      LEFT JOIN LATERAL (
        SELECT content
        FROM wiki_revisions
        WHERE page_id = j.id
        ORDER BY id DESC
        LIMIT 1
      ) r ON true
      LEFT JOIN wiki_page_bookmarks b ON j.id = b.page_id AND b.user_id = $1
      WHERE (j.is_deleted = FALSE OR j.is_deleted IS NULL)
      ORDER BY j.updated_at DESC
    `
      : `
      SELECT
        j.id,
        j.slug,
        j.title,
        'journals' as namespace,
        j.created_at,
        j.updated_at,
        j.is_deleted,
        j.deleted_by,
        j.deleted_at,
        j.category_id as journal_category_id,
        r.content,
        COALESCE(b.id, 0) as is_bookmarked
      FROM journals j
      LEFT JOIN LATERAL (
        SELECT content
        FROM wiki_revisions
        WHERE page_id = j.id
        ORDER BY id DESC
        LIMIT 1
      ) r ON true
      LEFT JOIN wiki_page_bookmarks b ON j.id = b.page_id AND b.user_id = $1
      WHERE j.user_id = $2
        AND (j.is_deleted = FALSE OR j.is_deleted IS NULL)
      ORDER BY j.updated_at DESC
    `;

    const params = isPrivileged ? [userId] : [userId, userId];

    const result = await dbAdapter.query(query, params, { schema: 'wiki' });

    logger.info('[getJournalsData] Query result:', {
      userId,
      userRole,
      isPrivileged,
      rowCount: result.rows.length,
      firstRow: result.rows[0] ? { id: result.rows[0].id, title: result.rows[0].title } : null,
    });

    // Ensure we return a plain serializable array (archive fields removed)
    return result.rows.map((j: any) => ({
      id: j.id,
      slug: j.slug,
      title: j.title,
      namespace: j.namespace,
      created_at: j.created_at,
      updated_at: j.updated_at,
      content: j.content || '',
      isBookmarked: j.is_bookmarked > 0,
      is_deleted: j.is_deleted || false,
      deleted_by: j.deleted_by || null,
      deleted_at: j.deleted_at || null,
      journal_category_id: j.journal_category_id || null,
    }));
  } catch (error) {
    logger.error('Error loading journals', { error });
    return [];
  }
}

export default async function CategoryPage({ params }: CategoryPageProps) {
  const { id } = await params;

  // Redirect library category to the main library page
  if (id === 'library') {
    const { redirect } = await import('next/navigation');
    redirect('/library');
  }

  // Special handling for journals category - admin/developer only
  if (id === 'journals') {
    const user = await getCurrentUser();

    // Step 1: Require authentication
    if (!user) {
      const { redirect } = await import('next/navigation');
      redirect('/auth/login?redirect=/wiki/category/journals');
      return; // TypeScript: redirect never returns, but satisfy the compiler
    }

    // Step 2: Require admin/developer role (NEW - Page-level access restriction)
    const { verifyAdminRole } = await import('@/lib/auth/ownership');
    if (!verifyAdminRole(user.role)) {
      const { redirect } = await import('next/navigation');
      redirect('/'); // Redirect non-admin users to homepage
      return; // TypeScript: redirect never returns, but satisfy the compiler
    }

    // User is authenticated and authorized - fetch ALL journals (admin sees all)
    const journals = await getJournalsData(user.id, user.role);

    logger.info('[CategoryPage] Passing journals to client:', {
      userId: user.id,
      userRole: user.role,
      journalCount: journals.length,
      firstJournal: journals[0] ? { id: journals[0].id, title: journals[0].title } : null,
    });

    return <JournalsPageClient journals={journals} />;
  }

  // Get current user
  const user = await getCurrentUser();
  const maintenanceModeEnabled = await isMaintenanceModeEnabled();

  if (maintenanceModeEnabled && !user) {
    // Maintenance mode ON + no user → redirect to login
    const { redirect } = await import('next/navigation');
    redirect('/auth/login?redirect=/wiki/category/' + id);
  }

  // TypeScript: user might be null if maintenance mode is OFF
  const userRole = user?.role || 'guest';

  const { category, pages, subcategories } = await getCategoryData(id, userRole);

  // Category not found - show error page
  if (!category) {
    const notFoundBreadcrumbs = [{ label: 'Wiki', href: '/wiki' }, { label: 'Category Not Found' }];
    const notFoundActionButtons = (
      <Link
        href="/wiki"
        className="flex h-8 items-center rounded border border-gray-600/40 bg-gray-800/40 px-3 text-sm text-gray-300 transition-colors hover:border-gray-500/60 hover:bg-gray-700/60 hover:text-white"
      >
        ← Back
      </Link>
    );

    return (
      <div className="mx-auto flex h-full max-w-6xl flex-col px-6 py-2">
        <UnifiedSearchHeader
          title="Category Not Found"
          description="This category doesn't exist"
          breadcrumbs={notFoundBreadcrumbs}
          searchPlaceholder="Search wiki pages..."
          searchValue=""
          actionButtons={notFoundActionButtons}
          resultCount={0}
          resultType="pages"
          loginWidget={<ClientWikiHeader />}
        />

        <div className="flex-1 overflow-y-auto pr-0 [scrollbar-width:none] md:pr-4 md:[scrollbar-width:auto] [&::-webkit-scrollbar]:hidden md:[&::-webkit-scrollbar]:block">
          <div className="mt-4 rounded border border-gray-700 bg-gray-900/50 p-8 text-center">
            <div className="mb-4 text-gray-300">This category doesn't exist</div>
            <Link href="/wiki" className="text-blue-400 transition-colors hover:text-blue-300">
              ← Back to Wiki
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Category found - use client component for real-time search
  return (
    <WikiCategoryPageClient
      categoryId={category.id}
      categoryName={category.name}
      initialPages={pages}
      subcategories={subcategories}
    />
  );
}
