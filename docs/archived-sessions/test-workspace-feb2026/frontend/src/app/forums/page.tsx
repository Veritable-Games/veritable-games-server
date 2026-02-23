import { forumService } from '@/lib/forums/services/ForumService';
import { forumStatsService } from '@/lib/forums/services/ForumStatsService';
import { dbAdapter } from '@/lib/database/adapter';
import { getCurrentUser } from '@/lib/auth/server';
import ForumsPageClient from '@/components/forums/ForumsPageClient';
import type { ForumSection } from '@/lib/forums/types';
import { logger } from '@/lib/utils/logger';

// Force dynamic rendering - disable Next.js caching for this page
export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function getForumsData() {
  try {
    // Get current user for role-based access control
    const user = await getCurrentUser();
    const isAdmin = user?.role === 'admin' || user?.role === 'moderator';

    // Fetch sections directly from database (Server Component pattern)
    const getSections = async (): Promise<ForumSection[]> => {
      const result = await dbAdapter.query(
        `
        SELECT id, display_name, sort_order, created_at
        FROM forum_sections
        ORDER BY sort_order ASC, id ASC
      `,
        [],
        { schema: 'forums' }
      );
      return result.rows as ForumSection[];
    };

    // Fetch categories, stats, and sections in parallel
    const [categoriesResult, statsResult, sections] = await Promise.all([
      forumService.getAllCategories(),
      forumStatsService.getForumStats(),
      getSections(),
    ]);

    // Extract categories from Result
    const categories = categoriesResult.isOk() ? categoriesResult.value : [];

    // Extract stats from Result
    const stats = statsResult.isOk() ? statsResult.value : null;

    return { categories, stats, sections, isAdmin };
  } catch (error) {
    logger.error('Error loading forums data:', error);
    return {
      categories: [],
      stats: null,
      sections: [],
      isAdmin: false,
    };
  }
}

export default async function ForumsPage() {
  const { categories, stats, sections, isAdmin } = await getForumsData();

  return (
    <ForumsPageClient
      initialCategories={categories}
      initialSections={sections}
      stats={stats}
      isAdmin={isAdmin}
    />
  );
}
