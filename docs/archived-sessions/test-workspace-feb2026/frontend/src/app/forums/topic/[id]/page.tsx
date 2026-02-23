import { notFound } from 'next/navigation';
import Link from 'next/link';
import { forumServices } from '@/lib/forums/services';
import { forumTagService } from '@/lib/forums/tags';
import { TopicView } from '@/components/forums/TopicView';
import { ReplyList } from '@/components/forums/ReplyList';
import { LoginWidget } from '@/components/forums/LoginWidget';
import type { TopicId, CategoryId } from '@/lib/forums/types';
import { logger } from '@/lib/utils/logger';

// Disable route caching to ensure real-time updates for solutions/replies
export const dynamic = 'force-dynamic';

interface TopicPageProps {
  params: Promise<{
    id: string;
  }>;
}

async function getTopicData(topicId: string) {
  try {
    const numericId = parseInt(topicId);

    if (isNaN(numericId)) {
      return null;
    }

    logger.info(`[getTopicData] Fetching topic ${numericId} at ${new Date().toISOString()}`);

    // Get topic with replies using modern forumServices
    const topicResult = await forumServices.forum.getTopic(numericId as TopicId, true);
    if (topicResult.isErr() || !topicResult.value) {
      return null;
    }
    const topicWithReplies = topicResult.value;

    logger.info(
      `[getTopicData] Topic ${numericId}: status='${topicWithReplies.status ?? 'unknown'}'`
    );
    const solutionCount = topicWithReplies.replies?.filter(r => r.is_solution).length || 0;
    logger.info(`[getTopicData] Topic ${numericId}: ${solutionCount} replies marked as solution`);

    // Log all replies with their is_solution status for debugging
    (topicWithReplies.replies || []).forEach((reply, index) => {
      logger.info(
        `[getTopicData] Reply ${index}: id=${reply.id}, is_solution=${reply.is_solution}, has_nested=${reply.replies?.length || 0}`
      );
      // Log nested replies too
      if (reply.replies && reply.replies.length > 0) {
        (reply.replies || []).forEach((nested, nestedIndex) => {
          logger.info(
            `[getTopicData]   Nested ${index}.${nestedIndex}: id=${nested.id}, is_solution=${nested.is_solution}`
          );
        });
      }
    });

    // Topic data from service - has topic fields plus replies array
    const flattenedTopic = {
      ...topicWithReplies,
      replies: topicWithReplies.replies || [],
    };

    // Get category info using modern forumServices
    const category = await forumServices.category.getCategoryById(
      flattenedTopic.category_id as CategoryId
    );

    // Get topic tags
    const tags = await forumTagService.getTopicTags(numericId);

    return {
      topic: flattenedTopic,
      category,
      tags,
    };
  } catch (error) {
    logger.error('Error loading topic data:', error);
    return null;
  }
}

export default async function TopicPage({ params }: TopicPageProps) {
  const resolvedParams = await params;
  const data = await getTopicData(resolvedParams.id);

  if (!data) {
    notFound();
  }

  const { topic, category, tags } = data;

  return (
    <div className="mx-auto flex h-full max-w-6xl flex-col overflow-hidden px-6 py-6">
      {/* Header */}
      <div className="mb-4 flex-shrink-0">
        {/* Breadcrumb Navigation */}
        <nav className="mb-2 flex items-baseline gap-2 text-xs text-gray-400">
          <Link href="/forums" className="transition-colors hover:text-blue-400">
            Forums
          </Link>
          <span>›</span>
          {category && (
            <>
              <Link
                href={`/forums/category/${category.slug}`}
                className="transition-colors hover:text-blue-400"
              >
                {category.name}
              </Link>
              <span>›</span>
            </>
          )}
          <span className="text-white">{topic.title}</span>
        </nav>

        {/* Topic Header with Login Integration */}
        <div className="flex items-start justify-between">
          <div className="min-w-0 flex-1">
            <h1 className="mb-3 break-words text-2xl font-bold text-white">{topic.title}</h1>
            {/* Stats only - author and date shown in TopicHeader component below */}
            <div className="flex items-center space-x-3 text-xs text-gray-500">
              <span>
                {topic.view_count} {topic.view_count === 1 ? 'view' : 'views'}
              </span>
              <span>•</span>
              <span>
                {topic.reply_count} {topic.reply_count === 1 ? 'reply' : 'replies'}
              </span>
            </div>
          </div>

          {/* Single Login Widget */}
          <div className="ml-4 flex-shrink-0">
            <LoginWidget />
          </div>
        </div>
      </div>

      {/* Scrollable Content Area */}
      <div className="flex-1 overflow-y-auto pr-0 [scrollbar-width:none] md:pr-4 md:[scrollbar-width:auto] [&::-webkit-scrollbar]:hidden md:[&::-webkit-scrollbar]:block">
        <div className="space-y-6">
          {/* Topic Content */}
          <TopicView topic={topic} tags={tags} />

          {/* Replies Section */}
          <div>
            <ReplyList
              replies={topic.replies}
              topicId={topic.id}
              topicTitle={topic.title}
              topicAuthorId={topic.user_id}
              isTopicLocked={topic.is_locked}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
