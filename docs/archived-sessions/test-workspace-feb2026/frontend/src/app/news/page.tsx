import { Metadata } from 'next';
import { dbAdapter } from '@/lib/database/adapter';
import { EditableDescription } from '@/components/ui/EditableDescription';
import { getCurrentUser } from '@/lib/auth/server';
import { NewsArticlesList } from '@/components/news/NewsArticlesList';
import { logger } from '@/lib/utils/logger';

export const metadata: Metadata = {
  title: 'News',
  description: 'Latest news and updates from Veritable Games',
};

interface NewsArticle {
  id: number;
  title: string;
  slug: string;
  summary: string;
  author: string;
  published_at: string;
  featured_image?: string;
  tags?: string;
}

async function getInitialArticles(limit: number = 10): Promise<NewsArticle[]> {
  try {
    const result = await dbAdapter.query(
      `
      SELECT id, title, slug,
             COALESCE(excerpt, '') as summary,
             COALESCE(author, 'Staff') as author,
             published_at, featured_image, tags
      FROM news
      WHERE status = 'published'
      ORDER BY published_at DESC
      LIMIT $1
    `,
      [limit],
      { schema: 'content' }
    );

    return result.rows as NewsArticle[];
  } catch (error) {
    logger.error('Error fetching news articles:', error);
    return [];
  }
}

export default async function NewsPage() {
  const articles = await getInitialArticles(10);
  const user = await getCurrentUser();
  const isAdmin = user?.role === 'admin';

  return (
    <div className="mx-auto flex h-full max-w-5xl flex-col overflow-hidden px-8 py-6">
      <div className="mb-4 flex-shrink-0">
        <h1 className="text-3xl font-bold text-white">Latest News</h1>
        <div className="hidden md:block">
          <EditableDescription
            pageKey="news"
            initialText="Stay up to date with the latest news and developments from Veritable Games."
            className="text-lg text-gray-300"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pr-0 [scrollbar-width:none] md:pr-4 md:[scrollbar-width:auto] [&::-webkit-scrollbar]:hidden md:[&::-webkit-scrollbar]:block">
        {articles.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-gray-400">No news articles available at the moment.</p>
          </div>
        ) : (
          <NewsArticlesList initialArticles={articles} isAdmin={isAdmin} />
        )}
      </div>
    </div>
  );
}
