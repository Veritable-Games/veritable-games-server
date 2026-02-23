import { notFound, redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/server';
import { wikiPageService, wikiCategoryService } from '@/lib/wiki/services';
import { WikiEditForm } from '@/components/wiki/WikiEditForm';
import { parseWikiSlug } from '@/lib/wiki/utils/slug-parser';
import { logger } from '@/lib/utils/logger';

// Force dynamic rendering for fresh data
export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface WikiEditPageProps {
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
  created_by: number;
  categories?: string[];
  tags?: string[];
}

interface Category {
  id: string;
  name: string;
  description?: string;
}

/**
 * Server-side data fetching - no API route needed
 */
async function getWikiEditData(
  slug: string,
  userRole?: string
): Promise<{
  page: WikiPageData;
  categories: Category[];
} | null> {
  try {
    // Parse slug to separate namespace (e.g., "library/doom-bible" → slug="doom-bible", namespace="library")
    const { slug: actualSlug, namespace } = parseWikiSlug(slug);

    // Fetch page and categories in parallel
    // Pass userRole to get hidden categories for admins/moderators
    const [page, categories] = await Promise.all([
      wikiPageService.getPageBySlug(actualSlug, namespace),
      wikiCategoryService.getAllCategories(userRole),
    ]);

    if (!page) {
      return null;
    }

    return {
      page: page as WikiPageData,
      categories: categories as Category[],
    };
  } catch (error) {
    logger.error('Error fetching wiki edit data', { slug, error });
    return null;
  }
}

/**
 * Wiki Edit Page - Server Component wrapper for instant rendering
 *
 * NOTE: This page ALWAYS requires authentication regardless of maintenance mode,
 * because editing content requires a logged-in user account with proper permissions.
 */
export default async function WikiEditPage({ params }: WikiEditPageProps) {
  const resolvedParams = await params;
  const slug = decodeURIComponent(resolvedParams.slug);

  // Get current user for authentication checks
  const user = await getCurrentUser();

  // Check authentication (ALWAYS required for editing content)
  if (!user) {
    redirect(`/wiki/${slug}`);
  }

  // Check permissions (admin, moderator, or page creator)
  // Pass user role to include hidden categories for admins/moderators
  const data = await getWikiEditData(slug, user.role);

  if (!data) {
    notFound();
  }

  const { page, categories } = data;

  // Check if user can edit this page
  const canEdit = user.role === 'admin' || user.role === 'moderator' || user.id === page.created_by;

  if (!canEdit) {
    redirect(`/wiki/${slug}`);
  }

  return (
    <WikiEditForm
      slug={slug}
      initialData={{
        title: page.title,
        content: page.content,
        category: page.categories?.[0] || '',
        tags: page.tags?.join(', ') || '',
        summary: '',
      }}
      categories={categories}
      userId={user.id}
    />
  );
}
