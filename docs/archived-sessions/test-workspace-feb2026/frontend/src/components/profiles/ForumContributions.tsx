/**
 * Forum Contributions Component
 *
 * Displays a user's forum activity and contributions on their profile page.
 * Shows statistics, recent topics, and recent replies.
 *
 * Features:
 * - Forum activity statistics (topics, replies, solutions)
 * - Recent topics with reply/view counts and solved status
 * - Recent replies with solution badges
 * - Most active category display
 * - Last activity timestamp
 * - React.memo for performance
 *
 * @module components/profiles/ForumContributions
 */

'use client';

import { memo } from 'react';
import Link from 'next/link';
import { ForumUserStats } from '@/types/profile-aggregation';

interface ForumContributionsProps {
  stats: ForumUserStats;
}

/**
 * Displays forum contributions and activity for a user profile
 *
 * Performance: Memoized to prevent unnecessary re-renders
 */
export const ForumContributions = memo<ForumContributionsProps>(({ stats }) => {
  return (
    <div className="rounded-lg border border-gray-700 bg-gray-900/70 p-6">
      <h2 className="mb-4 text-lg font-semibold text-white">Forum Contributions</h2>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Forum Statistics */}
        <div className="space-y-3">
          <h3 className="text-sm font-medium uppercase tracking-wide text-gray-300">Forum Stats</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">Topics Created:</span>
              <span className="font-medium text-blue-400">{stats.totalTopics}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Total Replies:</span>
              <span className="font-medium text-green-400">{stats.totalReplies}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Solutions Provided:</span>
              <span className="font-medium text-yellow-400">{stats.solutionsProvided}</span>
            </div>
            {stats.mostActiveCategory && (
              <div className="flex justify-between">
                <span className="text-gray-400">Most Active In:</span>
                <span className="max-w-[150px] truncate text-gray-200">
                  {stats.mostActiveCategory}
                </span>
              </div>
            )}
            {stats.averageReplyTime !== undefined && (
              <div className="flex justify-between">
                <span className="text-gray-400">Avg. Reply Time:</span>
                <span className="text-gray-200">
                  {stats.averageReplyTime < 60
                    ? `${Math.round(stats.averageReplyTime)}m`
                    : `${Math.round(stats.averageReplyTime / 60)}h`}
                </span>
              </div>
            )}
            {stats.lastForumActivity && (
              <div className="flex justify-between">
                <span className="text-gray-400">Last Activity:</span>
                <span className="text-gray-200">
                  {new Date(stats.lastForumActivity).toLocaleDateString()}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Recent Topics */}
        <div className="space-y-3">
          <h3 className="text-sm font-medium uppercase tracking-wide text-gray-300">
            Forum Activity
          </h3>
          {stats.recentTopics && stats.recentTopics.length > 0 ? (
            <div className="max-h-[280px] space-y-2 overflow-y-auto pr-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-gray-600 [&::-webkit-scrollbar-track]:bg-gray-800 [&::-webkit-scrollbar]:w-2">
              {stats.recentTopics.slice(0, 10).map(topic => (
                <div key={topic.id} className="text-sm">
                  <div className="flex items-start gap-2">
                    <Link
                      href={`/forums/topic/${topic.id}`}
                      className="block flex-1 truncate leading-snug text-blue-400 transition-colors hover:text-blue-300"
                    >
                      {topic.title}
                    </Link>
                    {topic.isSolved && (
                      <svg
                        className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-green-400"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                        aria-label="Solved"
                      >
                        <path
                          fillRule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                          clipRule="evenodd"
                        />
                      </svg>
                    )}
                  </div>
                  <div className="truncate text-xs text-gray-500">
                    {topic.categoryName && <span>{topic.categoryName}</span>}
                    {topic.categoryName && topic.replyCount > 0 && <span className="mx-1">•</span>}
                    {topic.replyCount > 0 && <span>{topic.replyCount} replies</span>}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-gray-400">No topics created yet</div>
          )}
        </div>
      </div>
    </div>
  );
});

ForumContributions.displayName = 'ForumContributions';

export default ForumContributions;
