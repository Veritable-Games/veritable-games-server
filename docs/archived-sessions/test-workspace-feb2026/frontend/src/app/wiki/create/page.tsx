import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/server';
import { wikiCategoryService } from '@/lib/wiki/services';
import { WikiCreateForm } from '@/components/wiki/WikiCreateForm';
import { logger } from '@/lib/utils/logger';

// Force dynamic rendering for fresh data
export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface Category {
  id: string;
  name: string;
  description?: string;
}

/**
 * Server-side data fetching - no API route needed
 */
async function getCategories(): Promise<Category[]> {
  try {
    const categories = await wikiCategoryService.getAllCategories();
    return categories as Category[];
  } catch (error) {
    logger.error('Error fetching categories', { error });
    return [];
  }
}

/**
 * Wiki Create Page - Server Component wrapper for instant rendering
 *
 * NOTE: This page ALWAYS requires authentication regardless of maintenance mode,
 * because creating content requires a logged-in user account.
 */
export default async function CreateWikiPage() {
  // Get current user for authentication checks
  const user = await getCurrentUser();

  // Check authentication (ALWAYS required for creating content)
  if (!user) {
    redirect('/wiki');
  }

  // Check permissions (admin, moderator, or any authenticated user)
  const canCreate = user.role === 'admin' || user.role === 'moderator' || user.role === 'user';

  if (!canCreate) {
    redirect('/wiki');
  }

  // Fetch categories server-side
  const categories = await getCategories();

  return <WikiCreateForm categories={categories} userId={user.id} username={user.username} />;
}
